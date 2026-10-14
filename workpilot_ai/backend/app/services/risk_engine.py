from datetime import date, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.task import Task, TaskStatus, TaskPriority, TaskDependency
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.risk import RiskAnalysis, RiskLevel


def calculate_business_days(start_d: date, end_d: date) -> int:
    if end_d < start_d:
        return 0
    days = 0
    cur = start_d
    while cur <= end_d:
        if cur.weekday() < 5:  # Monday to Friday
            days += 1
        cur += timedelta(days=1)
    return max(1, days)


def analyze_project_risk(project: Project, db: Session) -> Dict[str, Any]:
    tasks: List[Task] = project.tasks
    today = date.today()

    triggered_rules: List[Dict[str, Any]] = []
    missing_data_flags: List[Dict[str, Any]] = []
    evidence: Dict[str, Any] = {
        "total_tasks": len(tasks),
        "completed_tasks": 0,
        "blocked_tasks": 0,
        "overdue_tasks": 0,
        "tasks_with_leave_conflict": 0,
        "workload_by_assignee": {},
        "dependency_conflicts": 0,
    }

    if not tasks:
        missing_data_flags.append({
            "field_or_type": "tasks",
            "message": "Project has no tasks assigned yet. Add tasks with estimates to enable risk evaluation.",
            "task_id": None
        })
        return {
            "risk_level": RiskLevel.INSUFFICIENT_DATA.value,
            "score": 0.0,
            "triggered_rules": [],
            "evidence": evidence,
            "missing_data_flags": missing_data_flags
        }

    # Check for missing critical data on tasks
    unestimated_tasks = [t for t in tasks if t.status != TaskStatus.COMPLETED.value and (t.estimated_hours is None or t.estimated_hours <= 0)]
    unassigned_active_tasks = [t for t in tasks if t.status != TaskStatus.COMPLETED.value and t.assignee_id is None]
    
    for t in unestimated_tasks:
        missing_data_flags.append({
            "field_or_type": "estimated_hours",
            "message": f"Task '{t.title}' has no estimated effort hours configured.",
            "task_id": t.id
        })
    for t in unassigned_active_tasks:
        missing_data_flags.append({
            "field_or_type": "assignee",
            "message": f"Task '{t.title}' is active but unassigned to any team member.",
            "task_id": t.id
        })

    # If > 50% of active tasks lack estimates or assignees, flag insufficient data
    active_tasks = [t for t in tasks if t.status != TaskStatus.COMPLETED.value]
    if active_tasks and (len(unestimated_tasks) / len(active_tasks) > 0.5):
        return {
            "risk_level": RiskLevel.INSUFFICIENT_DATA.value,
            "score": 10.0,
            "triggered_rules": [],
            "evidence": evidence,
            "missing_data_flags": missing_data_flags
        }

    # Fetch all approved leaves for team members
    member_ids = [m.user_id for m in project.members]
    if project.manager_id not in member_ids:
        member_ids.append(project.manager_id)

    approved_leaves: List[LeaveRequest] = db.query(LeaveRequest).filter(
        LeaveRequest.user_id.in_(member_ids),
        LeaveRequest.status == LeaveStatus.APPROVED.value,
        LeaveRequest.end_date >= today
    ).all()

    risk_score = 0.0

    # Rule 1: Overdue and Velocity / Feasibility Analysis
    overdue_task_ids = []
    high_velocity_task_ids = []
    
    for t in active_tasks:
        rem_pct = max(0, 100 - t.progress_pct)
        rem_hours = t.estimated_hours * (rem_pct / 100.0)
        
        # Check overdue
        if t.due_date < today:
            overdue_task_ids.append(t.id)
            evidence["overdue_tasks"] += 1
            risk_score += 25.0
        else:
            bus_days = calculate_business_days(max(today, t.start_date), t.due_date)
            daily_velocity_needed = rem_hours / bus_days
            # If a single task requires > 8h/day, significant risk
            if daily_velocity_needed > 8.0:
                high_velocity_task_ids.append(t.id)
                risk_score += 15.0

        # Accumulate workload by assignee
        if t.assignee_id:
            evidence["workload_by_assignee"].setdefault(str(t.assignee_id), 0.0)
            evidence["workload_by_assignee"][str(t.assignee_id)] += rem_hours

    if overdue_task_ids:
        triggered_rules.append({
            "rule_id": "RULE_OVERDUE_TASKS",
            "rule_name": "Overdue Incomplete Tasks Detected",
            "severity": "CRITICAL",
            "description": f"{len(overdue_task_ids)} active task(s) have passed their due date without completion.",
            "evidence": {"task_ids": overdue_task_ids},
            "affected_task_ids": overdue_task_ids
        })

    if high_velocity_task_ids:
        triggered_rules.append({
            "rule_id": "RULE_VELOCITY_STRETCH",
            "rule_name": "Unrealistic Daily Velocity Required",
            "severity": "HIGH",
            "description": f"{len(high_velocity_task_ids)} task(s) require >8h/day continuous focus before deadline.",
            "evidence": {"task_ids": high_velocity_task_ids},
            "affected_task_ids": high_velocity_task_ids
        })

    # Rule 2: Unresolved Blocker Penalty
    blocked_task_ids = [t.id for t in active_tasks if t.is_blocked or t.status == TaskStatus.BLOCKED.value]
    evidence["blocked_tasks"] = len(blocked_task_ids)
    if blocked_task_ids:
        # Check if blocked task has dependents
        blocked_with_deps = []
        for b_id in blocked_task_ids:
            dep_count = db.query(TaskDependency).filter(TaskDependency.prerequisite_task_id == b_id).count()
            if dep_count > 0:
                blocked_with_deps.append(b_id)
        
        severity = "CRITICAL" if blocked_with_deps else "HIGH"
        risk_score += 30.0 if blocked_with_deps else 18.0
        triggered_rules.append({
            "rule_id": "RULE_ACTIVE_BLOCKER",
            "rule_name": "Active Work Blocker Halting Progress",
            "severity": severity,
            "description": f"{len(blocked_task_ids)} task(s) currently marked as blocked, preventing progress.",
            "evidence": {
                "blocked_task_ids": blocked_task_ids,
                "cascade_blocking_ids": blocked_with_deps
            },
            "affected_task_ids": blocked_task_ids
        })

    # Rule 3: Leave Conflict Analysis
    leave_conflict_task_ids = []
    leave_evidence = []
    for t in active_tasks:
        if not t.assignee_id:
            continue
        # Find approved leaves for this assignee overlapping [t.start_date, t.due_date]
        user_leaves = [
            l for l in approved_leaves 
            if l.user_id == t.assignee_id and not (l.end_date < t.start_date or l.start_date > t.due_date)
        ]
        if user_leaves:
            leave_conflict_task_ids.append(t.id)
            for l in user_leaves:
                leave_evidence.append({
                    "task_id": t.id,
                    "task_title": t.title,
                    "assignee_id": t.assignee_id,
                    "leave_start": str(l.start_date),
                    "leave_end": str(l.end_date)
                })

    evidence["tasks_with_leave_conflict"] = len(leave_conflict_task_ids)
    if leave_conflict_task_ids:
        risk_score += 25.0
        triggered_rules.append({
            "rule_id": "RULE_LEAVE_CONFLICT",
            "rule_name": "Approved Leave Overlaps Critical Task Schedule",
            "severity": "HIGH",
            "description": f"{len(leave_conflict_task_ids)} task(s) assigned to team members on approved leave during the scheduled delivery window.",
            "evidence": {"conflicts": leave_evidence},
            "affected_task_ids": leave_conflict_task_ids
        })

    # Rule 4: Assignee Capacity Overload
    overloaded_assignees = []
    for user_id_str, total_rem in evidence["workload_by_assignee"].items():
        if total_rem > 50.0:  # More than 50 hours committed concurrently
            overloaded_assignees.append({"user_id": int(user_id_str), "remaining_hours": total_rem})
            risk_score += 15.0

    if overloaded_assignees:
        triggered_rules.append({
            "rule_id": "RULE_CAPACITY_OVERLOAD",
            "rule_name": "Team Member Capacity Overload",
            "severity": "MEDIUM",
            "description": f"{len(overloaded_assignees)} team member(s) assigned >50 hours of concurrent active work.",
            "evidence": {"overloaded": overloaded_assignees},
            "affected_task_ids": [t.id for t in active_tasks if t.assignee_id in [o["user_id"] for o in overloaded_assignees]]
        })

    # Rule 5: Dependency Inconsistency & Propagation
    dep_violations = []
    all_task_map = {t.id: t for t in tasks}
    for t in tasks:
        for dep in t.dependencies:
            prereq = all_task_map.get(dep.prerequisite_task_id)
            if prereq:
                # If prerequisite due date is after this task's due date
                if prereq.due_date > t.due_date:
                    dep_violations.append({
                        "task_id": t.id,
                        "prereq_id": prereq.id,
                        "task_due": str(t.due_date),
                        "prereq_due": str(prereq.due_date)
                    })
                # If prerequisite is blocked
                elif prereq.is_blocked and t.status != TaskStatus.COMPLETED.value:
                    dep_violations.append({
                        "task_id": t.id,
                        "prereq_id": prereq.id,
                        "reason": f"Prerequisite '{prereq.title}' is blocked."
                    })

    evidence["dependency_conflicts"] = len(dep_violations)
    if dep_violations:
        risk_score += 18.0
        triggered_rules.append({
            "rule_id": "RULE_DEPENDENCY_CASCADE",
            "rule_name": "Dependency Sequencing Conflict",
            "severity": "HIGH",
            "description": f"{len(dep_violations)} prerequisite scheduling conflict(s) detected.",
            "evidence": {"violations": dep_violations},
            "affected_task_ids": [v["task_id"] for v in dep_violations]
        })

    # Rule 6: Project Deadline Buffer
    if project.target_end_date:
        max_task_due = max([t.due_date for t in tasks], default=project.target_end_date)
        if max_task_due > project.target_end_date:
            risk_score += 20.0
            triggered_rules.append({
                "rule_id": "RULE_TARGET_END_EXCEEDED",
                "rule_name": "Task Deadlines Exceed Project Target Date",
                "severity": "CRITICAL",
                "description": f"Tasks extend to {max_task_due}, past project milestone date {project.target_end_date}.",
                "evidence": {"project_target": str(project.target_end_date), "latest_task_due": str(max_task_due)},
                "affected_task_ids": [t.id for t in tasks if t.due_date > project.target_end_date]
            })

    # Normalized score between 0 and 100
    final_score = min(100.0, max(0.0, risk_score))
    
    if final_score >= 60.0:
        risk_level = RiskLevel.HIGH.value
    elif final_score >= 25.0:
        risk_level = RiskLevel.MEDIUM.value
    else:
        risk_level = RiskLevel.LOW.value

    return {
        "risk_level": risk_level,
        "score": round(final_score, 1),
        "triggered_rules": triggered_rules,
        "evidence": evidence,
        "missing_data_flags": missing_data_flags
    }
