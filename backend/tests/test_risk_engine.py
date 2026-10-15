from datetime import date, timedelta
from app.models.project import Project, ProjectMember
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.leave import LeaveRequest, LeaveStatus
from app.services.risk_engine import analyze_project_risk


def test_deterministic_risk_evaluation(db_session):
    today = date.today()
    # Create isolated project with intentional risk scenarios
    risk_project = Project(
        name="High Risk Isolated Project",
        manager_id=1,
        start_date=today - timedelta(days=5),
        target_end_date=today + timedelta(days=10)
    )
    db_session.add(risk_project)
    db_session.flush()

    m = ProjectMember(project_id=risk_project.id, user_id=2, role_in_project="Contributor")
    db_session.add(m)
    db_session.flush()

    # Blocked task with critical priority
    blocked_t = Task(
        project_id=risk_project.id,
        title="Critical Blocked Task",
        assignee_id=2,
        priority=TaskPriority.CRITICAL.value,
        status=TaskStatus.BLOCKED.value,
        estimated_hours=30.0,
        progress_pct=20,
        start_date=today - timedelta(days=2),
        due_date=today + timedelta(days=2),
        is_blocked=True,
        blocker_reason="Waiting on cloud vendor support"
    )
    db_session.add(blocked_t)

    # Approved leave overlapping task
    leave = LeaveRequest(
        user_id=2,
        start_date=today,
        end_date=today + timedelta(days=4),
        reason="Doctor visit and recovery",
        status=LeaveStatus.APPROVED.value
    )
    db_session.add(leave)
    db_session.commit()

    result = analyze_project_risk(risk_project, db_session)
    assert result["risk_level"] in ["MEDIUM", "HIGH"]
    assert result["score"] >= 25.0
    rule_ids = [r["rule_id"] for r in result["triggered_rules"]]
    assert "RULE_ACTIVE_BLOCKER" in rule_ids
    assert "RULE_LEAVE_CONFLICT" in rule_ids


def test_insufficient_data_detection(db_session):
    # Create empty project with proper date objects
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
    assert len(result["missing_data_flags"]) > 0
