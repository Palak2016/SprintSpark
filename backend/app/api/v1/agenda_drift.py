from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.models.agenda_drift import AgendaDrift
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.models.work_log import DailyUpdate
from app.schemas.agenda_drift import (
    AgendaDriftClarification,
    AgendaDriftOut,
    AgendaDriftReview,
)
from app.services.agenda_drift_service import analyze_and_persist_daily_update
from app.services.approval_service import ensure_can_manage_project

router = APIRouter(prefix="/agenda-drift", tags=["Agenda Drift"])


def _with_context(query):
    return query.options(
        joinedload(AgendaDrift.employee),
        joinedload(AgendaDrift.task),
        joinedload(AgendaDrift.daily_update),
    )


def _to_out(drift: AgendaDrift) -> AgendaDriftOut:
    task = drift.task
    update = drift.daily_update
    return AgendaDriftOut(
        id=drift.id,
        employee_id=drift.employee_id,
        employee_name=drift.employee.full_name,
        task_id=drift.task_id,
        task_title=task.title,
        task_priority=task.priority,
        task_due_date=task.due_date.isoformat(),
        project_id=drift.project_id,
        daily_update_id=drift.daily_update_id,
        daily_update_notes=update.update_notes or "",
        progress_pct=update.progress_pct,
        is_blocked=update.is_blocked,
        alignment_status=drift.alignment_status,
        alignment_score=drift.alignment_score,
        confidence_score=drift.confidence_score,
        drift_explanation=drift.drift_explanation,
        detected_mismatches=drift.detected_mismatches or [],
        recommended_actions=drift.recommended_actions or [],
        reported_blockers=drift.reported_blockers,
        employee_clarification=drift.employee_clarification,
        manager_review_status=drift.manager_review_status,
        manager_feedback=drift.manager_feedback,
        recovery_proposal_id=drift.recovery_proposal_id,
        analysis_details=drift.analysis_details or {},
        created_at=drift.created_at,
        updated_at=drift.updated_at,
    )


def _drift_or_404(drift_id: int, db: Session) -> AgendaDrift:
    drift = _with_context(
        db.query(AgendaDrift).filter(AgendaDrift.id == drift_id)
    ).first()
    if drift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agenda drift record not found")
    return drift


@router.get("/my-drift", response_model=List[AgendaDriftOut])
def get_my_drift(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = _with_context(
        db.query(AgendaDrift)
        .filter(AgendaDrift.employee_id == current_user.id)
        .order_by(AgendaDrift.created_at.desc(), AgendaDrift.id.desc())
        .limit(100)
    ).all()
    return [_to_out(record) for record in records]


@router.get("/projects/{project_id}", response_model=List[AgendaDriftOut])
def get_project_drift(
    project_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    ensure_can_manage_project(current_user, project)
    records = _with_context(
        db.query(AgendaDrift)
        .filter(AgendaDrift.project_id == project_id)
        .order_by(AgendaDrift.created_at.desc(), AgendaDrift.id.desc())
        .limit(200)
    ).all()
    return [_to_out(record) for record in records]


@router.patch("/{drift_id}/review", response_model=AgendaDriftOut)
def review_drift(
    drift_id: int,
    data: AgendaDriftReview,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    drift = _drift_or_404(drift_id, db)
    project = db.query(Project).filter(Project.id == drift.project_id).first()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    ensure_can_manage_project(current_user, project)
    drift.manager_review_status = data.decision
    drift.manager_feedback = data.feedback
    db.commit()
    return _to_out(_drift_or_404(drift_id, db))


@router.post("/{drift_id}/clarify", response_model=AgendaDriftOut)
def clarify_drift(
    drift_id: int,
    data: AgendaDriftClarification,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    drift = _drift_or_404(drift_id, db)
    if drift.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add context to your own agenda drift record.",
        )
    task = db.query(Task).filter(Task.id == drift.task_id).first()
    update = db.query(DailyUpdate).filter(DailyUpdate.id == drift.daily_update_id).first()
    if task is None or update is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task update is no longer available")
    drift.employee_clarification = data.clarification.strip()
    analyze_and_persist_daily_update(db, task, update, data.clarification.strip())
    db.commit()
    return _to_out(_drift_or_404(drift_id, db))
