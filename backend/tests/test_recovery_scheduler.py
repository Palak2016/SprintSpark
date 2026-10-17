"""Deterministic schedule and capacity calculations (no database needed)."""

from datetime import date, timedelta

from app.services.recovery_scheduler import (
    FOCUS_HOURS_PER_DAY,
    add_business_days,
    apply_actions_to_tasks,
    business_days_between,
    compare_schedules,
    deterministic_findings,
    member_workload,
    remaining_hours,
    signed_business_day_gap,
    simulate_schedule,
)

MONDAY = date(2026, 10, 19)


def _task(task_id, **overrides):
    task = {
        "id": task_id,
        "title": f"Task {task_id}",
        "assignee_id": 10,
        "assignee_name": "Asha",
        "status": "TODO",
        "priority": "MEDIUM",
        "estimated_hours": 12.0,
        "progress_pct": 0,
        "start_date": MONDAY.isoformat(),
        "due_date": (MONDAY + timedelta(days=4)).isoformat(),
        "is_blocked": False,
        "blocker_reason": None,
        "prerequisites": [],
    }
    task.update(overrides)
    return task


def test_business_day_helpers():
    friday = date(2026, 10, 23)
    assert business_days_between(MONDAY, friday) == 5
    assert add_business_days(friday, 1) == date(2026, 10, 26)
    assert signed_business_day_gap(MONDAY, friday) == 4
    assert signed_business_day_gap(friday, MONDAY) == -4


def test_remaining_hours_uses_progress_and_ignores_completed():
    assert remaining_hours(_task(1, estimated_hours=20, progress_pct=25)) == 15.0
    assert remaining_hours(_task(1, status="COMPLETED", progress_pct=100)) == 0.0


def test_dependencies_and_single_assignee_are_sequenced():
    tasks = [
        _task(1, estimated_hours=12),                  # 2 days
        _task(2, estimated_hours=6, prerequisites=[1]),  # 1 day after task 1
    ]
    result = simulate_schedule(tasks, [], MONDAY, MONDAY + timedelta(days=10))
    rows = {r["task_id"]: r for r in result["tasks"]}
    assert rows[1]["projected_start"] == "2026-10-19"
    assert rows[1]["projected_finish"] == "2026-10-20"
    assert rows[2]["projected_start"] == "2026-10-21"
    assert rows[2]["projected_finish"] == "2026-10-21"
    assert result["projected_completion"] == "2026-10-21"
    assert result["feasible"] is True


def test_approved_leave_pushes_work_out_and_marks_late():
    tasks = [_task(1, estimated_hours=FOCUS_HOURS_PER_DAY * 3,
                   due_date=(MONDAY + timedelta(days=2)).isoformat())]
    leave = [{"user_id": 10, "start_date": "2026-10-19", "end_date": "2026-10-20"}]
    result = simulate_schedule(tasks, leave, MONDAY, MONDAY + timedelta(days=2))
    row = result["tasks"][0]
    assert row["projected_start"] == "2026-10-21"
    assert row["projected_finish"] == "2026-10-23"
    assert row["late"] is True and row["slip_business_days"] == 2
    assert result["feasible"] is False


def test_reassignment_lets_independent_work_run_in_parallel():
    tasks = [_task(1, estimated_hours=12), _task(2, estimated_hours=12)]
    before = simulate_schedule(tasks, [], MONDAY, MONDAY + timedelta(days=3))
    after_tasks = apply_actions_to_tasks(tasks, [{
        "action_type": "REASSIGN", "task_id": 2,
        "proposed_values": {"assignee_id": 11, "assignee_name": "Ben"},
    }])
    after = simulate_schedule(after_tasks, [], MONDAY, MONDAY + timedelta(days=3))
    diff = compare_schedules(before, after)
    assert before["projected_completion"] == "2026-10-22"
    assert after["projected_completion"] == "2026-10-20"
    assert diff["business_days_saved"] == 2


def test_blocked_task_waits_for_assumed_resolution_time():
    tasks = [_task(1, is_blocked=True, status="BLOCKED", estimated_hours=6)]
    result = simulate_schedule(tasks, [], MONDAY, MONDAY + timedelta(days=10))
    assert result["tasks"][0]["projected_start"] == "2026-10-21"


def test_workload_counts_leave_against_capacity():
    tasks = [_task(1, estimated_hours=40)]
    members = [{"user_id": 10, "name": "Asha"}, {"user_id": 11, "name": "Ben"}]
    leave = [{"user_id": 10, "start_date": "2026-10-19", "end_date": "2026-10-21"}]
    rows = {r["user_id"]: r for r in member_workload(tasks, members, leave, MONDAY, MONDAY + timedelta(days=4))}
    assert rows[10]["capacity_hours"] == 2 * FOCUS_HOURS_PER_DAY
    assert rows[10]["over_capacity"] is True
    assert rows[11]["remaining_hours"] == 0


def test_findings_report_overdue_blocked_and_dependency_conflicts():
    tasks = [
        _task(1, due_date="2026-10-10", start_date="2026-10-01"),
        _task(2, is_blocked=True, status="BLOCKED", prerequisites=[1]),
        _task(3, prerequisites=[2], due_date="2026-10-20"),
        _task(4, prerequisites=[3], due_date="2026-10-19"),
    ]
    members = [{"user_id": 10, "name": "Asha"}]
    findings = deterministic_findings(tasks, members, [], MONDAY, "2026-10-30")
    assert findings["overdue_task_ids"] == [1]
    assert findings["blocked_chains"] == [{"task_id": 2, "blocks_task_ids": [3]}]
    assert [c["task_id"] for c in findings["dependency_conflicts"]] == [3, 4]
    assert findings["remaining_hours"] == 48.0


def test_project_manager_without_tasks_is_not_counted_as_capacity():
    members = [{"user_id": 10, "name": "Asha"}, {"user_id": 1, "name": "Alex", "role": "Project Manager"}]
    rows = member_workload([_task(1)], members, [], MONDAY, MONDAY + timedelta(days=4))
    assert [r["user_id"] for r in rows] == [10]
