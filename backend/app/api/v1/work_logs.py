
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.task import Task, TaskStatus
from app.models.work_log import WorkLog, DailyUpdate
from app.models.notification import Notification
from app.services.llm_client import LLMError
from app.services.progress_estimator import estimate_task_progress
from app.models.audit import AuditEvent
from app.schemas.work_log import (
    WorkLogCreate,
    WorkLogOut,
    DailyUpdateCreate,
    DailyUpdateOut,
    DailyUpdateProgressAnalysisRequest,
    DailyUpdateProgressAnalysisOut,
)

router = APIRouter(tags=["Work Logs & Daily Updates"])


@router.get("/work-logs", response_model=List[WorkLogOut])
def list_work_logs(
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(WorkLog)

    if task_id:
        query = query.filter(WorkLog.task_id == task_id)

    if user_id:
        query = query.filter(WorkLog.user_id == user_id)
    elif (
        current_user.role not in ("MANAGER", "ADMIN")
        and not task_id
    ):
        query = query.filter(
            WorkLog.user_id == current_user.id
        )

    logs = query.order_by(
        WorkLog.log_date.desc(),
        WorkLog.created_at.desc(),
    ).all()

    return [
        WorkLogOut.model_validate(log)
        for log in logs
    ]


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

    if (
        task.assignee_id != current_user.id
        and not (
            current_user.role in ("MANAGER", "ADMIN")
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
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DailyUpdate)

    if task_id:
        query = query.filter(DailyUpdate.task_id == task_id)

    if user_id:
        query = query.filter(DailyUpdate.user_id == user_id)
    elif (
        current_user.role not in ("MANAGER", "ADMIN")
        and not task_id
    ):
        query = query.filter(
            DailyUpdate.user_id == current_user.id
        )

    updates = query.order_by(
        DailyUpdate.date.desc(),
        DailyUpdate.created_at.desc(),
    ).all()

    return [
        DailyUpdateOut.model_validate(update)
        for update in updates
    ]


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

    if task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only analyze progress for tasks assigned to you.",
        )

    try:
        progress_pct, explanation = estimate_task_progress(
            task,
            data.update_notes,
        )
    except LLMError as error:
        response_status = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if error.category != "INVALID_RESPONSE"
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(
            status_code=response_status,
            detail=error.message,
        ) from error

    return DailyUpdateProgressAnalysisOut(
        progress_pct=progress_pct,
        explanation=explanation,
    )


@router.post(
    "/daily-updates",
    response_model=DailyUpdateOut,
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

    if task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit daily updates for tasks assigned to you.",
        )

    progress_pct = max(task.progress_pct or 0, data.progress_pct)

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

    db.commit()
    db.refresh(update)

    return DailyUpdateOut.model_validate(update)
