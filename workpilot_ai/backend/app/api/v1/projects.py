from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.models.user import User
from app.models.project import Project, ProjectMember
from app.models.task import Task, TaskStatus
from app.models.risk import RiskAnalysis
from app.models.audit import AuditEvent
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectMemberAdd
from app.schemas.auth import UserSimple

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch projects where user is manager or member
    projects = db.query(Project).all()
    results = []
    for p in projects:
        # Check access permission
        is_manager = p.manager_id == current_user.id
        is_member = any(m.user_id == current_user.id for m in p.members)
        if not (is_manager or is_member or current_user.role == "ADMIN"):
            continue

        # Compute stats
        total_tasks = len(p.tasks)
        completed_tasks = len([t for t in p.tasks if t.status == TaskStatus.COMPLETED.value])
        pct = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

        latest_risk = db.query(RiskAnalysis).filter(
            RiskAnalysis.project_id == p.id
        ).order_by(RiskAnalysis.created_at.desc()).first()

        p_out = ProjectOut.model_validate(p)
        p_out.task_count = total_tasks
        p_out.completed_task_count = completed_tasks
        p_out.completion_percentage = pct
        p_out.latest_risk_level = latest_risk.risk_level if latest_risk else "LOW"
        results.append(p_out)

    return results


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    project = Project(
        name=data.name,
        description=data.description,
        manager_id=current_user.id,
        start_date=data.start_date,
        target_end_date=data.target_end_date,
        status=data.status or "ACTIVE"
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Automatically add creator as manager member
    pm = ProjectMember(project_id=project.id, user_id=current_user.id, role_in_project="Project Manager")
    db.add(pm)

    # Log audit event
    audit = AuditEvent(
        project_id=project.id,
        actor_id=current_user.id,
        event_type="PROJECT_CREATED",
        description=f"Project '{project.name}' created by {current_user.full_name}.",
        metadata_json={"target_end_date": str(project.target_end_date)}
    )
    db.add(audit)
    db.commit()
    db.refresh(project)

    p_out = ProjectOut.model_validate(project)
    p_out.task_count = 0
    p_out.completed_task_count = 0
    p_out.completion_percentage = 0
    p_out.latest_risk_level = "LOW"
    return p_out


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    is_manager = project.manager_id == current_user.id
    is_member = any(m.user_id == current_user.id for m in project.members)
    if not (is_manager or is_member or current_user.role == "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this project")

    total_tasks = len(project.tasks)
    completed_tasks = len([t for t in project.tasks if t.status == TaskStatus.COMPLETED.value])
    pct = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

    latest_risk = db.query(RiskAnalysis).filter(
        RiskAnalysis.project_id == project.id
    ).order_by(RiskAnalysis.created_at.desc()).first()

    p_out = ProjectOut.model_validate(project)
    p_out.task_count = total_tasks
    p_out.completed_task_count = completed_tasks
    p_out.completion_percentage = pct
    p_out.latest_risk_level = latest_risk.risk_level if latest_risk else "LOW"
    return p_out


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

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

    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
def add_project_member(
    project_id: int,
    data: ProjectMemberAdd,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == data.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a member of this project")

    member = ProjectMember(
        project_id=project_id,
        user_id=data.user_id,
        role_in_project=data.role_in_project
    )
    db.add(member)
    db.commit()
    return {"message": "Member added successfully"}


@router.delete("/{project_id}/members/{user_id}")
def remove_project_member(
    project_id: int,
    user_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in project")

    db.delete(member)
    db.commit()
    return {"message": "Member removed successfully"}


@router.get("/users/all", response_model=List[UserSimple])
def list_all_team_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return [UserSimple.model_validate(u) for u in users]
