"""The backend, not the model, decides which extracted signals are kept."""

from types import SimpleNamespace

from app.services.progress_estimator import (
    ProgressEstimate,
    create_progress_analysis_token,
    validate_signals,
    verify_progress_analysis_claims,
)

NOTES = (
    "Spent most of today fixing the login bug QA raised on staging. "
    "Got the Razorpay webhook handler half done. Still waiting for Neha's "
    "order-service endpoint, can't test refunds until that's merged."
)

MAIN = SimpleNamespace(id=12, title="Payments API integration", assignee_id=2)
LOGIN = SimpleNamespace(id=8, title="Staging login bug", assignee_id=5)
ORDER = SimpleNamespace(id=15, title="Order-service refund endpoint", assignee_id=6)
OWN = SimpleNamespace(id=20, title="Payments docs", assignee_id=2)
TASKS = [MAIN, LOGIN, ORDER, OWN]


def kinds(signals):
    return [(s["kind"], s["related_task_id"]) for s in signals]


def test_worked_example_is_kept():
    raw = {
        "activities": [
            {"kind": "UNPLANNED_PROJECT", "task_id": 8, "effort_share": 0.6,
             "evidence": "fixing the login bug QA raised on staging"},
            {"kind": "PLANNED", "task_id": 12, "effort_share": 0.4,
             "evidence": "Got the Razorpay webhook handler half done"},
        ],
        "mentions": [
            {"kind": "DEPENDENCY", "task_id": 15, "evidence": "waiting for Neha's order-service endpoint"},
            {"kind": "BLOCKER", "task_id": None, "evidence": "can't test refunds until that's merged"},
        ],
    }
    signals = validate_signals(raw, MAIN, TASKS, NOTES)
    assert kinds(signals) == [("UNPLANNED_PROJECT", 8), ("PLANNED", None), ("DEPENDENCY", 15), ("BLOCKER", None)]
    assert [s["index"] for s in signals] == [0, 1, 2, 3]
    assert signals[0]["related_task_title"] == "Staging login bug"


def test_invented_quotes_and_unknown_tasks_are_dropped():
    raw = {
        "activities": [
            {"kind": "PLANNED", "effort_share": 0.5, "evidence": "finished the refund flow"},  # not in notes
            {"kind": "UNPLANNED_PROJECT", "task_id": 999, "effort_share": 0.5,
             "evidence": "fixing the login bug"},  # unknown task id
        ],
        "mentions": [
            {"kind": "DEPENDENCY", "task_id": None, "evidence": "waiting for Neha's order-service endpoint"},
            {"kind": "DEPENDENCY", "task_id": 12, "evidence": "waiting for Neha"},  # self-dependency
            {"kind": "DEADLINE", "evidence": "half done"},  # unknown kind
        ],
    }
    assert validate_signals(raw, MAIN, TASKS, NOTES) == []


def test_work_on_own_other_task_is_planned_not_drift():
    raw = {"activities": [{"kind": "UNPLANNED_PROJECT", "task_id": 20, "effort_share": 0.3,
                           "evidence": "Got the Razorpay webhook handler"}]}
    assert kinds(validate_signals(raw, MAIN, TASKS, NOTES)) == [("PLANNED", 20)]


def test_unmapped_project_work_becomes_other():
    raw = {"activities": [{"kind": "UNPLANNED_PROJECT", "task_id": None, "effort_share": 0.3,
                           "evidence": "fixing the login bug"}]}
    assert kinds(validate_signals(raw, MAIN, TASKS, NOTES)) == [("UNPLANNED_OTHER", None)]


def test_effort_shares_are_bounded_and_scaled():
    raw = {"activities": [
        {"kind": "UNPLANNED_OTHER", "effort_share": 0.9, "evidence": "fixing the login bug"},
        {"kind": "PLANNED", "effort_share": 0.6, "evidence": "webhook handler half done"},
        {"kind": "REWORK", "effort_share": 1.5, "evidence": "half done"},  # out of range
        {"kind": "REWORK", "effort_share": True, "evidence": "half done"},  # not a number
    ]}
    signals = validate_signals(raw, MAIN, TASKS, NOTES)
    assert [s["effort_share"] for s in signals] == [0.6, 0.4]


def test_evidence_match_ignores_case_and_whitespace():
    raw = {"mentions": [{"kind": "SCOPE_CHANGE", "evidence": "CAN'T   test refunds"}]}
    assert kinds(validate_signals(raw, MAIN, TASKS, NOTES)) == [("SCOPE_CHANGE", None)]


def test_missing_or_malformed_lists_give_no_signals():
    assert validate_signals({}, MAIN, TASKS, NOTES) == []
    assert validate_signals({"activities": "x", "mentions": None}, MAIN, TASKS, NOTES) == []


def test_token_carries_the_previewed_signals():
    signals = validate_signals({"mentions": [{"kind": "BLOCKER", "evidence": "can't test refunds"}]},
                               MAIN, TASKS, NOTES)
    token = create_progress_analysis_token(12, 2, NOTES, 30, 40, signals=signals, model="gemini-test")
    progress, carried, model = verify_progress_analysis_claims(token, 12, 2, NOTES, 30)
    assert progress == 40 and carried == signals and model == "gemini-test"


def test_progress_estimate_still_unpacks_as_a_pair():
    estimate = ProgressEstimate(40, "AI estimate: x", [{"kind": "PLANNED"}], "m")
    progress, explanation = estimate
    assert (progress, explanation) == (40, "AI estimate: x")
    assert estimate.signals == [{"kind": "PLANNED"}] and estimate.model == "m"
