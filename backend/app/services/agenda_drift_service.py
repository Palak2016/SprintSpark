"""Persistence and recovery-planner integration for agenda drift findings."""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.agenda_drift import AgendaDrift
from app.models.notification import Notification
from app.models.recovery import ProposalStatus, RecoveryProposal
from app.models.task import Task
from app.models.work_log import DailyUpdate
from app.core.config import settings
from app.services.drift_analysis_service import analyze_daily_update

logger = logging.getLogger(__name__)


def _create_recovery_proposal(
    db: Session,
    drift: AgendaDrift,
    task: Task,
) -> None:
    if task.project.manager_id == drift.employee_id:
        return
    if drift.alignment_status not in {"OFF_TRACK", "PARTIALLY_ALIGNED"}:
        return
    if drift.confidence_score < 50 or drift.recovery_proposal_id:
        return
    if not (drift.analysis_details or {}).get("ai_used") or not drift.recommended_actions:
        return

    recommendation = drift.recommended_actions[0]
    proposal = RecoveryProposal(
        project_id=drift.project_id,
        title=f"Agenda recovery: {task.title[:200]}",
        summary=(
            f"Review the reported work and agree on a next step for '{task.title}'. "
            "This is an advisory proposal; approving it does not change task assignments, "
            "deadlines, or priorities."
        ),
        proposed_actions=[{
            "action_id": f"agenda-{drift.id}",
            "action_type": "SPLIT_EFFORT",
            "task_id": task.id,
            "task_title": task.title,
            "original_values": {},
            "proposed_values": {"note": recommendation[:300]},
            "reason": drift.drift_explanation[:500],
            "expected_impact": recommendation[:300],
            "source": "AI",
            "is_advisory": True,
            "validation": {
                "status": "ADVISORY",
                "errors": [],
                "warnings": ["Advisory only; no task fields will be changed."],
            },
        }],
        focus_contexts=[],
        rationale=drift.drift_explanation[:1200],
        assumptions=[
            "The employee and manager will confirm the next step.",
            "No assignment, deadline, or priority changes are made by this proposal.",
        ],
        status=ProposalStatus.PENDING_APPROVAL.value,
        generation_trace={
            "status": "COMPLETED",
            "generation_mode": "AI_HYBRID",
            "llm": {
                "invoked": True,
                "status": "SUCCEEDED",
                "provider": (drift.analysis_details or {}).get("provider"),
                "model": (drift.analysis_details or {}).get("model"),
            },
            "graph_nodes": ["agenda_drift_detection", "recovery_proposal"],
            "deterministic_findings": {
                "alignment_status": drift.alignment_status,
                "alignment_score": drift.alignment_score,
                "confidence_score": drift.confidence_score,
                "daily_update_id": drift.daily_update_id,
            },
            "ai_analysis": {
                "delay_explanation": drift.drift_explanation,
                "recommendation_reason": recommendation,
            },
            "strategies": [],
            "rejected_actions": [],
            "validation": {
                "status": "PASSED_WITH_WARNINGS",
                "errors": [],
                "warnings": ["The recovery action is advisory and does not mutate task data."],
            },
            "schedule_comparison": {},
        },
    )
    db.add(proposal)
    db.flush()
    drift.recovery_proposal_id = proposal.id


def analyze_and_persist_daily_update(
    db: Session,
    task: Task,
    update: DailyUpdate,
    additional_context: Optional[str] = None,
) -> Optional[AgendaDrift]:
    # Only the assigned person is analyzed; managers can receive self-guidance
    # when they are also the task assignee.
    if task.assignee_id is None or task.assignee_id != update.user_id:
        return None

    existing = (
        db.query(AgendaDrift)
        .filter(AgendaDrift.daily_update_id == update.id)
        .first()
    )
    analysis = analyze_daily_update(db, task, update, additional_context)
    created = existing is None
    if created:
        drift = AgendaDrift(
            employee_id=update.user_id,
            task_id=task.id,
            daily_update_id=update.id,
            project_id=task.project_id,
            manager_review_status="PENDING_REVIEW",
            **analysis,
        )
        db.add(drift)
        db.flush()
    else:
        drift = existing
        for key, value in analysis.items():
            setattr(drift, key, value)
        drift.employee_clarification = additional_context or drift.employee_clarification
        drift.manager_review_status = "PENDING_REVIEW"
        drift.manager_feedback = None
        db.flush()

    if not additional_context:
        _create_recovery_proposal(db, drift, task)
        if (
            created
            and drift.alignment_status == "OFF_TRACK"
            and drift.confidence_score >= settings.AGENDA_DRIFT_MIN_CONFIDENCE
            and not update.is_blocked
            and task.project.manager_id is not None
            and task.project.manager_id != update.user_id
        ):
            manager_id = task.project.manager_id
            db.add(Notification(
                user_id=manager_id,
                type="AGENDA_DRIFT_DETECTED",
                title=f"Agenda check: {task.title}",
                message=(
                    f"{update.user.full_name} may need support aligning reported work "
                    f"with '{task.title}'. Review the explanation and recovery proposal."
                ),
                link="/manager/agenda-drift",
            ))
    return drift
