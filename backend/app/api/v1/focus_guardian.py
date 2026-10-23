from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.core.tenancy import require_project_access, require_task_access

from app.models.user import User
from app.models.task import Task
from app.models.project import Project
from app.models.focus_context import FocusContext
from app.models.notification import Notification

from app.schemas.focus_guardian import (
    FocusContextCreate,
    FocusContextOut,
    ProjectFocusContextOut,
)

router = APIRouter(
    prefix="/focus-guardian",
    tags=["Focus Guardian"],
)


@router.get(
    "/projects/{project_id}/contexts",
    response_model=List[ProjectFocusContextOut],
)
def list_project_focus_contexts(
    project_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    require_project_access(current_user, project)

    rows = (
        db.query(FocusContext, Task.title, User.full_name)
        .join(Task, Task.id == FocusContext.task_id)
        .join(User, User.id == FocusContext.user_id)
        .filter(Task.project_id == project_id)
        .order_by(FocusContext.created_at.desc(), FocusContext.id.desc())
        .all()
    )

    return [
        {
            "id": context.id,
            "user_id": context.user_id,
            "task_id": context.task_id,
            "reason": context.reason,
            "context": context.context,
            "created_at": context.created_at,
            "task_title": task_title,
            "employee_name": employee_name,
        }
        for context, task_title, employee_name in rows
    ]


@router.post(
    "/context",
    response_model=FocusContextOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_focus_context(
    payload: FocusContextCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Find the requested task.
    task = (
        db.query(Task)
        .filter(Task.id == payload.task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    require_task_access(current_user, task)
    # Employees can submit context only for their assigned tasks.
    if task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit context for your assigned tasks",
        )

    # Locate the project's responsible manager.
    project = (
        db.query(Project)
        .filter(Project.id == task.project_id)
        .first()
    )

    if project is None or not getattr(project, "manager_id", None):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No manager is assigned to this task's project",
        )

    try:
        # Save employee-provided context.
        focus_context = FocusContext(
            user_id=current_user.id,
            task_id=task.id,
            reason=payload.reason.strip(),
            context=payload.context.strip(),
        )

        db.add(focus_context)
        db.flush()

        # Notify the manager responsible for this project.
        if project.manager_id != current_user.id:
            notification = Notification(
                user_id=project.manager_id,
                type="FOCUS_CONTEXT_SUBMITTED",
                title="New Focus Guardian context",
                message=(
                    f"{current_user.full_name} submitted technical context "
                    f"for task '{task.title}'."
                ),
                is_read=False,
            )
            db.add(notification)

        # Persist the context and notification together.
        db.commit()
        db.refresh(focus_context)

        return focus_context

    except Exception:
        db.rollback()
        raise