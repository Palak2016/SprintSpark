from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.task import Task, TaskDependency, TaskPriority, TaskStatus
from app.models.work_log import WorkLog, DailyUpdate
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.risk import RiskAnalysis
from app.models.recovery import RecoveryProposal, ProposalStatus
from app.models.audit import AuditEvent
from app.models.notification import Notification
from app.services.recovery_graph import run_recovery_workflow


def seed_database(db: Session, force_reset: bool = True):
    if force_reset:
        # Clear existing data in correct dependency order
        db.query(AuditEvent).delete()
        db.query(Notification).delete()
        db.query(RecoveryProposal).delete()
        db.query(RiskAnalysis).delete()
        db.query(LeaveRequest).delete()
        db.query(DailyUpdate).delete()
        db.query(WorkLog).delete()
        db.query(TaskDependency).delete()
        db.query(Task).delete()
        db.query(ProjectMember).delete()
        db.query(Project).delete()
        db.query(User).delete()
        db.commit()

    # Check if already seeded
    existing_manager = db.query(User).filter(User.email == "manager@workpilot.ai").first()
    if existing_manager:
        return {"message": "Database already seeded"}

    today = date.today()
    default_pw_hash = get_password_hash("Password123!")

    # 1. Users
    manager = User(
        email="manager@workpilot.ai",
        hashed_password=default_pw_hash,
        full_name="Alex Vance",
        role=UserRole.MANAGER.value,
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
    )
    dev1 = User(
        email="dev1@workpilot.ai",
        hashed_password=default_pw_hash,
        full_name="Elena Rostova",
        role=UserRole.EMPLOYEE.value,
        avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150"
    )
    dev2 = User(
        email="dev2@workpilot.ai",
        hashed_password=default_pw_hash,
        full_name="Marcus Chen",
        role=UserRole.EMPLOYEE.value,
        avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
    )
    db.add_all([manager, dev1, dev2])
    db.flush()

    # 2. Project
    project = Project(
        name="WorkPilot Enterprise Cloud Migration",
        description="Migrating core legacy monolithic microservices to Kubernetes clusters with SOC2 compliance and zero downtime.",
        manager_id=manager.id,
        status=ProjectStatus.ACTIVE.value,
        start_date=today - timedelta(days=14),
        target_end_date=today + timedelta(days=21)
    )
    db.add(project)
    db.flush()

    # Project Members
    m1 = ProjectMember(project_id=project.id, user_id=dev1.id, role_in_project="Senior Full-Stack Engineer")
    m2 = ProjectMember(project_id=project.id, user_id=dev2.id, role_in_project="Lead Cloud Systems Architect")
    db.add_all([m1, m2])
    db.flush()

    # 3. Tasks
    t1 = Task(
        project_id=project.id,
        title="Cloud Infrastructure & VPC Isolation",
        description="Provision multi-region Terraform VPCs, NAT gateways, and IAM least-privilege security groups.",
        assignee_id=dev2.id,
        priority=TaskPriority.HIGH.value,
        status=TaskStatus.COMPLETED.value,
        estimated_hours=24.0,
        actual_hours=22.0,
        progress_pct=100,
        start_date=today - timedelta(days=14),
        due_date=today - timedelta(days=7),
        is_blocked=False
    )
    t2 = Task(
        project_id=project.id,
        title="PostgreSQL Database Schema & CDC Replication",
        description="Setup logical replication and verify foreign key consistency before zero-downtime cutover.",
        assignee_id=dev1.id,
        priority=TaskPriority.HIGH.value,
        status=TaskStatus.IN_PROGRESS.value,
        estimated_hours=32.0,
        actual_hours=24.0,
        progress_pct=75,
        start_date=today - timedelta(days=7),
        due_date=today + timedelta(days=2),
        is_blocked=False
    )
    t3 = Task(
        project_id=project.id,
        title="Auth & Enterprise SSO Microservice",
        description="Implement SAML 2.0 and OIDC federation with multi-tenant session isolation.",
        assignee_id=dev1.id,
        priority=TaskPriority.CRITICAL.value,
        status=TaskStatus.BLOCKED.value,
        estimated_hours=20.0,
        actual_hours=12.0,
        progress_pct=40,
        start_date=today - timedelta(days=3),
        due_date=today + timedelta(days=1),
        is_blocked=True,
        blocker_reason="Awaiting customer IT security team to provide production SAML metadata XML and IdP test sandbox credentials."
    )
    t4 = Task(
        project_id=project.id,
        title="Real-Time Risk Engine Event Streaming",
        description="Kafka streaming pipeline processing task change events and computing delivery probability vectors.",
        assignee_id=dev2.id,
        priority=TaskPriority.CRITICAL.value,
        status=TaskStatus.TODO.value,
        estimated_hours=36.0,
        actual_hours=0.0,
        progress_pct=0,
        start_date=today + timedelta(days=2),
        due_date=today + timedelta(days=8),
        is_blocked=False
    )
    t5 = Task(
        project_id=project.id,
        title="Executive Client Dashboard & Timeline View",
        description="Interactive React visualizer with Gantt timelines, burn-up charts, and risk badge overlays.",
        assignee_id=dev1.id,
        priority=TaskPriority.MEDIUM.value,
        status=TaskStatus.IN_PROGRESS.value,
        estimated_hours=28.0,
        actual_hours=8.0,
        progress_pct=30,
        start_date=today - timedelta(days=2),
        due_date=today + timedelta(days=10),
        is_blocked=False
    )
    t6 = Task(
        project_id=project.id,
        title="End-to-End Penetration Testing & Sign-off",
        description="Automated DAST scanning, secret auditing, and third-party penetration test compliance report.",
        assignee_id=dev2.id,
        priority=TaskPriority.HIGH.value,
        status=TaskStatus.TODO.value,
        estimated_hours=16.0,
        actual_hours=0.0,
        progress_pct=0,
        start_date=today + timedelta(days=10),
        due_date=today + timedelta(days=16),
        is_blocked=False
    )
    db.add_all([t1, t2, t3, t4, t5, t6])
    db.flush()

    # 4. Dependencies
    # t2 depends on t1
    dep1 = TaskDependency(task_id=t2.id, prerequisite_task_id=t1.id)
    # t3 depends on t1
    dep2 = TaskDependency(task_id=t3.id, prerequisite_task_id=t1.id)
    # t4 depends on t2 and t3
    dep3 = TaskDependency(task_id=t4.id, prerequisite_task_id=t2.id)
    dep4 = TaskDependency(task_id=t4.id, prerequisite_task_id=t3.id)
    # t5 depends on t4
    dep5 = TaskDependency(task_id=t5.id, prerequisite_task_id=t4.id)
    # t6 depends on t5
    dep6 = TaskDependency(task_id=t6.id, prerequisite_task_id=t5.id)
    db.add_all([dep1, dep2, dep3, dep4, dep5, dep6])
    db.flush()

    # 5. Work Logs
    wl1 = WorkLog(
        task_id=t1.id,
        user_id=dev2.id,
        hours_spent=8.0,
        notes="Configured AWS VPC peering and transit gateways.",
        log_date=today - timedelta(days=10)
    )
    wl2 = WorkLog(
        task_id=t2.id,
        user_id=dev1.id,
        hours_spent=6.5,
        notes="Completed initial table schema mappings and migration scripts.",
        log_date=today - timedelta(days=3)
    )
    wl3 = WorkLog(
        task_id=t3.id,
        user_id=dev1.id,
        hours_spent=5.0,
        notes="Built OIDC handler but hit roadblock awaiting IdP test credentials.",
        log_date=today - timedelta(days=1)
    )
    db.add_all([wl1, wl2, wl3])

    # 6. Daily Updates
    du1 = DailyUpdate(
        task_id=t2.id,
        user_id=dev1.id,
        progress_pct=75,
        is_blocked=False,
        update_notes="Schema validation passed on staging cluster. Preparing sync tests.",
        date=today - timedelta(days=1)
    )
    du2 = DailyUpdate(
        task_id=t3.id,
        user_id=dev1.id,
        progress_pct=40,
        is_blocked=True,
        blocker_notes="Cannot proceed with SSO handshake without corporate IdP endpoint.",
        update_notes="Pinged customer lead architect for expedited access.",
        date=today
    )
    db.add_all([du1, du2])

    # 7. Approved Leave Request for Marcus Chen during Task 4 window
    leave = LeaveRequest(
        user_id=dev2.id,
        start_date=today + timedelta(days=3),
        end_date=today + timedelta(days=6),
        reason="Keynote presentation at Cloud Native Architecture Summit & workshop.",
        status=LeaveStatus.APPROVED.value,
        reviewed_by=manager.id,
        reviewed_at=datetime.now(timezone.utc) - timedelta(days=2),
        decision_notes="Approved by Alex Vance; coordinate backup for critical path tasks."
    )
    db.add(leave)
    db.commit()

    # 8. Initial Audit Event
    audit = AuditEvent(
        project_id=project.id,
        actor_id=manager.id,
        event_type="PROJECT_INITIALIZED",
        description="Project 'WorkPilot Enterprise Cloud Migration' initialized with baseline tasks and milestones.",
        metadata_json={"target_date": str(project.target_end_date)}
    )
    db.add(audit)
    db.commit()

    # 9. Execute LangGraph recovery workflow to generate live Risk Analysis and Pending Recovery Proposal
    run_recovery_workflow(project.id, db)

    return {"message": "Test scenario seeded successfully."}
