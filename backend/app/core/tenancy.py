from fastapi import HTTPException, status

from app.models.project import Project
from app.models.task import Task
from app.models.user import User, UserRole


def can_access_project(user: User, project: Project) -> bool:
    if user.role == UserRole.ADMIN.value:
        return True

    if user.company_id is None or project.company_id != user.company_id:
        return False

    if user.role == UserRole.MANAGER.value:
        return True

    return any(member.user_id == user.id for member in project.members)


def require_project_access(user: User, project: Project) -> None:
    if not can_access_project(user, project):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this company project.",
        )


def can_access_task(user: User, task: Task) -> bool:
    if can_access_project(user, task.project):
        return True
    return (
        user.role == UserRole.EMPLOYEE.value
        and task.assignee_id == user.id
        and user.company_id is not None
        and task.project.company_id == user.company_id
    )


def require_task_access(user: User, task: Task) -> None:
    if not can_access_task(user, task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this company task.",
        )


def require_company_manager(user: User, company_id: int | None) -> None:
    if user.role == UserRole.ADMIN.value:
        return
    if (
        user.role != UserRole.MANAGER.value
        or user.company_id is None
        or company_id != user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access is limited to projects in your company.",
        )
