"""Chart data for the manager dashboard, computed from stored records only.

Sources:
* tasks / dependencies / approved leave  -> status mix, deadlines, workload,
  capacity, projected completion (``recovery_scheduler``)
* risk_analyses                          -> risk score history
* daily_updates                          -> reported progress over time

Nothing is estimated to fill gaps. When a series has no underlying data the
response says so (``available: false`` with a reason) and the UI shows an
empty state.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence

from app.services.recovery_scheduler import (
    business_days_between,
    is_blocked,
    is_open,
    member_workload,
    remaining_hours,
    simulate_schedule,
    to_date,
)

MAX_TREND_DAYS = 120
UPCOMING_WINDOW_DAYS = 14


def status_distribution(tasks: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counts = {"TODO": 0, "IN_PROGRESS": 0, "BLOCKED": 0, "COMPLETED": 0}
    for task in tasks:
        if not is_open(task):
            counts["COMPLETED"] += 1
        elif is_blocked(task):
            counts["BLOCKED"] += 1
        elif task.get("status") == "IN_PROGRESS":
            counts["IN_PROGRESS"] += 1
        else:
            counts["TODO"] += 1
    return [{"status": key, "count": value} for key, value in counts.items()]


def deadline_buckets(tasks: Sequence[Dict[str, Any]], today: date) -> Dict[str, Any]:
    overdue, upcoming = [], []
    horizon = today + timedelta(days=UPCOMING_WINDOW_DAYS)
    for task in tasks:
        if not is_open(task):
            continue
        due = to_date(task.get("due_date"))
        if not due:
            continue
        row = {
            "task_id": task["id"],
            "title": task.get("title"),
            "assignee_name": task.get("assignee_name"),
            "due_date": due.isoformat(),
            "days_from_today": (due - today).days,
            "status": task.get("status"),
            "is_blocked": is_blocked(task),
            "priority": task.get("priority"),
        }
        if due < today:
            overdue.append(row)
        elif due <= horizon:
            upcoming.append(row)
    overdue.sort(key=lambda r: r["due_date"])
    upcoming.sort(key=lambda r: r["due_date"])
    return {"window_days": UPCOMING_WINDOW_DAYS, "overdue": overdue, "upcoming": upcoming}


def _planned_fraction(task: Dict[str, Any], day: date) -> float:
    start = to_date(task.get("start_date"))
    due = to_date(task.get("due_date"))
    if not start or not due:
        return 0.0
    if day < start:
        return 0.0
    if day >= due:
        return 1.0
    total = business_days_between(start, due)
    elapsed = business_days_between(start, day)
    return min(1.0, elapsed / total) if total else 1.0


def progress_trend(
    tasks: Sequence[Dict[str, Any]],
    daily_updates: Iterable[Dict[str, Any]],
    project_start: Any,
    today: date,
) -> Dict[str, Any]:
    """Planned versus reported progress, weighted by estimated hours.

    Only tasks with at least one daily update are included, because only
    for those do we know progress on past dates. Planned progress for the
    same tasks assumes even progress across working days from start to due.
    """
    updates_by_task: Dict[int, List[tuple]] = {}
    for update in daily_updates:
        day = to_date(update.get("date"))
        task_id = update.get("task_id")
        if day is None or task_id is None:
            continue
        updates_by_task.setdefault(task_id, []).append((day, int(update.get("progress_pct") or 0)))

    included = [
        t for t in tasks
        if t["id"] in updates_by_task and float(t.get("estimated_hours") or 0) > 0
    ]
    base = {
        "tasks_included": len(included),
        "tasks_total": len(tasks),
        "method": (
            "Weighted by estimated hours. Reported progress is the latest daily "
            "update on or before each date (0% before the first update). Planned "
            "progress assumes even progress over working days between each task's "
            "start and due date. Only tasks with daily updates are included."
        ),
    }
    if not included:
        return {
            **base,
            "available": False,
            "reason": "No daily progress updates have been submitted for tasks with estimates yet.",
            "points": [],
        }

    first_update = min(day for t in included for day, _ in updates_by_task[t["id"]])
    start = min(
        to_date(project_start) or first_update,
        min(to_date(t.get("start_date")) or first_update for t in included),
    )
    start = max(start, today - timedelta(days=MAX_TREND_DAYS))
    total_weight = sum(float(t["estimated_hours"]) for t in included)

    for task_id in updates_by_task:
        updates_by_task[task_id].sort()

    points = []
    day = start
    while day <= today:
        planned = 0.0
        actual = 0.0
        for task in included:
            weight = float(task["estimated_hours"])
            planned += weight * _planned_fraction(task, day)
            reported = 0
            for update_day, pct in updates_by_task[task["id"]]:
                if update_day <= day:
                    reported = pct
                else:
                    break
            actual += weight * reported / 100.0
        points.append({
            "date": day.isoformat(),
            "planned_pct": round(planned / total_weight * 100.0, 1),
            "actual_pct": round(actual / total_weight * 100.0, 1),
        })
        day += timedelta(days=1)

    return {**base, "available": True, "reason": None, "points": points}


def risk_history(analyses: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    rows = [
        {
            "created_at": a["created_at"],
            "score": a["score"],
            "risk_level": a["risk_level"],
        }
        for a in analyses
    ]
    rows.sort(key=lambda r: r["created_at"])
    return {
        "available": bool(rows),
        "reason": None if rows else "No risk analysis has been run for this project yet.",
        "points": rows[-30:],
    }


def compute_project_analytics(
    context: Dict[str, Any],
    leaves: Sequence[Dict[str, Any]],
    daily_updates: Iterable[Dict[str, Any]],
    analyses: Iterable[Dict[str, Any]],
    today: date,
) -> Dict[str, Any]:
    tasks = context.get("tasks", [])
    target = to_date(context.get("target_end_date")) or today
    workload = member_workload(tasks, context.get("members", []), leaves, today, target)
    schedule = simulate_schedule(tasks, leaves, today, target)
    open_tasks = [t for t in tasks if is_open(t)]
    total_estimate = sum(float(t.get("estimated_hours") or 0) for t in tasks)
    done_estimate = sum(
        float(t.get("estimated_hours") or 0) - remaining_hours(t) for t in tasks
    )
    remaining_total = round(sum(remaining_hours(t) for t in open_tasks), 1)
    capacity_total = round(sum(w["capacity_hours"] for w in workload if w["user_id"] is not None), 1)

    return {
        "project_id": context.get("project_id"),
        "project_name": context.get("project_name"),
        "generated_for": today.isoformat(),
        "target_end_date": target.isoformat(),
        "summary": {
            "task_count": len(tasks),
            "open_task_count": len(open_tasks),
            "estimated_hours_total": round(total_estimate, 1),
            "completed_hours_estimate": round(done_estimate, 1),
            "completion_pct": round(done_estimate / total_estimate * 100.0, 1) if total_estimate else None,
            "remaining_hours": remaining_total,
            "capacity_hours_until_target": capacity_total,
            "unestimated_open_tasks": sum(1 for t in open_tasks if not float(t.get("estimated_hours") or 0)),
        },
        "status_distribution": status_distribution(tasks),
        "deadlines": deadline_buckets(tasks, today),
        "workload": {
            "horizon_start": today.isoformat(),
            "horizon_end": target.isoformat(),
            "hours_per_day": schedule["hours_per_day"],
            "members": workload,
        },
        "projection": {
            "projected_completion": schedule["projected_completion"],
            "target_end_date": schedule["target_end_date"],
            "business_days_vs_target": schedule["business_days_vs_target"],
            "feasible": schedule["feasible"],
            "method": schedule["method"],
            "assumptions": schedule["assumptions"],
            "late_task_ids": schedule["late_task_ids"],
        },
        "progress_trend": progress_trend(tasks, daily_updates, context.get("start_date"), today),
        "risk_history": risk_history(analyses),
    }


def portfolio_health(projects: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Latest risk level per project, for the delay-risk distribution chart."""
    counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "INSUFFICIENT_DATA": 0, "NOT_ANALYZED": 0}
    for project in projects:
        level = project.get("risk_level") or "NOT_ANALYZED"
        counts[level if level in counts else "NOT_ANALYZED"] += 1
    return {
        "distribution": [{"risk_level": k, "count": v} for k, v in counts.items()],
        "projects": list(projects),
    }
