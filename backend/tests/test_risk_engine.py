from datetime import date, timedelta

from app.models.project import Project, ProjectMember
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.leave import LeaveRequest, LeaveStatus
from app.services.risk_engine import analyze_project_risk

# A fixed Tuesday, so working-day arithmetic does not depend on when tests run.
AS_OF = date(2026, 11, 17)


def test_deterministic_risk_evaluation(db_session):
    risk_project = Project(
        name="High Risk Isolated Project",
        manager_id=1,
        company_id=1,
        start_date=AS_OF - timedelta(days=5),
        target_end_date=AS_OF + timedelta(days=10)
    )
    db_session.add(risk_project)
    db_session.flush()
    db_session.add(ProjectMember(project_id=risk_project.id, user_id=2, role_in_project="Contributor"))
    db_session.flush()

    # 24h left with exactly three working days (Tue-Thu) before it is due.
    blocked_t = Task(
        project_id=risk_project.id,
        title="Critical Blocked Task",
        assignee_id=2,
        priority=TaskPriority.CRITICAL.value,
        status=TaskStatus.BLOCKED.value,
        estimated_hours=30.0,
        progress_pct=20,
        start_date=AS_OF - timedelta(days=2),
        due_date=AS_OF + timedelta(days=2),
        is_blocked=True,
        blocker_reason="Waiting on cloud vendor support"
    )
    db_session.add(blocked_t)
    # Approved leave covering those three days.
    db_session.add(LeaveRequest(
        user_id=2,
        start_date=AS_OF,
        end_date=AS_OF + timedelta(days=4),
        reason="Doctor visit and recovery",
        status=LeaveStatus.APPROVED.value
    ))
    db_session.commit()

    result = analyze_project_risk(risk_project, db_session, as_of=AS_OF)
    again = analyze_project_risk(risk_project, db_session, as_of=AS_OF)
    assert result == again
    assert result["risk_level"] in ["MEDIUM", "HIGH"]
    rule_ids = [r["rule_id"] for r in result["triggered_rules"]]
    assert "RULE_ACTIVE_BLOCKER" in rule_ids
    assert "RULE_LEAVE_CONFLICT" in rule_ids
    # Leave makes the work late even if the blocker cleared today (forecast);
    # staying blocked is a separate cause (blockers).
    contributions = {f["key"]: f["contribution"] for f in result["factor_breakdown"]}
    assert contributions["delivery_forecast"] > 0
    assert contributions["blockers"] > 0
    assert blocked_t.blocked_since is not None


def test_insufficient_data_detection(db_session):
    empty_p = Project(
        name="Empty Project Without Tasks",
        manager_id=1,
        start_date=date(2026, 10, 1),
        target_end_date=date(2026, 11, 1)
    )
    db_session.add(empty_p)
    db_session.commit()

    result = analyze_project_risk(empty_p, db_session)
    assert result["risk_level"] == "INSUFFICIENT_DATA"
    assert result["score"] == 0.0
    assert len(result["missing_data_flags"]) > 0
