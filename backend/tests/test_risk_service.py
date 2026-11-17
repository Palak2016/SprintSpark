"""Risk history, automatic recalculation, update signals and manager review."""

from datetime import date, timedelta

import pytest

from app.models.leave import LeaveRequest, LeaveStatus
from app.models.project import Project, ProjectMember
from app.models.recovery import ProposalStatus, RecoveryProposal
from app.models.risk import DailyUpdateSignal, RiskAnalysis
from app.models.task import Task, TaskDependency, TaskStatus
from app.services.progress_estimator import ProgressEstimate
from app.services.risk_service import recompute_project_risk


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def risk_project(db_session):
    today = date.today()
    project = Project(name=f"Risk service {id(db_session)}", manager_id=1, company_id=1,
                      start_date=today - timedelta(days=10), target_end_date=today + timedelta(days=30))
    db_session.add(project)
    db_session.flush()
    db_session.add(ProjectMember(project_id=project.id, user_id=2, role_in_project="Engineer"))
    main = Task(project_id=project.id, title="Payments API integration", assignee_id=2,
                status=TaskStatus.IN_PROGRESS.value, estimated_hours=40, progress_pct=30,
                start_date=today - timedelta(days=7), due_date=today + timedelta(days=4))
    other = Task(project_id=project.id, title="Order service refund endpoint", assignee_id=3,
                 status=TaskStatus.IN_PROGRESS.value, estimated_hours=16, progress_pct=10,
                 start_date=today - timedelta(days=3), due_date=today + timedelta(days=6))
    db_session.add_all([main, other])
    db_session.commit()
    yield {"project": project, "main": main, "other": other}
    db_session.query(RecoveryProposal).filter(
        RecoveryProposal.project_id == project.id,
        RecoveryProposal.status == ProposalStatus.PENDING_APPROVAL.value,
    ).update({RecoveryProposal.status: ProposalStatus.REJECTED.value}, synchronize_session=False)
    db_session.commit()


def _history(db_session, project_id):
    return (
        db_session.query(RiskAnalysis)
        .filter(RiskAnalysis.project_id == project_id)
        .order_by(RiskAnalysis.id)
        .all()
    )


def test_unchanged_project_does_not_add_history(db_session, risk_project):
    pid = risk_project["project"].id
    first = recompute_project_risk(db_session, pid, "MANUAL")
    second = recompute_project_risk(db_session, pid, "MANUAL")
    db_session.commit()
    assert first.id == second.id
    assert first.input_hash and first.config_version == "default-v1"
    assert first.change_explanation["headline"].startswith("First risk evaluation")


def test_progress_change_records_a_row_with_explanation(client, employee_token, manager_token, db_session,
                                                        risk_project):
    pid = risk_project["project"].id
    before = recompute_project_risk(db_session, pid, "MANUAL")
    db_session.commit()

    response = client.post(
        f"/api/v1/tasks/{risk_project['main'].id}/progress",
        headers=_auth(employee_token),
        json={"progress_pct": 90},
    )
    assert response.status_code == 200

    rows = _history(db_session, pid)
    latest = rows[-1]
    assert latest.id != before.id
    assert latest.trigger_type == "TASK_CHANGE"
    assert latest.previous_analysis_id == before.id
    assert latest.score <= before.score
    assert latest.change_explanation["headline"].startswith("Risk ")

    history = client.get(f"/api/v1/projects/{pid}/risk-history", headers=_auth(manager_token))
    assert history.status_code == 200
    assert history.json()[0]["id"] == latest.id


def test_daily_update_stores_signals_and_rescores(client, employee_token, manager_token, db_session,
                                                  risk_project, monkeypatch):
    from app.api.v1 import work_logs

    main, other = risk_project["main"], risk_project["other"]
    notes = ("Spent most of today fixing an urgent production issue for another team. "
             "Got the webhook handler half done. Still waiting for the refund endpoint.")

    def fake_estimate(task, update_notes):
        assert update_notes == notes
        return ProgressEstimate(40, "AI estimate: webhook handler half done.", [
            {"index": 0, "kind": "UNPLANNED_OTHER", "related_task_id": None, "effort_share": 0.6,
             "evidence": "fixing an urgent production issue for another team", "related_task_title": None},
            {"index": 1, "kind": "PLANNED", "related_task_id": None, "effort_share": 0.4,
             "evidence": "Got the webhook handler half done", "related_task_title": None},
            {"index": 2, "kind": "DEPENDENCY", "related_task_id": other.id, "effort_share": None,
             "evidence": "waiting for the refund endpoint", "related_task_title": other.title},
            {"index": 3, "kind": "SCOPE_CHANGE", "related_task_id": None, "effort_share": None,
             "evidence": "Got the webhook handler half done", "related_task_title": None},
        ], "gemini-test")

    monkeypatch.setattr(work_logs, "estimate_task_progress", fake_estimate)
    analysis = client.post("/api/v1/daily-updates/analyze-progress", headers=_auth(employee_token),
                           json={"task_id": main.id, "update_notes": notes})
    assert analysis.status_code == 200
    body = analysis.json()
    assert [s["kind"] for s in body["signals"]] == ["UNPLANNED_OTHER", "PLANNED", "DEPENDENCY", "SCOPE_CHANGE"]

    # The employee removes the scope-change item before submitting.
    submitted = client.post("/api/v1/daily-updates", headers=_auth(employee_token), json={
        "task_id": main.id, "update_notes": notes,
        "analysis_token": body["analysis_token"], "rejected_signal_indexes": [3],
    })
    assert submitted.status_code == 201
    update_id = submitted.json()["id"]

    stored = db_session.query(DailyUpdateSignal).filter(DailyUpdateSignal.daily_update_id == update_id).all()
    by_kind = {s.kind: s for s in stored}
    assert set(by_kind) == {"UNPLANNED_OTHER", "PLANNED", "DEPENDENCY"}
    assert by_kind["UNPLANNED_OTHER"].status == "CONFIRMED"
    assert by_kind["DEPENDENCY"].status == "PENDING_REVIEW"

    latest = _history(db_session, risk_project["project"].id)[-1]
    assert latest.trigger_type == "DAILY_UPDATE" and latest.trigger_ref_id == update_id
    forecast = latest.evidence_json["forecasts"][str(main.id)]
    assert forecast["focus_ratio"] == 0.4

    # Nothing changes project data until the manager accepts the suggestion.
    assert db_session.query(TaskDependency).filter(TaskDependency.task_id == main.id).count() == 0
    pending = client.get(f"/api/v1/projects/{risk_project['project'].id}/risk-suggestions",
                         headers=_auth(manager_token)).json()
    assert [p["kind"] for p in pending] == ["DEPENDENCY"]
    assert client.get(f"/api/v1/projects/{risk_project['project'].id}/risk-suggestions",
                      headers=_auth(employee_token)).status_code == 403

    accepted = client.post(f"/api/v1/risk-suggestions/{pending[0]['id']}/review",
                           headers=_auth(manager_token), json={"decision": "ACCEPT"})
    assert accepted.status_code == 200 and accepted.json()["status"] == "ACCEPTED"
    assert db_session.query(TaskDependency).filter(
        TaskDependency.task_id == main.id, TaskDependency.prerequisite_task_id == other.id
    ).count() == 1
    again = client.post(f"/api/v1/risk-suggestions/{pending[0]['id']}/review",
                        headers=_auth(manager_token), json={"decision": "REJECT"})
    assert again.status_code == 409


def test_leave_approval_rescores_affected_projects(client, manager_token, db_session, risk_project):
    today = date.today()
    leave = LeaveRequest(user_id=2, start_date=today + timedelta(days=1), end_date=today + timedelta(days=3),
                         reason="Private", status=LeaveStatus.PENDING.value)
    db_session.add(leave)
    db_session.commit()

    response = client.put(f"/api/v1/leave-requests/{leave.id}/review", headers=_auth(manager_token),
                          json={"status": "APPROVED", "decision_notes": "ok"})
    assert response.status_code == 200
    rows = _history(db_session, risk_project["project"].id)
    assert rows and rows[-1].trigger_type == "LEAVE_CHANGE"
    # Leave is described as a capacity issue, never as the employee falling behind.
    for rule in rows[-1].triggered_rules:
        if rule["rule_id"] == "RULE_LEAVE_CONFLICT":
            assert "not a performance issue" in rule["description"]


def test_risk_config_is_validated_and_versioned(client, manager_token, employee_token, db_session, risk_project):
    pid = risk_project["project"].id
    bad = client.put(f"/api/v1/projects/{pid}/risk-config", headers=_auth(manager_token), json={
        "weights": {"schedule_variance": 50, "delivery_forecast": 50, "blockers": 20,
                    "dependencies": 10, "update_freshness": 10},
    })
    assert bad.status_code == 422
    assert client.put(f"/api/v1/projects/{pid}/risk-config", headers=_auth(employee_token), json={
        "weights": {"schedule_variance": 30, "delivery_forecast": 30, "blockers": 20,
                    "dependencies": 10, "update_freshness": 10},
    }).status_code == 403

    good = client.put(f"/api/v1/projects/{pid}/risk-config", headers=_auth(manager_token), json={
        "weights": {"schedule_variance": 25, "delivery_forecast": 35, "blockers": 20,
                    "dependencies": 10, "update_freshness": 10},
        "notes": "Deadline-driven client project",
    })
    assert good.status_code == 200
    version = good.json()["version"]
    assert version.startswith("project:")
    latest = _history(db_session, pid)[-1]
    assert latest.config_version == version


def test_recovery_reuses_the_risk_row(client, manager_token, db_session, risk_project):
    pid = risk_project["project"].id
    recompute_project_risk(db_session, pid, "MANUAL")
    db_session.commit()
    count_before = len(_history(db_session, pid))

    response = client.post(f"/api/v1/projects/{pid}/recovery-proposals/generate", headers=_auth(manager_token))
    assert response.status_code == 200
    rows = _history(db_session, pid)
    assert len(rows) == count_before  # nothing changed, so no duplicate history row
    proposal = db_session.get(RecoveryProposal, response.json()["id"])
    assert proposal.risk_analysis_id == rows[-1].id


def test_recovery_for_long_overdue_task_proposes_a_future_date(client, manager_token, db_session, risk_project):
    today = date.today()
    overdue = Task(project_id=risk_project["project"].id, title="Long overdue report", assignee_id=2,
                   status=TaskStatus.IN_PROGRESS.value, estimated_hours=8, progress_pct=50,
                   start_date=today - timedelta(days=20), due_date=today - timedelta(days=10))
    db_session.add(overdue)
    db_session.commit()

    response = client.post(f"/api/v1/projects/{risk_project['project'].id}/recovery-proposals/generate",
                           headers=_auth(manager_token))
    assert response.status_code == 200
    extension = next(
        (a for a in response.json()["proposed_actions"]
         if a["task_id"] == overdue.id and a["action_type"] == "EXTEND_DEADLINE"),
        None,
    )
    assert extension is not None
    assert date.fromisoformat(extension["proposed_values"]["due_date"]) > today
