"""AI recovery-planning workflow (LangGraph).

Graph (every node runs on each generation request):

    context_collector -> risk_analyzer -> leave_impact -> schedule_analyzer
        -> recovery_planner -> output_validator -> approval_queue -> END

* Deterministic: context_collector, risk_analyzer (app.services.risk_engine),
  leave_impact, schedule_analyzer (app.services.recovery_scheduler) and
  output_validator (app.services.recovery_validation + re-simulation).
* LLM: recovery_planner calls the configured model through
  app.services.recovery_ai_planner when recovery is needed and a key is
  configured. It always also builds the rule-based plan as a baseline and
  as the documented fallback.
* approval_queue stores the proposal as PENDING_APPROVAL. Nothing is applied
  until a manager approves it (app.services.approval_service), which
  re-validates against current data first.

Each stored proposal carries ``generation_trace`` recording whether a model
was really invoked, which one, the deterministic findings, validation
results and the before/after schedule simulation.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from functools import partial
from typing import Any, Callable, Dict, List, Optional, TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit import AuditEvent
from app.models.focus_context import FocusContext
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.project import Project
from app.models.recovery import ProposalStatus, RecoveryProposal
from app.models.risk import RiskAnalysis
from app.models.task import Task
from app.models.user import User
from app.services.llm_client import LLMError, resolve_config
from app.services.recovery_ai_planner import (
    LLMCaller,
    build_facts,
    generate_ai_strategies,
)
from app.services.recovery_scheduler import (
    apply_actions_to_tasks,
    compare_schedules,
    deterministic_findings,
    member_workload,
    remaining_hours,
    simulate_schedule,
    to_date,
)
from app.services.recovery_validation import validate_plan
from app.services.risk_engine import analyze_project_risk, calculate_business_days

RULE_BASED_TITLE = "Sprint Recovery & Critical Path Realignment Plan"


class RecoveryWorkflowState(TypedDict, total=False):
    project_id: int
    project_name: str
    project_context: Dict[str, Any]
    risk_analysis: Dict[str, Any]
    leave_impact: Dict[str, Any]
    findings: Dict[str, Any]
    raw_proposal: Dict[str, Any]
    candidate_strategies: List[Dict[str, Any]]
    ai_analysis: Optional[Dict[str, Any]]
    llm_trace: Dict[str, Any]
    validated_proposal: Optional[Dict[str, Any]]
    validation_errors: List[str]
    trace: Dict[str, Any]
    proposal_record_id: Optional[int]
    executed_nodes: List[str]
    today: str
    run_id: str
    started_at: str
    status: str
    error: Optional[str]
    actor_id: Optional[int]


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


def _executed(state: RecoveryWorkflowState, name: str) -> List[str]:
    return list(state.get("executed_nodes") or []) + [name]


def _today(state: RecoveryWorkflowState) -> date:
    return to_date(state.get("today")) or date.today()


def _pick_reassignment_candidate(
    candidates: List[Dict[str, Any]],
    conflict: Dict[str, Any],
    state: RecoveryWorkflowState,
) -> Optional[Dict[str, Any]]:
    """Least-loaded member who is not on leave during the conflict window.

    Project managers are only chosen when no other member is available.
    """
    if not candidates:
        return None
    workload = state["risk_analysis"].get("evidence", {}).get("workload_by_assignee", {})
    window_start = to_date(conflict.get("leave_start"))
    window_end = to_date(conflict.get("leave_end"))
    on_leave = set()
    for leave in state.get("leave_impact", {}).get("approved_leaves", []):
        start, end = to_date(leave.get("start_date")), to_date(leave.get("end_date"))
        if window_start and window_end and start and end and not (end < window_start or start > window_end):
            on_leave.add(leave.get("user_id"))

    def rank(member: Dict[str, Any]):
        return (
            member["user_id"] in on_leave,
            member.get("role") == "Project Manager",
            float(workload.get(str(member["user_id"]), 0.0)),
            member["user_id"],
        )

    return sorted(candidates, key=rank)[0]


def _blocker_impact_text(task: Dict[str, Any], tasks: List[Dict[str, Any]]) -> str:
    dependents = [t for t in tasks if task["id"] in (t.get("prerequisites") or [])]
    if not dependents:
        return "No other task depends on this one; escalation protects its own due date."
    return (
        f"{len(dependents)} dependent task(s) cannot start until this blocker is "
        "resolved; escalation targets the critical path."
    )


def _extension_impact_text(task: Dict[str, Any], new_due: date) -> str:
    start = max(date.today(), to_date(task.get("start_date")) or date.today())
    days = calculate_business_days(start, new_due)
    hours = remaining_hours(task)
    return (
        f"Spreads the remaining {hours:.1f}h over {days} working day(s) "
        f"(about {hours / days:.1f}h/day)."
    )


def rule_based_planner_node(state: RecoveryWorkflowState) -> Dict[str, Any]:
    """Rule-based planner: maps triggered risk rules to fixed recovery actions.

    No language model is involved. It is the fallback when no LLM is
    configured or the model call fails, and the baseline every AI strategy
    is compared against.
    """
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
                            else "ESCALATE_BLOCKER"
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
                                "is_blocked": True,
                                "blocker_reason": (
                                    "Escalated for priority resolution: "
                                    f"{task['blocker_reason'] or 'blocker reported on this task'}"
                                )
                            }
                        ),
                        "reason": (
                            f"Keep '{task['title']}' blocked and escalate the specific technical issue "
                            f"described by the employee before resuming work. {context_note}"
                            if has_employee_context
                            else (
                                f"'{task['title']}' is blocked"
                                + (f" ({task['blocker_reason']})" if task["blocker_reason"] else "")
                                + ". Escalate it so the blocker is resolved before dependent work is due."
                            )
                        ),
                        "expected_impact": (
                            "Gives the manager and team a concrete issue to resolve without marking "
                            "the task unblocked before the employee-reported dependency is addressed."
                            if has_employee_context
                            else _blocker_impact_text(task, tasks)
                        )
                    })
                    rationale_points.append(
                        f"Escalate the employee-reported blocker on Task #{task['id']} ({task['title']}) "
                        f"without prematurely clearing it."
                        if has_employee_context
                        else f"Escalate the blocker on Task #{task['id']} ({task['title']})."
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
                
                new_assignee = _pick_reassignment_candidate(
                    candidate_members, conf, state
                )
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
                            f"velocity deficit.{context_suffix}"
                        ),
                        "expected_impact": (
                            "Adds a schedule buffer informed by the "
                            f"employee's technical context.{context_suffix}"
                            if context_note
                            else _extension_impact_text(task, new_due)
                        )
                    })
                    rationale_points.append(f"Extend Task #{task['id']} deadline by 4 days to add a delivery buffer.")

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


def schedule_analyzer_node(state: RecoveryWorkflowState) -> Dict[str, Any]:
    """Deterministic capacity, schedule and feasibility analysis."""
    context = state["project_context"]
    findings = deterministic_findings(
        context["tasks"],
        context["members"],
        state["leave_impact"]["approved_leaves"],
        _today(state),
        context.get("target_end_date"),
        state.get("risk_analysis"),
    )
    return {"findings": findings, "executed_nodes": _executed(state, "schedule_analyzer")}


def _recovery_needed(state: RecoveryWorkflowState) -> Optional[str]:
    """Returns a reason the LLM is skipped, or None when planning is needed."""
    level = state["risk_analysis"].get("risk_level")
    feasible = state["findings"]["schedule"].get("feasible", True)
    if level == "INSUFFICIENT_DATA":
        return "Risk could not be computed because task estimates or assignees are missing."
    if level == "LOW" and feasible:
        return "Risk is low and the simulated schedule meets the target date."
    return None


def recovery_planner_node(
    state: RecoveryWorkflowState,
    llm: Optional[LLMCaller] = None,
) -> Dict[str, Any]:
    """Builds candidate strategies: the rule-based baseline plus, when
    recovery is needed and a model is available, AI-generated strategies."""
    rule_output = rule_based_planner_node(state)["raw_proposal"]
    candidates = [{
        "strategy_id": "R1",
        "name": "Rule-based plan",
        "approach": "MIXED",
        "summary": rule_output["summary"],
        "benefits": [],
        "trade_offs": [],
        "assumptions": rule_output.get("assumptions", []),
        "risks": [],
        "actions": [dict(a, source="RULE") for a in rule_output["proposed_actions"]],
        "source": "RULE",
        "title": rule_output["title"],
        "rationale": rule_output["rationale"],
    }]

    config = resolve_config()
    llm_trace: Dict[str, Any] = {
        "invoked": False,
        "provider": config.provider if config else None,
        "model": config.model if config else None,
        "status": "SKIPPED",
        "error": None,
        "error_category": None,
        "latency_ms": None,
        "skip_reason": None,
        "prompt_version": None,
    }
    ai_analysis = None

    skip_reason = _recovery_needed(state)
    if skip_reason:
        llm_trace["skip_reason"] = skip_reason
    elif llm is None and config is None:
        llm_trace["status"] = "NOT_CONFIGURED"
        llm_trace["skip_reason"] = (
            "No LLM key is configured (OPENAI_API_KEY or GEMINI_API_KEY), so the "
            "rule-based planner was used."
        )
    else:
        facts = build_facts(
            state["project_context"],
            state["leave_impact"]["approved_leaves"],
            state["findings"],
            _today(state),
        )
        llm_trace["invoked"] = True
        try:
            result = generate_ai_strategies(facts, llm=llm)
            llm_trace.update({
                "status": "SUCCEEDED",
                "provider": result["provider"],
                "model": result["model"],
                "latency_ms": result["latency_ms"],
                "usage": result.get("usage") or {},
                "prompt_version": result["prompt_version"],
            })
            ai_analysis = {
                "delay_explanation": result["delay_explanation"],
                "recommended_strategy_id": result["recommended_strategy_id"],
                "recommendation_reason": result["recommendation_reason"],
            }
            candidates = result["strategies"] + candidates
            if not result["strategies"]:
                llm_trace["status"] = "SUCCEEDED_NO_STRATEGIES"
        except LLMError as exc:
            llm_trace.update({
                "status": "FAILED",
                "error": exc.message,
                "error_category": exc.category,
                "latency_ms": exc.latency_ms,
                "provider": exc.provider or llm_trace["provider"],
                "model": exc.model or llm_trace["model"],
            })
            if settings.RECOVERY_REQUIRE_LLM:
                return {
                    "status": "FAILED",
                    "error": f"AI recovery planning failed: {exc.message}",
                    "llm_trace": llm_trace,
                    "executed_nodes": _executed(state, "recovery_planner"),
                }

    return {
        "raw_proposal": rule_output,
        "candidate_strategies": candidates,
        "ai_analysis": ai_analysis,
        "llm_trace": llm_trace,
        "executed_nodes": _executed(state, "recovery_planner"),
    }


def _schedule_rows(simulation: Dict[str, Any]) -> List[Dict[str, Any]]:
    keys = (
        "task_id", "title", "assignee_id", "assignee_name", "status", "is_blocked",
        "start_date", "due_date", "projected_start", "projected_finish", "late",
        "slip_business_days",
    )
    return [{k: row.get(k) for k in keys} for row in simulation["tasks"]]


def output_validator_node(state: RecoveryWorkflowState) -> Dict[str, Any]:
    """Validates every strategy against project data, re-simulates the
    schedule for each, and selects the strategy to put up for approval."""
    context = state["project_context"]
    leaves = state["leave_impact"]["approved_leaves"]
    today = _today(state)
    target = context.get("target_end_date")
    baseline = state["findings"]["_simulation"]
    members = context["members"]
    validation_context = {**context, "target_end_date": target}

    evaluated = []
    rejected_actions = []
    for strategy in state.get("candidate_strategies", []):
        result = validate_plan(strategy["actions"], validation_context, leaves, today)
        for action in result["accepted"]:
            action["source"] = strategy["source"]
        after_tasks = apply_actions_to_tasks(
            context["tasks"],
            [a for a in result["accepted"] if a["validation"]["status"] == "VALID"],
        )
        after = simulate_schedule(after_tasks, leaves, today, target)
        comparison = compare_schedules(baseline, after)
        for action in result["rejected"]:
            rejected_actions.append({
                "strategy_id": strategy["strategy_id"],
                "source": strategy["source"],
                "action_type": action["action_type"],
                "task_id": action["task_id"],
                "errors": action["validation"]["errors"],
            })
        evaluated.append({
            "strategy": strategy,
            "validation": result,
            "after": after,
            "after_tasks": after_tasks,
            "comparison": comparison,
        })

    def usable(item):
        return any(a["validation"]["status"] == "VALID" for a in item["validation"]["accepted"])

    ai_items = [e for e in evaluated if e["strategy"]["source"] == "AI"]
    rule_item = next((e for e in evaluated if e["strategy"]["source"] == "RULE"), None)
    ai_analysis = state.get("ai_analysis") or {}
    chosen = None
    selection_reason = None
    recommended_id = ai_analysis.get("recommended_strategy_id")
    if ai_items:
        preferred = next((e for e in ai_items if e["strategy"]["strategy_id"] == recommended_id), None)
        if preferred and usable(preferred):
            chosen = preferred
            selection_reason = "Recommended by the AI planner and passed validation."
        else:
            valid_ai = [e for e in ai_items if usable(e)]
            if valid_ai:
                chosen = sorted(
                    valid_ai,
                    key=lambda e: (
                        -(e["comparison"]["business_days_saved"] or 0),
                        e["comparison"]["late_tasks_after"],
                    ),
                )[0]
                selection_reason = (
                    "The AI's recommended strategy failed validation; the valid AI "
                    "strategy with the best simulated completion date was selected."
                )
    if chosen is None:
        chosen = rule_item
        if ai_items:
            selection_reason = "No AI strategy passed validation; the rule-based plan was used."
        else:
            selection_reason = "Rule-based plan (no AI strategies were generated)."

    llm_trace = state.get("llm_trace") or {}
    if chosen and chosen["strategy"]["source"] == "AI":
        generation_mode = "AI_HYBRID"
    elif llm_trace.get("skip_reason") and not llm_trace.get("invoked") and llm_trace.get("status") == "SKIPPED":
        generation_mode = "RULE_BASED"
    else:
        generation_mode = "RULE_BASED_FALLBACK"

    strategy = chosen["strategy"]
    accepted = chosen["validation"]["accepted"]
    if strategy["source"] == "AI":
        title = f"AI recovery plan: {strategy['name']}"
        summary = strategy["summary"] or ai_analysis.get("delay_explanation") or ""
        rationale = " ".join(
            part for part in (
                ai_analysis.get("delay_explanation"),
                ai_analysis.get("recommendation_reason"),
            ) if part
        ) or strategy["summary"]
        assumptions = strategy["assumptions"]
    else:
        title = strategy.get("title") or RULE_BASED_TITLE
        summary = strategy["summary"]
        if accepted and strategy["actions"]:
            summary = summary.replace(
                f"Identified {len(strategy['actions'])} ", f"Identified {len(accepted)} "
            )
        rationale = strategy.get("rationale") or ""
        assumptions = strategy.get("assumptions", [])

    target_date = to_date(target) or today
    workload_before = member_workload(context["tasks"], members, leaves, today, target_date)
    workload_after = member_workload(chosen["after_tasks"], members, leaves, today, target_date)
    changed_ids = sorted({a["task_id"] for a in accepted if a["validation"]["status"] == "VALID"})

    all_errors = [e for item in evaluated for e in item["validation"]["errors"]]
    chosen_warnings = chosen["validation"]["warnings"]
    if chosen["validation"]["rejected"]:
        validation_status = "PASSED_WITH_REJECTIONS"
    elif chosen_warnings:
        validation_status = "PASSED_WITH_WARNINGS"
    else:
        validation_status = "PASSED"

    strategies_trace = []
    for item in evaluated:
        s = item["strategy"]
        strategies_trace.append({
            "strategy_id": s["strategy_id"],
            "name": s["name"],
            "approach": s["approach"],
            "source": s["source"],
            "summary": s["summary"],
            "benefits": s.get("benefits", []),
            "trade_offs": s.get("trade_offs", []),
            "assumptions": s.get("assumptions", []),
            "risks": s.get("risks", []),
            "selected": item is chosen,
            "actions": [
                {
                    "action_type": a["action_type"],
                    "task_id": a["task_id"],
                    "task_title": a["task_title"],
                    "proposed_values": a["proposed_values"],
                    "reason": a["reason"],
                    "validation": a["validation"],
                }
                for a in item["validation"]["accepted"]
            ],
            "evaluation": {
                "accepted_action_count": len(item["validation"]["accepted"]),
                "rejected_action_count": len(item["validation"]["rejected"]),
                **item["comparison"],
            },
        })

    findings = dict(state["findings"])
    findings.pop("_simulation", None)
    trace = {
        "run_id": state.get("run_id"),
        "started_at": state.get("started_at"),
        "generation_mode": generation_mode,
        "llm": llm_trace,
        "deterministic_findings": findings,
        "ai_analysis": ai_analysis or None,
        "selected_strategy_id": strategy["strategy_id"],
        "selection_reason": selection_reason,
        "strategies": strategies_trace,
        "rejected_actions": rejected_actions,
        "validation": {
            "status": validation_status,
            "errors": all_errors,
            "warnings": chosen_warnings,
            "validated_at": datetime.now(timezone.utc).isoformat(),
        },
        "schedule_comparison": {
            "label": "Projection from WorkPilot's schedule model, not a measured result.",
            "method": baseline["method"],
            "assumptions": baseline["assumptions"],
            "computed_for": today.isoformat(),
            "target_end_date": baseline["target_end_date"],
            "before": {
                "projected_completion": baseline["projected_completion"],
                "business_days_vs_target": baseline["business_days_vs_target"],
                "tasks": _schedule_rows(baseline),
            },
            "after": {
                "projected_completion": chosen["after"]["projected_completion"],
                "business_days_vs_target": chosen["after"]["business_days_vs_target"],
                "tasks": _schedule_rows(chosen["after"]),
            },
            "business_days_saved": chosen["comparison"]["business_days_saved"],
            "changed_task_ids": changed_ids,
            "dependency_conflicts_before": state["findings"].get("dependency_conflicts", []),
            "workload_before": workload_before,
            "workload_after": workload_after,
        },
    }

    validated_proposal = {
        "title": title,
        "summary": summary,
        "proposed_actions": accepted,
        "rationale": rationale,
        "assumptions": assumptions,
    }
    return {
        "validated_proposal": validated_proposal,
        "validation_errors": all_errors,
        "trace": trace,
        "status": "VALIDATED" if not all_errors else "VALIDATED_WITH_WARNINGS",
        "executed_nodes": _executed(state, "output_validator"),
    }


def approval_queue_node(state: RecoveryWorkflowState, db: Session) -> Dict[str, Any]:
    """Persists the risk analysis and the proposal as PENDING_APPROVAL.

    Earlier pending proposals for the project are marked SUPERSEDED so only
    the newest analysis can be approved.
    """
    proposal_data = state.get("validated_proposal")
    if not proposal_data:
        return {"status": "FAILED", "proposal_record_id": None}

    risk_info = state["risk_analysis"]
    risk_record = RiskAnalysis(
        project_id=state["project_id"],
        risk_level=risk_info["risk_level"],
        score=risk_info["score"],
        triggered_rules=risk_info["triggered_rules"],
        evidence_json=risk_info["evidence"],
        missing_data_flags=risk_info["missing_data_flags"],
    )
    db.add(risk_record)
    db.flush()

    db.query(RecoveryProposal).filter(
        RecoveryProposal.project_id == state["project_id"],
        RecoveryProposal.status == ProposalStatus.PENDING_APPROVAL.value,
    ).update(
        {RecoveryProposal.status: ProposalStatus.SUPERSEDED.value},
        synchronize_session=False,
    )

    executed = _executed(state, "approval_queue")
    trace = dict(state.get("trace") or {})
    trace["graph_nodes"] = executed
    trace["status"] = (
        "COMPLETED" if trace.get("validation", {}).get("status") == "PASSED"
        else "COMPLETED_WITH_WARNINGS"
    )
    trace["completed_at"] = datetime.now(timezone.utc).isoformat()

    proposal_record = RecoveryProposal(
        project_id=state["project_id"],
        risk_analysis_id=risk_record.id,
        title=proposal_data["title"],
        summary=proposal_data["summary"],
        proposed_actions=proposal_data["proposed_actions"],
        focus_contexts=state["project_context"].get("focus_contexts", []),
        rationale=proposal_data["rationale"],
        assumptions=proposal_data["assumptions"],
        status=ProposalStatus.PENDING_APPROVAL.value,
        generation_trace=trace,
    )
    db.add(proposal_record)
    db.flush()

    llm = trace.get("llm") or {}
    db.add(AuditEvent(
        project_id=state["project_id"],
        actor_id=state.get("actor_id"),
        event_type="RECOVERY_PROPOSAL_GENERATED",
        description=(
            f"Recovery proposal '{proposal_data['title']}' generated "
            + (
                f"with {llm.get('provider')} model {llm.get('model')}."
                if trace.get("generation_mode") == "AI_HYBRID"
                else "by the rule-based planner"
                + (f" (LLM {llm.get('status', '').lower()})." if llm.get("invoked") else ".")
            )
        ),
        metadata_json={
            "proposal_id": proposal_record.id,
            "run_id": trace.get("run_id"),
            "generation_mode": trace.get("generation_mode"),
            "llm_invoked": bool(llm.get("invoked")),
            "llm_status": llm.get("status"),
            "provider": llm.get("provider"),
            "model": llm.get("model"),
            "accepted_actions": len(proposal_data["proposed_actions"]),
            "rejected_actions": len(trace.get("rejected_actions") or []),
        },
    ))
    db.commit()
    db.refresh(proposal_record)

    return {
        "proposal_record_id": proposal_record.id,
        "status": "PENDING_APPROVAL",
        "executed_nodes": executed,
        "trace": trace,
    }


def _track(name: str, fn: Callable[..., Dict[str, Any]]) -> Callable[[RecoveryWorkflowState], Dict[str, Any]]:
    def node(state: RecoveryWorkflowState) -> Dict[str, Any]:
        update = fn(state)
        if "executed_nodes" not in update:
            update = {**update, "executed_nodes": _executed(state, name)}
        return update
    return node


def _continue_unless_failed(state: RecoveryWorkflowState) -> str:
    return "stop" if state.get("status") == "FAILED" else "continue"


def build_recovery_workflow(db: Session, llm: Optional[LLMCaller] = None):
    """Compile the recovery LangGraph with the database session bound."""
    workflow = StateGraph(RecoveryWorkflowState)
    workflow.add_node("context_collector", _track("context_collector", partial(context_collector_node, db=db)))
    workflow.add_node("risk_analyzer", _track("risk_analyzer", partial(risk_analyzer_node, db=db)))
    workflow.add_node("leave_impact", _track("leave_impact", partial(leave_impact_node, db=db)))
    workflow.add_node("schedule_analyzer", schedule_analyzer_node)
    workflow.add_node("recovery_planner", partial(recovery_planner_node, llm=llm))
    workflow.add_node("output_validator", output_validator_node)
    workflow.add_node("approval_queue", partial(approval_queue_node, db=db))

    workflow.set_entry_point("context_collector")
    workflow.add_conditional_edges(
        "context_collector", _continue_unless_failed,
        {"continue": "risk_analyzer", "stop": END},
    )
    workflow.add_edge("risk_analyzer", "leave_impact")
    workflow.add_edge("leave_impact", "schedule_analyzer")
    workflow.add_edge("schedule_analyzer", "recovery_planner")
    workflow.add_conditional_edges(
        "recovery_planner", _continue_unless_failed,
        {"continue": "output_validator", "stop": END},
    )
    workflow.add_edge("output_validator", "approval_queue")
    workflow.add_edge("approval_queue", END)
    return workflow.compile()


def run_recovery_workflow(
    project_id: int,
    db: Session,
    llm: Optional[LLMCaller] = None,
    today: Optional[date] = None,
    actor_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Run the compiled LangGraph workflow for one project.

    ``llm`` overrides the model caller (used by tests); by default the
    provider configured in settings is used.
    """
    initial_state: RecoveryWorkflowState = {
        "project_id": project_id,
        "project_name": "",
        "project_context": {},
        "risk_analysis": {},
        "leave_impact": {},
        "raw_proposal": {},
        "candidate_strategies": [],
        "validated_proposal": None,
        "validation_errors": [],
        "proposal_record_id": None,
        "executed_nodes": [],
        "today": (today or date.today()).isoformat(),
        "run_id": str(uuid.uuid4()),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "status": "INITIALIZED",
        "error": None,
        "actor_id": actor_id,
    }
    graph = build_recovery_workflow(db, llm=llm)
    return graph.invoke(initial_state)
