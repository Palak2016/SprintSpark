"""End-to-end recovery planning: AI path, fallback, validation, approval,
authorization, timeline date changes and analytics.

The model is always faked here; no network calls are made.
"""

from datetime import date, timedelta

import pytest

from app.core.config import settings
from app.core.security import create_access_token
from app.models.audit import AuditEvent
from app.models.company import Company
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.project import Project, ProjectMember
from app.models.recovery import ProposalStatus, RecoveryProposal
from app.models.task import Task, TaskDependency, TaskStatus
from app.models.user import User, UserRole
from app.models.work_log import DailyUpdate
from app.services import recovery_ai_planner, recovery_graph
from app.services.llm_client import LLMConfig, LLMError, LLMResult

FAKE_CONFIG = LLMConfig("openai", "gpt-test", "sk-test", "https://api.openai.com/v1", 5)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def scenario(db_session):
    """An isolated at-risk project managed by user 1 (the seeded manager)."""
    today = date.today()
    suffix = str(id(db_session))[-6:]
    asha = User(email=f"asha.{suffix}@example.com", hashed_password="x",
                full_name="Asha Iyer", role=UserRole.EMPLOYEE.value,
                company_id=1, company_name="WorkPilot AI")
    ben = User(email=f"ben.{suffix}@example.com", hashed_password="x",
               full_name="Ben Okafor", role=UserRole.EMPLOYEE.value,
               company_id=1, company_name="WorkPilot AI")
    db_session.add_all([asha, ben])
    db_session.flush()
    project = Project(name=f"Recovery scenario {suffix}", manager_id=1,
                      company_id=1,
                      start_date=today - timedelta(days=10),
                      target_end_date=today + timedelta(days=12))
    db_session.add(project)
    db_session.flush()
    db_session.add_all([
        ProjectMember(project_id=project.id, user_id=asha.id, role_in_project="Engineer"),
        ProjectMember(project_id=project.id, user_id=ben.id, role_in_project="Engineer"),
    ])
    blocked = Task(project_id=project.id, title="Payments API", assignee_id=asha.id,
                   status=TaskStatus.BLOCKED.value, priority="CRITICAL",
                   estimated_hours=10, progress_pct=20, is_blocked=True,
                   blocker_reason="Waiting for sandbox credentials",
                   start_date=today - timedelta(days=1), due_date=today + timedelta(days=3))
    follow = Task(project_id=project.id, title="Checkout UI", assignee_id=ben.id,
                  status=TaskStatus.TODO.value, priority="HIGH", estimated_hours=12,
                  start_date=today + timedelta(days=4), due_date=today + timedelta(days=9))
    db_session.add_all([blocked, follow])
    db_session.flush()
    db_session.add(TaskDependency(task_id=follow.id, prerequisite_task_id=blocked.id))
    db_session.add(LeaveRequest(user_id=ben.id, start_date=today + timedelta(days=5),
                                end_date=today + timedelta(days=6), reason="Private",
                                status=LeaveStatus.APPROVED.value))
    db_session.commit()
    yield {"project": project, "asha": asha, "ben": ben, "blocked": blocked, "follow": follow}

    # Leave nothing pending so other tests only see their own proposals.
    db_session.query(RecoveryProposal).filter(
        RecoveryProposal.project_id == project.id,
        RecoveryProposal.status == ProposalStatus.PENDING_APPROVAL.value,
    ).update({RecoveryProposal.status: ProposalStatus.REJECTED.value}, synchronize_session=False)
    db_session.commit()


def _fake_model(scenario):
    def model(system_prompt, user_prompt):
        assert "Private" not in user_prompt  # leave reasons are never sent
        assert "@example.com" not in user_prompt  # nor email addresses
        return LLMResult("openai", "gpt-test-0001", {
            "delay_explanation": "Payments API is blocked and Ben is on leave during Checkout UI.",
            "recommended_strategy_id": "S1",
            "recommendation_reason": "Moves Checkout UI to someone available.",
            "strategies": [{
                "strategy_id": "S1", "name": "Cover the leave", "approach": "REASSIGN",
                "summary": "Reassign Checkout UI and escalate the blocker.",
                "benefits": ["Avoids idle days"], "trade_offs": ["Asha takes on more work"],
                "assumptions": ["Credentials arrive within two days"], "risks": ["Context switching"],
                "actions": [
                    {"action_type": "REASSIGN", "task_id": scenario["follow"].id,
                     "proposed_values": {"assignee_id": scenario["asha"].id},
                     "reason": "Ben has approved leave inside the task window."},
                    {"action_type": "ESCALATE_BLOCKER", "task_id": scenario["blocked"].id,
                     "proposed_values": {"blocker_reason": "Escalate sandbox credentials to vendor"},
                     "reason": "Critical path is blocked."},
                    {"action_type": "REASSIGN", "task_id": scenario["blocked"].id,
                     "proposed_values": {"assignee_id": 987654},
                     "reason": "Invented person"},
                ],
            }],
        }, 87)
    return model


def _generate(client, token, project_id):
    return client.post(f"/api/v1/projects/{project_id}/recovery-proposals/generate", headers=_auth(token))


def test_ai_generation_is_traced_and_invalid_ai_actions_are_rejected(
    client, manager_token, db_session, scenario, monkeypatch
):
    monkeypatch.setattr(recovery_graph, "resolve_config", lambda: FAKE_CONFIG)
    monkeypatch.setattr(recovery_ai_planner, "call_json_model", _fake_model(scenario))

    response = _generate(client, manager_token, scenario["project"].id)
    assert response.status_code == 200
    proposal = response.json()
    trace = proposal["generation_trace"]

    assert proposal["status"] == "PENDING_APPROVAL"
    assert trace["generation_mode"] == "AI_HYBRID"
    assert trace["llm"]["invoked"] is True
    assert trace["llm"]["status"] == "SUCCEEDED"
    assert trace["llm"]["provider"] == "openai"
    assert trace["llm"]["model"] == "gpt-test-0001"
    assert trace["run_id"]
    assert trace["graph_nodes"] == [
        "context_collector", "risk_analyzer", "leave_impact", "schedule_analyzer",
        "recovery_planner", "output_validator", "approval_queue",
    ]
    assert proposal["title"].startswith("AI recovery plan")
    assert {a["source"] for a in proposal["proposed_actions"]} == {"AI"}
    assert all(a["validation"]["status"] in ("VALID", "ADVISORY") for a in proposal["proposed_actions"])
    assert not any(a["proposed_values"].get("assignee_id") == 987654 for a in proposal["proposed_actions"])
    assert any(r["task_id"] == scenario["blocked"].id and r["source"] == "AI"
               for r in trace["rejected_actions"])
    comparison = trace["schedule_comparison"]
    assert comparison["before"]["projected_completion"]
    assert comparison["after"]["projected_completion"]
    assert "not a measured result" in comparison["label"]
    assert any(s["source"] == "RULE" for s in trace["strategies"])  # rule baseline shown for comparison
    assert "sk-test" not in response.text

    audit = db_session.query(AuditEvent).filter(
        AuditEvent.project_id == scenario["project"].id,
        AuditEvent.event_type == "RECOVERY_PROPOSAL_GENERATED",
    ).first()
    assert audit.metadata_json["llm_invoked"] is True
    assert audit.metadata_json["model"] == "gpt-test-0001"


def test_model_failure_falls_back_to_rules_and_says_so(client, manager_token, scenario, monkeypatch):
    def broken(system_prompt, user_prompt):
        raise LLMError("TIMEOUT", "openai did not respond within 5s.", "openai", "gpt-test", 5000)

    monkeypatch.setattr(recovery_graph, "resolve_config", lambda: FAKE_CONFIG)
    monkeypatch.setattr(recovery_ai_planner, "call_json_model", broken)

    proposal = _generate(client, manager_token, scenario["project"].id).json()
    trace = proposal["generation_trace"]
    assert trace["generation_mode"] == "RULE_BASED_FALLBACK"
    assert trace["llm"]["invoked"] is True
    assert trace["llm"]["status"] == "FAILED"
    assert trace["llm"]["error_category"] == "TIMEOUT"
    assert {a["source"] for a in proposal["proposed_actions"]} == {"RULE"}
    assert not proposal["title"].startswith("AI")


def test_required_llm_failure_returns_503_without_saving(client, manager_token, db_session, scenario, monkeypatch):
    def broken(system_prompt, user_prompt):
        raise LLMError("HTTP_ERROR", "openai returned HTTP 500.", "openai", "gpt-test", 10)

    monkeypatch.setattr(settings, "RECOVERY_REQUIRE_LLM", True)
    monkeypatch.setattr(recovery_graph, "resolve_config", lambda: FAKE_CONFIG)
    monkeypatch.setattr(recovery_ai_planner, "call_json_model", broken)
    before = db_session.query(RecoveryProposal).filter(
        RecoveryProposal.project_id == scenario["project"].id).count()

    response = _generate(client, manager_token, scenario["project"].id)
    assert response.status_code == 503
    assert "HTTP 500" in response.json()["detail"]
    assert db_session.query(RecoveryProposal).filter(
        RecoveryProposal.project_id == scenario["project"].id).count() == before


def test_without_a_key_the_trace_reports_no_llm_call(client, manager_token, scenario):
    trace = _generate(client, manager_token, scenario["project"].id).json()["generation_trace"]
    assert trace["llm"]["invoked"] is False
    assert trace["llm"]["status"] == "NOT_CONFIGURED"
    assert trace["generation_mode"] == "RULE_BASED_FALLBACK"


def test_new_proposal_supersedes_older_pending_one(client, manager_token, db_session, scenario):
    first = _generate(client, manager_token, scenario["project"].id).json()
    second = _generate(client, manager_token, scenario["project"].id).json()
    old = db_session.get(RecoveryProposal, first["id"])
    db_session.refresh(old)
    assert old.status == ProposalStatus.SUPERSEDED.value
    assert second["status"] == "PENDING_APPROVAL"


def test_approval_is_blocked_when_project_data_changed(client, manager_token, db_session, scenario):
    proposal = _generate(client, manager_token, scenario["project"].id).json()
    assert any(a["task_id"] == scenario["blocked"].id for a in proposal["proposed_actions"])

    # The blocker gets cleared after the proposal was generated.
    cleared = client.post(f"/api/v1/tasks/{scenario['blocked'].id}/blocker",
                          headers=_auth(manager_token), json={"is_blocked": False})
    assert cleared.status_code == 200

    response = client.post(f"/api/v1/recovery-proposals/{proposal['id']}/decide",
                           headers=_auth(manager_token), json={"decision": "APPROVED"})
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "Nothing was applied" in detail["message"]
    assert detail["stale_actions"]

    record = db_session.get(RecoveryProposal, proposal["id"])
    db_session.refresh(record)
    assert record.status == ProposalStatus.PENDING_APPROVAL.value
    task = db_session.get(Task, scenario["follow"].id)
    db_session.refresh(task)
    assert task.assignee_id == scenario["ben"].id  # reassignment not applied


def test_approval_applies_validated_actions_and_records_execution(client, manager_token, db_session, scenario):
    proposal = _generate(client, manager_token, scenario["project"].id).json()
    response = client.post(f"/api/v1/recovery-proposals/{proposal['id']}/decide",
                           headers=_auth(manager_token), json={"decision": "APPROVED"})
    assert response.status_code == 200
    decision = response.json()
    applied = [a for a in proposal["proposed_actions"] if not a["is_advisory"]]
    assert decision["execution_report"]["status"] == "SUCCEEDED"
    assert decision["execution_report"]["applied_count"] == len(applied)
    assert len(decision["applied_changes"]) == len(applied)

    reassign = next((a for a in applied if a["action_type"] == "REASSIGN"), None)
    if reassign:
        task = db_session.get(Task, reassign["task_id"])
        db_session.refresh(task)
        assert task.assignee_id == reassign["proposed_values"]["assignee_id"]


def test_managers_can_only_view_company_projects(client, employee_token, db_session, scenario):
    other_company = Company(name="Other Recovery Company", join_code="OTHERREC")
    db_session.add(other_company)
    db_session.flush()
    other = User(email=f"other.mgr.{scenario['project'].id}@example.com", hashed_password="x",
                 full_name="Other Manager", role=UserRole.MANAGER.value,
                 company_id=other_company.id, company_name=other_company.name)
    db_session.add(other)
    db_session.commit()
    other_token = create_access_token(subject=other.id, role="MANAGER")
    manager_token = create_access_token(subject=1, role="MANAGER")
    proposal = _generate(client, manager_token, scenario["project"].id).json()

    assert client.get(f"/api/v1/projects/{scenario['project'].id}/recovery-proposals",
                      headers=_auth(other_token)).status_code == 403
    assert client.get(f"/api/v1/projects/{scenario['project'].id}/recovery-proposals",
                      headers=_auth(employee_token)).status_code == 403
    assert _generate(client, other_token, scenario["project"].id).status_code == 403
    assert client.post(f"/api/v1/recovery-proposals/{proposal['id']}/decide",
                       headers=_auth(other_token), json={"decision": "APPROVED"}).status_code == 403


def test_timeline_date_changes_are_validated(client, manager_token, employee_token, scenario):
    blocked, follow = scenario["blocked"], scenario["follow"]
    original_start = blocked.start_date
    original_due = blocked.due_date
    url = f"/api/v1/tasks/{blocked.id}"

    inverted = client.put(url, headers=_auth(manager_token), json={
        "start_date": str(original_due), "due_date": str(original_start - timedelta(days=1))})
    assert inverted.status_code == 400

    past_dependent = client.put(url, headers=_auth(manager_token), json={
        "due_date": str(follow.due_date + timedelta(days=1))})
    assert past_dependent.status_code == 409
    assert past_dependent.json()["detail"]["conflicts"][0]["task_id"] == follow.id

    assert client.put(url, headers=_auth(employee_token), json={
        "due_date": str(original_due + timedelta(days=1))}).status_code == 403

    moved = client.put(url, headers=_auth(manager_token), json={
        "start_date": str(original_start + timedelta(days=1)),
        "due_date": str(original_due + timedelta(days=1))})
    assert moved.status_code == 200
    assert moved.json()["due_date"] == str(original_due + timedelta(days=1))


def test_project_analytics_use_real_records(client, manager_token, db_session, scenario):
    other_company = Company(
        name="Analytics Outsider Company",
        join_code=f"ANALYTICS{scenario['project'].id}",
    )
    db_session.add(other_company)
    db_session.flush()
    url = f"/api/v1/analytics/projects/{scenario['project'].id}"
    data = client.get(url, headers=_auth(manager_token)).json()
    counts = {row["status"]: row["count"] for row in data["status_distribution"]}
    assert counts == {"TODO": 1, "IN_PROGRESS": 0, "BLOCKED": 1, "COMPLETED": 0}
    assert data["progress_trend"]["available"] is False
    names = {row["name"] for row in data["workload"]["members"]}
    assert {"Asha Iyer", "Ben Okafor"} <= names
    assert data["projection"]["projected_completion"]

    db_session.add(DailyUpdate(task_id=scenario["blocked"].id, user_id=scenario["asha"].id,
                               progress_pct=20, date=date.today()))
    db_session.commit()
    trend = client.get(url, headers=_auth(manager_token)).json()["progress_trend"]
    assert trend["available"] is True
    assert trend["tasks_included"] == 1
    assert trend["points"][-1]["actual_pct"] == 20.0

    outsider = User(email=f"outsider.{scenario['project'].id}@example.com", hashed_password="x",
                    full_name="Outsider", role=UserRole.EMPLOYEE.value,
                    company_id=other_company.id, company_name=other_company.name)
    db_session.add(outsider)
    db_session.commit()
    token = create_access_token(subject=outsider.id, role="EMPLOYEE")
    assert client.get(url, headers=_auth(token)).status_code == 403


def test_portfolio_health_lists_managed_projects(client, manager_token, scenario):
    data = client.get("/api/v1/analytics/portfolio", headers=_auth(manager_token)).json()
    ids = {p["project_id"] for p in data["projects"]}
    assert scenario["project"].id in ids
    assert sum(row["count"] for row in data["distribution"]) == len(data["projects"])
