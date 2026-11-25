
import logging
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import false
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.core.company_access import is_company_admin
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.tenancy import is_manager_role, require_project_manager, require_task_access, visible_projects_clause
from app.models.user import User
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.models.work_log import WorkLog, DailyUpdate
from app.models.notification import Notification
from app.models.recovery import RecoveryProposal
from app.services.llm_client import LLMError
from app.services.progress_estimator import (
    PROMPT_VERSION,
    ProgressAnalysisTokenError,
    create_progress_analysis_token,
    estimate_task_progress,
    verify_progress_analysis_claims,
)
from app.models.risk import (
    DailyUpdateSignal,
    EFFORT_KINDS,
    RiskTrigger,
    SignalKind,
    SignalStatus,
)
from app.models.task import TaskDependency
from app.services.risk_service import project_today, safe_recompute
from app.services.agenda_drift_service import analyze_and_persist_daily_update
from app.services.excel_export import (
    XLSX_MEDIA_TYPE,
    daily_updates_workbook,
    export_filename,
    work_logs_workbook,
)
from app.core.config import settings
from app.models.audit import AuditEvent
from app.schemas.work_log import (
    WorkLogCreate,
    WorkLogOut,
    DailyUpdateCreate,
    DailyUpdateOut,
    DailyUpdateProgressAnalysisRequest,
    DailyUpdateProgressAnalysisOut,
    DailyUpdateSubmissionOut,
    DailyUpdateAgendaDriftOut,
    ExtractedSignalOut,
)

router = APIRouter(tags=["Work Logs & Daily Updates"])
logger = logging.getLogger(__name__)


def _can_view_project_activity(current_user: User, db: Session) -> bool:
    return is_manager_role(current_user) or (
        current_user.company_id is not None
        and is_company_admin(db, current_user, current_user.company_id)
    )


def _visible_work_logs(
    current_user: User,
    db: Session,
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """Work logs this user may see; shared by the list and the Excel export."""
    query = db.query(WorkLog)
    if _can_view_project_activity(current_user, db):
        # Managers see their projects; Company Admins see their company.
        query = query.join(Task, Task.id == WorkLog.task_id).join(
            Project, Project.id == Task.project_id
        ).filter(visible_projects_clause(current_user, db))
    else:
        query = query.filter(WorkLog.user_id == current_user.id)

    if task_id:
        query = query.filter(WorkLog.task_id == task_id)

    if user_id:
        query = query.filter(WorkLog.user_id == user_id)
    if date_from:
        query = query.filter(WorkLog.log_date >= date_from)
    if date_to:
        query = query.filter(WorkLog.log_date <= date_to)
    return query.order_by(
        WorkLog.log_date.desc(),
        WorkLog.created_at.desc(),
    )


def _visible_daily_updates(
    current_user: User,
    db: Session,
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    project_id: Optional[int] = None,
):
    """Daily updates this user may see; shared by the list and the Excel export."""
    query = db.query(DailyUpdate)
    if _can_view_project_activity(current_user, db):
        # Managers see their projects; Company Admins see their company.
        query = query.join(Task, Task.id == DailyUpdate.task_id).join(
            Project, Project.id == Task.project_id
        ).filter(visible_projects_clause(current_user, db))
    else:
        query = query.filter(DailyUpdate.user_id == current_user.id)

    if task_id:
        query = query.filter(DailyUpdate.task_id == task_id)

    if project_id is not None:
        query = query.filter(
            DailyUpdate.task_id.in_(
                db.query(Task.id).filter(Task.project_id == project_id)
            )
        )

    if user_id:
        query = query.filter(DailyUpdate.user_id == user_id)
    if date_from:
        query = query.filter(DailyUpdate.date >= date_from)
    if date_to:
        query = query.filter(DailyUpdate.date <= date_to)
    return query.order_by(
        DailyUpdate.date.desc(),
        DailyUpdate.created_at.desc(),
    )


def _check_range(date_from: Optional[date], date_to: Optional[date]) -> None:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The start date must be on or before the end date.",
        )


def _xlsx_response(content: bytes, kind: str) -> Response:
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": f'attachment; filename="{export_filename(kind, project_today())}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/work-logs", response_model=List[WorkLogOut])
def list_work_logs(
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = _visible_work_logs(current_user, db, task_id, user_id).all()

    return [
        WorkLogOut.model_validate(log)
        for log in logs
    ]


@router.get("/work-logs/export")
def export_work_logs(
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Excel download of the same work logs the list returns for this user."""
    _check_range(date_from, date_to)
    logs = (
        _visible_work_logs(current_user, db, task_id, user_id, date_from, date_to)
        .options(
            joinedload(WorkLog.task).joinedload(Task.project),
            joinedload(WorkLog.user),
        )
        .all()
    )
    return _xlsx_response(work_logs_workbook(logs, settings.RISK_TIMEZONE), "work-logs")


@router.post(
    "/work-logs",
    response_model=WorkLogOut,
    status_code=status.HTTP_201_CREATED,
)
def create_work_log(
    data: WorkLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == data.task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    require_task_access(current_user, task)
    if is_manager_role(current_user):
        require_project_manager(current_user, task.project)
    elif task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only log work for your assigned tasks.",
        )

    if (
        task.assignee_id != current_user.id
        and not (
            current_user.role == "MANAGER"
            and task.project.manager_id == current_user.id
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only log work for your assigned tasks or projects you manage.",
        )

    log = WorkLog(
        task_id=data.task_id,
        user_id=current_user.id,
        hours_spent=data.hours_spent,
        notes=data.notes,
        log_date=data.log_date or date.today(),
    )

    db.add(log)

    # Add the newly logged hours to the task.
    task.actual_hours = (
        (task.actual_hours or 0.0) + data.hours_spent
    )

    # Logging positive hours starts a TODO task.
    # Do not override a blocked or completed task.
    if (
        data.hours_spent > 0
        and not task.is_blocked
        and task.status == TaskStatus.TODO.value
    ):
        task.status = TaskStatus.IN_PROGRESS.value

    manager_id = task.project.manager_id
    if manager_id != current_user.id:
        db.add(
            Notification(
                user_id=manager_id,
                type="WORK_LOG_SUBMITTED",
                title=f"Work Log Submitted: {task.title}",
                message=(
                    f"{current_user.full_name} logged {data.hours_spent:g} "
                    f"hours for '{task.title}'."
                    + (
                        f" Notes: {data.notes.strip()[:300]}"
                        if data.notes and data.notes.strip()
                        else ""
                    )
                ),
                link="/manager/work-logs",
            )
        )

    db.commit()
    db.refresh(log)

    return WorkLogOut.model_validate(log)


@router.get(
    "/daily-updates",
    response_model=List[DailyUpdateOut],
)
def list_daily_updates(
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updates = _visible_daily_updates(
        current_user,
        db,
        task_id=task_id,
        user_id=user_id,
        project_id=project_id,
    ).all()

    return [
        DailyUpdateOut.model_validate(update)
        for update in updates
    ]


@router.get("/daily-updates/export")
def export_daily_updates(
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Excel download of the same daily updates the list returns for this user."""
    _check_range(date_from, date_to)
    updates = (
        _visible_daily_updates(
            current_user,
            db,
            task_id,
            user_id,
            date_from,
            date_to,
            project_id,
        )
        .options(
            joinedload(DailyUpdate.task).joinedload(Task.project),
            joinedload(DailyUpdate.user),
        )
        .all()
    )
    return _xlsx_response(daily_updates_workbook(updates, settings.RISK_TIMEZONE), "daily-updates")


@router.post(
    "/daily-updates/analyze-progress",
    response_model=DailyUpdateProgressAnalysisOut,
)
def analyze_daily_update_progress(
    data: DailyUpdateProgressAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == data.task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    require_task_access(current_user, task)
    if is_manager_role(current_user):
        require_project_manager(current_user, task.project)
    elif task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only analyze progress for tasks assigned to you.",
        )

    current_progress = task.progress_pct or 0
    ai_available = True
    model = None
    if data.manual_progress_pct is not None:
        if data.manual_progress_pct < current_progress:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Manual progress cannot be lower than the task's saved progress.",
            )
        ai_available = False
        progress_pct = data.manual_progress_pct
        explanation = (
            f"Manual progress set to {progress_pct}%. No AI estimate was used; "
            "this value will be saved when you submit the update."
        )
        signals = []
        model = "MANUAL"
    else:
        try:
            estimate = estimate_task_progress(
                task,
                data.update_notes,
            )
        except LLMError as error:
            ai_available = False
            progress_pct = current_progress
            explanation = (
                f"AI progress analysis is unavailable: {error.message} "
                f"Current task progress ({progress_pct}%) will be kept. "
                "You can still submit this update or set progress manually."
            )
            signals = []
            logger.warning(
                "Progress analysis unavailable for task %s (%s): %s",
                task.id,
                error.category,
                error.message,
            )
        else:
            progress_pct, explanation = estimate[0], estimate[1]
            signals = list(getattr(estimate, "signals", []) or [])
            model = getattr(estimate, "model", None)
    return DailyUpdateProgressAnalysisOut(
        progress_pct=progress_pct,
        explanation=explanation,
        analysis_token=create_progress_analysis_token(
            task_id=task.id,
            user_id=current_user.id,
            update_notes=data.update_notes,
            current_progress=current_progress,
            progress_pct=progress_pct,
            signals=signals,
            model=model,
        ),
        signals=[ExtractedSignalOut(**s) for s in signals],
        ai_available=ai_available,
    )


@router.post(
    "/daily-updates",
    response_model=DailyUpdateSubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_daily_update(
    data: DailyUpdateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == data.task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    require_task_access(current_user, task)
    if is_manager_role(current_user):
        require_project_manager(current_user, task.project)
    elif task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit updates for tasks assigned to you.",
        )

    if data.analysis_token:
        try:
            progress_pct, signals, model = verify_progress_analysis_claims(
                token=data.analysis_token,
                task_id=task.id,
                user_id=current_user.id,
                update_notes=data.update_notes,
                current_progress=task.progress_pct or 0,
            )
        except ProgressAnalysisTokenError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This analysis is expired or no longer matches the task or notes. Analyze the update again.",
            ) from error
    else:
        try:
            estimate = estimate_task_progress(
                task,
                data.update_notes,
            )
        except LLMError as error:
            raise _llm_http_error(error) from error
        progress_pct = estimate[0]
        signals = list(getattr(estimate, "signals", []) or [])
        model = getattr(estimate, "model", None)
    progress_pct = max(task.progress_pct or 0, progress_pct)
    rejected = set(data.rejected_signal_indexes)
    kept_signals = [s for s in signals if s.get("index") not in rejected]

    update = DailyUpdate(
        task_id=data.task_id,
        user_id=current_user.id,
        progress_pct=progress_pct,
        is_blocked=data.is_blocked,
        blocker_notes=data.blocker_notes,
        update_notes=data.update_notes,
        date=data.date or date.today(),
    )

    db.add(update)
    db.flush()
    _store_signals(db, update, task, kept_signals, data.is_blocked, model)

    # Synchronize the task's progress with the daily update.
    task.progress_pct = progress_pct

    if progress_pct == 100:
        # Completing the task clears any existing blocker.
        task.status = TaskStatus.COMPLETED.value
        task.is_blocked = False
        task.blocker_reason = None

    elif data.is_blocked:
        # An explicitly blocked task remains blocked.
        task.is_blocked = True
        task.status = TaskStatus.BLOCKED.value

        if data.blocker_notes:
            task.blocker_reason = data.blocker_notes

    elif task.is_blocked or task.status == TaskStatus.BLOCKED.value:
        # An explicit unblocked daily update resolves the blocker.
        task.is_blocked = False
        task.blocker_reason = None

        task.status = (
            TaskStatus.IN_PROGRESS.value
            if progress_pct > 0
            else TaskStatus.TODO.value
        )

    elif progress_pct > 0:
        # Positive progress automatically starts the task.
        task.is_blocked = False
        task.status = TaskStatus.IN_PROGRESS.value

    # Record the update in the audit trail.
    audit = AuditEvent(
        project_id=task.project_id,
        actor_id=current_user.id,
        event_type="DAILY_UPDATE_SUBMITTED",
        description=(
            f"{current_user.full_name} submitted a daily update "
            f"for '{task.title}' "
            f"({progress_pct}% complete)."
        ),
        metadata_json={
            "task_id": task.id,
            "is_blocked": data.is_blocked,
            "signals_kept": len(kept_signals),
            "signals_removed_by_employee": len(signals) - len(kept_signals),
        },
    )

    db.add(audit)
    manager_id = task.project.manager_id
    if manager_id != current_user.id:
        update_summary = (
            f" Progress: {progress_pct}%."
            + (
                f" Update: {data.update_notes.strip()[:300]}"
                if data.update_notes and data.update_notes.strip()
                else ""
            )
            + (
                f" Blocker: {data.blocker_notes.strip()[:300]}"
                if data.is_blocked
                and data.blocker_notes
                and data.blocker_notes.strip()
                else ""
            )
        )
        db.add(
            Notification(
                user_id=manager_id,
                type="DAILY_UPDATE_SUBMITTED",
                title=f"Daily Update: {task.title}",
                message=(
                    f"{current_user.full_name} submitted a daily update "
                    f"for '{task.title}'.{update_summary}"
                ),
                link="/manager/daily-updates",
            )
        )

    # Persist the employee's report before running optional analysis. An
    # agenda-analysis database failure must not roll back the daily update.
    db.commit()
    db.refresh(update)
    response = DailyUpdateSubmissionOut.model_validate(update)
    try:
        safe_recompute(
            db,
            task.project_id,
            RiskTrigger.DAILY_UPDATE.value,
            trigger_ref_id=update.id,
            actor_id=current_user.id,
        )
        drift = analyze_and_persist_daily_update(db, task, update)
        if drift is None:
            db.commit()
            return response.model_copy(update={
                "agenda_drift_note": (
                    "No employee agenda check was created because this update was not "
                    "submitted by the task's current assignee."
                ),
            })

        manager_notified = (
            drift.alignment_status == "OFF_TRACK"
            and drift.confidence_score >= settings.AGENDA_DRIFT_MIN_CONFIDENCE
            and not update.is_blocked
            and task.project.manager_id is not None
            and task.project.manager_id != current_user.id
        )
        recovery_proposal_status = None
        if drift.recovery_proposal_id:
            proposal = db.query(RecoveryProposal).filter(
                RecoveryProposal.id == drift.recovery_proposal_id
            ).first()
            recovery_proposal_status = proposal.status if proposal else None
        db.commit()
        return response.model_copy(update={
            "agenda_drift": DailyUpdateAgendaDriftOut(
                alignment_status=drift.alignment_status,
                alignment_score=drift.alignment_score,
                confidence_score=drift.confidence_score,
                drift_explanation=drift.drift_explanation,
                recommended_actions=drift.recommended_actions or [],
                manager_notified=manager_notified,
                recovery_proposal_id=drift.recovery_proposal_id,
                recovery_proposal_status=recovery_proposal_status,
            ),
        })
    except SQLAlchemyError:
        db.rollback()
        logger.exception(
            "Agenda drift processing failed for saved daily update %s",
            update.id,
        )
        return response.model_copy(update={
            "agenda_drift_note": (
                "Your daily update was saved, but the agenda check could not be stored. "
                "Please ask your manager or administrator to check the server logs."
            ),
        })


def _llm_http_error(error: LLMError) -> HTTPException:
    response_status = (
        status.HTTP_503_SERVICE_UNAVAILABLE
        if error.category != "INVALID_RESPONSE"
        else status.HTTP_502_BAD_GATEWAY
    )
    if error.category == "RATE_LIMITED":
        response_status = status.HTTP_429_TOO_MANY_REQUESTS
    elif error.category == "PAYMENT_REQUIRED":
        response_status = status.HTTP_402_PAYMENT_REQUIRED
    return HTTPException(status_code=response_status, detail=error.message)


def _store_signals(
    db: Session,
    update: DailyUpdate,
    task: Task,
    signals: list,
    explicitly_blocked: bool,
    model: Optional[str],
) -> None:
    """Persist the signals the employee kept.

    Effort signals are confirmed by submitting. Blocker, dependency and scope
    mentions wait for the manager, except when they are already true.
    """
    project_task_ids = {
        row[0] for row in db.query(Task.id).filter(Task.project_id == task.project_id).all()
    }
    for signal in signals:
        kind = signal.get("kind")
        related = signal.get("related_task_id")
        if related is not None and related not in project_task_ids:
            continue  # task removed since the analysis
        if kind in EFFORT_KINDS:
            status_value = SignalStatus.CONFIRMED.value
        elif kind == SignalKind.BLOCKER.value:
            if explicitly_blocked or task.is_blocked:
                continue
            status_value = SignalStatus.PENDING_REVIEW.value
        elif kind == SignalKind.DEPENDENCY.value:
            exists = db.query(TaskDependency).filter(
                TaskDependency.task_id == task.id,
                TaskDependency.prerequisite_task_id == related,
            ).first()
            if exists:
                continue
            status_value = SignalStatus.PENDING_REVIEW.value
        elif kind == SignalKind.SCOPE_CHANGE.value:
            status_value = SignalStatus.PENDING_REVIEW.value
        else:
            continue
        db.add(DailyUpdateSignal(
            daily_update_id=update.id,
            project_id=task.project_id,
            task_id=task.id,
            user_id=update.user_id,
            kind=kind,
            related_task_id=related,
            effort_share=signal.get("effort_share"),
            evidence=str(signal.get("evidence") or "")[:300],
            status=status_value,
            update_date=update.date,
            model=model,
            prompt_version=PROMPT_VERSION,
        ))
