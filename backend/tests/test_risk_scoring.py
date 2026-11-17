"""Unit tests for the pure, deterministic risk scoring engine.

These need no database: compute_risk takes a plain snapshot dict.
"""

import copy
import random
from datetime import date, timedelta

import pytest

from app.services.risk_scoring import (
    DEFAULT_CONFIG,
    compute_risk,
    explain_change,
    result_fingerprint,
    validate_config,
)

AS_OF = date(2026, 11, 17)  # a Tuesday


def d(offset):
    return (AS_OF + timedelta(days=offset)).isoformat()


def task(id, **kw):
    base = {
        "id": id,
        "title": f"Task {id}",
        "assignee_id": 10,
        "status": "IN_PROGRESS",
        "estimated_hours": 16.0,
        "progress_pct": 0,
        "start_date": d(-7),
        "due_date": d(7),
        "is_blocked": False,
        "blocked_since": None,
        "prerequisite_ids": [],
        "last_update_date": d(-1),
    }
    base.update(kw)
    return base


def snap(tasks, leaves=None, focus=None, target=None):
    return {
        "project": {"id": 1, "start_date": d(-30), "target_end_date": target or d(60)},
        "tasks": tasks,
        "leaves": leaves or [],
        "focus": focus or {},
    }


def factor(result, key):
    return next(b for b in result["factor_breakdown"] if b["key"] == key)


def rule_ids(result):
    return {r["rule_id"] for r in result["triggered_rules"]}


def test_as_of_is_a_tuesday():
    assert AS_OF.weekday() == 1


def test_identical_inputs_give_identical_results_and_hash():
    s = snap([task(1, progress_pct=20), task(2, assignee_id=11, progress_pct=50, is_blocked=True,
                                         status="BLOCKED", blocked_since=d(-3))])
    first = compute_risk(s, None, AS_OF)
    second = compute_risk(copy.deepcopy(s), None, AS_OF)
    assert first == second

    shuffled = copy.deepcopy(s)
    random.Random(7).shuffle(shuffled["tasks"])
    assert compute_risk(shuffled, None, AS_OF)["input_hash"] == first["input_hash"]


def test_hash_changes_with_config_and_date():
    s = snap([task(1, progress_pct=20)])
    base = compute_risk(s, None, AS_OF)["input_hash"]
    other_cfg = copy.deepcopy(DEFAULT_CONFIG)
    other_cfg["version"] = "project:7"
    assert compute_risk(s, other_cfg, AS_OF)["input_hash"] != base
    assert compute_risk(s, None, AS_OF + timedelta(days=1))["input_hash"] != base


def test_score_falls_as_progress_catches_up():
    behind = compute_risk(snap([task(1, progress_pct=10)]), None, AS_OF)
    caught_up = compute_risk(snap([task(1, progress_pct=50)]), None, AS_OF)
    assert behind["score"] > caught_up["score"]
    assert factor(behind, "schedule_variance")["contribution"] > 0
    assert factor(caught_up, "schedule_variance")["contribution"] == 0


def test_completed_project_is_low_risk():
    result = compute_risk(snap([task(1, status="COMPLETED", progress_pct=100)]), None, AS_OF)
    assert result["risk_level"] == "LOW"
    assert result["score"] == 0.0


def test_small_overdue_task_does_not_saturate_score():
    tasks = [task(1, estimated_hours=2, start_date=d(-10), due_date=d(-2), progress_pct=50)]
    tasks += [task(i, estimated_hours=20, progress_pct=60, start_date=d(-5), due_date=d(20))
              for i in range(2, 7)]
    result = compute_risk(snap(tasks), None, AS_OF)
    assert "RULE_OVERDUE_TASKS" in rule_ids(result)
    assert 0 < factor(result, "delivery_forecast")["contribution"] < 5
    assert result["score"] < 20


def test_blocked_prerequisite_is_counted_only_under_blockers():
    prereq = task(1, is_blocked=True, status="BLOCKED", blocked_since=d(-2), progress_pct=30,
                  due_date=d(1))
    dependent = task(2, assignee_id=11, prerequisite_ids=[1], start_date=d(2), due_date=d(6),
                     last_update_date=None)
    result = compute_risk(snap([prereq, dependent]), None, AS_OF)
    assert factor(result, "blockers")["contribution"] > 0
    assert factor(result, "dependencies")["contribution"] == 0
    assert "RULE_DEPENDENCY_CASCADE" not in rule_ids(result)
    blocker_rule = next(r for r in result["triggered_rules"] if r["rule_id"] == "RULE_ACTIVE_BLOCKER")
    assert blocker_rule["evidence"]["cascade_blocking_ids"] == [1]


def test_blockage_and_capacity_are_separate_causes():
    # Blocked, but plenty of time once it resumes: only the blockers factor moves.
    roomy = compute_risk(snap([task(1, is_blocked=True, status="BLOCKED", blocked_since=d(-1),
                                    estimated_hours=8, progress_pct=50, due_date=d(14))]), None, AS_OF)
    assert factor(roomy, "blockers")["contribution"] > 0
    assert factor(roomy, "delivery_forecast")["contribution"] == 0
    # Blocked and too much work left even if unblocked today: both causes count.
    tight = compute_risk(snap([task(1, is_blocked=True, status="BLOCKED", blocked_since=d(-1),
                                    estimated_hours=40, progress_pct=0, start_date=d(-1), due_date=d(1))]),
                         None, AS_OF)
    assert factor(tight, "blockers")["contribution"] > 0
    assert factor(tight, "delivery_forecast")["contribution"] > 0


def test_blocked_task_with_assignee_on_leave_is_at_least_medium():
    t = task(1, is_blocked=True, status="BLOCKED", blocked_since=d(-1), estimated_hours=30,
             progress_pct=20, start_date=d(-2), due_date=d(2), last_update_date=None)
    leaves = [{"user_id": 10, "start_date": d(0), "end_date": d(4)}]
    result = compute_risk(snap([t], leaves=leaves, target=d(10)), None, AS_OF)
    assert result["risk_level"] in ("MEDIUM", "HIGH")
    assert {"RULE_ACTIVE_BLOCKER", "RULE_LEAVE_CONFLICT"} <= rule_ids(result)


def test_blocker_severity_grows_with_age():
    young = compute_risk(snap([task(1, is_blocked=True, status="BLOCKED", blocked_since=d(0))]), None, AS_OF)
    old = compute_risk(snap([task(1, is_blocked=True, status="BLOCKED", blocked_since=d(-8))]), None, AS_OF)
    assert factor(old, "blockers")["value"] > factor(young, "blockers")["value"]


def test_approved_leave_with_slack_adds_no_risk():
    # 16h task over 3 weeks; assignee off for two days next week.
    t = task(1, estimated_hours=16, progress_pct=30, start_date=d(-7), due_date=d(14))
    leaves = [{"user_id": 10, "start_date": d(6), "end_date": d(7)}]
    with_leave = compute_risk(snap([t], leaves=leaves), None, AS_OF)
    without = compute_risk(snap([t]), None, AS_OF)
    assert "RULE_LEAVE_CONFLICT" not in rule_ids(with_leave)
    assert factor(with_leave, "delivery_forecast")["contribution"] == 0
    assert with_leave["score"] <= without["score"] + 0.1


def test_leave_days_are_not_expected_progress():
    # Started a week ago but was on approved leave all of last week.
    t = task(1, start_date=d(-8), due_date=d(10), progress_pct=0, last_update_date=None)
    leaves = [{"user_id": 10, "start_date": d(-8), "end_date": d(-1)}]
    on_leave = compute_risk(snap([t], leaves=leaves), None, AS_OF)
    not_on_leave = compute_risk(snap([t]), None, AS_OF)
    assert factor(on_leave, "schedule_variance")["contribution"] == 0
    assert factor(on_leave, "update_freshness")["contribution"] == 0
    assert factor(not_on_leave, "schedule_variance")["contribution"] > 0
    assert factor(not_on_leave, "update_freshness")["contribution"] > 0


def test_leave_that_makes_work_late_is_a_capacity_conflict():
    # 24h left, 4 working days to due, assignee on leave for 3 of them.
    t = task(1, estimated_hours=30, progress_pct=20, start_date=d(-1), due_date=d(3))
    leaves = [{"user_id": 10, "start_date": d(1), "end_date": d(3)}]
    result = compute_risk(snap([t], leaves=leaves), None, AS_OF)
    rule = next(r for r in result["triggered_rules"] if r["rule_id"] == "RULE_LEAVE_CONFLICT")
    conflict = rule["evidence"]["conflicts"][0]
    assert conflict["task_id"] == 1 and conflict["assignee_id"] == 10
    assert conflict["leave_start"] == d(1) and conflict["leave_end"] == d(3)
    assert "not a performance issue" in rule["description"]
    assert "approved leave" in factor(result, "delivery_forecast")["summary"]


def test_low_focus_on_planned_work_pushes_forecast_late():
    t = task(1, estimated_hours=40, progress_pct=40, start_date=d(-7), due_date=d(3))
    focused = compute_risk(snap([t]), None, AS_OF)
    drifting = compute_risk(snap([t], focus={"10": 0.5}), None, AS_OF)
    assert factor(focused, "delivery_forecast")["contribution"] == 0
    assert factor(drifting, "delivery_forecast")["contribution"] > 0
    assert "focus of 50%" in factor(drifting, "delivery_forecast")["summary"]


def test_overloaded_assignee_is_caught_by_forecast():
    tasks = [task(i, estimated_hours=24, progress_pct=0, start_date=d(0), due_date=d(3)) for i in (1, 2)]
    result = compute_risk(snap(tasks), None, AS_OF)
    assert "RULE_VELOCITY_STRETCH" in rule_ids(result)
    assert result["evidence"]["workload_by_assignee"] == {"10": 48.0}


def test_prerequisite_slip_flows_down_the_chain_in_the_forecast_only():
    prereq = task(1, estimated_hours=40, progress_pct=0, start_date=d(0), due_date=d(8))
    dependent = task(2, assignee_id=11, estimated_hours=8, prerequisite_ids=[1],
                     start_date=d(0), due_date=d(9))
    alone = compute_risk(snap([dependent | {"prerequisite_ids": []}]), None, AS_OF)
    chained = compute_risk(snap([prereq, dependent]), None, AS_OF)
    assert factor(alone, "delivery_forecast")["contribution"] == 0
    # Prerequisite finishes d(6); the dependent can only start d(7)... still fits.
    assert chained["evidence"]["forecasts"]["2"]["projected_finish"] > chained["evidence"]["forecasts"]["1"]["projected_finish"]

    slow = prereq | {"estimated_hours": 64}
    late = compute_risk(snap([slow, dependent]), None, AS_OF)
    assert 2 in next(r for r in late["triggered_rules"] if r["rule_id"] == "RULE_VELOCITY_STRETCH")["affected_task_ids"]
    # The slip is not charged again under dependencies.
    assert factor(late, "dependencies")["contribution"] == 0


def test_prerequisite_due_after_dependent_is_a_plan_conflict():
    prereq = task(1, due_date=d(10))
    dependent = task(2, assignee_id=11, prerequisite_ids=[1], due_date=d(8))
    result = compute_risk(snap([prereq, dependent]), None, AS_OF)
    assert "RULE_DEPENDENCY_CASCADE" in rule_ids(result)
    assert factor(result, "dependencies")["contribution"] > 0


def test_target_date_exceeded():
    t = task(1, due_date=d(20))
    result = compute_risk(snap([t], target=d(10)), None, AS_OF)
    assert "RULE_TARGET_END_EXCEEDED" in rule_ids(result)


def test_insufficient_data_scores_zero():
    empty = compute_risk(snap([]), None, AS_OF)
    assert empty["risk_level"] == "INSUFFICIENT_DATA" and empty["score"] == 0.0
    unestimated = compute_risk(snap([task(1, estimated_hours=0), task(2, estimated_hours=0), task(3)]), None, AS_OF)
    assert unestimated["risk_level"] == "INSUFFICIENT_DATA" and unestimated["score"] == 0.0


def test_contributions_add_up_to_score():
    tasks = [
        task(1, progress_pct=10),
        task(2, assignee_id=11, is_blocked=True, status="BLOCKED", blocked_since=d(-4)),
        task(3, assignee_id=12, start_date=d(-10), due_date=d(-1), progress_pct=60, last_update_date=d(-6)),
    ]
    result = compute_risk(snap(tasks), None, AS_OF)
    total = round(sum(b["contribution"] for b in result["factor_breakdown"]), 1)
    assert result["score"] == min(100.0, total)
    assert [b["key"] for b in result["factor_breakdown"]] == [
        "schedule_variance", "delivery_forecast", "blockers", "dependencies", "update_freshness",
    ]


def test_custom_weights_change_score_and_are_validated():
    s = snap([task(1, is_blocked=True, status="BLOCKED", blocked_since=d(-8))])
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    cfg["version"] = "project:3"
    cfg["weights"] = {"schedule_variance": 20, "delivery_forecast": 20, "blockers": 40,
                      "dependencies": 10, "update_freshness": 10}
    default = compute_risk(s, None, AS_OF)
    custom = compute_risk(s, cfg, AS_OF)
    assert custom["config_version"] == "project:3"
    assert factor(custom, "blockers")["contribution"] > factor(default, "blockers")["contribution"]

    bad = copy.deepcopy(cfg)
    bad["weights"]["blockers"] = 50
    with pytest.raises(ValueError, match="add up to 100"):
        validate_config(bad)
    bad = copy.deepcopy(cfg)
    bad["thresholds"] = {"medium": 70, "high": 60}
    with pytest.raises(ValueError):
        validate_config(bad)


def test_explain_change_lists_factor_deltas():
    before = compute_risk(snap([task(1, progress_pct=50)]), None, AS_OF)
    after = compute_risk(snap([task(1, progress_pct=10)]), None, AS_OF)
    first = explain_change(None, before)
    assert first["score_delta"] is None and first["headline"].startswith("First risk evaluation")
    change = explain_change(before, after)
    assert change["score_delta"] == round(after["score"] - before["score"], 1)
    assert change["changes"][0]["key"] == "schedule_variance"
    assert "planned" in change["changes"][0]["text"]
    assert result_fingerprint(before) != result_fingerprint(after)
    assert result_fingerprint(before) == result_fingerprint(compute_risk(snap([task(1, progress_pct=50)]), None, AS_OF))
