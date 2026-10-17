"""Validation of planner output against project data (no database needed)."""

from datetime import date

from app.services.recovery_validation import stale_fields, validate_plan

TODAY = date(2026, 10, 19)


def _context():
    return {
        "project_id": 1,
        "target_end_date": "2026-11-13",
        "members": [
            {"user_id": 10, "name": "Asha", "role": "Engineer"},
            {"user_id": 11, "name": "Ben", "role": "Engineer"},
        ],
        "tasks": [
            {
                "id": 1, "title": "API", "assignee_id": 10, "assignee_name": "Asha",
                "status": "IN_PROGRESS", "priority": "HIGH", "estimated_hours": 12,
                "progress_pct": 50, "start_date": "2026-10-19", "due_date": "2026-10-23",
                "is_blocked": False, "blocker_reason": None, "prerequisites": [],
            },
            {
                "id": 2, "title": "UI", "assignee_id": 10, "assignee_name": "Asha",
                "status": "BLOCKED", "priority": "MEDIUM", "estimated_hours": 12,
                "progress_pct": 0, "start_date": "2026-10-22", "due_date": "2026-10-28",
                "is_blocked": True, "blocker_reason": "Waiting for design", "prerequisites": [1],
            },
            {
                "id": 3, "title": "Done", "assignee_id": 11, "assignee_name": "Ben",
                "status": "COMPLETED", "priority": "LOW", "estimated_hours": 4,
                "progress_pct": 100, "start_date": "2026-10-01", "due_date": "2026-10-10",
                "is_blocked": False, "blocker_reason": None, "prerequisites": [],
            },
        ],
    }


def _one(action, leaves=()):
    return validate_plan([action], _context(), list(leaves), TODAY)


def test_rejects_unknown_task_and_type_and_completed_task():
    assert _one({"action_type": "REASSIGN", "task_id": 99,
                 "proposed_values": {"assignee_id": 11}})["rejected"]
    assert _one({"action_type": "DELETE_TASK", "task_id": 1})["rejected"]
    assert _one({"action_type": "REPRIORITIZE", "task_id": 3,
                 "proposed_values": {"priority": "HIGH"}})["rejected"]


def test_rejects_reassignment_to_non_member():
    result = _one({"action_type": "REASSIGN", "task_id": 1,
                   "proposed_values": {"assignee_id": 999}})
    assert "not a member" in result["rejected"][0]["validation"]["errors"][0]


def test_reassignment_warns_about_leave_and_rebuilds_original_values():
    leave = [{"user_id": 11, "start_date": "2026-10-20", "end_date": "2026-10-21"}]
    result = _one({
        "action_type": "REASSIGN", "task_id": 1,
        "original_values": {"assignee_id": 42},
        "proposed_values": {"assignee_id": 11, "salary": 5},
    }, leave)
    action = result["accepted"][0]
    assert action["original_values"]["assignee_id"] == 10
    assert action["proposed_values"] == {"assignee_id": 11, "assignee_name": "Ben"}
    warnings = " ".join(action["validation"]["warnings"])
    assert "approved leave" in warnings
    assert "actual value is used" in warnings
    assert "Ignored fields" in warnings


def test_rejects_past_or_inverted_dates_and_non_extensions():
    assert _one({"action_type": "EXTEND_DEADLINE", "task_id": 1,
                 "proposed_values": {"due_date": "2026-10-01"}})["rejected"]
    assert _one({"action_type": "EXTEND_DEADLINE", "task_id": 1,
                 "proposed_values": {"due_date": "2026-10-22"}})["rejected"]
    assert _one({"action_type": "RESCHEDULE", "task_id": 1,
                 "proposed_values": {"start_date": "2026-10-30", "due_date": "2026-10-26"}})["rejected"]
    assert _one({"action_type": "EXTEND_DEADLINE", "task_id": 1,
                 "proposed_values": {"due_date": "not-a-date"}})["rejected"]


def test_rejects_due_date_that_breaks_dependency_order_unless_dependent_moves():
    alone = _one({"action_type": "EXTEND_DEADLINE", "task_id": 1,
                  "proposed_values": {"due_date": "2026-10-30"}})
    assert "dependency order" in alone["rejected"][0]["validation"]["errors"][0]

    together = validate_plan([
        {"action_type": "EXTEND_DEADLINE", "task_id": 1, "proposed_values": {"due_date": "2026-10-30"}},
        {"action_type": "EXTEND_DEADLINE", "task_id": 2, "proposed_values": {"due_date": "2026-11-04"}},
    ], _context(), [], TODAY)
    assert not together["rejected"]
    assert len(together["accepted"]) == 2


def test_rejects_contradictory_actions_on_same_field():
    result = validate_plan([
        {"action_type": "EXTEND_DEADLINE", "task_id": 2, "proposed_values": {"due_date": "2026-11-02"}},
        {"action_type": "RESCHEDULE", "task_id": 2, "proposed_values": {"due_date": "2026-11-05"}},
    ], _context(), [], TODAY)
    assert len(result["accepted"]) == 1
    assert "Contradicts" in result["rejected"][0]["validation"]["errors"][0]


def test_blocker_actions_require_blocked_task_and_split_is_advisory():
    assert _one({"action_type": "ESCALATE_BLOCKER", "task_id": 1,
                 "proposed_values": {"blocker_reason": "x"}})["rejected"]
    escalate = _one({"action_type": "ESCALATE_BLOCKER", "task_id": 2,
                     "proposed_values": {"blocker_reason": "Need design sign-off"}})
    assert escalate["accepted"][0]["proposed_values"]["is_blocked"] is True
    split = _one({"action_type": "SPLIT_EFFORT", "task_id": 1,
                  "proposed_values": {"note": "Pair on the API client"}})
    assert split["accepted"][0]["validation"]["status"] == "ADVISORY"


def test_stale_fields_detects_changes_since_generation():
    task = _context()["tasks"][0]
    action = {"action_type": "EXTEND_DEADLINE", "original_values": {"due_date": "2026-10-23"}}
    assert stale_fields(action, task) == []
    assert stale_fields(action, {**task, "due_date": "2026-10-24"}) == ["due_date"]
    assert stale_fields(action, None) == ["task"]
