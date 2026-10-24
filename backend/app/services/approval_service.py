"""Manager decisions on recovery proposals.

Approval is the only path that changes tasks. Before anything is applied the
proposal is re-validated against the current database state:

* the decider must manage the proposal's project (or be an admin);
* every stored action is validated again with ``recovery_validation``;
* if a task changed since the proposal was generated (assignee, dates,
  priority or blocker state differ from the proposal's snapshot), the
  approval is refused with HTTP 409 and nothing is applied;
* advisory actions are recorded but never change data;
* all changes are applied in one transaction. A failure rolls everything
  back and is reported.
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.notification import Notification
from app.models.project import Project
from app.models.recovery import ProposalDecision, ProposalStatus, RecoveryProposal
from app.models.task import Task
from app.models.user import User, UserRole
from app.core.tenancy import can_access_project, can_manage_project
from app.services.recovery_validation import stale_fields, validate_plan


def ensure_can_manage_project(user: User, project: Project) -> None:
    if not can_manage_project(user, project):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only this project's manager or an administrator can do this.",
        )


def _current_context(project: Project, db: Session):
    # Imported here to avoid a circular import at module load.
    from app.services.recovery_graph import context_collector_node, leave_impact_node

    state: Dict[str, Any] = {"project_id": project.id}
    state.update(context_collector_node(state, db))
    state.update(leave_impact_node(state, db))
    return state["project_context"], state["leave_impact"]["approved_leaves"]


def revalidate_proposal(proposal: RecoveryProposal, project: Project, db: Session) -> Dict[str, Any]:
    """Re-check a stored proposal against current data without changing it."""
    context, leaves = _current_context(project, db)
    tasks = {t["id"]: t for t in context["tasks"]}
    actions = proposal.proposed_actions or []

    stale = []
    for action in actions:
        changed = stale_fields(action, tasks.get(action.get("task_id")))
        if changed:
            stale.append({
                "task_id": action.get("task_id"),
                "task_title": action.get("task_title"),
                "action_type": action.get("action_type"),
                "changed_fields": changed,
            })

    result = validate_plan(actions, context, leaves, date.today())
    return {
        "revalidated_at": datetime.now(timezone.utc).isoformat(),
        "stale_actions": stale,
        "invalid_actions": [
            {
                "task_id": a["task_id"],
                "action_type": a["action_type"],
                "errors": a["validation"]["errors"],
            }
            for a in result["rejected"]
        ],
        "warnings": result["warnings"],
        "accepted": result["accepted"],
        "ok": not stale and not result["rejected"],
    }


def _apply_action(task: Task, action: Dict[str, Any], proposal: RecoveryProposal, db: Session) -> Dict[str, Any]:
    action_type = action["action_type"]
    values = action.get("proposed_values") or {}
    before: Dict[str, Any] = {}
    after: Dict[str, Any] = {}

    if action_type == "REASSIGN":
        before["assignee_id"] = task.assignee_id
        task.assignee_id = int(values["assignee_id"])
        after["assignee_id"] = task.assignee_id
        db.add(Notification(
            user_id=task.assignee_id,
            title="Task Reassigned via Recovery Plan",
            message=(
                f"Task '{task.title}' has been reassigned to you following manager "
                f"approval of Recovery Plan '{proposal.title}'."
            ),
            link="/employee/tasks",
        ))
    elif action_type in ("EXTEND_DEADLINE", "RESCHEDULE"):
        if values.get("start_date"):
            before["start_date"] = str(task.start_date)
            task.start_date = date.fromisoformat(values["start_date"])
            after["start_date"] = values["start_date"]
        if values.get("due_date"):
            before["due_date"] = str(task.due_date)
            task.due_date = date.fromisoformat(values["due_date"])
            after["due_date"] = values["due_date"]
    elif action_type == "REPRIORITIZE":
        before["priority"] = task.priority
        task.priority = values["priority"]
        after["priority"] = task.priority
    elif action_type in ("RESOLVE_DEPENDENCY", "ESCALATE_BLOCKER"):
        before = {
            "is_blocked": task.is_blocked,
            "blocker_reason": task.blocker_reason,
            "status": task.status,
        }
        task.is_blocked = bool(values.get("is_blocked", task.is_blocked))
        if values.get("blocker_reason") is not None:
            task.blocker_reason = values["blocker_reason"]
        if values.get("status"):
            task.status = values["status"]
        elif task.is_blocked:
            task.status = "BLOCKED"
        after = {
            "is_blocked": task.is_blocked,
            "blocker_reason": task.blocker_reason,
            "status": task.status,
        }

    return {
        "task_id": task.id,
        "task_title": task.title,
        "action_type": action_type,
        "source": action.get("source"),
        "before": before,
        "after": after,
    }


def apply_recovery_decision(
    proposal_id: int,
    decider: User,
    decision: str,
    decision_notes: str,
    db: Session
) -> ProposalDecision:
    proposal = db.query(RecoveryProposal).filter(RecoveryProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recovery proposal not found")

    project = db.query(Project).filter(Project.id == proposal.project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    ensure_can_manage_project(decider, project)

    if proposal.status != ProposalStatus.PENDING_APPROVAL.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal cannot be decided: current status is {proposal.status}"
        )

    applied_changes: List[Dict[str, Any]] = []
    execution_report: Dict[str, Any] = {"status": "NOT_APPLICABLE"}

    if decision == "APPROVED":
        check = revalidate_proposal(proposal, project, db)
        if not check["ok"]:
            db.add(AuditEvent(
                project_id=proposal.project_id,
                actor_id=decider.id,
                event_type="RECOVERY_PROPOSAL_REVALIDATION_FAILED",
                description=(
                    f"Approval of recovery proposal '{proposal.title}' was blocked: "
                    "project data changed or actions are no longer valid."
                ),
                metadata_json={
                    "proposal_id": proposal.id,
                    "stale_actions": check["stale_actions"],
                    "invalid_actions": check["invalid_actions"],
                },
            ))
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": (
                        "This proposal no longer matches current project data. "
                        "Nothing was applied. Generate a new proposal."
                    ),
                    "stale_actions": check["stale_actions"],
                    "invalid_actions": check["invalid_actions"],
                },
            )

        advisory = []
        try:
            for action in check["accepted"]:
                if action["validation"]["status"] == "ADVISORY":
                    advisory.append({
                        "task_id": action["task_id"],
                        "action_type": action["action_type"],
                        "note": action["proposed_values"].get("note") or action["reason"],
                    })
                    continue
                task = db.query(Task).filter(
                    Task.id == action["task_id"],
                    Task.project_id == proposal.project_id,
                ).first()
                applied_changes.append(_apply_action(task, action, proposal, db))
            db.flush()
        except Exception as exc:  # pragma: no cover - defensive rollback path
            db.rollback()
            db.add(AuditEvent(
                project_id=proposal.project_id,
                actor_id=decider.id,
                event_type="RECOVERY_EXECUTION_FAILED",
                description=f"Applying recovery proposal '{proposal.title}' failed; no changes were saved.",
                metadata_json={"proposal_id": proposal.id, "error": type(exc).__name__},
            ))
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Applying the proposal failed. No changes were saved.",
            ) from exc

        execution_report = {
            "status": "SUCCEEDED",
            "revalidated_at": check["revalidated_at"],
            "applied_count": len(applied_changes),
            "advisory_not_applied": advisory,
            "warnings": check["warnings"],
            "errors": [],
        }
        proposal.status = ProposalStatus.APPROVED.value
        event_type = "RECOVERY_PROPOSAL_APPROVED"
        audit_desc = f"Manager {decider.full_name} approved recovery proposal '{proposal.title}' ({len(applied_changes)} changes applied)."

    elif decision == "REJECTED":
        proposal.status = ProposalStatus.REJECTED.value
        event_type = "RECOVERY_PROPOSAL_REJECTED"
        audit_desc = f"Manager {decider.full_name} rejected recovery proposal '{proposal.title}'."
    else:  # DEFERRED
        proposal.status = ProposalStatus.DEFERRED.value
        event_type = "RECOVERY_PROPOSAL_DEFERRED"
        audit_desc = f"Manager {decider.full_name} deferred review of recovery proposal '{proposal.title}'."

    decision_record = ProposalDecision(
        proposal_id=proposal.id,
        decider_id=decider.id,
        decision=decision,
        decision_notes=decision_notes,
        applied_changes=applied_changes,
        execution_report=execution_report,
        decided_at=func.now()
    )
    db.add(decision_record)

    trace = proposal.generation_trace or {}
    db.add(AuditEvent(
        project_id=proposal.project_id,
        actor_id=decider.id,
        event_type=event_type,
        description=audit_desc,
        metadata_json={
            "proposal_id": proposal.id,
            "decision": decision,
            "decision_notes": decision_notes,
            "applied_changes_count": len(applied_changes),
            "applied_changes": applied_changes,
            "generation_mode": trace.get("generation_mode"),
            "llm_invoked": bool((trace.get("llm") or {}).get("invoked")),
            "execution_status": execution_report.get("status"),
        }
    ))

    db.commit()
    db.refresh(decision_record)
    return decision_record
