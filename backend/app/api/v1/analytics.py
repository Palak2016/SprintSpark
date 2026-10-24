"""Dashboard chart data computed from stored project records."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.core.tenancy import require_project_access, visible_projects_clause
from app.models.project import Project
from app.models.risk import RiskAnalysis
from app.models.task import Task
from app.models.user import User, UserRole
from app.models.work_log import DailyUpdate
from app.schemas.timestamps import normalize_utc
from app.services.project_analytics import compute_project_analytics, portfolio_health
from app.services.recovery_graph import context_collector_node, leave_impact_node

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _can_view(user: User, project: Project) -> bool:
    try:
        require_project_access(user, project)
        return True
    except HTTPException:
        return False


@router.get("/projects/{project_id}")
def project_analytics(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not _can_view(current_user, project):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this project.")

    state = {"project_id": project.id}
    state.update(context_collector_node(state, db))
    state.update(leave_impact_node(state, db))

    updates = [
        {"task_id": u.task_id, "date": u.date, "progress_pct": u.progress_pct}
        for u in db.query(DailyUpdate)
        .join(Task, Task.id == DailyUpdate.task_id)
        .filter(Task.project_id == project.id)
        .all()
    ]
    analyses = [
        {
            "created_at": normalize_utc(a.created_at).isoformat(),
            "score": a.score,
            "risk_level": a.risk_level,
        }
        for a in db.query(RiskAnalysis).filter(RiskAnalysis.project_id == project.id).all()
    ]
    return compute_project_analytics(
        state["project_context"],
        state["leave_impact"]["approved_leaves"],
        updates,
        analyses,
        date.today(),
    )


def build_portfolio_rows(projects, db: Session):
    """Latest risk snapshot per project (shared by manager and Company Portal analytics)."""
    rows = []
    for project in projects:
        latest = (
            db.query(RiskAnalysis)
            .filter(RiskAnalysis.project_id == project.id)
            .order_by(RiskAnalysis.created_at.desc(), RiskAnalysis.id.desc())
            .first()
        )
        rows.append({
            "project_id": project.id,
            "name": project.name,
            "status": project.status,
            "target_end_date": str(project.target_end_date),
            "risk_level": latest.risk_level if latest else None,
            "risk_score": latest.score if latest else None,
            "analyzed_at": normalize_utc(latest.created_at).isoformat() if latest else None,
        })
    return rows


@router.get("/portfolio")
def portfolio_analytics(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(Project)
        .filter(visible_projects_clause(current_user, db))
        .order_by(Project.id)
        .all()
    )
    return portfolio_health(build_portfolio_rows(projects, db))
