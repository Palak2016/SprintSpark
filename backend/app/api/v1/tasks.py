from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.task import Task, TaskDependency, TaskStatus
from app.models.audit import AuditEvent
from app.models.notification import Notification
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskOut,
    TaskProgressUpdate,
    TaskBlockerReport,
    TaskDependencyCreate,
    TaskDependencyOut,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def would_create_cycle(
    db: Session,
    task_id: int,
    new_prereq_id: int,
) -> bool:
    """Check whether adding a dependency would create a circular cycle."""
    if task_id == new_prereq_id:
        return True

    visited = set()
    stack = [new_prereq_id]

    while stack:
        current = stack.pop()

        if current == task_id:
            return True

        if current in visited:
            continue

        visited.add(current)

        dependencies = (
            db.query(TaskDependency)
            .filter(TaskDependency.task_id == current)
            .all()
        )

        for dependency in dependencies:
            stack.append(dependency.prerequisite_task_id)

    return False


@router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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

    task_map = {task.id: task for task in tasks}
    results = []

    for task in tasks:
        task_out = TaskOut.model_validate(task)
        dependency_outputs = []

        for dependency in task.dependencies:
            prerequisite = task_map.get(
                dependency.prerequisite_task_id
            )

            if prerequisite is None:
                prerequisite = (
                    db.query(Task)
                    .filter(
                        Task.id == dependency.prerequisite_task_id
                    )
                    .first()
                )

            dependency_outputs.append(
                TaskDependencyOut(
                    id=dependency.id,
                    task_id=dependency.task_id,
                    prerequisite_task_id=(
                        dependency.prerequisite_task_id
                    ),
                    created_at=dependency.created_at,
                    prerequisite_task_title=(
                        prerequisite.title
                        if prerequisite
                        else "Unknown Task"
                    ),
                    prerequisite_task_status=(
                        prerequisite.status
                        if prerequisite
                        else "UNKNOWN"
                    ),
                )
            )

        task_out.dependencies = dependency_outputs
        results.append(task_out)

    return results


@router.post(
    "",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == data.project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    new_task = Task(
        project_id=data.project_id,
        title=data.title,
        description=data.description,
        assignee_id=data.assignee_id,
        priority=data.priority,
        status=data.status,
        estimated_hours=data.estimated_hours,
        start_date=data.start_date,
        due_date=data.due_date,
    )

    db.add(new_task)
    db.flush()

    if new_task.assignee_id is not None:
        db.add(
            Notification(
                user_id=new_task.assignee_id,
                title=f"Task Assigned: {new_task.title}",
                message=(
                    f"You have been assigned the task '{new_task.title}'."
                ),
                link="/employee/tasks",
            )
        )

    if data.prerequisite_ids:
        for prerequisite_id in data.prerequisite_ids:
            if would_create_cycle(
                db,
                new_task.id,
                prerequisite_id,
            ):
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Circular dependency detected: "
                        f"Task #{prerequisite_id} cannot be "
                        "a prerequisite."
                    ),
                )

            dependency = TaskDependency(
                task_id=new_task.id,
                prerequisite_task_id=prerequisite_id,
            )
            db.add(dependency)

    audit = AuditEvent(
        project_id=project.id,
        actor_id=current_user.id,
        event_type="TASK_CREATED",
        description=(
            f"Task '{new_task.title}' created by "
            f"{current_user.full_name}."
        ),
        metadata_json={
            "task_id": new_task.id,
            "due_date": str(new_task.due_date),
        },
    )

    db.add(audit)
    db.commit()
    db.refresh(new_task)

    return TaskOut.model_validate(new_task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return TaskOut.model_validate(task)


def _validate_schedule_change(task: Task, data: TaskUpdate, user: User, db: Session) -> None:
    """Checks a start/due date change before it is saved.

    Used by the task editor and the timeline. Only managers and admins may
    move dates. The new dates must be ordered, and the change must keep
    dependency order (a prerequisite may not be due after a task that
    depends on it); conflicting tasks are listed in the error.
    """
    new_start = data.start_date or task.start_date
    new_due = data.due_date or task.due_date
    if new_start == task.start_date and new_due == task.due_date:
        return

    if user.role not in (UserRole.MANAGER.value, UserRole.ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can change task dates.",
        )
    if new_due < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before the start date.",
        )

    conflicts = []
    for dependency in task.dependencies:
        prerequisite = dependency.prerequisite_task
        if prerequisite and prerequisite.due_date > new_due:
            conflicts.append({
                "task_id": prerequisite.id,
                "title": prerequisite.title,
                "relation": "prerequisite",
                "due_date": prerequisite.due_date.isoformat(),
            })
    for dependency in task.dependents:
        dependent = dependency.task
        if (
            dependent
            and dependent.status != TaskStatus.COMPLETED.value
            and dependent.due_date < new_due
        ):
            conflicts.append({
                "task_id": dependent.id,
                "title": dependent.title,
                "relation": "dependent",
                "due_date": dependent.due_date.isoformat(),
            })
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "This date change breaks dependency order. A prerequisite "
                    "must be due on or before the tasks that depend on it."
                ),
                "conflicts": conflicts,
            },
        )


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    previous_assignee_id = task.assignee_id

    if data.start_date is not None or data.due_date is not None:
        _validate_schedule_change(task, data, current_user, db)

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
            task.blocker_reason = None

        elif data.status == TaskStatus.BLOCKED.value:
            task.is_blocked = True

        elif data.status == TaskStatus.IN_PROGRESS.value:
            # Do not allow a status edit to silently clear a blocker.
            if task.is_blocked:
                task.status = TaskStatus.BLOCKED.value

    if data.estimated_hours is not None:
        task.estimated_hours = data.estimated_hours

    if data.actual_hours is not None:
        task.actual_hours = data.actual_hours

    if data.progress_pct is not None:
        task.progress_pct = data.progress_pct

        if data.progress_pct == 100:
            task.status = TaskStatus.COMPLETED.value
            task.is_blocked = False
            task.blocker_reason = None

        elif task.is_blocked:
            task.status = TaskStatus.BLOCKED.value

        elif data.progress_pct > 0:
            task.status = TaskStatus.IN_PROGRESS.value

    if data.start_date is not None:
        task.start_date = data.start_date

    if data.due_date is not None:
        task.due_date = data.due_date

    if data.is_blocked is not None:
        task.is_blocked = data.is_blocked

        if data.is_blocked:
            task.status = TaskStatus.BLOCKED.value

        else:
            task.blocker_reason = None

            if task.status == TaskStatus.BLOCKED.value:
                task.status = (
                    TaskStatus.IN_PROGRESS.value
                    if task.progress_pct > 0
                    else TaskStatus.TODO.value
                )

    if data.blocker_reason is not None:
        task.blocker_reason = data.blocker_reason

    if (
        task.assignee_id is not None
        and task.assignee_id != previous_assignee_id
    ):
        db.add(
            Notification(
                user_id=task.assignee_id,
                title=f"Task Assigned: {task.title}",
                message=(
                    f"You have been assigned the task '{task.title}'."
                ),
                link="/employee/tasks",
            )
        )

    db.commit()
    db.refresh(task)

    return TaskOut.model_validate(task)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return {"message": "Task deleted successfully"}


@router.post("/{task_id}/progress", response_model=TaskOut)
def update_task_progress(
    task_id: int,
    data: TaskProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    task.progress_pct = data.progress_pct

    if data.progress_pct == 100:
        # Completing the task also resolves its blocker.
        task.status = TaskStatus.COMPLETED.value
        task.is_blocked = False
        task.blocker_reason = None

    elif task.is_blocked or task.status == TaskStatus.BLOCKED.value:
        # A progress update must not silently resolve a blocker.
        task.status = TaskStatus.BLOCKED.value

    elif data.progress_pct > 0:
        # Positive progress means the task has been started.
        task.status = TaskStatus.IN_PROGRESS.value

    elif data.status:
        task.status = data.status

        if task.status == TaskStatus.COMPLETED.value:
            task.progress_pct = 100
            task.is_blocked = False
            task.blocker_reason = None

        elif task.status == TaskStatus.BLOCKED.value:
            task.is_blocked = True

    db.commit()
    db.refresh(task)

    return TaskOut.model_validate(task)


@router.post("/{task_id}/blocker", response_model=TaskOut)
def report_or_resolve_blocker(
    task_id: int,
    data: TaskBlockerReport,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    task.is_blocked = data.is_blocked

    if data.is_blocked:
        task.status = TaskStatus.BLOCKED.value
        task.blocker_reason = (
            data.blocker_reason or "Unspecified blocker"
        )

        notification = Notification(
            user_id=task.project.manager_id,
            title=f"Blocker Reported on '{task.title}'",
            message=(
                f"{current_user.full_name} reported blocker: "
                f"{task.blocker_reason}"
            ),
            link="/manager/tasks",
        )

        db.add(notification)

    else:
        task.blocker_reason = None

        if task.status == TaskStatus.BLOCKED.value:
            task.status = (
                TaskStatus.IN_PROGRESS.value
                if task.progress_pct > 0
                else TaskStatus.TODO.value
            )

    event_type = (
        "BLOCKER_REPORTED"
        if data.is_blocked
        else "BLOCKER_RESOLVED"
    )

    audit = AuditEvent(
        project_id=task.project_id,
        actor_id=current_user.id,
        event_type=event_type,
        description=(
            f"{current_user.full_name} "
            f"{'reported' if data.is_blocked else 'resolved'} "
            f"blocker on task '{task.title}'."
        ),
        metadata_json={
            "task_id": task.id,
            "reason": task.blocker_reason,
        },
    )

    db.add(audit)
    db.commit()
    db.refresh(task)

    return TaskOut.model_validate(task)


@router.post(
    "/{task_id}/dependencies",
    response_model=TaskDependencyOut,
    status_code=status.HTTP_201_CREATED,
)
def add_task_dependency(
    task_id: int,
    data: TaskDependencyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    prerequisite = (
        db.query(Task)
        .filter(Task.id == data.prerequisite_task_id)
        .first()
    )

    if not task or not prerequisite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task or prerequisite task not found",
        )

    if task.project_id != prerequisite.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tasks must belong to the same project",
        )

    if would_create_cycle(
        db,
        task_id,
        data.prerequisite_task_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Circular dependency error: "
                f"Task #{data.prerequisite_task_id} "
                f"('{prerequisite.title}') cannot depend on "
                f"Task #{task_id} ('{task.title}')."
            ),
        )

    existing = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.task_id == task_id,
            TaskDependency.prerequisite_task_id
            == data.prerequisite_task_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dependency link already exists",
        )

    dependency = TaskDependency(
        task_id=task_id,
        prerequisite_task_id=data.prerequisite_task_id,
    )

    db.add(dependency)
    db.commit()
    db.refresh(dependency)

    return TaskDependencyOut(
        id=dependency.id,
        task_id=dependency.task_id,
        prerequisite_task_id=dependency.prerequisite_task_id,
        created_at=dependency.created_at,
        prerequisite_task_title=prerequisite.title,
        prerequisite_task_status=prerequisite.status,
    )


@router.delete("/{task_id}/dependencies/{prerequisite_id}")
def remove_task_dependency(
    task_id: int,
    prerequisite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dependency = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.task_id == task_id,
            TaskDependency.prerequisite_task_id == prerequisite_id,
        )
        .first()
    )

    if not dependency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dependency link not found",
        )

    db.delete(dependency)
    db.commit()

    return {"message": "Dependency removed successfully"}