from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.models.user import User
from app.models.project import Project
from app.models.task import Task, TaskDependency, TaskStatus
from app.models.audit import AuditEvent
from app.models.notification import Notification
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskOut, TaskProgressUpdate,
    TaskBlockerReport, TaskDependencyCreate, TaskDependencyOut
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def would_create_cycle(db: Session, task_id: int, new_prereq_id: int) -> bool:
    """Detects if making new_prereq_id a prerequisite of task_id causes a circular cycle."""
    if task_id == new_prereq_id:
        return True

    # Traverse upstream from new_prereq_id
    visited = set()
    stack = [new_prereq_id]

    while stack:
        current = stack.pop()
        if current == task_id:
            return True
        if current in visited:
            continue
        visited.add(current)

        # Get all prerequisites of current
        deps = db.query(TaskDependency).filter(TaskDependency.task_id == current).all()
        for d in deps:
            stack.append(d.prerequisite_task_id)

    return False


@router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if priority:
        query = query.filter(Task.priority == priority)

    tasks = query.order_by(Task.due_date.asc()).all()

    # Enrich dependency info
    task_map = {t.id: t for t in tasks}
    results = []
    for t in tasks:
        t_out = TaskOut.model_validate(t)
        # Format dependencies with titles
        dep_outs = []
        for d in t.dependencies:
            prereq = task_map.get(d.prerequisite_task_id) or db.query(Task).filter(Task.id == d.prerequisite_task_id).first()
            dep_outs.append(TaskDependencyOut(
                id=d.id,
                task_id=d.task_id,
                prerequisite_task_id=d.prerequisite_task_id,
                created_at=d.created_at,
                prerequisite_task_title=prereq.title if prereq else "Unknown Task",
                prerequisite_task_status=prereq.status if prereq else "UNKNOWN"
            ))
        t_out.dependencies = dep_outs
        results.append(t_out)

    return results


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == data.project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    new_task = Task(
        project_id=data.project_id,
        title=data.title,
        description=data.description,
        assignee_id=data.assignee_id,
        priority=data.priority,
        status=data.status,
        estimated_hours=data.estimated_hours,
        start_date=data.start_date,
        due_date=data.due_date
    )
    db.add(new_task)
    db.flush()

    # Handle prerequisite dependencies
    if data.prerequisite_ids:
        for p_id in data.prerequisite_ids:
            if would_create_cycle(db, new_task.id, p_id):
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Circular dependency detected: Task #{p_id} cannot be a prerequisite."
                )
            dep = TaskDependency(task_id=new_task.id, prerequisite_task_id=p_id)
            db.add(dep)

    # Audit event
    audit = AuditEvent(
        project_id=project.id,
        actor_id=current_user.id,
        event_type="TASK_CREATED",
        description=f"Task '{new_task.title}' created by {current_user.full_name}.",
        metadata_json={"task_id": new_task.id, "due_date": str(new_task.due_date)}
    )
    db.add(audit)
    db.commit()
    db.refresh(new_task)
    return TaskOut.model_validate(new_task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskOut.model_validate(task)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.assignee_id is not None:
        task.assignee_id = data.assignee_id
    if data.priority is not None:
        task.priority = data.priority
    if data.status is not None:
        task.status = data.status
        if data.status == TaskStatus.COMPLETED.value:
            task.progress_pct = 100
            task.is_blocked = False
    if data.estimated_hours is not None:
        task.estimated_hours = data.estimated_hours
    if data.actual_hours is not None:
        task.actual_hours = data.actual_hours
    if data.progress_pct is not None:
        task.progress_pct = data.progress_pct
        if task.progress_pct == 100:
            task.status = TaskStatus.COMPLETED.value
            task.is_blocked = False
    if data.start_date is not None:
        task.start_date = data.start_date
    if data.due_date is not None:
        task.due_date = data.due_date
    if data.is_blocked is not None:
        task.is_blocked = data.is_blocked
    if data.blocker_reason is not None:
        task.blocker_reason = data.blocker_reason

    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}


@router.post("/{task_id}/progress", response_model=TaskOut)
def update_task_progress(
    task_id: int,
    data: TaskProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.progress_pct = data.progress_pct
    if data.progress_pct == 100:
        task.status = TaskStatus.COMPLETED.value
        task.is_blocked = False
    elif data.status:
        task.status = data.status

    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/{task_id}/blocker", response_model=TaskOut)
def report_or_resolve_blocker(
    task_id: int,
    data: TaskBlockerReport,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.is_blocked = data.is_blocked
    if data.is_blocked:
        task.status = TaskStatus.BLOCKED.value
        task.blocker_reason = data.blocker_reason or "Unspecified blocker"
        # Notify project manager
        notif = Notification(
            user_id=task.project.manager_id,
            title=f"Blocker Reported on '{task.title}'",
            message=f"{current_user.full_name} reported blocker: {task.blocker_reason}",
            link=f"/manager/tasks"
        )
        db.add(notif)
    else:
        if task.status == TaskStatus.BLOCKED.value:
            task.status = TaskStatus.IN_PROGRESS.value
        task.blocker_reason = None

    # Audit event
    event_type = "BLOCKER_REPORTED" if data.is_blocked else "BLOCKER_RESOLVED"
    audit = AuditEvent(
        project_id=task.project_id,
        actor_id=current_user.id,
        event_type=event_type,
        description=f"{current_user.full_name} {'reported' if data.is_blocked else 'resolved'} blocker on task '{task.title}'.",
        metadata_json={"task_id": task.id, "reason": task.blocker_reason}
    )
    db.add(audit)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/{task_id}/dependencies", response_model=TaskDependencyOut, status_code=status.HTTP_201_CREATED)
def add_task_dependency(
    task_id: int,
    data: TaskDependencyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    prereq = db.query(Task).filter(Task.id == data.prerequisite_task_id).first()
    if not task or not prereq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task or prerequisite task not found")

    if task.project_id != prereq.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tasks must belong to the same project")

    # Cycle check!
    if would_create_cycle(db, task_id, data.prerequisite_task_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Circular dependency error: Task #{data.prerequisite_task_id} ('{prereq.title}') cannot depend on Task #{task_id} ('{task.title}')."
        )

    # Check duplicate
    existing = db.query(TaskDependency).filter(
        TaskDependency.task_id == task_id,
        TaskDependency.prerequisite_task_id == data.prerequisite_task_id
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dependency link already exists")

    dep = TaskDependency(task_id=task_id, prerequisite_task_id=data.prerequisite_task_id)
    db.add(dep)
    db.commit()
    db.refresh(dep)

    return TaskDependencyOut(
        id=dep.id,
        task_id=dep.task_id,
        prerequisite_task_id=dep.prerequisite_task_id,
        created_at=dep.created_at,
        prerequisite_task_title=prereq.title,
        prerequisite_task_status=prereq.status
    )


@router.delete("/{task_id}/dependencies/{prerequisite_id}")
def remove_task_dependency(
    task_id: int,
    prerequisite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dep = db.query(TaskDependency).filter(
        TaskDependency.task_id == task_id,
        TaskDependency.prerequisite_task_id == prerequisite_id
    ).first()
    if not dep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency link not found")

    db.delete(dep)
    db.commit()
    return {"message": "Dependency removed successfully"}
