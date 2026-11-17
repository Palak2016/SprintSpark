"""Deterministic project risk scoring.

Everything in this module is a pure function: no database, no AI, no clock.
``compute_risk(snapshot, config, as_of)`` returns the same result for the same
inputs, and ``input_hash`` proves which inputs produced a stored score.

The score is the sum of five bounded factors, one per underlying cause, so a
single fact is never charged twice:

* schedule_variance  - how far started work is behind its (leave-adjusted) plan
* delivery_forecast  - whether remaining work fits each assignee's available
                       capacity before due dates and the project target,
                       with prerequisites finishing before dependents start
                       (overdue, velocity, overload, leave and target checks
                       are all answered by this one forecast)
* blockers           - the blockage itself: how long work has been stuck,
                       how urgent it is and how many tasks wait on it
                       (the forecast assumes blocked work resumes today, so
                       the cost of staying blocked is only counted here)
* dependencies       - plan sequencing errors: a prerequisite due after the
                       task that needs it (forecast slips that flow down a
                       chain are in delivery_forecast; blocked prerequisites
                       are in blockers)
* update_freshness   - started work without a recent daily update
                       (approved leave days never count as missed updates)

Each factor is a value from 0 to 1; contribution = weight x value, and the
weights sum to 100. Approved leave only ever reduces available capacity; it is
never treated as an employee falling behind.

Snapshot format (all dates ISO strings, all ids ints)::

    {
      "project": {"id", "start_date", "target_end_date"},
      "tasks": [{"id", "title", "assignee_id", "status", "estimated_hours",
                 "progress_pct", "start_date", "due_date", "is_blocked",
                 "blocked_since", "prerequisite_ids", "last_update_date"}],
      "leaves": [{"user_id", "start_date", "end_date"}],   # approved only
      "focus": {"<user_id>": ratio},   # share of recent effort on planned work
    }
"""

from __future__ import annotations

import copy
import hashlib
import json
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

ENGINE_VERSION = "2.0"

FACTOR_ORDER = [
    "schedule_variance",
    "delivery_forecast",
    "blockers",
    "dependencies",
    "update_freshness",
]

FACTOR_LABELS = {
    "schedule_variance": "Schedule variance",
    "delivery_forecast": "Delivery forecast",
    "blockers": "Blockers",
    "dependencies": "Dependencies",
    "update_freshness": "Update freshness",
}

DEFAULT_PARAMS: Dict[str, float] = {
    # Working hours an assignee can give one task per working day.
    "hours_per_day": 8.0,
    # Hours-weighted percentage points behind plan that score the full factor.
    "variance_full_scale_pts": 30.0,
    # Working days late that score a task's full forecast severity.
    "late_full_scale_working_days": 5,
    # Working days blocked that score a blocker's full age severity.
    "blocker_full_scale_working_days": 5,
    # Working days (leave excluded) without an update before work is stale.
    "stale_after_working_days": 2,
    # Floor for the focus ratio so one unusual day cannot zero out capacity.
    "min_focus_ratio": 0.3,
    # Severity of a prerequisite planned to finish after its dependent is due.
    "structural_dependency_severity": 0.6,
    # Share of active tasks without estimates that makes the score unreliable.
    "insufficient_estimate_share": 0.5,
}

DEFAULT_CONFIG: Dict[str, Any] = {
    "version": "default-v1",
    "weights": {
        "schedule_variance": 30.0,
        "delivery_forecast": 30.0,
        "blockers": 20.0,
        "dependencies": 10.0,
        "update_freshness": 10.0,
    },
    # Factors are bounded, so one serious problem at full strength (e.g. the
    # blockers factor at 20) is MEDIUM, and two or more together are HIGH.
    "thresholds": {"medium": 20.0, "high": 50.0},
    "params": dict(DEFAULT_PARAMS),
}

COMPLETED = "COMPLETED"
# A forecast that cannot finish within this many days is treated as fully late.
_FORECAST_HORIZON_DAYS = 3 * 366


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

def validate_config(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Return a complete, validated copy of ``config``.

    Raises ValueError with a readable message when weights or thresholds are
    unusable. Missing params fall back to defaults.
    """
    if config is None:
        return copy.deepcopy(DEFAULT_CONFIG)

    weights = config.get("weights") or {}
    if set(weights) != set(FACTOR_ORDER):
        raise ValueError(
            "Weights must be given for exactly these factors: "
            + ", ".join(FACTOR_ORDER)
        )
    clean_weights: Dict[str, float] = {}
    for key in FACTOR_ORDER:
        value = weights[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
            raise ValueError(f"Weight for {key} must be a number of 0 or more.")
        clean_weights[key] = float(value)
    if abs(sum(clean_weights.values()) - 100.0) > 1e-6:
        raise ValueError("Factor weights must add up to 100.")

    thresholds = config.get("thresholds") or DEFAULT_CONFIG["thresholds"]
    medium = thresholds.get("medium")
    high = thresholds.get("high")
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (medium, high)):
        raise ValueError("Thresholds must be numbers.")
    if not 0 < medium < high <= 100:
        raise ValueError("Thresholds must satisfy 0 < medium < high <= 100.")

    params = dict(DEFAULT_PARAMS)
    for key, value in (config.get("params") or {}).items():
        if key not in DEFAULT_PARAMS:
            raise ValueError(f"Unknown risk parameter: {key}")
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
            raise ValueError(f"Parameter {key} must be a positive number.")
        params[key] = value
    if params["min_focus_ratio"] > 1 or params["structural_dependency_severity"] > 1:
        raise ValueError("Ratios and severities must be at most 1.")
    if params["insufficient_estimate_share"] > 1:
        raise ValueError("insufficient_estimate_share must be at most 1.")

    return {
        "version": str(config.get("version") or "custom"),
        "weights": clean_weights,
        "thresholds": {"medium": float(medium), "high": float(high)},
        "params": params,
    }


# --------------------------------------------------------------------------
# Date helpers
# --------------------------------------------------------------------------

def _d(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _weekdays(start: date, end: date) -> int:
    """Weekdays in [start, end], inclusive; 0 when end < start."""
    if end < start:
        return 0
    total_days = (end - start).days + 1
    full_weeks, extra = divmod(total_days, 7)
    count = full_weeks * 5
    first = start.weekday()
    for offset in range(extra):
        if (first + offset) % 7 < 5:
            count += 1
    return count


def _working_days(start: date, end: date, leave_days: Set[date]) -> int:
    """Weekdays in [start, end] that are not approved leave."""
    if end < start:
        return 0
    off = sum(1 for d in leave_days if start <= d <= end and d.weekday() < 5)
    return _weekdays(start, end) - off


def _expand_leaves(leaves: Iterable[Dict[str, Any]]) -> Dict[int, Set[date]]:
    by_user: Dict[int, Set[date]] = {}
    for leave in leaves:
        start, end = _d(leave.get("start_date")), _d(leave.get("end_date"))
        user_id = leave.get("user_id")
        if start is None or end is None or user_id is None or end < start:
            continue
        days = by_user.setdefault(int(user_id), set())
        cur = start
        while cur <= end:
            days.add(cur)
            cur += timedelta(days=1)
    return by_user


# --------------------------------------------------------------------------
# Snapshot normalisation and hashing
# --------------------------------------------------------------------------

def normalize_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Canonical, order-independent copy of a snapshot."""
    def iso(value: Any) -> Optional[str]:
        parsed = _d(value)
        return parsed.isoformat() if parsed else None

    project = snapshot.get("project") or {}
    tasks = []
    for t in snapshot.get("tasks") or []:
        tasks.append({
            "id": int(t["id"]),
            "title": str(t.get("title") or ""),
            "assignee_id": int(t["assignee_id"]) if t.get("assignee_id") is not None else None,
            "status": str(t.get("status") or ""),
            "estimated_hours": round(float(t.get("estimated_hours") or 0.0), 4),
            "progress_pct": max(0, min(100, int(t.get("progress_pct") or 0))),
            "start_date": iso(t.get("start_date")),
            "due_date": iso(t.get("due_date")),
            "is_blocked": bool(t.get("is_blocked")),
            "blocked_since": iso(t.get("blocked_since")),
            "prerequisite_ids": sorted({int(p) for p in (t.get("prerequisite_ids") or [])}),
            "last_update_date": iso(t.get("last_update_date")),
        })
    tasks.sort(key=lambda t: t["id"])

    leaves = sorted(
        (
            {
                "user_id": int(l["user_id"]),
                "start_date": iso(l.get("start_date")),
                "end_date": iso(l.get("end_date")),
            }
            for l in snapshot.get("leaves") or []
            if l.get("user_id") is not None
        ),
        key=lambda l: (l["user_id"], l["start_date"] or "", l["end_date"] or ""),
    )
    focus = {
        str(int(k)): round(float(v), 4)
        for k, v in (snapshot.get("focus") or {}).items()
    }
    return {
        "project": {
            "id": project.get("id"),
            "start_date": iso(project.get("start_date")),
            "target_end_date": iso(project.get("target_end_date")),
        },
        "tasks": tasks,
        "leaves": leaves,
        "focus": dict(sorted(focus.items())),
    }


def compute_input_hash(snapshot: Dict[str, Any], config: Dict[str, Any], as_of: date) -> str:
    payload = {
        "engine_version": ENGINE_VERSION,
        "as_of": as_of.isoformat(),
        "config": config,
        "snapshot": normalize_snapshot(snapshot),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# Forecast
# --------------------------------------------------------------------------

def _remaining_hours(task: Dict[str, Any]) -> float:
    est = float(task["estimated_hours"] or 0.0)
    return max(0.0, est * (100 - task["progress_pct"]) / 100.0)


def _simulate_assignees(
    active: List[Dict[str, Any]],
    leave_days: Dict[int, Set[date]],
    focus: Dict[int, float],
    as_of: date,
    hours_per_day: float,
    ignore_leave_for: Set[int],
    earliest: Dict[int, date],
) -> Dict[int, Optional[date]]:
    """One pass: each assignee works their tasks one at a time.

    Tasks are taken in order of earliest possible start (start date or
    prerequisite finish), then due date, then id, at ``hours_per_day x focus``
    hours per working day, never on approved leave.
    """
    by_user: Dict[int, List[Dict[str, Any]]] = {}
    for t in active:
        if t["assignee_id"] is None or t["estimated_hours"] <= 0:
            continue
        by_user.setdefault(t["assignee_id"], []).append(t)

    def ready(t: Dict[str, Any]) -> date:
        start = max(_d(t["start_date"]) or as_of, as_of)
        return max(start, earliest.get(t["id"], start))

    finishes: Dict[int, Optional[date]] = {}
    horizon = as_of + timedelta(days=_FORECAST_HORIZON_DAYS)
    for user_id in sorted(by_user):
        days_off = set() if user_id in ignore_leave_for else leave_days.get(user_id, set())
        capacity = hours_per_day * focus.get(user_id, 1.0)
        day = as_of
        available = capacity
        for task in sorted(by_user[user_id], key=lambda t: (ready(t), t["due_date"], t["id"])):
            start = ready(task)
            if start > day:
                day = start
                available = capacity
            remaining = _remaining_hours(task)
            finish: Optional[date] = day
            while remaining > 1e-9:
                if day > horizon:
                    finish = None
                    break
                if day.weekday() < 5 and day not in days_off and available > 1e-9:
                    used = min(available, remaining)
                    remaining -= used
                    available -= used
                    finish = day
                    if remaining <= 1e-9:
                        break
                day += timedelta(days=1)
                available = capacity
            finishes[task["id"]] = finish
            if finish is None:
                day = horizon + timedelta(days=1)
    return finishes


def _forecast_finishes(
    active: List[Dict[str, Any]],
    leave_days: Dict[int, Set[date]],
    focus: Dict[int, float],
    as_of: date,
    hours_per_day: float,
    ignore_leave_for: Optional[Set[int]] = None,
) -> Dict[int, Optional[date]]:
    """Projected finish date per assigned, estimated, active task.

    Dependency-aware: a task cannot start before the working day after its
    active prerequisites are forecast to finish, so a slip flows down the
    chain. Repeats the assignee simulation until start constraints settle.
    ``None`` means the work cannot finish within the forecast horizon.
    """
    ignore_leave_for = ignore_leave_for or set()
    horizon = as_of + timedelta(days=_FORECAST_HORIZON_DAYS)
    active_ids = {t["id"] for t in active}
    earliest: Dict[int, date] = {}
    finishes: Dict[int, Optional[date]] = {}
    for _ in range(len(active) + 1):
        finishes = _simulate_assignees(
            active, leave_days, focus, as_of, hours_per_day, ignore_leave_for, earliest
        )
        updated: Dict[int, date] = {}
        for t in active:
            starts = [
                (finishes[p] or horizon) + timedelta(days=1)
                for p in t["prerequisite_ids"]
                if p in active_ids and p in finishes
            ]
            if starts:
                updated[t["id"]] = max(starts)
        if updated == earliest:
            break
        earliest = updated
    return finishes


def _late_working_days(due: date, finish: Optional[date], full_scale: float) -> Tuple[int, float]:
    """(weekdays late, severity 0..1). An unforecastable finish is fully late."""
    if finish is None:
        return int(full_scale), 1.0
    late = _weekdays(due + timedelta(days=1), finish)
    return late, min(1.0, late / full_scale)


def _combine(severities: Iterable[float]) -> float:
    """1 - product(1 - s): grows with each item, never exceeds 1."""
    remaining = 1.0
    for s in severities:
        remaining *= 1.0 - max(0.0, min(1.0, s))
    return 1.0 - remaining


# --------------------------------------------------------------------------
# Main entry point
# --------------------------------------------------------------------------

def compute_risk(
    snapshot: Dict[str, Any],
    config: Optional[Dict[str, Any]],
    as_of: date,
) -> Dict[str, Any]:
    config = validate_config(config)
    params = config["params"]
    weights = config["weights"]
    snap = normalize_snapshot(snapshot)
    input_hash = compute_input_hash(snapshot, config, as_of)

    tasks = snap["tasks"]
    task_map = {t["id"]: t for t in tasks}
    active = [t for t in tasks if t["status"] != COMPLETED]
    leave_days = _expand_leaves(snap["leaves"])
    focus = {
        int(k): max(params["min_focus_ratio"], min(1.0, v))
        for k, v in snap["focus"].items()
    }
    yesterday = as_of - timedelta(days=1)

    base = {
        "engine_version": ENGINE_VERSION,
        "config_version": config["version"],
        "as_of": as_of.isoformat(),
        "input_hash": input_hash,
    }

    evidence: Dict[str, Any] = {
        "total_tasks": len(tasks),
        "completed_tasks": len(tasks) - len(active),
        "active_tasks": len(active),
        "blocked_tasks": sum(1 for t in active if t["is_blocked"] or t["status"] == "BLOCKED"),
        "overdue_tasks": 0,
        "tasks_with_leave_conflict": 0,
        "dependency_conflicts": 0,
        "stale_tasks": 0,
        "workload_by_assignee": {},
        "forecasts": {},
    }

    # --- Missing data ------------------------------------------------------
    missing: List[Dict[str, Any]] = []
    if not tasks:
        missing.append({
            "field_or_type": "tasks",
            "message": "Project has no tasks assigned yet. Add tasks with estimates to enable risk evaluation.",
            "task_id": None,
        })
        return _insufficient(base, evidence, missing, config)

    unestimated = [t for t in active if t["estimated_hours"] <= 0]
    unassigned = [t for t in active if t["assignee_id"] is None]
    for t in unestimated:
        missing.append({
            "field_or_type": "estimated_hours",
            "message": f"Task '{t['title']}' has no estimated effort hours configured.",
            "task_id": t["id"],
        })
    for t in unassigned:
        missing.append({
            "field_or_type": "assignee",
            "message": f"Task '{t['title']}' is active but unassigned to any team member.",
            "task_id": t["id"],
        })
    if active and len(unestimated) / len(active) > params["insufficient_estimate_share"]:
        return _insufficient(base, evidence, missing, config)

    for t in active:
        if t["assignee_id"] is not None:
            key = str(t["assignee_id"])
            evidence["workload_by_assignee"][key] = round(
                evidence["workload_by_assignee"].get(key, 0.0) + _remaining_hours(t), 2
            )

    def is_blocked(t: Dict[str, Any]) -> bool:
        return t["is_blocked"] or t["status"] == "BLOCKED"

    active_est = sum(t["estimated_hours"] for t in active if t["estimated_hours"] > 0)
    rules: List[Dict[str, Any]] = []
    factors: Dict[str, Dict[str, Any]] = {}

    # --- 1. Schedule variance ---------------------------------------------
    variance_rows = []
    weighted_gap = 0.0
    started_est = 0.0
    for t in tasks:
        start, due = _d(t["start_date"]), _d(t["due_date"])
        if t["estimated_hours"] <= 0 or start is None or due is None or start > yesterday:
            continue
        days_off = leave_days.get(t["assignee_id"], set()) if t["assignee_id"] is not None else set()
        if as_of > due:
            planned = 100.0
        else:
            # Past leave days are not expected work. Future leave is ignored
            # here on purpose: it must not make anyone look behind today; the
            # delivery forecast is the one place future capacity is judged.
            elapsed = _working_days(start, yesterday, days_off)
            total = elapsed + _weekdays(as_of, due)
            planned = 0.0 if total <= 0 else min(100.0, 100.0 * elapsed / total)
        actual = 100.0 if t["status"] == COMPLETED else float(t["progress_pct"])
        gap = max(0.0, planned - actual)
        started_est += t["estimated_hours"]
        weighted_gap += t["estimated_hours"] * gap
        if gap > 0:
            variance_rows.append({
                "task_id": t["id"],
                "task_title": t["title"],
                "planned_pct": round(planned, 1),
                "actual_pct": round(actual, 1),
                "gap_pts": round(gap, 1),
                "weight": t["estimated_hours"] * gap,
            })
    avg_gap = weighted_gap / started_est if started_est else 0.0
    variance_value = min(1.0, avg_gap / params["variance_full_scale_pts"])
    variance_rows.sort(key=lambda r: (-r["weight"], r["task_id"]))
    factors["schedule_variance"] = {
        "value": variance_value,
        "summary": (
            f"'{variance_rows[0]['task_title']}' is at {variance_rows[0]['actual_pct']:g}% "
            f"vs {variance_rows[0]['planned_pct']:g}% planned"
            + (f" (+{len(variance_rows) - 1} more task(s) behind plan)" if len(variance_rows) > 1 else "")
            if variance_rows else "Started work is on or ahead of plan"
        ),
        "details": {"hours_weighted_gap_pts": round(avg_gap, 2)},
        "contributors": [
            {
                "task_id": r["task_id"],
                "task_title": r["task_title"],
                "detail": f"{r['actual_pct']:g}% done vs {r['planned_pct']:g}% planned",
            }
            for r in variance_rows[:5]
        ],
    }
    if variance_rows:
        rules.append({
            "rule_id": "RULE_SCHEDULE_VARIANCE",
            "rule_name": "Work Behind Planned Progress",
            "severity": "HIGH" if variance_value >= 0.5 else "MEDIUM",
            "factor": "schedule_variance",
            "description": (
                f"{len(variance_rows)} task(s) are behind their planned progress; "
                f"hours-weighted gap is {avg_gap:.1f} percentage points."
            ),
            "evidence": {"tasks": [{k: v for k, v in r.items() if k != "weight"} for r in variance_rows]},
            "affected_task_ids": [r["task_id"] for r in variance_rows],
        })

    # --- 2. Delivery forecast ---------------------------------------------
    hpd = float(params["hours_per_day"])
    late_scale = float(params["late_full_scale_working_days"])
    finishes = _forecast_finishes(active, leave_days, focus, as_of, hpd)
    users_with_leave = {t["assignee_id"] for t in active if t["assignee_id"] in leave_days}
    finishes_no_leave = (
        _forecast_finishes(active, leave_days, focus, as_of, hpd, ignore_leave_for=users_with_leave)
        if users_with_leave else finishes
    )

    overdue_ids, late_ids = [], []
    leave_conflicts: List[Dict[str, Any]] = []
    leave_task_ids: List[int] = []
    weighted_late = 0.0
    forecast_rows = []
    for t in active:
        if t["id"] not in finishes:
            continue
        due = _d(t["due_date"])
        finish = finishes[t["id"]]
        late_days, severity = _late_working_days(due, finish, late_scale)
        evidence["forecasts"][str(t["id"])] = {
            "projected_finish": finish.isoformat() if finish else None,
            "due_date": due.isoformat(),
            "late_working_days": late_days,
            "remaining_hours": round(_remaining_hours(t), 2),
            "focus_ratio": round(focus.get(t["assignee_id"], 1.0), 2),
        }
        if as_of > due:
            overdue_ids.append(t["id"])
        if late_days <= 0:
            continue
        # Attribute to approved leave only when leave is what makes it late.
        alt_late, _ = _late_working_days(due, finishes_no_leave.get(t["id"]), late_scale)
        if t["assignee_id"] in users_with_leave and alt_late < late_days:
            window_start = max(as_of, _d(t["start_date"]) or as_of)
            for leave in snap["leaves"]:
                l_start, l_end = _d(leave["start_date"]), _d(leave["end_date"])
                if leave["user_id"] == t["assignee_id"] and not (l_end < window_start or l_start > due):
                    leave_conflicts.append({
                        "task_id": t["id"],
                        "task_title": t["title"],
                        "assignee_id": t["assignee_id"],
                        "leave_start": l_start.isoformat(),
                        "leave_end": l_end.isoformat(),
                    })
            leave_task_ids.append(t["id"])
        weighted_late += t["estimated_hours"] * severity
        if as_of <= due:
            late_ids.append(t["id"])
        forecast_rows.append({
            "task_id": t["id"],
            "task_title": t["title"],
            "late_days": late_days,
            "finish": finish,
            "due": due,
            "weight": t["estimated_hours"] * severity,
        })

    task_late_value = weighted_late / active_est if active_est else 0.0

    target = _d(snap["project"]["target_end_date"])
    target_value = 0.0
    target_rule = None
    if target is not None and active:
        latest = max(
            [_d(t["due_date"]) for t in active]
            + [f for f in finishes.values() if f is not None]
        )
        if any(f is None for f in finishes.values()):
            latest = None
        target_late, target_value = _late_working_days(target, latest, late_scale)
        if target_late > 0:
            target_rule = {
                "rule_id": "RULE_TARGET_END_EXCEEDED",
                "rule_name": "Work Extends Past Project Target Date",
                "severity": "CRITICAL",
                "factor": "delivery_forecast",
                "description": (
                    f"Planned or forecast work runs to {latest.isoformat() if latest else 'an unknown date'}, "
                    f"{target_late} working day(s) past the target {target.isoformat()}."
                ),
                "evidence": {
                    "project_target": target.isoformat(),
                    "latest_finish": latest.isoformat() if latest else None,
                },
                "affected_task_ids": sorted(
                    t["id"] for t in active
                    if _d(t["due_date"]) > target
                    or (finishes.get(t["id"]) is not None and finishes[t["id"]] > target)
                ),
            }

    forecast_value = max(task_late_value, target_value)
    forecast_rows.sort(key=lambda r: (-r["weight"], r["task_id"]))
    if forecast_rows:
        top = forecast_rows[0]
        finish_text = top["finish"].isoformat() if top["finish"] else "beyond the forecast horizon"
        forecast_summary = (
            f"'{top['task_title']}' is forecast to finish {finish_text}, "
            f"{top['late_days']} working day(s) after its {top['due'].isoformat()} due date"
        )
        if top["task_id"] in leave_task_ids:
            forecast_summary += " (capacity reduced by approved leave)"
        elif focus.get(task_map[top["task_id"]]["assignee_id"], 1.0) < 1.0:
            forecast_summary += (
                f" at the assignee's recent focus of "
                f"{focus[task_map[top['task_id']]['assignee_id']]:.0%} on planned work"
            )
    elif target_rule:
        forecast_summary = target_rule["description"]
    else:
        forecast_summary = "Remaining work fits available capacity before due dates"
    factors["delivery_forecast"] = {
        "value": forecast_value,
        "summary": forecast_summary,
        "details": {
            "task_lateness": round(task_late_value, 4),
            "target_lateness": round(target_value, 4),
        },
        "contributors": [
            {
                "task_id": r["task_id"],
                "task_title": r["task_title"],
                "detail": f"{r['late_days']} working day(s) late",
            }
            for r in forecast_rows[:5]
        ],
    }
    evidence["overdue_tasks"] = len(overdue_ids)
    evidence["tasks_with_leave_conflict"] = len(set(leave_task_ids))

    if overdue_ids:
        rules.append({
            "rule_id": "RULE_OVERDUE_TASKS",
            "rule_name": "Overdue Incomplete Tasks Detected",
            "severity": "CRITICAL",
            "factor": "delivery_forecast",
            "description": f"{len(overdue_ids)} active task(s) have passed their due date without completion.",
            "evidence": {"task_ids": overdue_ids},
            "affected_task_ids": overdue_ids,
        })
    if late_ids:
        rules.append({
            "rule_id": "RULE_VELOCITY_STRETCH",
            "rule_name": "Forecast to Miss Due Date",
            "severity": "HIGH",
            "factor": "delivery_forecast",
            "description": (
                f"{len(late_ids)} task(s) cannot finish by their due date with the assignee's "
                "available capacity."
            ),
            "evidence": {
                "task_ids": late_ids,
                "forecasts": {str(i): evidence["forecasts"][str(i)] for i in late_ids},
            },
            "affected_task_ids": late_ids,
        })
    if leave_conflicts:
        rules.append({
            "rule_id": "RULE_LEAVE_CONFLICT",
            "rule_name": "Approved Leave Reduces Capacity Below Required",
            "severity": "HIGH",
            "factor": "delivery_forecast",
            "description": (
                f"{len(set(leave_task_ids))} task(s) no longer fit before their due date because "
                "approved leave reduces available capacity. This is a planning issue, not a "
                "performance issue."
            ),
            "evidence": {"conflicts": leave_conflicts},
            "affected_task_ids": sorted(set(leave_task_ids)),
        })
    if target_rule:
        rules.append(target_rule)

    # --- 3. Blockers --------------------------------------------------------
    dependents: Dict[int, List[int]] = {}
    for t in active:
        for p in t["prerequisite_ids"]:
            if p in task_map:
                dependents.setdefault(p, []).append(t["id"])

    blocker_rows = []
    blocker_scale = float(params["blocker_full_scale_working_days"])
    for t in active:
        if not is_blocked(t):
            continue
        since = _d(t["blocked_since"]) or as_of
        age = _weekdays(since, yesterday) if since <= yesterday else 0
        age_factor = min(1.0, (age + 1) / blocker_scale)
        # Urgency: share of the weekdays left before the due date that the
        # remaining work needs. A fresh blocker on work due tomorrow is serious.
        # Leave is ignored here; its effect is judged once, in the forecast.
        due = _d(t["due_date"])
        days_left = max(1, _weekdays(as_of, due))
        urgency = min(1.0, _remaining_hours(t) / (hpd * days_left)) if as_of <= due else 1.0
        reach_count = len(dependents.get(t["id"], []))
        reach = min(1.0, 0.5 + 0.25 * reach_count)
        blocker_rows.append({
            "task_id": t["id"],
            "task_title": t["title"],
            "blocked_working_days": age,
            "urgency": round(urgency, 4),
            "dependent_task_ids": sorted(dependents.get(t["id"], [])),
            "severity": round(max(age_factor, urgency) * reach, 4),
        })
    blocker_value = _combine(r["severity"] for r in blocker_rows)
    blocker_rows.sort(key=lambda r: (-r["severity"], r["task_id"]))
    factors["blockers"] = {
        "value": blocker_value,
        "summary": (
            f"'{blocker_rows[0]['task_title']}' blocked for {blocker_rows[0]['blocked_working_days']} "
            f"working day(s) with {len(blocker_rows[0]['dependent_task_ids'])} dependent task(s)"
            + (f" (+{len(blocker_rows) - 1} more blocked)" if len(blocker_rows) > 1 else "")
            if blocker_rows else "No blocked work"
        ),
        "details": {},
        "contributors": [
            {
                "task_id": r["task_id"],
                "task_title": r["task_title"],
                "detail": (
                    f"blocked {r['blocked_working_days']} working day(s), "
                    f"{len(r['dependent_task_ids'])} dependent(s)"
                ),
            }
            for r in blocker_rows[:5]
        ],
    }
    if blocker_rows:
        cascade = [r["task_id"] for r in blocker_rows if r["dependent_task_ids"]]
        rules.append({
            "rule_id": "RULE_ACTIVE_BLOCKER",
            "rule_name": "Active Work Blocker Halting Progress",
            "severity": "CRITICAL" if cascade else "HIGH",
            "factor": "blockers",
            "description": f"{len(blocker_rows)} task(s) currently marked as blocked, preventing progress.",
            "evidence": {
                "blocked_task_ids": sorted(r["task_id"] for r in blocker_rows),
                "cascade_blocking_ids": sorted(cascade),
                "blockers": blocker_rows,
            },
            "affected_task_ids": sorted(r["task_id"] for r in blocker_rows),
        })

    # --- 4. Dependencies ----------------------------------------------------
    # Plan integrity only: a prerequisite due after its dependent is due.
    # Forecast slips that flow down a chain are already in delivery_forecast,
    # and blocked prerequisites are scored under blockers.
    dep_rows = []
    structural = float(params["structural_dependency_severity"])
    for t in active:
        t_due = _d(t["due_date"])
        for p_id in t["prerequisite_ids"]:
            prereq = task_map.get(p_id)
            if prereq is None or prereq["status"] == COMPLETED or is_blocked(prereq):
                continue
            p_due = _d(prereq["due_date"])
            if p_due > t_due:
                dep_rows.append({
                    "task_id": t["id"],
                    "task_title": t["title"],
                    "prereq_id": p_id,
                    "prereq_title": prereq["title"],
                    "reason": (
                        f"prerequisite is due {p_due.isoformat()}, after this task's "
                        f"{t_due.isoformat()} due date"
                    ),
                    "severity": round(structural, 4),
                })
    dep_value = _combine(r["severity"] for r in dep_rows)
    dep_rows.sort(key=lambda r: (-r["severity"], r["task_id"], r["prereq_id"]))
    evidence["dependency_conflicts"] = len(dep_rows)
    factors["dependencies"] = {
        "value": dep_value,
        "summary": (
            f"'{dep_rows[0]['task_title']}' waits on '{dep_rows[0]['prereq_title']}': {dep_rows[0]['reason']}"
            if dep_rows else "Prerequisites are planned to finish before the tasks that need them"
        ),
        "details": {},
        "contributors": [
            {"task_id": r["task_id"], "task_title": r["task_title"], "detail": r["reason"]}
            for r in dep_rows[:5]
        ],
    }
    if dep_rows:
        rules.append({
            "rule_id": "RULE_DEPENDENCY_CASCADE",
            "rule_name": "Dependency Sequencing Conflict",
            "severity": "HIGH",
            "factor": "dependencies",
            "description": f"{len(dep_rows)} prerequisite scheduling conflict(s) detected.",
            "evidence": {"violations": dep_rows},
            "affected_task_ids": sorted({r["task_id"] for r in dep_rows}),
        })

    # --- 5. Update freshness ------------------------------------------------
    stale_rows = []
    eligible_est = 0.0
    stale_est = 0.0
    stale_after = int(params["stale_after_working_days"])
    stale_ids: Set[int] = set()
    for t in active:
        start = _d(t["start_date"])
        if t["assignee_id"] is None or t["estimated_hours"] <= 0 or start is None or start > yesterday:
            continue
        days_off = leave_days.get(t["assignee_id"], set())
        last = _d(t["last_update_date"])
        window_start = max(start, last + timedelta(days=1)) if last else start
        missed = _working_days(window_start, yesterday, days_off)
        eligible_est += t["estimated_hours"]
        if missed >= stale_after:
            stale_est += t["estimated_hours"]
            stale_ids.add(t["id"])
            stale_rows.append({
                "task_id": t["id"],
                "task_title": t["title"],
                "working_days_without_update": missed,
                "last_update_date": last.isoformat() if last else None,
            })
    fresh_value = stale_est / eligible_est if eligible_est else 0.0
    stale_rows.sort(key=lambda r: (-r["working_days_without_update"], r["task_id"]))
    evidence["stale_tasks"] = len(stale_rows)
    factors["update_freshness"] = {
        "value": fresh_value,
        "summary": (
            f"'{stale_rows[0]['task_title']}' has had no update for "
            f"{stale_rows[0]['working_days_without_update']} working day(s)"
            + (f" (+{len(stale_rows) - 1} more)" if len(stale_rows) > 1 else "")
            if stale_rows else "Started work has recent daily updates"
        ),
        "details": {},
        "contributors": [
            {
                "task_id": r["task_id"],
                "task_title": r["task_title"],
                "detail": f"{r['working_days_without_update']} working day(s) without an update",
            }
            for r in stale_rows[:5]
        ],
    }
    if stale_rows:
        rules.append({
            "rule_id": "RULE_STALE_UPDATES",
            "rule_name": "Started Work Without Recent Updates",
            "severity": "MEDIUM",
            "factor": "update_freshness",
            "description": (
                f"{len(stale_rows)} started task(s) have no daily update for {stale_after}+ working days "
                "(approved leave days are excluded)."
            ),
            "evidence": {"tasks": stale_rows},
            "affected_task_ids": [r["task_id"] for r in stale_rows],
        })

    # --- Score ---------------------------------------------------------------
    breakdown = []
    for key in FACTOR_ORDER:
        f = factors[key]
        contribution = round(weights[key] * f["value"], 1)
        breakdown.append({
            "key": key,
            "label": FACTOR_LABELS[key],
            "weight": weights[key],
            "value": round(f["value"], 4),
            "contribution": contribution,
            "summary": f["summary"],
            "details": f["details"],
            "contributors": f["contributors"],
        })
    score = round(min(100.0, max(0.0, sum(b["contribution"] for b in breakdown))), 1)
    level = _level(score, config)

    # Confidence: share of active tasks the engine can judge reliably.
    if active:
        ok = sum(
            1 for t in active
            if t["estimated_hours"] > 0 and t["assignee_id"] is not None and t["id"] not in stale_ids
        )
        conf_value = ok / len(active)
    else:
        conf_value = 1.0
    confidence = {
        "value": round(conf_value, 2),
        "label": "HIGH" if conf_value >= 0.8 else "MEDIUM" if conf_value >= 0.5 else "LOW",
    }

    return {
        **base,
        "risk_level": level,
        "score": score,
        "factor_breakdown": breakdown,
        "triggered_rules": rules,
        "evidence": evidence,
        "missing_data_flags": missing,
        "confidence": confidence,
    }


def _level(score: float, config: Dict[str, Any]) -> str:
    if score >= config["thresholds"]["high"]:
        return "HIGH"
    if score >= config["thresholds"]["medium"]:
        return "MEDIUM"
    return "LOW"


def _insufficient(base, evidence, missing, config) -> Dict[str, Any]:
    return {
        **base,
        "risk_level": "INSUFFICIENT_DATA",
        "score": 0.0,
        "factor_breakdown": [
            {
                "key": key,
                "label": FACTOR_LABELS[key],
                "weight": config["weights"][key],
                "value": 0.0,
                "contribution": 0.0,
                "summary": "Not evaluated: task estimates or tasks are missing",
                "details": {},
                "contributors": [],
            }
            for key in FACTOR_ORDER
        ],
        "triggered_rules": [],
        "evidence": evidence,
        "missing_data_flags": missing,
        "confidence": {"value": 0.0, "label": "LOW"},
    }


# --------------------------------------------------------------------------
# Change explanation
# --------------------------------------------------------------------------

def explain_change(previous: Optional[Dict[str, Any]], current: Dict[str, Any]) -> Dict[str, Any]:
    """Template explanation of what changed between two results.

    ``previous`` needs ``score``, ``risk_level`` and ``factor_breakdown``
    (a stored row's values); ``None`` means this is the first evaluation.
    """
    score = current["score"]
    level = current["risk_level"]
    if previous is None:
        return {
            "score_delta": None,
            "headline": f"First risk evaluation: {score:g}/100 ({level.replace('_', ' ')}).",
            "changes": [
                {
                    "key": b["key"],
                    "label": b["label"],
                    "delta": b["contribution"],
                    "text": f"{b['label']} {b['contribution']:+.1f}: {b['summary']}",
                }
                for b in current["factor_breakdown"]
                if b["contribution"] >= 0.1
            ],
            "level_changed": False,
        }

    prev_score = float(previous.get("score") or 0.0)
    prev_level = previous.get("risk_level") or "LOW"
    prev_by_key = {b["key"]: b for b in (previous.get("factor_breakdown") or [])}
    delta = round(score - prev_score, 1)
    changes = []
    for b in current["factor_breakdown"]:
        before = float(prev_by_key.get(b["key"], {}).get("contribution", 0.0))
        d = round(b["contribution"] - before, 1)
        if abs(d) >= 0.1:
            changes.append({
                "key": b["key"],
                "label": b["label"],
                "delta": d,
                "text": f"{b['label']} {d:+.1f}: {b['summary']}",
            })
    changes.sort(key=lambda c: (-abs(c["delta"]), FACTOR_ORDER.index(c["key"])))
    level_text = (
        f"{prev_level.replace('_', ' ')} → {level.replace('_', ' ')}"
        if prev_level != level else level.replace("_", " ")
    )
    return {
        "score_delta": delta,
        "headline": f"Risk {prev_score:g} → {score:g} ({delta:+.1f}, {level_text}).",
        "changes": changes,
        "level_changed": prev_level != level,
    }


def result_fingerprint(result: Dict[str, Any]) -> str:
    """Hash of the parts of a result a manager sees; equal means 'no change'."""
    payload = {
        "score": result["score"],
        "risk_level": result["risk_level"],
        "factors": [(b["key"], b["contribution"], b["summary"]) for b in result["factor_breakdown"]],
        "rules": sorted((r["rule_id"], tuple(r["affected_task_ids"])) for r in result["triggered_rules"]),
        "config_version": result["config_version"],
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
