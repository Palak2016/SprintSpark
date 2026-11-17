from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.tenancy import require_project_access, require_project_manager
from app.models.audit import AuditEvent
from app.models.project import Project
from app.models.risk import DailyUpdateSignal, RiskAnalysis, RiskConfig, RiskTrigger, SignalKind, SignalStatus
from app.models.task import Task, TaskDependency, TaskStatus
from app.models.user import User
from app.schemas.risk import (
    RiskAnalysisOut,
    RiskConfigIn,
    RiskConfigOut,
    RiskHistoryItem,
    RiskSuggestionOut,
    RiskSuggestionReview,
)
from app.services.risk_scoring import DEFAULT_CONFIG, validate_config
from app.services.risk_service import active_config_record, latest_analysis, recompute_project_risk

router = APIRouter(prefix="/projects", tags=["Risk Intelligence"])
suggestions_router = APIRouter(prefix="/risk-suggestions", tags=["Risk Intelligence"])


def _project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/{project_id}/risk-analysis", response_model=RiskAnalysisOut)
def get_latest_risk_analysis(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = _project_or_404(db, project_id)
    require_project_access(current_user, project)

    analysis = latest_analysis(db, project_id)
    if not analysis:
        analysis = recompute_project_risk(db, project.id, RiskTrigger.INITIAL.value, actor_id=current_user.id)
        db.commit()
        db.refresh(analysis)

    return RiskAnalysisOut.model_validate(analysis)


@router.post("/{project_id}/risk-analysis/run", response_model=RiskAnalysisOut)
def run_project_risk_analysis(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = _project_or_404(db, project_id)
    require_project_access(current_user, project)

    previous = latest_analysis(db, project_id)
    analysis = recompute_project_risk(db, project.id, RiskTrigger.MANUAL.value, actor_id=current_user.id)
    changed = previous is None or analysis.id != previous.id

    db.add(AuditEvent(
        project_id=project.id,
        actor_id=current_user.id,
        event_type="RISK_ANALYSIS_EVALUATED",
        description=(
            f"Deterministic risk analysis evaluated: {analysis.risk_level} "
            f"(Risk Score: {analysis.score}/100)"
            + ("." if changed else "; no change since the last evaluation.")
        ),
        metadata_json={
            "risk_analysis_id": analysis.id,
            "risk_level": analysis.risk_level,
            "score": analysis.score,
            "changed": changed,
            "input_hash": analysis.input_hash,
            "config_version": analysis.config_version,
            "triggered_rules_count": len(analysis.triggered_rules or []),
        }
    ))
    db.commit()
    db.refresh(analysis)

    return RiskAnalysisOut.model_validate(analysis)


@router.get("/{project_id}/risk-history", response_model=List[RiskHistoryItem])
def get_risk_history(
    project_id: int,
    limit: int = Query(30, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _project_or_404(db, project_id)
    require_project_access(current_user, project)
    rows = (
        db.query(RiskAnalysis)
        .filter(RiskAnalysis.project_id == project_id)
        .order_by(RiskAnalysis.created_at.desc(), RiskAnalysis.id.desc())
        .limit(limit)
        .all()
    )
    return [RiskHistoryItem.model_validate(r) for r in rows]


# --------------------------------------------------------------------------
# Scoring configuration (versioned; managers only)
# --------------------------------------------------------------------------

def _config_out(record) -> RiskConfigOut:
    if record is None:
        cfg = validate_config(DEFAULT_CONFIG)
        return RiskConfigOut(
            version=cfg["version"], scope="default", weights=cfg["weights"],
            thresholds=cfg["thresholds"], params=cfg["params"],
        )
    cfg = validate_config({
        "version": record.version, "weights": record.weights,
        "thresholds": record.thresholds, "params": record.params or {},
    })
    return RiskConfigOut(
        version=record.version,
        scope="project" if record.project_id else "company",
        weights=cfg["weights"], thresholds=cfg["thresholds"], params=cfg["params"],
        notes=record.notes, created_at=record.created_at,
    )


@router.get("/{project_id}/risk-config", response_model=RiskConfigOut)
def get_risk_config(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _project_or_404(db, project_id)
    require_project_access(current_user, project)
    return _config_out(active_config_record(db, project))


@router.put("/{project_id}/risk-config", response_model=RiskConfigOut)
def set_risk_config(
    project_id: int,
    data: RiskConfigIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new config version for this project and rescore with it."""
    project = _project_or_404(db, project_id)
    require_project_manager(current_user, project)
    try:
        cfg = validate_config({
            "version": "pending", "weights": data.weights,
            "thresholds": data.thresholds, "params": data.params,
        })
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    record = RiskConfig(
        project_id=project.id,
        company_id=project.company_id,
        weights=cfg["weights"],
        thresholds=cfg["thresholds"],
        params={k: v for k, v in data.params.items()},
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(record)
    db.flush()
    db.add(AuditEvent(
        project_id=project.id,
        actor_id=current_user.id,
        event_type="RISK_CONFIG_CHANGED",
        description=f"Risk scoring configuration {record.version} saved.",
        metadata_json={"config_version": record.version, "weights": cfg["weights"], "thresholds": cfg["thresholds"]},
    ))
    recompute_project_risk(db, project.id, RiskTrigger.CONFIG_CHANGE.value, record.id, current_user.id)
    db.commit()
    db.refresh(record)
    return _config_out(record)


# --------------------------------------------------------------------------
# Suggestions extracted from daily updates (manager review)
# --------------------------------------------------------------------------

def _suggestion_out(signal: DailyUpdateSignal) -> RiskSuggestionOut:
    employee = signal.daily_update.user if signal.daily_update else None
    return RiskSuggestionOut(
        id=signal.id,
        project_id=signal.project_id,
        task_id=signal.task_id,
        task_title=signal.task.title if signal.task else "",
        related_task_id=signal.related_task_id,
        related_task_title=signal.related_task.title if signal.related_task else None,
        user_id=signal.user_id,
        employee_name=employee.full_name if employee else None,
        kind=signal.kind,
        evidence=signal.evidence,
        status=signal.status,
        update_date=signal.update_date,
        created_at=signal.created_at,
    )


@router.get("/{project_id}/risk-suggestions", response_model=List[RiskSuggestionOut])
def list_risk_suggestions(
    project_id: int,
    include_reviewed: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _project_or_404(db, project_id)
    require_project_manager(current_user, project)
    query = db.query(DailyUpdateSignal).filter(
        DailyUpdateSignal.project_id == project_id,
        DailyUpdateSignal.kind.in_([
            SignalKind.BLOCKER.value, SignalKind.DEPENDENCY.value, SignalKind.SCOPE_CHANGE.value,
        ]),
    )
    if not include_reviewed:
        query = query.filter(DailyUpdateSignal.status == SignalStatus.PENDING_REVIEW.value)
    rows = query.order_by(DailyUpdateSignal.created_at.desc(), DailyUpdateSignal.id.desc()).all()
    return [_suggestion_out(r) for r in rows]


@suggestions_router.post("/{signal_id}/review", response_model=RiskSuggestionOut)
def review_risk_suggestion(
    signal_id: int,
    data: RiskSuggestionReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept or reject an AI-extracted suggestion. Only an accepted
    suggestion changes project data, and only in the ways listed here."""
    from app.api.v1.tasks import would_create_cycle

    signal = db.get(DailyUpdateSignal, signal_id)
    if signal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    project = _project_or_404(db, signal.project_id)
    require_project_manager(current_user, project)
    if signal.status != SignalStatus.PENDING_REVIEW.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This suggestion was already reviewed.")

    task = db.get(Task, signal.task_id)
    applied = None
    if data.decision == "ACCEPT":
        if signal.kind == SignalKind.DEPENDENCY.value:
            prereq = db.get(Task, signal.related_task_id) if signal.related_task_id else None
            if prereq is None or task is None or prereq.project_id != task.project_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The prerequisite task no longer exists in this project.",
                )
            exists = db.query(TaskDependency).filter(
                TaskDependency.task_id == task.id,
                TaskDependency.prerequisite_task_id == prereq.id,
            ).first()
            if not exists:
                if would_create_cycle(db, task.id, prereq.id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Adding this dependency would create a cycle with '{prereq.title}'.",
                    )
                db.add(TaskDependency(task_id=task.id, prerequisite_task_id=prereq.id))
            applied = {"dependency_added": {"task_id": task.id, "prerequisite_task_id": prereq.id}}
        elif signal.kind == SignalKind.BLOCKER.value:
            if task is not None and task.status != TaskStatus.COMPLETED.value and not task.is_blocked:
                task.is_blocked = True
                task.status = TaskStatus.BLOCKED.value
                task.blocker_reason = signal.evidence[:1000]
            applied = {"task_blocked": signal.task_id}
        # SCOPE_CHANGE: acknowledged only; the manager edits the estimate on the task.

    signal.status = SignalStatus.ACCEPTED.value if data.decision == "ACCEPT" else SignalStatus.REJECTED.value
    signal.reviewed_by = current_user.id
    signal.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    signal.review_notes = data.notes
    db.add(AuditEvent(
        project_id=project.id,
        actor_id=current_user.id,
        event_type="RISK_SUGGESTION_REVIEWED",
        description=(
            f"{current_user.full_name} {'accepted' if data.decision == 'ACCEPT' else 'rejected'} a "
            f"{signal.kind.lower().replace('_', ' ')} suggestion for '{task.title if task else signal.task_id}'."
        ),
        metadata_json={"signal_id": signal.id, "kind": signal.kind, "decision": data.decision, "applied": applied},
    ))
    if data.decision == "ACCEPT" and applied:
        recompute_project_risk(db, project.id, RiskTrigger.SUGGESTION_REVIEWED.value, signal.id, current_user.id)
    db.commit()
    db.refresh(signal)
    return _suggestion_out(signal)
