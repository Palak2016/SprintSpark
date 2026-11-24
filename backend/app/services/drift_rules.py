"""Deterministic agenda-drift scoring and safeguards."""

from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.core.config import settings


def is_vague_update(text: Optional[str]) -> bool:
    normalized = " ".join((text or "").lower().split())
    vague_phrases = {
        "worked on it",
        "made progress",
        "working on this",
        "ongoing",
        "in progress",
        "same as yesterday",
        "no update",
    }
    return len(normalized) < 18 or normalized in vague_phrases


def stalled_progress(
    current_progress: int,
    previous_updates: Iterable[Dict[str, Any]],
    is_blocked: bool,
) -> bool:
    if is_blocked:
        return False
    progress = [
        int(item.get("progress_pct") or 0)
        for item in list(previous_updates)[:2]
    ]
    progress.append(int(current_progress or 0))
    return len(progress) >= 3 and len(set(progress)) == 1


def build_mismatches(
    task: Any,
    update: Any,
    previous_updates: List[Dict[str, Any]],
    dependencies: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    mismatches: List[Dict[str, Any]] = []
    if getattr(task, "due_date", None):
        from datetime import date

        if task.due_date < date.today() and (task.progress_pct or 0) < 100:
            mismatches.append({
                "kind": "overdue",
                "evidence": f"Task deadline was {task.due_date.isoformat()} and progress is {task.progress_pct or 0}%.",
            })

    if stalled_progress(update.progress_pct, previous_updates, update.is_blocked):
        mismatches.append({
            "kind": "stalled_progress",
            "evidence": "Progress has not changed across the last three updates.",
        })

    incomplete_dependencies = [
        item for item in dependencies
        if item.get("status") != "COMPLETED"
    ]
    if incomplete_dependencies:
        mismatches.append({
            "kind": "dependency",
            "evidence": "Waiting on prerequisite task(s): "
            + ", ".join(item.get("title", "Untitled task") for item in incomplete_dependencies),
        })

    if update.is_blocked and update.blocker_notes:
        mismatches.append({
            "kind": "reported_blocker",
            "evidence": update.blocker_notes.strip()[:500],
        })

    description = (getattr(task, "description", None) or "").strip()
    if description and (update.progress_pct or 0) < 100:
        mismatches.append({
            "kind": "incomplete_deliverables",
            "evidence": "The task is not complete; remaining deliverables should be confirmed against its description.",
        })
    return mismatches


def alignment_score(
    semantic_score: int,
    approved_priority_change: bool,
) -> int:
    score = max(0, min(100, int(semantic_score)))
    if approved_priority_change:
        # A manager-approved change is legitimate work, not employee drift.
        score = max(score, settings.AGENDA_DRIFT_PARTIAL_THRESHOLD)
    return score


def alignment_status(
    score: int,
    confidence: int,
    needs_clarification: bool,
    approved_priority_change: bool,
    reported_blocker: bool = False,
) -> str:
    if needs_clarification or confidence < settings.AGENDA_DRIFT_MIN_CONFIDENCE:
        return "NEEDS_CLARIFICATION"
    if approved_priority_change:
        return "PARTIALLY_ALIGNED"
    if reported_blocker and score < settings.AGENDA_DRIFT_PARTIAL_THRESHOLD:
        return "NEEDS_CLARIFICATION"
    if score >= settings.AGENDA_DRIFT_ALIGNED_THRESHOLD:
        return "ALIGNED"
    if score >= settings.AGENDA_DRIFT_PARTIAL_THRESHOLD:
        return "PARTIALLY_ALIGNED"
    return "OFF_TRACK"
