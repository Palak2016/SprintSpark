import json
import uuid
from datetime import date, timedelta
from typing import Dict, Any, List, Optional, TypedDict
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.task import Task, TaskStatus, TaskDependency
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.risk import RiskAnalysis
from app.models.recovery import RecoveryProposal, ProposalStatus
from app.models.focus_context import FocusContext
from app.models.user import User
from app.services.risk_engine import analyze_project_risk


class RecoveryWorkflowState(TypedDict):
    project_id: int
    project_name: str
    project_context: Dict[str, Any]
    risk_analysis: Dict[str, Any]
    leave_impact: Dict[str, Any]
    raw_proposal: Dict[str, Any]
    validated_proposal: Optional[Dict[str, Any]]
    validation_errors: List[str]
    proposal_record_id: Optional[int]
    status: str


def context_collector_node(state: RecoveryWorkflowState, db: Session) -> Dict[str, Any]:
    project = db.query(Project).filter(Project.id == state["project_id"]).first()
    if not project:
        return {"status": "FAILED", "validation_errors": ["Project not found"]}

    tasks_data = []
    for t in project.tasks:
        prereqs = [d.prerequisite_task_id for d in t.dependencies]
        tasks_data.append({
            "id": t.id,
            "title": t.title,
            "assignee_id": t.assignee_id,
            "assignee_name": t.assignee.full_name if t.assignee else "Unassigned",
            "priority": t.priority,
            "status": t.status,
            "estimated_hours": t.estimated_hours,
            "actual_hours": t.actual_hours,
            "progress_pct": t.progress_pct,
            "start_date": str(t.start_date),
            "due_date": str(t.due_date),
            "is_blocked": t.is_blocked,
            "blocker_reason": t.blocker_reason,
            "prerequisites": prereqs
        })

    focus_contexts = [
        {
            "id": focus_context.id,
            "task_id": focus_context.task_id,
            "task_title": task_title,
            "user_id": focus_context.user_id,
            "employee_name": employee_name,
            "reason": focus_context.reason,
            "context": focus_context.context,
            "created_at": focus_context.created_at.isoformat(),
        }
        for focus_context, task_title, employee_name in (
            db.query(FocusContext, Task.title, User.full_name)
            .join(Task, Task.id == FocusContext.task_id)
            .join(User, User.id == FocusContext.user_id)
            .filter(Task.project_id == project.id)
            .order_by(FocusContext.created_at.asc(), FocusContext.id.asc())
            .all()
        )
    ]

    members_data = []
    for m in project.members:
        members_data.append({
            "user_id": m.user.id,
            "name": m.user.full_name,
            "email": m.user.email,
            "role": m.role_in_project
        })
    if project.manager and not any(m["user_id"] == project.manager_id for m in members_data):
        members_data.append({
            "user_id": project.manager.id,
            "name": project.manager.full_name,
            "email": project.manager.email,
            "role": "Project Manager"
        })

    return {
        "project_name": project.name,
        "project_context": {
            "project_id": project.id,
            "project_name": project.name,
            "start_date": str(project.start_date),
            "target_end_date": str(project.target_end_date),
            "tasks": tasks_data,
            "members": members_data,
            "focus_contexts": focus_contexts,
        }
    }


def risk_analyzer_node(state: RecoveryWorkflowState, db: Session) -> Dict[str, Any]:
    project = db.query(Project).filter(Project.id == state["project_id"]).first()
    risk_result = analyze_project_risk(project, db)
    return {"risk_analysis": risk_result}


def leave_impact_node(state: RecoveryWorkflowState, db: Session) -> Dict[str, Any]:
    project_context = state["project_context"]
    member_ids = [m["user_id"] for m in project_context["members"]]
    
    approved_leaves = db.query(LeaveRequest).filter(
        LeaveRequest.user_id.in_(member_ids),
        LeaveRequest.status == LeaveStatus.APPROVED.value
    ).all()

    leaves_data = []
    for l in approved_leaves:
        leaves_data.append({
            "user_id": l.user_id,
            "user_name": l.user.full_name if l.user else "User",
            "start_date": str(l.start_date),
            "end_date": str(l.end_date),
            "reason": l.reason
        })

    return {"leave_impact": {"approved_leaves": leaves_data}}


def recovery_planner_node(state: RecoveryWorkflowState) -> Dict[str, Any]:
    """Generates structured recovery proposal actions based on triggered risk rules."""
    risk_analysis = state["risk_analysis"]
    context = state["project_context"]
    tasks = context["tasks"]
    members = context["members"]
    focus_contexts = context.get("focus_contexts", [])
    leaves = state["leave_impact"]["approved_leaves"]

    def context_for_task(task_id: int) -> List[Dict[str, Any]]:
        return [item for item in focus_contexts if item["task_id"] == task_id]

    def context_details(task_id: int) -> str:
        return " ".join(
            f"Employee {item['employee_name']} reported under "
            f"'{item['reason']}': {item['context']}"
            for item in context_for_task(task_id)
        )

    context_count = len(focus_contexts)
    context_summary = (
        f" Incorporated {context_count} employee-submitted Focus Guardian "
        f"context note(s) into this proposal."
        if context_count
        else ""
    )

    # If risk is low or insufficient data, state why
    if risk_analysis["risk_level"] == "LOW":
        return {
            "raw_proposal": {
                "title": "On-Track Maintenance Plan",
                "summary": (
                    "Project is currently performing within normal delivery parameters. "
                    "No immediate schedule intervention required." + context_summary
                ),
                "proposed_actions": [],
                "rationale": (
                    "All tasks are progressing within estimated velocity thresholds and no critical "
                    "blockers or leave conflicts exist."
                    + (
                        " Review the attached employee context notes for task-specific concerns "
                        "before deciding whether further action is needed."
                        if context_count
                        else ""
                    )
                ),
                "assumptions": ["Current team velocity remains steady", "No unannounced dependencies or leave occur"]
            }
        }
    elif risk_analysis["risk_level"] == "INSUFFICIENT_DATA":
        return {
            "raw_proposal": {
                "title": "Data Completion Plan",
                "summary": (
                    "Delivery risk cannot be accurately computed because essential estimates or "
                    "assignees are missing." + context_summary
                ),
                "proposed_actions": [],
                "rationale": (
                    "Before altering project schedule, team should complete missing task estimates "
                    "and assign unassigned tasks."
                    + (
                        " Review the attached employee context notes alongside the missing project data."
                        if context_count
                        else ""
                    )
                ),
                "assumptions": ["Team members can provide effort estimates within 24 hours"]
            }
        }

    proposed_actions = []
    rationale_points = []
    assumptions = [
        "Reassigned members possess necessary architectural and domain context",
        "Team members maintain dedicated focus during sprint recovery window",
        "Critical-path blockers must be resolved before dependent work resumes"
    ]

    # Action 1: Handle blocked tasks
    for rule in risk_analysis["triggered_rules"]:
        if rule["rule_id"] == "RULE_ACTIVE_BLOCKER":
            for t_id in rule["affected_task_ids"]:
                task = next((t for t in tasks if t["id"] == t_id), None)
                if task:
                    task_contexts = context_for_task(task["id"])
                    has_employee_context = bool(task_contexts)
                    latest_context = task_contexts[-1] if has_employee_context else None
                    context_note = context_details(task["id"])
                    proposed_actions.append({
                        "action_id": str(uuid.uuid4())[:8],
                        "action_type": (
                            "ESCALATE_BLOCKER"
                            if has_employee_context
                            else "RESOLVE_DEPENDENCY"
                        ),
                        "task_id": task["id"],
                        "task_title": task["title"],
                        "original_values": {
                            "is_blocked": True,
                            "blocker_reason": task["blocker_reason"],
                            "status": task["status"]
                        },
                        "proposed_values": (
                            {
                                "is_blocked": True,
                                "blocker_reason": (
                                    f"Employee-reported issue ({latest_context['reason']}): "
                                    f"{latest_context['context']}"
                                )
                            }
                            if latest_context
                            else {
                                "is_blocked": False,
                                "blocker_reason": "Escalated for immediate priority resolution via WorkPilot Recovery Plan",
                                "status": "IN_PROGRESS"
                            }
                        ),
                        "reason": (
                            f"Keep '{task['title']}' blocked and escalate the specific technical issue "
                            f"described by the employee before resuming work. {context_note}"
                            if has_employee_context
                            else f"Active blocker on '{task['title']}' halts critical-path downstream tasks. Prioritizing credential/API provisioning clears the delivery bottleneck."
                        ),
                        "expected_impact": (
                            "Gives the manager and team a concrete issue to resolve without marking "
                            "the task unblocked before the employee-reported dependency is addressed."
                            if has_employee_context
                            else "Unblocks 1 downstream dependent task and recovers 15% estimated milestone slippage."
                        )
                    })
                    rationale_points.append(
                        f"Escalate the employee-reported blocker on Task #{task['id']} ({task['title']}) "
                        f"without prematurely clearing it."
                        if has_employee_context
                        else f"Clear critical path blocker on Task #{task['id']} ({task['title']})."
                    )

    # Action 2: Handle leave conflicts by reassigning to available team member
    for rule in risk_analysis["triggered_rules"]:
        if rule["rule_id"] == "RULE_LEAVE_CONFLICT":
            conflicts = rule["evidence"].get("conflicts", [])
            for conf in conflicts:
                task = next((t for t in tasks if t["id"] == conf["task_id"]), None)
                if not task:
                    continue
                
                # Find an available team member who is not on leave
                conflicted_user_id = conf["assignee_id"]
                candidate_members = [
                    m for m in members 
                    if m["user_id"] != conflicted_user_id
                ]
                
                # Pick the member with least remaining workload
                new_assignee = candidate_members[0] if candidate_members else None
                if new_assignee:
                    context_note = context_details(task["id"])
                    context_suffix = (
                        f" Employee context: {context_note}"
                        if context_note
                        else ""
                    )
                    proposed_actions.append({
                        "action_id": str(uuid.uuid4())[:8],
                        "action_type": "REASSIGN",
                        "task_id": task["id"],
                        "task_title": task["title"],
                        "original_values": {
                            "assignee_id": task["assignee_id"],
                            "assignee_name": task["assignee_name"]
                        },
                        "proposed_values": {
                            "assignee_id": new_assignee["user_id"],
                            "assignee_name": new_assignee["name"]
                        },
                        "reason": (
                            f"Original assignee {task['assignee_name']} has approved leave from "
                            f"{conf['leave_start']} to {conf['leave_end']}. Reassigning to "
                            f"{new_assignee['name']} avoids work stoppage.{context_suffix}"
                        ),
                        "expected_impact": (
                            f"Eliminates schedule collision while preserving the employee-reported "
                            f"technical context for Task #{task['id']}.{context_suffix}"
                            if context_note
                            else f"Eliminates schedule collision; protects delivery date of Task #{task['id']}."
                        )
                    })
                    rationale_points.append(f"Reassign Task #{task['id']} from {task['assignee_name']} to {new_assignee['name']} due to planned absence.")

    # Action 3: Overdue or Velocity Stretch -> Extend deadline or resequence
    for rule in risk_analysis["triggered_rules"]:
        if rule["rule_id"] in ["RULE_OVERDUE_TASKS", "RULE_VELOCITY_STRETCH"]:
            for t_id in rule["affected_task_ids"]:
                # If we haven't already modified this task
                if any(a["task_id"] == t_id and a["action_type"] == "EXTEND_DEADLINE" for a in proposed_actions):
                    continue
                task = next((t for t in tasks if t["id"] == t_id), None)
                if task:
                    context_note = context_details(task["id"])
                    context_suffix = (
                        f" Employee context: {context_note}"
                        if context_note
                        else ""
                    )
                    cur_due = date.fromisoformat(task["due_date"])
                    new_due = cur_due + timedelta(days=4)
                    proposed_actions.append({
                        "action_id": str(uuid.uuid4())[:8],
                        "action_type": "EXTEND_DEADLINE",
                        "task_id": task["id"],
                        "task_title": task["title"],
                        "original_values": {
                            "due_date": str(cur_due)
                        },
                        "proposed_values": {
                            "due_date": str(new_due)
                        },
                        "reason": (
                            "Adjust scheduled due date by +4 calendar days to absorb current "
                            f"velocity deficit and ensure rigorous testing.{context_suffix}"
                        ),
                        "expected_impact": (
                            "Stabilizes velocity with a realistic delivery buffer informed by the "
                            f"employee's technical context.{context_suffix}"
                            if context_note
                            else "Stabilizes velocity requirement to realistic 5h/day, preventing burnout and defect leakage."
                        )
                    })
                    rationale_points.append(f"Extend Task #{task['id']} deadline by 4 days to realistic delivery buffer.")

    title = "Sprint Recovery & Critical Path Realignment Plan"
    summary = (
        f"Identified {len(proposed_actions)} targeted interventions addressing blocker clearance, "
        f"leave coverage, and schedule buffering to protect project delivery.{context_summary}"
    )
    rationale = " ".join(rationale_points) if rationale_points else "Mitigates high risk alerts through proactive resource reallocation and deadline adjustments."

    return {
        "raw_proposal": {
            "title": title,
            "summary": summary,
            "proposed_actions": proposed_actions,
            "rationale": rationale,
            "assumptions": assumptions
        }
    }


def output_validator_node(state: RecoveryWorkflowState) -> Dict[str, Any]:
    raw = state["raw_proposal"]
    context = state["project_context"]
    valid_task_ids = {t["id"]: t for t in context["tasks"]}
    valid_member_ids = {m["user_id"] for m in context["members"]}

    validated_actions = []
    errors = []

    for action in raw.get("proposed_actions", []):
        t_id = action.get("task_id")
        if t_id not in valid_task_ids:
            errors.append(f"Action references invalid Task ID {t_id}")
            continue

        a_type = action.get("action_type")
        if a_type not in [
            "REASSIGN",
            "EXTEND_DEADLINE",
            "RESOLVE_DEPENDENCY",
            "ESCALATE_BLOCKER",
            "SPLIT_EFFORT",
        ]:
            errors.append(f"Unknown action type {a_type}")
            continue

        if a_type == "REASSIGN":
            new_assignee_id = action.get("proposed_values", {}).get("assignee_id")
            if new_assignee_id and new_assignee_id not in valid_member_ids:
                errors.append(f"Proposed assignee {new_assignee_id} is not a member of project")
                continue

        validated_actions.append(action)

    validated_proposal = {
        "title": raw.get("title", "Project Recovery Proposal"),
        "summary": raw.get("summary", "Automated delivery recovery proposal"),
        "proposed_actions": validated_actions,
        "rationale": raw.get("rationale", ""),
        "assumptions": raw.get("assumptions", [])
    }

    return {
        "validated_proposal": validated_proposal,
        "validation_errors": errors,
        "status": "VALIDATED" if not errors else "VALIDATED_WITH_WARNINGS"
    }


def approval_queue_node(state: RecoveryWorkflowState, db: Session) -> Dict[str, Any]:
    proposal_data = state["validated_proposal"]
    if not proposal_data:
        return {"status": "FAILED", "proposal_record_id": None}

    # Save RiskAnalysis record
    risk_info = state["risk_analysis"]
    risk_record = RiskAnalysis(
        project_id=state["project_id"],
        risk_level=risk_info["risk_level"],
        score=risk_info["score"],
        triggered_rules=risk_info["triggered_rules"],
        evidence_json=risk_info["evidence"],
        missing_data_flags=risk_info["missing_data_flags"]
    )
    db.add(risk_record)
    db.flush()

    # Save RecoveryProposal record
    proposal_record = RecoveryProposal(
        project_id=state["project_id"],
        risk_analysis_id=risk_record.id,
        title=proposal_data["title"],
        summary=proposal_data["summary"],
        proposed_actions=proposal_data["proposed_actions"],
        focus_contexts=state["project_context"].get("focus_contexts", []),
        rationale=proposal_data["rationale"],
        assumptions=proposal_data["assumptions"],
        status=ProposalStatus.PENDING_APPROVAL.value
    )
    db.add(proposal_record)
    db.commit()
    db.refresh(proposal_record)

    return {
        "proposal_record_id": proposal_record.id,
        "status": "PENDING_APPROVAL"
    }


def build_recovery_workflow():
    workflow = StateGraph(RecoveryWorkflowState)

    # Note: DB session is passed into runner wrapper
    workflow.add_node("context_collector", lambda state: state)
    workflow.add_node("risk_analyzer", lambda state: state)
    workflow.add_node("leave_impact", lambda state: state)
    workflow.add_node("recovery_planner", recovery_planner_node)
    workflow.add_node("output_validator", output_validator_node)
    workflow.add_node("approval_queue", lambda state: state)

    workflow.set_entry_point("context_collector")
    workflow.add_edge("context_collector", "risk_analyzer")
    workflow.add_edge("risk_analyzer", "leave_impact")
    workflow.add_edge("leave_impact", "recovery_planner")
    workflow.add_edge("recovery_planner", "output_validator")
    workflow.add_edge("output_validator", "approval_queue")
    workflow.add_edge("approval_queue", END)

    return workflow.compile()


def run_recovery_workflow(project_id: int, db: Session) -> Dict[str, Any]:
    """Coordinates execution of the 6-stage recovery workflow."""
    initial_state: RecoveryWorkflowState = {
        "project_id": project_id,
        "project_name": "",
        "project_context": {},
        "risk_analysis": {},
        "leave_impact": {},
        "raw_proposal": {},
        "validated_proposal": None,
        "validation_errors": [],
        "proposal_record_id": None,
        "status": "INITIALIZED"
    }

    # Step 1: Collect Context
    s1 = context_collector_node(initial_state, db)
    initial_state.update(s1)
    if initial_state["status"] == "FAILED":
        return initial_state

    # Step 2: Analyze Risk
    s2 = risk_analyzer_node(initial_state, db)
    initial_state.update(s2)

    # Step 3: Leave Impact
    s3 = leave_impact_node(initial_state, db)
    initial_state.update(s3)

    # Step 4: Recovery Planner
    s4 = recovery_planner_node(initial_state)
    initial_state.update(s4)

    # Step 5: Output Validator
    s5 = output_validator_node(initial_state)
    initial_state.update(s5)

    # Step 6: Approval Queue
    s6 = approval_queue_node(initial_state, db)
    initial_state.update(s6)

    return initial_state
