"""Recompute and record project risk.

Ties the pure engine (risk_scoring) to the database: resolves the scoring
config, loads the snapshot, stores a history row only when the result
changes, writes the change explanation, and tells the manager when a project
becomes HIGH risk. Recovery plans are never generated or applied here; the
manager starts them and approves them.
"""

import logging
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit import AuditEvent
from app.models.notification import Notification
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.risk import RiskAnalysis, RiskConfig, RiskLevel
from app.models.task import Task
from app.services.risk_scoring import (
    DEFAULT_CONFIG,
    compute_risk,
    explain_change,
    result_fingerprint,
    validate_config,
)
from app.services.risk_snapshot import build_snapshot

logger = logging.getLogger(__name__)


def project_today() -> date:
    """Today's date in the configured business timezone (not the server's)."""
    try:
        return datetime.now(ZoneInfo(settings.RISK_TIMEZONE)).date()
    except Exception:  # unknown zone name: fall back rather than fail scoring
        return date.today()


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

def active_config_record(db: Session, project: Project) -> Optional[RiskConfig]:
    record = (
        db.query(RiskConfig)
        .filter(RiskConfig.project_id == project.id)
        .order_by(RiskConfig.id.desc())
        .first()
    )
    if record is None and project.company_id is not None:
        record = (
            db.query(RiskConfig)
            .filter(RiskConfig.company_id == project.company_id, RiskConfig.project_id.is_(None))
            .order_by(RiskConfig.id.desc())
            .first()
        )
    return record


def resolve_config(db: Session, project: Project) -> Dict[str, Any]:
    record = active_config_record(db, project)
    if record is None:
        return validate_config(DEFAULT_CONFIG)
    return validate_config({
        "version": record.version,
        "weights": record.weights,
        "thresholds": record.thresholds,
        "params": record.params or {},
    })


# --------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------

def evaluate_project(db: Session, project: Project, as_of: Optional[date] = None) -> Dict[str, Any]:
    """Score a project without storing anything."""
    as_of = as_of or project_today()
    db.flush()  # make pending changes in this session visible to the loader
    snapshot = build_snapshot(db, project, as_of)
    return compute_risk(snapshot, resolve_config(db, project), as_of)


def latest_analysis(db: Session, project_id: int) -> Optional[RiskAnalysis]:
    return (
        db.query(RiskAnalysis)
        .filter(RiskAnalysis.project_id == project_id)
        .order_by(RiskAnalysis.created_at.desc(), RiskAnalysis.id.desc())
        .first()
    )


def analysis_to_result(record: RiskAnalysis) -> Dict[str, Any]:
    """A stored row in the same shape compute_risk returns (plus its id)."""
    return {
        "id": record.id,
        "engine_version": record.engine_version,
        "config_version": record.config_version,
        "as_of": record.as_of_date.isoformat() if record.as_of_date else None,
        "input_hash": record.input_hash,
        "risk_level": record.risk_level,
        "score": record.score,
        "factor_breakdown": record.factor_breakdown or [],
        "triggered_rules": record.triggered_rules or [],
        "evidence": record.evidence_json or {},
        "missing_data_flags": record.missing_data_flags or [],
        "confidence": record.confidence or {},
    }


def recompute_project_risk(
    db: Session,
    project_id: int,
    trigger_type: str,
    trigger_ref_id: Optional[int] = None,
    actor_id: Optional[int] = None,
    as_of: Optional[date] = None,
) -> Optional[RiskAnalysis]:
    """Score the project and record a history row if anything changed.

    Returns the new row, or the latest row when the result is unchanged.
    Adds to the session and flushes; the caller commits.
    """
    project = db.get(Project, project_id)
    if project is None:
        return None
    result = evaluate_project(db, project, as_of)
    latest = latest_analysis(db, project_id)

    if latest is not None and latest.engine_version == result["engine_version"]:
        if latest.input_hash == result["input_hash"]:
            return latest
        if result_fingerprint(analysis_to_result(latest)) == result_fingerprint(result):
            return latest

    previous = None
    if latest is not None:
        previous = {
            "score": latest.score,
            "risk_level": latest.risk_level,
            "factor_breakdown": latest.factor_breakdown or [],
        }
    change = explain_change(previous, result)

    record = RiskAnalysis(
        project_id=project_id,
        risk_level=result["risk_level"],
        score=result["score"],
        triggered_rules=result["triggered_rules"],
        evidence_json=result["evidence"],
        missing_data_flags=result["missing_data_flags"],
        engine_version=result["engine_version"],
        config_version=result["config_version"],
        as_of_date=date.fromisoformat(result["as_of"]),
        input_hash=result["input_hash"],
        factor_breakdown=result["factor_breakdown"],
        confidence=result["confidence"],
        trigger_type=trigger_type,
        trigger_ref_id=trigger_ref_id,
        triggered_by_id=actor_id,
        previous_analysis_id=latest.id if latest else None,
        score_delta=change["score_delta"],
        change_explanation=change,
    )
    db.add(record)
    db.flush()

    became_high = (
        result["risk_level"] == RiskLevel.HIGH.value
        and (latest is None or latest.risk_level != RiskLevel.HIGH.value)
    )
    if change["level_changed"] or (latest is None and became_high):
        db.add(AuditEvent(
            project_id=project_id,
            actor_id=actor_id,
            event_type="RISK_LEVEL_CHANGED",
            description=change["headline"],
            metadata_json={
                "risk_analysis_id": record.id,
                "previous_level": latest.risk_level if latest else None,
                "risk_level": record.risk_level,
                "score": record.score,
                "trigger_type": trigger_type,
            },
        ))
    if became_high and project.manager_id != actor_id:
        top = [c["text"] for c in change["changes"][:3]]
        db.add(Notification(
            user_id=project.manager_id,
            type="RISK_LEVEL_RAISED",
            title=f"High delivery risk: {project.name}",
            message=(
                change["headline"]
                + (" " + " ".join(top) if top else "")
                + " Review the risk breakdown and generate a recovery plan if needed."
            )[:1000],
            link="/manager/risk",
        ))
    return record


def safe_recompute(
    db: Session,
    project_id: Optional[int],
    trigger_type: str,
    trigger_ref_id: Optional[int] = None,
    actor_id: Optional[int] = None,
) -> Optional[RiskAnalysis]:
    """Recompute without letting a scoring problem fail the user's action."""
    if project_id is None:
        return None
    try:
        return recompute_project_risk(db, project_id, trigger_type, trigger_ref_id, actor_id)
    except Exception:  # noqa: BLE001 - scoring must never block saving work
        logger.exception("Risk recalculation failed for project %s", project_id)
        return None


def recompute_many(
    db: Session,
    project_ids: Iterable[int],
    trigger_type: str,
    trigger_ref_id: Optional[int] = None,
    actor_id: Optional[int] = None,
) -> List[RiskAnalysis]:
    records = []
    for project_id in sorted(set(project_ids)):
        record = safe_recompute(db, project_id, trigger_type, trigger_ref_id, actor_id)
        if record is not None:
            records.append(record)
    return records


def project_ids_for_user(db: Session, user_id: int) -> List[int]:
    """Projects whose risk can change when this user's availability changes."""
    ids = {
        row[0] for row in db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user_id).all()
    }
    ids |= {
        row[0] for row in db.query(Task.project_id).filter(Task.assignee_id == user_id).distinct().all()
    }
    ids |= {row[0] for row in db.query(Project.id).filter(Project.manager_id == user_id).all()}
    return sorted(ids)


def recompute_active_projects(db: Session, as_of: Optional[date] = None) -> Tuple[int, int]:
    """Daily job: rescore every active project. Returns (evaluated, recorded)."""
    as_of = as_of or project_today()
    projects = (
        db.query(Project)
        .filter(Project.status.in_([ProjectStatus.ACTIVE.value, ProjectStatus.PLANNING.value]))
        .order_by(Project.id)
        .all()
    )
    recorded = 0
    for project in projects:
        before = latest_analysis(db, project.id)
        try:
            record = recompute_project_risk(db, project.id, "DAILY_JOB", as_of=as_of)
        except Exception:  # noqa: BLE001
            logger.exception("Daily risk job failed for project %s", project.id)
            db.rollback()
            continue
        if record is not None and (before is None or record.id != before.id):
            recorded += 1
        db.commit()
    return len(projects), recorded
