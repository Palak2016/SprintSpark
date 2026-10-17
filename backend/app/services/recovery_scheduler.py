"""Deterministic schedule, capacity and feasibility analysis.

Everything in this module is plain Python over dictionaries so it can be
unit-tested without a database and reused by:

* the recovery workflow (facts given to the LLM, and the before/after
  comparison of every proposed strategy),
* the proposal validator and the approval re-check,
* the project analytics endpoint.

Nothing here calls a language model. Every number it produces comes from
task, dependency and approved-leave data plus the documented assumptions
below.
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

# Documented planning assumptions. They are returned with every simulation
# so the UI can show how an estimate was produced.
FOCUS_HOURS_PER_DAY = 6.0
BLOCKER_RESOLUTION_BUSINESS_DAYS = 2
PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

SCHEDULE_METHOD = (
    "Forward-pass list scheduling over business days (Mon-Fri). Each open "
    "task needs its remaining estimated hours "
    "(estimated_hours x (100 - progress) / 100) at "
    f"{FOCUS_HOURS_PER_DAY:g} focus hours per day. A task starts no earlier "
    "than its planned start date, today, and the working day after all its "
    "prerequisites finish. One person works on one task at a time; tasks are "
    "taken in order of earliest possible start, then priority, then due "
    "date. Approved leave days are skipped for the assignee."
)

SCHEDULE_ASSUMPTIONS = [
    f"Each person contributes {FOCUS_HOURS_PER_DAY:g} focused hours per working day.",
    "Remaining effort is estimated hours scaled by reported progress.",
    (
        "A blocked task cannot restart until its blocker is resolved; this is "
        f"assumed to take {BLOCKER_RESOLUTION_BUSINESS_DAYS} working days."
    ),
    "Weekends and approved leave are non-working days; public holidays are not modelled.",
    "Unassigned tasks are scheduled as if someone is available to start them.",
]


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def to_date(value: Any) -> Optional[date]:
    if value is None or value == "" or value == "None":
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def is_business_day(day: date) -> bool:
    return day.weekday() < 5


def next_business_day(day: date) -> date:
    while not is_business_day(day):
        day += timedelta(days=1)
    return day


def add_business_days(day: date, count: int) -> date:
    current = day
    added = 0
    while added < count:
        current += timedelta(days=1)
        if is_business_day(current):
            added += 1
    return current


def business_days_between(start: date, end: date) -> int:
    """Number of business days in the inclusive range [start, end]."""
    if end < start:
        return 0
    days = 0
    current = start
    while current <= end:
        if is_business_day(current):
            days += 1
        current += timedelta(days=1)
    return days


def signed_business_day_gap(earlier: date, later: date) -> int:
    """Business days from ``earlier`` to ``later``; negative when reversed."""
    if later == earlier:
        return 0
    if later > earlier:
        return business_days_between(earlier + timedelta(days=1), later)
    return -business_days_between(later + timedelta(days=1), earlier)


def leave_days_by_user(leaves: Iterable[Dict[str, Any]]) -> Dict[int, Set[date]]:
    days: Dict[int, Set[date]] = {}
    for leave in leaves:
        start = to_date(leave.get("start_date"))
        end = to_date(leave.get("end_date"))
        user_id = leave.get("user_id")
        if not start or not end or user_id is None:
            continue
        bucket = days.setdefault(int(user_id), set())
        current = start
        while current <= end:
            bucket.add(current)
            current += timedelta(days=1)
    return days


# ---------------------------------------------------------------------------
# Work and capacity
# ---------------------------------------------------------------------------

def is_open(task: Dict[str, Any]) -> bool:
    return task.get("status") != "COMPLETED"


def is_blocked(task: Dict[str, Any]) -> bool:
    return bool(task.get("is_blocked")) or task.get("status") == "BLOCKED"


def remaining_hours(task: Dict[str, Any]) -> float:
    if not is_open(task):
        return 0.0
    estimate = float(task.get("estimated_hours") or 0.0)
    progress = min(100, max(0, int(task.get("progress_pct") or 0)))
    return round(estimate * (100 - progress) / 100.0, 2)


def capacity_hours(
    user_id: Optional[int],
    start: date,
    end: date,
    leave_days: Dict[int, Set[date]],
    hours_per_day: float = FOCUS_HOURS_PER_DAY,
) -> float:
    if end < start:
        return 0.0
    off = leave_days.get(int(user_id), set()) if user_id is not None else set()
    working = 0
    current = start
    while current <= end:
        if is_business_day(current) and current not in off:
            working += 1
        current += timedelta(days=1)
    return round(working * hours_per_day, 2)


def member_workload(
    tasks: Sequence[Dict[str, Any]],
    members: Sequence[Dict[str, Any]],
    leaves: Sequence[Dict[str, Any]],
    today: date,
    horizon_end: date,
    hours_per_day: float = FOCUS_HOURS_PER_DAY,
) -> List[Dict[str, Any]]:
    """Remaining committed hours versus available hours until ``horizon_end``."""
    leave_days = leave_days_by_user(leaves)
    horizon_start = today
    horizon_end = max(horizon_end, today)
    rows: List[Dict[str, Any]] = []
    seen: Set[int] = set()

    for member in members:
        user_id = member.get("user_id")
        if user_id is None or user_id in seen:
            continue
        seen.add(user_id)
        assigned = [
            t for t in tasks if t.get("assignee_id") == user_id and is_open(t)
        ]
        # A project manager who carries no tasks is not delivery capacity.
        if member.get("role") == "Project Manager" and not assigned:
            continue
        remaining = round(sum(remaining_hours(t) for t in assigned), 2)
        available = capacity_hours(
            user_id, horizon_start, horizon_end, leave_days, hours_per_day
        )
        leave_in_window = sorted(
            d.isoformat()
            for d in leave_days.get(int(user_id), set())
            if horizon_start <= d <= horizon_end and is_business_day(d)
        )
        rows.append({
            "user_id": user_id,
            "name": member.get("name") or f"User {user_id}",
            "role": member.get("role"),
            "open_task_count": len(assigned),
            "remaining_hours": remaining,
            "capacity_hours": available,
            "utilization_pct": (
                round(remaining / available * 100.0, 1) if available > 0 else None
            ),
            "over_capacity": remaining > available,
            "leave_business_days": len(leave_in_window),
        })

    unassigned = [t for t in tasks if t.get("assignee_id") is None and is_open(t)]
    if unassigned:
        rows.append({
            "user_id": None,
            "name": "Unassigned",
            "role": None,
            "open_task_count": len(unassigned),
            "remaining_hours": round(sum(remaining_hours(t) for t in unassigned), 2),
            "capacity_hours": 0.0,
            "utilization_pct": None,
            "over_capacity": False,
            "leave_business_days": 0,
        })
    return rows


# ---------------------------------------------------------------------------
# Plan overrides
# ---------------------------------------------------------------------------

def apply_actions_to_tasks(
    tasks: Sequence[Dict[str, Any]],
    actions: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Return copies of ``tasks`` with schedule-relevant actions applied.

    Only actions that change data the scheduler models are applied:
    REASSIGN, EXTEND_DEADLINE, RESCHEDULE and REPRIORITIZE. Escalations
    and advisory actions do not change the simulated schedule because their
    effect on delivery time cannot be measured from project data.
    """
    by_id = {t["id"]: dict(t) for t in tasks}
    for action in actions:
        task = by_id.get(action.get("task_id"))
        if task is None:
            continue
        values = action.get("proposed_values") or {}
        kind = action.get("action_type")
        if kind == "REASSIGN" and values.get("assignee_id") is not None:
            task["assignee_id"] = int(values["assignee_id"])
            if values.get("assignee_name"):
                task["assignee_name"] = values["assignee_name"]
        elif kind in ("EXTEND_DEADLINE", "RESCHEDULE"):
            if values.get("start_date"):
                task["start_date"] = str(values["start_date"])
            if values.get("due_date"):
                task["due_date"] = str(values["due_date"])
        elif kind == "REPRIORITIZE" and values.get("priority"):
            task["priority"] = values["priority"]
    return list(by_id.values())


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

def _topological_order(tasks: Sequence[Dict[str, Any]]) -> Tuple[List[int], List[int]]:
    ids = {t["id"] for t in tasks}
    prereqs = {
        t["id"]: [p for p in (t.get("prerequisites") or []) if p in ids]
        for t in tasks
    }
    order: List[int] = []
    state: Dict[int, int] = {}
    cyclic: List[int] = []

    def visit(node: int) -> None:
        mark = state.get(node, 0)
        if mark == 2:
            return
        if mark == 1:
            cyclic.append(node)
            return
        state[node] = 1
        for parent in prereqs.get(node, []):
            visit(parent)
        state[node] = 2
        order.append(node)

    for task in sorted(tasks, key=lambda t: t["id"]):
        visit(task["id"])
    return order, cyclic


def simulate_schedule(
    tasks: Sequence[Dict[str, Any]],
    leaves: Sequence[Dict[str, Any]],
    today: date,
    target_end_date: Optional[Any] = None,
    hours_per_day: float = FOCUS_HOURS_PER_DAY,
) -> Dict[str, Any]:
    """Project when each open task will finish given current data."""
    leave_days = leave_days_by_user(leaves)
    task_map = {t["id"]: t for t in tasks}
    order, cyclic = _topological_order(tasks)
    position = {task_id: index for index, task_id in enumerate(order)}
    finish: Dict[int, date] = {}
    starts: Dict[int, date] = {}
    person_free: Dict[int, date] = {}
    first_workday = next_business_day(today)

    # Completed tasks finish on their due date (or earlier) for dependency
    # purposes; they are already done, so they never delay successors past
    # today.
    for task in tasks:
        if not is_open(task):
            due = to_date(task.get("due_date")) or today
            finish[task["id"]] = min(due, today)

    pending = [task_map[i] for i in order if is_open(task_map[i])]
    scheduled: Set[int] = set()

    def earliest_start(task: Dict[str, Any]) -> Optional[date]:
        start = max(
            to_date(task.get("start_date")) or first_workday,
            first_workday,
        )
        for parent in task.get("prerequisites") or []:
            if parent not in task_map:
                continue
            if parent not in finish:
                return None
            start = max(start, add_business_days(finish[parent], 1))
        if is_blocked(task):
            start = max(
                start,
                add_business_days(first_workday, BLOCKER_RESOLUTION_BUSINESS_DAYS),
            )
        return next_business_day(start)

    guard = 0
    while len(scheduled) < len(pending) and guard < len(pending) * 4 + 10:
        guard += 1
        ready = []
        for task in pending:
            if task["id"] in scheduled:
                continue
            est = earliest_start(task)
            if est is not None:
                ready.append((est, task))
        if not ready:
            # Remaining tasks are part of a dependency cycle; schedule them
            # from today so the simulation still terminates.
            for task in pending:
                if task["id"] not in scheduled:
                    ready.append((first_workday, task))
                    break
        ready.sort(key=lambda item: (
            item[0],
            PRIORITY_ORDER.get(item[1].get("priority"), 4),
            to_date(item[1].get("due_date")) or date.max,
            position.get(item[1]["id"], 0),
        ))
        start, task = ready[0]
        assignee = task.get("assignee_id")
        off = leave_days.get(int(assignee), set()) if assignee is not None else set()
        if assignee is not None and assignee in person_free:
            start = max(start, person_free[assignee])
        start = next_business_day(start)
        while start in off:
            start = next_business_day(start + timedelta(days=1))

        hours = remaining_hours(task)
        days_needed = max(1, math.ceil(hours / hours_per_day)) if hours > 0 else 1
        current = start
        worked = 0
        end = start
        while worked < days_needed:
            if is_business_day(current) and current not in off:
                worked += 1
                end = current
            current += timedelta(days=1)

        starts[task["id"]] = start
        finish[task["id"]] = end
        if assignee is not None:
            person_free[assignee] = add_business_days(end, 1)
        scheduled.add(task["id"])

    rows = []
    for task in sorted(tasks, key=lambda t: position.get(t["id"], 0)):
        due = to_date(task.get("due_date"))
        projected_finish = finish.get(task["id"])
        open_task = is_open(task)
        slip = (
            max(0, signed_business_day_gap(due, projected_finish))
            if open_task and due and projected_finish
            else 0
        )
        rows.append({
            "task_id": task["id"],
            "title": task.get("title"),
            "assignee_id": task.get("assignee_id"),
            "assignee_name": task.get("assignee_name"),
            "status": task.get("status"),
            "priority": task.get("priority"),
            "is_blocked": is_blocked(task),
            "start_date": str(task.get("start_date")),
            "due_date": str(task.get("due_date")),
            "remaining_hours": remaining_hours(task),
            "projected_start": starts[task["id"]].isoformat() if task["id"] in starts else None,
            "projected_finish": projected_finish.isoformat() if projected_finish else None,
            "late": slip > 0,
            "slip_business_days": slip,
        })

    open_finishes = [finish[t["id"]] for t in tasks if is_open(t) and t["id"] in finish]
    projected_completion = max(open_finishes) if open_finishes else None
    target = to_date(target_end_date)
    slip_vs_target = (
        signed_business_day_gap(target, projected_completion)
        if projected_completion and target
        else None
    )

    return {
        "method": SCHEDULE_METHOD,
        "assumptions": list(SCHEDULE_ASSUMPTIONS),
        "today": today.isoformat(),
        "hours_per_day": hours_per_day,
        "projected_completion": projected_completion.isoformat() if projected_completion else None,
        "target_end_date": target.isoformat() if target else None,
        "business_days_vs_target": slip_vs_target,
        "feasible": (slip_vs_target is None or slip_vs_target <= 0),
        "late_task_ids": [r["task_id"] for r in rows if r["late"]],
        "cyclic_task_ids": sorted(set(cyclic)),
        "tasks": rows,
    }


def compare_schedules(before: Dict[str, Any], after: Dict[str, Any]) -> Dict[str, Any]:
    """Difference between two simulations produced by ``simulate_schedule``."""
    before_end = to_date(before.get("projected_completion"))
    after_end = to_date(after.get("projected_completion"))
    saved = (
        signed_business_day_gap(after_end, before_end)
        if before_end and after_end
        else None
    )
    return {
        "projected_completion_before": before.get("projected_completion"),
        "projected_completion_after": after.get("projected_completion"),
        "business_days_saved": saved,
        "late_tasks_before": len(before.get("late_task_ids") or []),
        "late_tasks_after": len(after.get("late_task_ids") or []),
        "feasible_before": before.get("feasible"),
        "feasible_after": after.get("feasible"),
    }


def deterministic_findings(
    tasks: Sequence[Dict[str, Any]],
    members: Sequence[Dict[str, Any]],
    leaves: Sequence[Dict[str, Any]],
    today: date,
    target_end_date: Any,
    risk_analysis: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Facts the LLM receives and the UI shows as 'deterministic analysis'."""
    target = to_date(target_end_date) or today
    schedule = simulate_schedule(tasks, leaves, today, target)
    workload = member_workload(tasks, members, leaves, today, target)
    open_tasks = [t for t in tasks if is_open(t)]
    task_map = {t["id"]: t for t in tasks}

    overdue = [
        t["id"] for t in open_tasks
        if (to_date(t.get("due_date")) or today) < today
    ]
    blocked_chains = []
    for task in open_tasks:
        if not is_blocked(task):
            continue
        dependents = [
            other["id"] for other in tasks
            if task["id"] in (other.get("prerequisites") or []) and is_open(other)
        ]
        blocked_chains.append({"task_id": task["id"], "blocks_task_ids": dependents})

    dependency_conflicts = []
    for task in tasks:
        due = to_date(task.get("due_date"))
        for parent_id in task.get("prerequisites") or []:
            parent = task_map.get(parent_id)
            parent_due = to_date(parent.get("due_date")) if parent else None
            if parent and due and parent_due and parent_due > due:
                dependency_conflicts.append({
                    "task_id": task["id"],
                    "prerequisite_id": parent_id,
                    "task_due": due.isoformat(),
                    "prerequisite_due": parent_due.isoformat(),
                })

    total_remaining = round(sum(remaining_hours(t) for t in open_tasks), 2)
    total_capacity = round(
        sum(row["capacity_hours"] for row in workload if row["user_id"] is not None), 2
    )

    rules = []
    if risk_analysis:
        for rule in risk_analysis.get("triggered_rules", []):
            rules.append({
                "rule_id": rule.get("rule_id"),
                "severity": rule.get("severity"),
                "description": rule.get("description"),
                "affected_task_ids": rule.get("affected_task_ids", []),
            })

    return {
        "risk_level": (risk_analysis or {}).get("risk_level"),
        "risk_score": (risk_analysis or {}).get("score"),
        "rules": rules,
        "overdue_task_ids": overdue,
        "blocked_chains": blocked_chains,
        "dependency_conflicts": dependency_conflicts,
        "remaining_hours": total_remaining,
        "capacity_hours_until_target": total_capacity,
        "capacity_shortfall_hours": round(max(0.0, total_remaining - total_capacity), 2),
        "workload": workload,
        "schedule": {
            "projected_completion": schedule["projected_completion"],
            "target_end_date": schedule["target_end_date"],
            "business_days_vs_target": schedule["business_days_vs_target"],
            "feasible": schedule["feasible"],
            "late_task_ids": schedule["late_task_ids"],
        },
        "_simulation": schedule,
    }
