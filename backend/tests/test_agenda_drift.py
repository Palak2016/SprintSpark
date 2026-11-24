from datetime import date, timedelta
from types import SimpleNamespace

from app.models.agenda_drift import AgendaDrift
from app.models.notification import Notification
from app.models.project import Project
from app.models.risk import DailyUpdateSignal
from app.models.task import Task
from app.models.work_log import DailyUpdate
from app.core.security import create_access_token
from app.services import drift_analysis_service


def _task_and_update(db_session, notes, progress=25, blocked=False, blocker=None):
    project = Project(
        name=f"Agenda drift test {id(db_session)}",
        manager_id=1,
        company_id=1,
        start_date=date.today(),
        target_end_date=date.today() + timedelta(days=14),
    )
    db_session.add(project)
    db_session.flush()
    task = Task(
        project_id=project.id,
        title=f"Implement PostgreSQL CDC replication {project.id}",
        description="Configure logical replication and validate foreign key consistency.",
        assignee_id=2,
        priority="HIGH",
        status="IN_PROGRESS",
        progress_pct=progress,
        start_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        is_blocked=blocked,
    )
    db_session.add(task)
    db_session.flush()
    update = DailyUpdate(
        task_id=task.id,
        user_id=2,
        progress_pct=progress,
        is_blocked=blocked,
        blocker_notes=blocker,
        update_notes=notes,
        date=date.today(),
    )
    db_session.add(update)
    db_session.flush()
    return task, update


def _use_model(monkeypatch, relevance, confidence=90, actions=None, needs_clarification=False):
    monkeypatch.setattr(
        drift_analysis_service,
        "resolve_config",
        lambda: SimpleNamespace(provider="gemini"),
    )
    monkeypatch.setattr(
        drift_analysis_service,
        "call_json_model",
        lambda *_args, **_kwargs: SimpleNamespace(
            content={
                "relevance_score": relevance,
                "confidence_score": confidence,
                "explanation": "The report was compared with the task deliverables.",
                "mismatches": [],
                "recommended_actions": actions or [],
                "needs_clarification": needs_clarification,
                "clarification_question": "",
            },
            provider="gemini",
            model="test-model",
        ),
    )


def test_fully_aligned_update_is_not_flagged(db_session, monkeypatch):
    _use_model(monkeypatch, 94, actions=["Validate foreign key consistency in the CDC replication setup."])
    task, update = _task_and_update(
        db_session,
        "Configured logical replication and checked consistency for the PostgreSQL CDC flow.",
    )

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "ALIGNED"
    assert result["alignment_score"] == 94
    assert result["recommended_actions"] == []


def test_unrelated_update_gets_explanation_and_task_actions(db_session, monkeypatch):
    _use_model(
        monkeypatch,
        18,
        actions=["Resume PostgreSQL CDC replication by validating foreign-key consistency in the stream."],
    )
    task, update = _task_and_update(
        db_session,
        "Built the marketing homepage animation and adjusted the landing page colors.",
    )

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "OFF_TRACK"
    assert result["drift_explanation"]
    assert any("CDC replication" in action for action in result["recommended_actions"])


def test_partially_related_update_is_classified_as_partial(db_session, monkeypatch):
    _use_model(monkeypatch, 64)
    task, update = _task_and_update(
        db_session,
        "Configured the replication stream; foreign key validation is still pending.",
    )

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "PARTIALLY_ALIGNED"


def test_reported_blocker_is_not_treated_as_off_track(db_session, monkeypatch):
    _use_model(
        monkeypatch,
        15,
        actions=["Request staging database credentials from the dependency owner, then resume CDC validation."],
    )
    task, update = _task_and_update(
        db_session,
        "Could not continue because the staging database is unavailable.",
        blocked=True,
        blocker="Staging database credentials have not been provisioned.",
    )

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "NEEDS_CLARIFICATION"
    assert result["reported_blockers"] == update.blocker_notes
    assert any("staging database credentials" in action for action in result["recommended_actions"])


def test_accepted_scope_change_is_not_classified_as_off_track(db_session, monkeypatch):
    _use_model(monkeypatch, 10)
    task, update = _task_and_update(db_session, "Handled an urgent approved customer outage task.")
    db_session.add(DailyUpdateSignal(
        daily_update_id=update.id,
        project_id=task.project_id,
        task_id=task.id,
        user_id=update.user_id,
        kind="SCOPE_CHANGE",
        evidence="Manager approved urgent customer outage work.",
        status="ACCEPTED",
        update_date=update.date,
        reviewed_by=1,
    ))
    db_session.flush()

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "PARTIALLY_ALIGNED"
    assert "manager-approved" in result["drift_explanation"].lower()


def test_vague_update_requests_clarification(db_session, monkeypatch):
    _use_model(monkeypatch, 95)
    task, update = _task_and_update(db_session, "Worked on it.")

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "NEEDS_CLARIFICATION"


def test_manager_self_report_gets_task_tools_without_manager_escalation(
    db_session,
    monkeypatch,
):
    from app.services.agenda_drift_service import analyze_and_persist_daily_update

    _use_model(
        monkeypatch,
        58,
        actions=[
            "Use Alembic to generate the schema migration, apply it to a test database, "
            "and run pytest for the affected endpoint."
        ],
    )
    task, update = _task_and_update(
        db_session,
        "Updated the PostgreSQL schema and started the endpoint implementation.",
    )
    task.title = "Build FastAPI backend endpoint and PostgreSQL migration"
    task.description = "Add an Alembic migration, implement the endpoint, and test it."
    task.project.manager_id = update.user_id

    drift = analyze_and_persist_daily_update(db_session, task, update)
    db_session.flush()

    assert drift.alignment_status == "PARTIALLY_ALIGNED"
    assert drift.recommended_actions
    assert all("manager" not in action.lower() for action in drift.recommended_actions)
    assert any("Alembic" in action and "pytest" in action for action in drift.recommended_actions)
    assert drift.recovery_proposal_id is None


def test_aligned_manager_self_report_still_gets_future_work_guidance(
    db_session,
    monkeypatch,
):
    _use_model(
        monkeypatch,
        96,
        actions=["Use curl or Postman to verify successful, invalid-input, and unauthorized endpoint requests."],
    )
    task, update = _task_and_update(
        db_session,
        "Implemented the backend endpoint and verified a valid request.",
    )
    task.title = "Build FastAPI backend endpoint"
    task.description = "Implement the endpoint and test response validation."
    task.project.manager_id = update.user_id

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "ALIGNED"
    assert result["recommended_actions"]
    assert all("manager" not in action.lower() for action in result["recommended_actions"])
    assert any("curl or Postman" in action for action in result["recommended_actions"])


def test_unassigned_update_does_not_create_drift(db_session):
    from app.services.agenda_drift_service import analyze_and_persist_daily_update

    task = db_session.query(Task).filter(Task.assignee_id == 2).first()
    update = SimpleNamespace(user_id=3, id=None)

    assert analyze_and_persist_daily_update(db_session, task, update) is None


def test_stalled_progress_is_separate_from_semantic_alignment(db_session, monkeypatch):
    from datetime import datetime

    _use_model(monkeypatch, 92)
    task, update = _task_and_update(
        db_session,
        "Verified the replication configuration against the PostgreSQL schema.",
        progress=25,
    )
    for day in (2, 1):
        db_session.add(DailyUpdate(
            task_id=task.id,
            user_id=2,
            progress_pct=25,
            is_blocked=False,
            update_notes="Worked on replication verification.",
            date=date.today() - timedelta(days=day),
            created_at=datetime.now() - timedelta(days=day),
        ))
    db_session.flush()

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "ALIGNED"
    assert any(item["kind"] == "stalled_progress" for item in result["detected_mismatches"])


def test_no_semantic_provider_asks_for_clarification_instead_of_guessing(db_session, monkeypatch):
    monkeypatch.setattr(drift_analysis_service, "resolve_config", lambda: None)
    task, update = _task_and_update(
        db_session,
        "Prepared a slide deck for tomorrow's product review meeting.",
    )

    result = drift_analysis_service.analyze_daily_update(db_session, task, update)

    assert result["alignment_status"] == "NEEDS_CLARIFICATION"
    assert result["analysis_details"]["ai_used"] is False
    assert result["recommended_actions"] == []


def test_missing_ai_recommendations_do_not_create_a_rule_based_recovery_plan(
    db_session,
    monkeypatch,
):
    from app.services.agenda_drift_service import analyze_and_persist_daily_update

    _use_model(monkeypatch, 12)
    task, update = _task_and_update(
        db_session,
        "Built the marketing homepage animation and adjusted the landing page colors.",
    )

    drift = analyze_and_persist_daily_update(db_session, task, update)

    assert drift.alignment_status == "OFF_TRACK"
    assert drift.recommended_actions == []
    assert drift.recovery_proposal_id is None


def test_persisted_analysis_links_advisory_recovery_without_mutating_task(
    db_session,
    monkeypatch,
):
    from app.models.recovery import RecoveryProposal
    from app.services.agenda_drift_service import analyze_and_persist_daily_update

    _use_model(
        monkeypatch,
        12,
        actions=[
            "Resume CDC validation by checking the replication consumer logs, then rerun the foreign-key consistency query."
        ],
    )
    task, update = _task_and_update(
        db_session,
        "Built the marketing homepage animation and adjusted the landing page colors.",
    )
    original_priority = task.priority
    first = analyze_and_persist_daily_update(db_session, task, update)
    db_session.flush()
    second = analyze_and_persist_daily_update(db_session, task, update)

    assert first.id == second.id
    assert db_session.query(AgendaDrift).filter_by(daily_update_id=update.id).count() == 1
    assert second.recovery_proposal_id is not None
    proposal = db_session.query(RecoveryProposal).filter_by(
        id=second.recovery_proposal_id,
    ).one()
    assert proposal.status == "PENDING_APPROVAL"
    assert proposal.proposed_actions[0]["action_type"] == "SPLIT_EFFORT"
    assert proposal.proposed_actions[0]["source"] == "AI"
    assert "Resume CDC validation" in proposal.proposed_actions[0]["proposed_values"]["note"]
    assert db_session.query(Notification).filter_by(
        type="AGENDA_DRIFT_DETECTED",
        title=f"Agenda check: {task.title}",
    ).count() == 1
    assert task.priority == original_priority
    assert task.due_date == date.today() + timedelta(days=5)


def test_manager_project_access_and_review_are_scoped(
    client,
    db_session,
    manager_token,
    employee_token,
    monkeypatch,
):
    from app.services.agenda_drift_service import analyze_and_persist_daily_update

    _use_model(
        monkeypatch,
        12,
        actions=[
            "Resume CDC validation by checking the replication consumer logs, then rerun the foreign-key consistency query."
        ],
    )
    task, update = _task_and_update(
        db_session,
        "Built the marketing homepage animation and adjusted the landing page colors.",
    )
    drift = analyze_and_persist_daily_update(db_session, task, update)
    db_session.commit()
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    employee_headers = {"Authorization": f"Bearer {employee_token}"}

    response = client.get(
        f"/api/v1/agenda-drift/projects/{task.project_id}",
        headers=manager_headers,
    )
    assert response.status_code == 200
    assert any(item["id"] == drift.id for item in response.json())
    assert client.get("/api/v1/agenda-drift/my-drift", headers=employee_headers).status_code == 200
    assert client.get(
        f"/api/v1/agenda-drift/projects/{task.project_id}",
        headers=employee_headers,
    ).status_code == 403

    clarification = client.post(
        f"/api/v1/agenda-drift/{drift.id}/clarify",
        headers=employee_headers,
        json={"clarification": "I was assigned the customer outage work by my manager."},
    )
    assert clarification.status_code == 200
    assert clarification.json()["employee_clarification"].startswith("I was assigned")

    other_employee_headers = {
        "Authorization": "Bearer " + create_access_token(subject=3, role="EMPLOYEE"),
    }
    unauthorized_clarification = client.post(
        f"/api/v1/agenda-drift/{drift.id}/clarify",
        headers=other_employee_headers,
        json={"clarification": "This update is not mine."},
    )
    assert unauthorized_clarification.status_code == 403

    reviewed = client.patch(
        f"/api/v1/agenda-drift/{drift.id}/review",
        headers=manager_headers,
        json={"decision": "ACKNOWLEDGED", "feedback": "Reviewed the context with the employee."},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["manager_review_status"] == "ACKNOWLEDGED"

    original_priority = task.priority
    original_due_date = task.due_date
    decision = client.post(
        f"/api/v1/recovery-proposals/{drift.recovery_proposal_id}/decide",
        headers=manager_headers,
        json={"decision": "APPROVED", "decision_notes": "Approved the advisory next-step proposal."},
    )
    assert decision.status_code == 200
    assert decision.json()["applied_changes"] == []
    assert task.priority == original_priority
    assert task.due_date == original_due_date
