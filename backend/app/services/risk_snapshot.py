"""Load the plain-data snapshot the risk engine scores.

This is the only part of risk scoring that touches the database. Everything
it returns is JSON-serialisable so the snapshot can be hashed.
"""

from datetime import date, timedelta
from typing import Any, Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.leave import LeaveRequest, LeaveStatus
from app.models.project import Project, ProjectMember
from app.models.risk import DailyUpdateSignal, EFFORT_KINDS, SignalKind, SignalStatus
from app.models.task import Task, TaskDependency, TaskStatus
from app.models.work_log import DailyUpdate

# Calendar days of daily updates used for an assignee's focus ratio
# (about five working days).
FOCUS_WINDOW_DAYS = 7


def _iso(value: Any) -> Any:
    return value.isoformat() if isinstance(value, date) else value


def build_snapshot(db: Session, project: Project, as_of: date) -> Dict[str, Any]:
    tasks: List[Task] = (
        db.query(Task).filter(Task.project_id == project.id).order_by(Task.id).all()
    )
    task_ids = [t.id for t in tasks]

    prereqs: Dict[int, List[int]] = {}
    last_update: Dict[int, date] = {}
    if task_ids:
        for dep in db.query(TaskDependency).filter(TaskDependency.task_id.in_(task_ids)).all():
            prereqs.setdefault(dep.task_id, []).append(dep.prerequisite_task_id)
        rows = (
            db.query(DailyUpdate.task_id, func.max(DailyUpdate.date))
            .filter(DailyUpdate.task_id.in_(task_ids), DailyUpdate.date <= as_of)
            .group_by(DailyUpdate.task_id)
            .all()
        )
        last_update = {task_id: day for task_id, day in rows if day is not None}

    user_ids = {t.assignee_id for t in tasks if t.assignee_id is not None}
    user_ids |= {
        m.user_id for m in db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
    }

    earliest = min([t.start_date for t in tasks if t.start_date] + [project.start_date or as_of])
    leaves = []
    if user_ids:
        for leave in (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.user_id.in_(sorted(user_ids)),
                LeaveRequest.status == LeaveStatus.APPROVED.value,
                LeaveRequest.end_date >= earliest,
            )
            .all()
        ):
            leaves.append({
                "user_id": leave.user_id,
                "start_date": _iso(leave.start_date),
                "end_date": _iso(leave.end_date),
            })

    snapshot_tasks = []
    for t in tasks:
        blocked = bool(t.is_blocked) or t.status == TaskStatus.BLOCKED.value
        blocked_since = t.blocked_since
        if blocked and blocked_since is None and t.updated_at is not None:
            # Rows blocked before blocked_since existed: best available date.
            blocked_since = t.updated_at.date()
        snapshot_tasks.append({
            "id": t.id,
            "title": t.title,
            "assignee_id": t.assignee_id,
            "status": t.status,
            "estimated_hours": float(t.estimated_hours or 0.0),
            "progress_pct": int(t.progress_pct or 0),
            "start_date": _iso(t.start_date),
            "due_date": _iso(t.due_date),
            "is_blocked": blocked,
            "blocked_since": _iso(blocked_since) if blocked else None,
            "prerequisite_ids": sorted(prereqs.get(t.id, [])),
            "last_update_date": _iso(last_update.get(t.id)),
        })

    return {
        "project": {
            "id": project.id,
            "start_date": _iso(project.start_date),
            "target_end_date": _iso(project.target_end_date),
        },
        "tasks": snapshot_tasks,
        "leaves": leaves,
        "focus": _focus_ratios(db, project.id, as_of),
    }


def _focus_ratios(db: Session, project_id: int, as_of: date) -> Dict[str, float]:
    """Share of each assignee's recently reported effort that was planned work.

    Uses only signals the employee confirmed when submitting. A daily update
    with no effort signals counts as fully planned. Users at 100% are left out
    so the snapshot (and its hash) only changes when drift exists.
    """
    window_start = as_of - timedelta(days=FOCUS_WINDOW_DAYS - 1)
    updates = (
        db.query(DailyUpdate)
        .join(Task, Task.id == DailyUpdate.task_id)
        .filter(
            Task.project_id == project_id,
            DailyUpdate.date >= window_start,
            DailyUpdate.date <= as_of,
        )
        .order_by(DailyUpdate.id)
        .all()
    )
    if not updates:
        return {}

    off_plan: Dict[int, float] = {}
    for signal in (
        db.query(DailyUpdateSignal)
        .filter(
            DailyUpdateSignal.daily_update_id.in_([u.id for u in updates]),
            DailyUpdateSignal.status == SignalStatus.CONFIRMED.value,
            DailyUpdateSignal.kind.in_(sorted(EFFORT_KINDS - {SignalKind.PLANNED.value})),
        )
        .all()
    ):
        off_plan[signal.daily_update_id] = off_plan.get(signal.daily_update_id, 0.0) + float(
            signal.effort_share or 0.0
        )

    per_user: Dict[int, List[float]] = {}
    for update in updates:
        planned = max(0.0, min(1.0, 1.0 - off_plan.get(update.id, 0.0)))
        per_user.setdefault(update.user_id, []).append(planned)

    ratios = {}
    for user_id in sorted(per_user):
        values = per_user[user_id]
        ratio = round(sum(values) / len(values), 4)
        if ratio < 1.0:
            ratios[str(user_id)] = ratio
    return ratios
