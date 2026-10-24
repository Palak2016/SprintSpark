"""Who may see or manage which project.

A user sees a project when, inside their own company, they are:
  * its lead (``projects.manager_id``), or
  * a member through ``project_members``, or
  * the active Company Admin of the project's company.
Sharing a company is not enough on its own. Managing (editing the project,
its members and tasks, recovery decisions) additionally needs the MANAGER
role. The platform-wide ADMIN role keeps its existing full access.
"""

from typing import List

from fastapi import HTTPException, status
from sqlalchemy import and_, false, or_, true
from sqlalchemy.orm import Session, object_session

from app.models.company_access import CompanyAdmin, CompanyAdminStatus
from app.models.project import Project, ProjectMember
from app.models.task import Task
from app.models.user import ManagerApprovalStatus, User, UserRole


def _admin_company_ids(user: User, db: Session | None = None) -> List[int]:
    """Companies this user actively administers (approved accounts only)."""
    db = db or object_session(user)
    if db is None or user.id is None:
        return []
    if user.approval_status != ManagerApprovalStatus.APPROVED.value:
        return []
    rows = (
        db.query(CompanyAdmin.company_id)
        .filter(
            CompanyAdmin.user_id == user.id,
            CompanyAdmin.status == CompanyAdminStatus.ACTIVE.value,
        )
        .all()
    )
    # Only the company the account belongs to counts.
    return [cid for (cid,) in rows if cid == user.company_id]


def visible_projects_clause(user: User, db: Session | None = None):
    """SQL filter on ``Project`` matching exactly what ``can_access_project`` allows."""
    if user.role == UserRole.ADMIN.value:
        return true()
    if user.company_id is None:
        return false()
    if _admin_company_ids(user, db):
        return Project.company_id == user.company_id
    return and_(
        Project.company_id == user.company_id,
        or_(
            Project.manager_id == user.id,
            Project.members.any(ProjectMember.user_id == user.id),
        ),
    )


def can_access_project(user: User, project: Project) -> bool:
    if user.role == UserRole.ADMIN.value:
        return True

    if user.company_id is None or project.company_id != user.company_id:
        return False

    if project.manager_id == user.id:
        return True

    if any(member.user_id == user.id for member in project.members):
        return True

    return project.company_id in _admin_company_ids(user)


def require_project_access(user: User, project: Project) -> None:
    if not can_access_project(user, project):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project.",
        )


def can_manage_project(user: User, project: Project) -> bool:
    if user.role == UserRole.ADMIN.value:
        return True
    return user.role == UserRole.MANAGER.value and can_access_project(user, project)


def require_project_manager(user: User, project: Project) -> None:
    if not can_manage_project(user, project):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a manager on this project can do this.",
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
            detail="You do not have access to this task.",
        )


def require_company_manager(user: User, company_id: int | None) -> None:
    """Company-level manager actions that are not tied to one project (leave review)."""
    if user.role == UserRole.ADMIN.value:
        return
    if (
        user.role != UserRole.MANAGER.value
        or user.company_id is None
        or company_id != user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access is limited to your company.",
        )
