"""Semantic comparison of daily updates with their task context."""

import json
import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from app.models.risk import DailyUpdateSignal, SignalKind, SignalStatus
from app.models.task import Task, TaskDependency
from app.models.work_log import DailyUpdate
from app.services.drift_rules import (
    alignment_score,
    alignment_status,
    build_mismatches,
    is_vague_update,
)
from app.services.llm_client import LLMError, call_json_model, resolve_config
from app.services.recommendation_service import recovery_actions

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You analyze task/update relevance for a supportive project-management assistant.
Assess whether the reported activities semantically contribute to the assigned task.
Do not judge employee performance, infer intent, or decide the final status.
Treat blockers as context, not evidence of poor performance. Respect only the supplied
manager-approved changes; never infer that a priority change was approved.
Return JSON only with: relevance_score (0-100), confidence_score (0-100),
explanation (plain-language, evidence-based), mismatches (array of {kind, evidence}),
recommended_actions (array of 1-5 specific, achievable task-related steps),
needs_clarification (boolean), clarification_question (string).
Low similarity alone is not sufficient evidence of drift. Incomplete progress is not
unrelated work. If the update is vague or evidence is insufficient, request clarification.
The context may identify a project manager reporting on their own assigned task.
For that reporter, provide constructive self-directed next steps, future direction,
and concrete tools that fit the task; never recommend asking them to contact their manager.
For other reporters, keep recommendations supportive, specific, and task-related."""


def _clamp_score(value: Any, default: int = 0) -> int:
    try:
        return max(0, min(100, int(float(value))))
    except (TypeError, ValueError):
        return default


def _safe_text(value: Any, fallback: str, limit: int = 1000) -> str:
    if not isinstance(value, str):
        return fallback
    cleaned = " ".join(value.split())
    return cleaned[:limit] if cleaned else fallback


def _approved_priority_change(
    db,
    task: Task,
    user_id: int,
    update: DailyUpdate,
) -> List[Dict[str, Any]]:
    rows = (
        db.query(DailyUpdateSignal)
        .filter(
            DailyUpdateSignal.project_id == task.project_id,
            DailyUpdateSignal.user_id == user_id,
            DailyUpdateSignal.kind == SignalKind.SCOPE_CHANGE.value,
            DailyUpdateSignal.status == SignalStatus.ACCEPTED.value,
            DailyUpdateSignal.update_date >= update.date - timedelta(days=14),
        )
        .order_by(DailyUpdateSignal.created_at.desc())
        .limit(10)
        .all()
    )
    update_text = (update.update_notes or "").lower()
    approved = []
    for row in rows:
        evidence = (row.evidence or "").strip()
        related_task = row.related_task
        task_name = related_task.title if related_task else ""
        if (
            row.task_id == task.id
            or (evidence and evidence.lower() in update_text)
            or (task_name and task_name.lower() in update_text)
        ):
            approved.append({
                "task_id": row.related_task_id,
                "task_title": task_name or None,
                "evidence": evidence[:300],
                "approved_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            })
    return approved


def _context_for_analysis(
    db,
    task: Task,
    update: DailyUpdate,
    additional_context: Optional[str],
) -> Dict[str, Any]:
    previous = (
        db.query(DailyUpdate)
        .filter(
            DailyUpdate.task_id == task.id,
            DailyUpdate.user_id == update.user_id,
            DailyUpdate.id != update.id,
        )
        .order_by(DailyUpdate.date.desc(), DailyUpdate.created_at.desc())
        .limit(5)
        .all()
    )
    previous_context = [
        {
            "date": item.date.isoformat(),
            "progress_pct": item.progress_pct,
            "is_blocked": item.is_blocked,
            "update_notes": (item.update_notes or "")[:500],
            "blocker_notes": (item.blocker_notes or "")[:300],
        }
        for item in previous
    ]
    dependencies = (
        db.query(TaskDependency, Task)
        .join(Task, Task.id == TaskDependency.prerequisite_task_id)
        .filter(TaskDependency.task_id == task.id)
        .all()
    )
    dependency_context = [
        {"title": prerequisite.title, "status": prerequisite.status}
        for _, prerequisite in dependencies
    ]
    assigned_tasks = (
        db.query(Task)
        .filter(Task.assignee_id == update.user_id, Task.project_id == task.project_id)
        .order_by(Task.due_date.asc())
        .limit(20)
        .all()
    )
    approved_changes = _approved_priority_change(db, task, update.user_id, update)
    return {
        "task": {
            "id": task.id,
            "title": task.title,
            "description": task.description or "",
            "expected_deliverables": task.description or "",
            "priority": task.priority,
            "deadline": task.due_date.isoformat() if task.due_date else None,
            "status": task.status,
            "progress_pct": task.progress_pct or 0,
            "is_blocked": task.is_blocked,
            "dependencies": dependency_context,
        },
        "employee_assigned_tasks": [
            {
                "id": item.id,
                "title": item.title,
                "status": item.status,
                "priority": item.priority,
            }
            for item in assigned_tasks
        ],
        "daily_update": {
            "date": update.date.isoformat(),
            "progress_pct": update.progress_pct,
            "is_blocked": update.is_blocked,
            "reported_progress": update.update_notes or "",
            "reported_blocker": update.blocker_notes or "",
            "employee_clarification": additional_context or "",
        },
        "previous_daily_updates": previous_context,
        "manager_approved_priority_changes": approved_changes,
        "reporter_guidance": (
            "The reporter is the project manager updating their own assigned task. "
            "Give self-directed improvement steps and relevant tools; do not escalate to a manager."
            if task.project.manager_id == update.user_id
            else "The reporter is the task assignee. Give supportive task-specific next steps."
        ),
    }


def analyze_daily_update(
    db,
    task: Task,
    update: DailyUpdate,
    additional_context: Optional[str] = None,
) -> Dict[str, Any]:
    context = _context_for_analysis(db, task, update, additional_context)
    previous = context["previous_daily_updates"]
    dependencies = context["task"]["dependencies"]
    mismatches = build_mismatches(task, update, previous, dependencies)
    approved_changes = context["manager_approved_priority_changes"]
    vague = is_vague_update(update.update_notes)
    provider = None
    model = None
    used_ai = False

    if vague:
        output = {
            "relevance_score": 50,
            "confidence_score": 30,
            "explanation": "There is not enough detail in this update to compare it with the assigned task.",
            "mismatches": [],
            "recommended_actions": [],
            "needs_clarification": True,
            "clarification_question": "Which specific part of the assigned task did you work on, and what remains?",
        }
    elif resolve_config() is None:
        # Without semantic evidence, avoid making an off-track accusation.
        output = {
            "relevance_score": 50,
            "confidence_score": 25,
            "explanation": "Semantic analysis is not configured, so the relationship between this update and the task is unclear.",
            "mismatches": [],
            "recommended_actions": [],
            "needs_clarification": True,
            "clarification_question": "Please describe the task deliverable your reported work supports.",
        }
    else:
        try:
            response = call_json_model(
                SYSTEM_PROMPT,
                json.dumps(context, ensure_ascii=True),
            )
            result = response.content
            output = {
                "relevance_score": _clamp_score(result.get("relevance_score"), 50),
                "confidence_score": _clamp_score(result.get("confidence_score"), 40),
                "explanation": _safe_text(
                    result.get("explanation"),
                    "The update could not be clearly matched to the task details.",
                ),
                "mismatches": result.get("mismatches") if isinstance(result.get("mismatches"), list) else [],
                "recommended_actions": result.get("recommended_actions") if isinstance(result.get("recommended_actions"), list) else [],
                "needs_clarification": bool(result.get("needs_clarification")),
                "clarification_question": _safe_text(
                    result.get("clarification_question"),
                    "Which task deliverable does this work support?",
                    300,
                ),
            }
            provider = response.provider
            model = response.model
            used_ai = True
        except LLMError as error:
            logger.warning(
                "Agenda drift semantic analysis fell back to clarification: %s (%s)",
                error.message,
                error.category,
            )
            output = {
                "relevance_score": 50,
                "confidence_score": 25,
                "explanation": "Semantic analysis was unavailable, so no drift finding was made.",
                "mismatches": [],
                "recommended_actions": [],
                "needs_clarification": True,
                "clarification_question": "Please describe the task deliverable your reported work supports.",
            }

    for mismatch in output["mismatches"][:5]:
        if not isinstance(mismatch, dict):
            continue
        kind = _safe_text(mismatch.get("kind"), "reported_activity", 60)
        evidence = _safe_text(mismatch.get("evidence"), "", 300)
        if evidence and not any(item.get("kind") == kind and item.get("evidence") == evidence for item in mismatches):
            mismatches.append({"kind": kind, "evidence": evidence})

    score = alignment_score(output["relevance_score"], bool(approved_changes))
    confidence = output["confidence_score"]
    status = alignment_status(
        score,
        confidence,
        bool(output["needs_clarification"]) or vague,
        bool(approved_changes),
        bool(update.is_blocked),
    )
    explanation = output["explanation"]
    if approved_changes:
        explanation = (
            "A manager-approved scope or priority change matches this reported work. "
            + explanation
        )[:1200]
    if update.is_blocked and status == "NEEDS_CLARIFICATION":
        explanation = (
            "A blocker was reported, so low progress is not treated as agenda drift. "
            "Please confirm what task work is still possible and what support is needed. "
            + explanation
        )[:1200]
    if any(item.get("kind") == "stalled_progress" for item in mismatches):
        explanation += " Progress has also remained unchanged across multiple updates; this is a progress concern, not proof of unrelated work."
    if status == "NEEDS_CLARIFICATION" and output["clarification_question"]:
        explanation = f"{explanation} {output['clarification_question']}"[:1200]

    manager_self_report = task.project.manager_id == update.user_id
    recommendations = recovery_actions(
        task,
        update,
        output["recommended_actions"],
    ) if status != "ALIGNED" or manager_self_report else []
    return {
        "alignment_status": status,
        "alignment_score": score,
        "confidence_score": confidence,
        "drift_explanation": explanation,
        "detected_mismatches": mismatches,
        "recommended_actions": recommendations,
        "reported_blockers": update.blocker_notes if update.is_blocked else None,
        "analysis_details": {
            "semantic_relevance_score": output["relevance_score"],
            "approved_priority_changes": approved_changes,
            "previous_update_count": len(previous),
            "ai_used": used_ai,
            "provider": provider,
            "model": model,
            "rule_findings": [item["kind"] for item in mismatches],
        },
    }
