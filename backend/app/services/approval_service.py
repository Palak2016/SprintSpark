from datetime import datetime, timezone, date
from typing import Dict, Any, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.task import Task
from app.models.recovery import RecoveryProposal, ProposalDecision, ProposalStatus
from app.models.audit import AuditEvent
from app.models.notification import Notification


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

    if proposal.status != ProposalStatus.PENDING_APPROVAL.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal cannot be decided: current status is {proposal.status}"
        )

    # Permission check: decider must be Manager or Admin
    if decider.role not in [UserRole.MANAGER.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project managers or administrators can approve recovery proposals"
        )

    applied_changes: List[Dict[str, Any]] = []

    if decision == "APPROVED":
        actions = proposal.proposed_actions or []
        for act in actions:
            task_id = act.get("task_id")
            task = db.query(Task).filter(Task.id == task_id).first()
            if not task:
                continue

            action_type = act.get("action_type")
            proposed_vals = act.get("proposed_values", {})
            orig_vals = act.get("original_values", {})
            applied_record = {
                "task_id": task.id,
                "task_title": task.title,
                "action_type": action_type,
                "before": orig_vals,
                "after": proposed_vals
            }

            if action_type == "REASSIGN":
                new_assignee_id = proposed_vals.get("assignee_id")
                if new_assignee_id:
                    task.assignee_id = new_assignee_id
                    # Notify new assignee
                    notif = Notification(
                        user_id=new_assignee_id,
                        title="Task Reassigned via Recovery Plan",
                        message=f"Task '{task.title}' has been reassigned to you following manager approval of Recovery Plan '{proposal.title}'.",
                        link=f"/employee/tasks"
                    )
                    db.add(notif)

            elif action_type == "EXTEND_DEADLINE":
                new_due_str = proposed_vals.get("due_date")
                if new_due_str:
                    task.due_date = date.fromisoformat(new_due_str)

            elif action_type in ["RESOLVE_DEPENDENCY", "ESCALATE_BLOCKER"]:
                task.is_blocked = proposed_vals.get("is_blocked", False)
                task.blocker_reason = proposed_vals.get("blocker_reason")
                if "status" in proposed_vals:
                    task.status = proposed_vals["status"]

            applied_changes.append(applied_record)

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

    # Record decision
    decision_record = ProposalDecision(
        proposal_id=proposal.id,
        decider_id=decider.id,
        decision=decision,
        decision_notes=decision_notes,
        applied_changes=applied_changes,
        decided_at=datetime.now(timezone.utc)
    )
    db.add(decision_record)

    # Record Audit Event
    audit_event = AuditEvent(
        project_id=proposal.project_id,
        actor_id=decider.id,
        event_type=event_type,
        description=audit_desc,
        metadata_json={
            "proposal_id": proposal.id,
            "decision": decision,
            "decision_notes": decision_notes,
            "applied_changes_count": len(applied_changes),
            "applied_changes": applied_changes
        }
    )
    db.add(audit_event)

    db.commit()
    db.refresh(decision_record)
    return decision_record
