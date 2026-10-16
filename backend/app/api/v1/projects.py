
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.core.demo_data import DEMO_USER_EMAILS

from app.models.user import User
from app.models.project import Project, ProjectMember
from app.models.task import Task, TaskStatus
from app.models.risk import RiskAnalysis
from app.models.audit import AuditEvent

from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectMemberAdd,
)
from app.schemas.auth import UserSimple


router = APIRouter(prefix="/projects", tags=["Projects"])


# ---------------------------------------------------------
# LIST PROJECTS
# ---------------------------------------------------------
@router.get("", response_model=List[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = db.query(Project).all()
    results = []

    for project in projects:
        is_manager = project.manager_id == current_user.id
        is_member = any(
            member.user_id == current_user.id
            for member in project.members
        )

        if not (
            is_manager
            or is_member
            or current_user.role == "ADMIN"
        ):
            continue

        total_tasks = len(project.tasks)
        completed_tasks = sum(
            1
            for task in project.tasks
            if task.status == TaskStatus.COMPLETED.value
        )

        percentage = (
            int(completed_tasks / total_tasks * 100)
            if total_tasks > 0
            else 0
        )

        latest_risk = (
            db.query(RiskAnalysis)
            .filter(RiskAnalysis.project_id == project.id)
            .order_by(RiskAnalysis.created_at.desc())
            .first()
        )

        project_out = ProjectOut.model_validate(project)
        project_out.task_count = total_tasks
        project_out.completed_task_count = completed_tasks
        project_out.completion_percentage = percentage
        project_out.latest_risk_level = (
            latest_risk.risk_level if latest_risk else "LOW"
        )

        results.append(project_out)

    return results


# ---------------------------------------------------------
# CREATE PROJECT
# ---------------------------------------------------------
@router.post(
    "",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    project = Project(
        name=data.name,
        description=data.description,
        manager_id=current_user.id,
        start_date=data.start_date,
        target_end_date=data.target_end_date,
        status=data.status or "ACTIVE",
    )

    try:
        db.add(project)
        db.commit()
        db.refresh(project)

        # Add the creator as the project manager member.
        member = ProjectMember(
            project_id=project.id,
            user_id=current_user.id,
            role_in_project="Project Manager",
        )
        db.add(member)

        audit = AuditEvent(
            project_id=project.id,
            actor_id=current_user.id,
            event_type="PROJECT_CREATED",
            description=(
                f"Project '{project.name}' created by "
                f"{current_user.full_name}."
            ),
            metadata_json={
                "target_end_date": str(project.target_end_date)
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(project)

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project.",
        )

    project_out = ProjectOut.model_validate(project)
    project_out.task_count = 0
    project_out.completed_task_count = 0
    project_out.completion_percentage = 0
    project_out.latest_risk_level = "LOW"

    return project_out


# ---------------------------------------------------------
# GET ONE PROJECT
# ---------------------------------------------------------
@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    is_manager = project.manager_id == current_user.id
    is_member = any(
        member.user_id == current_user.id
        for member in project.members
    )

    if not (
        is_manager
        or is_member
        or current_user.role == "ADMIN"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project",
        )

    total_tasks = len(project.tasks)
    completed_tasks = sum(
        1
        for task in project.tasks
        if task.status == TaskStatus.COMPLETED.value
    )

    percentage = (
        int(completed_tasks / total_tasks * 100)
        if total_tasks > 0
        else 0
    )

    latest_risk = (
        db.query(RiskAnalysis)
        .filter(RiskAnalysis.project_id == project.id)
        .order_by(RiskAnalysis.created_at.desc())
        .first()
    )

    project_out = ProjectOut.model_validate(project)
    project_out.task_count = total_tasks
    project_out.completed_task_count = completed_tasks
    project_out.completion_percentage = percentage
    project_out.latest_risk_level = (
        latest_risk.risk_level if latest_risk else "LOW"
    )

    return project_out


# ---------------------------------------------------------
# UPDATE PROJECT
# ---------------------------------------------------------
@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # A manager may update only their own projects.
    if (
        project.manager_id != current_user.id
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot update this project",
        )

    if data.name is not None:
        project.name = data.name

    if data.description is not None:
        project.description = data.description

    if data.start_date is not None:
        project.start_date = data.start_date

    if data.target_end_date is not None:
        project.target_end_date = data.target_end_date

    if data.status is not None:
        project.status = data.status

    try:
        db.commit()
        db.refresh(project)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project.",
        )

    return ProjectOut.model_validate(project)


# ---------------------------------------------------------
# DELETE PROJECT
# ---------------------------------------------------------
@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Only the project's manager or an admin can delete it.
    if (
        project.manager_id != current_user.id
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this project",
        )

    try:
        # Remove known records linked to this project.
        db.query(RiskAnalysis).filter(
            RiskAnalysis.project_id == project_id
        ).delete(synchronize_session=False)

        # This removes audit history for this project too.
        # Retain audit records instead if your policy requires it.
        db.query(AuditEvent).filter(
            AuditEvent.project_id == project_id
        ).delete(synchronize_session=False)

        db.query(Task).filter(
            Task.project_id == project_id
        ).delete(synchronize_session=False)

        db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id
        ).delete(synchronize_session=False)

        db.delete(project)
        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot delete this project because other records "
                "are linked to it. Check related database tables."
            ),
        )

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred while deleting the project.",
        )

    return None


# ---------------------------------------------------------
# ADD PROJECT MEMBER
# ---------------------------------------------------------
@router.post(
    "/{project_id}/members",
    status_code=status.HTTP_201_CREATED,
)
def add_project_member(
    project_id: int,
    data: ProjectMemberAdd,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if (
        project.manager_id != current_user.id
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot manage members of this project",
        )

    existing = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == data.user_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project",
        )

    member = ProjectMember(
        project_id=project_id,
        user_id=data.user_id,
        role_in_project=data.role_in_project,
    )

    try:
        db.add(member)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add project member.",
        )

    return {"message": "Member added successfully"}


# ---------------------------------------------------------
# REMOVE PROJECT MEMBER
# ---------------------------------------------------------
@router.delete("/{project_id}/members/{user_id}")
def remove_project_member(
    project_id: int,
    user_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if (
        project.manager_id != current_user.id
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot manage members of this project",
        )

    member = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
        .first()
    )

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in project",
        )

    try:
        db.delete(member)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove project member.",
        )

    return {"message": "Member removed successfully"}


# ---------------------------------------------------------
# LIST TEAM USERS
# ---------------------------------------------------------
@router.get("/users/all", response_model=List[UserSimple])
def list_all_team_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(~User.email.in_(DEMO_USER_EMAILS))
        .all()
    )

    return [
        UserSimple.model_validate(user)
        for user in users
    ]
