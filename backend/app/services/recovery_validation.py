"""Validation of recovery actions against project data.

The validator never trusts values supplied by a planner (rule-based or
LLM). ``original_values`` are always rebuilt from the current task, task
references must belong to the project, proposed people must be project
members, dates must parse and respect dependencies, and two actions may
not change the same field of the same task.

Results per action:
* VALID - can be applied on approval.
* ADVISORY - a recommendation with no automatic data change.
* INVALID - rejected; never stored as a proposed action and never applied.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Sequence, Tuple

from app.services.recovery_scheduler import (
    FOCUS_HOURS_PER_DAY,
    capacity_hours,
    is_blocked,
    is_open,
    leave_days_by_user,
    remaining_hours,
    to_date,
)

APPLYABLE_ACTION_TYPES = {
    "REASSIGN",
    "EXTEND_DEADLINE",
    "RESCHEDULE",
    "REPRIORITIZE",
    "RESOLVE_DEPENDENCY",
    "ESCALATE_BLOCKER",
}
ADVISORY_ACTION_TYPES = {"SPLIT_EFFORT"}
ALLOWED_ACTION_TYPES = APPLYABLE_ACTION_TYPES | ADVISORY_ACTION_TYPES
VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
VALID_STATUSES = {"TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"}

# Fields each action type is allowed to change.
ACTION_FIELDS = {
    "REASSIGN": ("assignee_id",),
    "EXTEND_DEADLINE": ("due_date",),
    "RESCHEDULE": ("start_date", "due_date"),
    "REPRIORITIZE": ("priority",),
    "RESOLVE_DEPENDENCY": ("is_blocked", "blocker_reason", "status"),
    "ESCALATE_BLOCKER": ("is_blocked", "blocker_reason"),
    "SPLIT_EFFORT": (),
}

MAX_TEXT = 600


def _clip(value: Any, limit: int = MAX_TEXT) -> str:
    text = " ".join(str(value or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def current_values(task: Dict[str, Any], action_type: str) -> Dict[str, Any]:
    """The task's actual values for the fields an action touches."""
    if action_type == "REASSIGN":
        return {
            "assignee_id": task.get("assignee_id"),
            "assignee_name": task.get("assignee_name") or "Unassigned",
        }
    if action_type == "EXTEND_DEADLINE":
        return {"due_date": str(task.get("due_date"))}
    if action_type == "RESCHEDULE":
        return {
            "start_date": str(task.get("start_date")),
            "due_date": str(task.get("due_date")),
        }
    if action_type == "REPRIORITIZE":
        return {"priority": task.get("priority")}
    if action_type in ("RESOLVE_DEPENDENCY", "ESCALATE_BLOCKER"):
        return {
            "is_blocked": bool(task.get("is_blocked")),
            "blocker_reason": task.get("blocker_reason"),
            "status": task.get("status"),
        }
    return {}


def _validation(status: str, errors: List[str], warnings: List[str]) -> Dict[str, Any]:
    return {"status": status, "errors": errors, "warnings": warnings}


def validate_action(
    action: Dict[str, Any],
    context: Dict[str, Any],
    leaves: Sequence[Dict[str, Any]],
    today: date,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Validate a single action in isolation.

    Returns ``(normalized_action, validation)``.
    """
    errors: List[str] = []
    warnings: List[str] = []
    tasks = {t["id"]: t for t in context.get("tasks", [])}
    members = {m["user_id"]: m for m in context.get("members", [])}
    target_end = to_date(context.get("target_end_date"))

    action_type = str(action.get("action_type") or "").upper()
    raw_task_id = action.get("task_id")
    try:
        task_id = int(raw_task_id)
    except (TypeError, ValueError):
        task_id = None

    normalized: Dict[str, Any] = {
        "action_id": str(action.get("action_id") or "")[:32],
        "action_type": action_type,
        "task_id": task_id if task_id is not None else -1,
        "task_title": "",
        "original_values": {},
        "proposed_values": {},
        "reason": _clip(action.get("reason")) or "No reason provided.",
        "expected_impact": _clip(action.get("expected_impact")) or "Not stated.",
        "source": action.get("source") or "RULE",
        "is_advisory": action_type in ADVISORY_ACTION_TYPES,
    }

    if action_type not in ALLOWED_ACTION_TYPES:
        errors.append(f"Unknown action type '{action.get('action_type')}'.")
        return normalized, _validation("INVALID", errors, warnings)

    task = tasks.get(task_id) if task_id is not None else None
    if task is None:
        errors.append(f"Task {raw_task_id} does not belong to this project.")
        return normalized, _validation("INVALID", errors, warnings)

    normalized["task_title"] = task.get("title") or f"Task {task_id}"
    normalized["original_values"] = current_values(task, action_type)

    claimed = action.get("original_values") or {}
    for key, actual in normalized["original_values"].items():
        if key in claimed and key != "assignee_name" and str(claimed[key]) != str(actual):
            warnings.append(
                f"Planner stated {key}={claimed[key]!r}, but the task has "
                f"{actual!r}. The actual value is used."
            )

    if not is_open(task) and action_type not in ADVISORY_ACTION_TYPES:
        errors.append(f"Task '{task['title']}' is already completed.")
        return normalized, _validation("INVALID", errors, warnings)

    raw_values = action.get("proposed_values") or {}
    if not isinstance(raw_values, dict):
        raw_values = {}
    allowed = ACTION_FIELDS.get(action_type, ())
    extra = sorted(set(raw_values) - set(allowed) - {"assignee_name", "note"})
    if extra:
        warnings.append(f"Ignored fields not allowed for {action_type}: {', '.join(extra)}.")
    values: Dict[str, Any] = {}

    if action_type == "REASSIGN":
        try:
            new_id = int(raw_values.get("assignee_id"))
        except (TypeError, ValueError):
            errors.append("Reassignment needs a valid assignee_id.")
            return normalized, _validation("INVALID", errors, warnings)
        member = members.get(new_id)
        if member is None:
            errors.append(f"User {new_id} is not a member of this project.")
            return normalized, _validation("INVALID", errors, warnings)
        if new_id == task.get("assignee_id"):
            errors.append("Task is already assigned to that person.")
            return normalized, _validation("INVALID", errors, warnings)
        values = {"assignee_id": new_id, "assignee_name": member.get("name")}

        window_start = max(to_date(task.get("start_date")) or today, today)
        window_end = max(to_date(task.get("due_date")) or today, window_start)
        leave_days = leave_days_by_user(leaves)
        overlap = sorted(
            d for d in leave_days.get(new_id, set())
            if window_start <= d <= window_end and d.weekday() < 5
        )
        if overlap:
            warnings.append(
                f"{member.get('name')} has approved leave on {len(overlap)} working "
                f"day(s) in this task's window ({overlap[0].isoformat()} to "
                f"{overlap[-1].isoformat()})."
            )
        available = capacity_hours(new_id, window_start, window_end, leave_days)
        committed = 0.0
        for other in tasks.values():
            if other["id"] == task_id or other.get("assignee_id") != new_id or not is_open(other):
                continue
            o_start = max(to_date(other.get("start_date")) or today, today)
            o_end = max(to_date(other.get("due_date")) or today, o_start)
            if o_end < window_start or o_start > window_end:
                continue
            committed += remaining_hours(other)
        needed = remaining_hours(task)
        if committed + needed > available:
            warnings.append(
                f"{member.get('name')} would have {committed + needed:.1f}h of work in "
                f"this window against about {available:.1f}h of capacity "
                f"({FOCUS_HOURS_PER_DAY:g}h/day)."
            )

    elif action_type in ("EXTEND_DEADLINE", "RESCHEDULE"):
        new_due = to_date(raw_values.get("due_date"))
        new_start = to_date(raw_values.get("start_date")) if action_type == "RESCHEDULE" else None
        if action_type == "EXTEND_DEADLINE" and new_due is None:
            errors.append("Deadline change needs a valid due_date (YYYY-MM-DD).")
        if action_type == "RESCHEDULE" and new_due is None and new_start is None:
            errors.append("Reschedule needs a valid start_date and/or due_date.")
        if errors:
            return normalized, _validation("INVALID", errors, warnings)

        effective_start = new_start or to_date(task.get("start_date"))
        effective_due = new_due or to_date(task.get("due_date"))
        current_due = to_date(task.get("due_date"))
        if effective_start and effective_due and effective_due < effective_start:
            errors.append("Due date would be before the start date.")
        if new_due and new_due < today:
            errors.append(f"Due date {new_due.isoformat()} is in the past.")
        if action_type == "EXTEND_DEADLINE" and new_due and current_due and new_due <= current_due:
            errors.append("An extension must move the due date later.")
        if new_start and new_start < today and int(task.get("progress_pct") or 0) == 0:
            warnings.append("Proposed start date is in the past for a task that has not started.")
        if new_due and target_end and new_due > target_end:
            warnings.append(
                f"New due date is after the project target date {target_end.isoformat()}."
            )
        if new_due and (new_due - (current_due or new_due)).days > 60:
            warnings.append("Moves the due date by more than 60 days.")
        if new_start:
            values["start_date"] = new_start.isoformat()
        if new_due:
            values["due_date"] = new_due.isoformat()

    elif action_type == "REPRIORITIZE":
        priority = str(raw_values.get("priority") or "").upper()
        if priority not in VALID_PRIORITIES:
            errors.append(f"Priority must be one of {', '.join(sorted(VALID_PRIORITIES))}.")
        elif priority == task.get("priority"):
            errors.append("Task already has that priority.")
        values = {"priority": priority}

    elif action_type in ("RESOLVE_DEPENDENCY", "ESCALATE_BLOCKER"):
        if not is_blocked(task):
            errors.append(f"Task '{task['title']}' is not currently blocked.")
        reason = _clip(raw_values.get("blocker_reason")) or task.get("blocker_reason")
        if action_type == "ESCALATE_BLOCKER":
            values = {"is_blocked": True, "blocker_reason": reason}
        else:
            unblock = raw_values.get("is_blocked") is False
            values = {"is_blocked": not unblock, "blocker_reason": reason}
            status = raw_values.get("status")
            if status:
                status = str(status).upper()
                if status not in VALID_STATUSES:
                    errors.append(f"Unknown status '{status}'.")
                else:
                    values["status"] = status
            if unblock:
                warnings.append(
                    "Approving this marks the task as unblocked. Confirm the blocker "
                    "has actually been resolved first."
                )

    elif action_type == "SPLIT_EFFORT":
        values = {"note": _clip(raw_values.get("note") or action.get("reason"))}

    normalized["proposed_values"] = values
    if errors:
        return normalized, _validation("INVALID", errors, warnings)
    status = "ADVISORY" if action_type in ADVISORY_ACTION_TYPES else "VALID"
    return normalized, _validation(status, errors, warnings)


def validate_plan(
    actions: Sequence[Dict[str, Any]],
    context: Dict[str, Any],
    leaves: Sequence[Dict[str, Any]],
    today: date,
) -> Dict[str, Any]:
    """Validate actions individually, then check the plan as a whole."""
    accepted: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    touched: Dict[Tuple[int, str], str] = {}

    for index, action in enumerate(actions):
        normalized, result = validate_action(action, context, leaves, today)
        if not normalized["action_id"]:
            normalized["action_id"] = f"a{index + 1}"
        if result["status"] != "INVALID":
            for field in ACTION_FIELDS.get(normalized["action_type"], ()):
                if field not in normalized["proposed_values"]:
                    continue
                key = (normalized["task_id"], field)
                if key in touched:
                    result["errors"].append(
                        f"Contradicts action {touched[key]}, which already changes "
                        f"{field} on this task."
                    )
                    result["status"] = "INVALID"
                    break
            if result["status"] != "INVALID":
                for field in ACTION_FIELDS.get(normalized["action_type"], ()):
                    if field in normalized["proposed_values"]:
                        touched[(normalized["task_id"], field)] = normalized["action_id"]
        normalized["validation"] = result
        (accepted if result["status"] != "INVALID" else rejected).append(normalized)

    # Dependency order after the accepted date changes: a prerequisite must
    # not be due after the task that depends on it (same rule as the risk
    # engine's RULE_DEPENDENCY_CASCADE).
    due_after: Dict[int, date] = {
        t["id"]: to_date(t.get("due_date")) for t in context.get("tasks", [])
    }
    for action in accepted:
        new_due = to_date(action["proposed_values"].get("due_date"))
        if new_due:
            due_after[action["task_id"]] = new_due
    changed = {
        a["task_id"]: a for a in accepted
        if a["proposed_values"].get("due_date")
    }
    still_ok: List[Dict[str, Any]] = []
    for action in accepted:
        if action["task_id"] not in changed or changed[action["task_id"]] is not action:
            still_ok.append(action)
            continue
        task_id = action["task_id"]
        conflicts = []
        for task in context.get("tasks", []):
            if task_id in (task.get("prerequisites") or []) and is_open(task):
                dep_due = due_after.get(task["id"])
                if dep_due and due_after[task_id] and due_after[task_id] > dep_due:
                    conflicts.append(f"'{task['title']}' (due {dep_due.isoformat()})")
        own = next((t for t in context.get("tasks", []) if t["id"] == task_id), None)
        for parent_id in (own or {}).get("prerequisites") or []:
            parent_due = due_after.get(parent_id)
            if parent_due and due_after[task_id] and parent_due > due_after[task_id]:
                conflicts.append(f"prerequisite #{parent_id} (due {parent_due.isoformat()})")
        if conflicts:
            action["validation"]["errors"].append(
                "New due date breaks dependency order with " + ", ".join(conflicts)
                + ". Move those tasks in the same plan."
            )
            action["validation"]["status"] = "INVALID"
            rejected.append(action)
        else:
            still_ok.append(action)

    errors = [
        f"{a['action_type']} on task {a['task_id']}: {e}"
        for a in rejected for e in a["validation"]["errors"]
    ]
    warnings = [
        f"{a['action_type']} on task {a['task_id']}: {w}"
        for a in still_ok for w in a["validation"]["warnings"]
    ]
    if rejected:
        status = "PASSED_WITH_REJECTIONS"
    elif warnings:
        status = "PASSED_WITH_WARNINGS"
    else:
        status = "PASSED"
    return {
        "status": status,
        "accepted": still_ok,
        "rejected": rejected,
        "errors": errors,
        "warnings": warnings,
    }


def stale_fields(action: Dict[str, Any], task: Optional[Dict[str, Any]]) -> List[str]:
    """Fields whose current value no longer matches the proposal snapshot."""
    if task is None:
        return ["task"]
    snapshot = action.get("original_values") or {}
    now = current_values(task, action.get("action_type", ""))
    changed = []
    for key, value in snapshot.items():
        if key in ("assignee_name", "blocker_reason"):
            continue
        if key in now and str(now[key]) != str(value):
            changed.append(key)
    return changed
