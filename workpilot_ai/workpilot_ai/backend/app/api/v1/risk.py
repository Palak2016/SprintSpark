from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.risk import RiskAnalysis
from app.models.audit import AuditEvent
from app.schemas.risk import RiskAnalysisOut
from app.services.risk_engine import analyze_project_risk

router = APIRouter(prefix="/projects", tags=["Risk Intelligence"])


@router.get("/{project_id}/risk-analysis", response_model=RiskAnalysisOut)
def get_latest_risk_analysis(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    analysis = db.query(RiskAnalysis).filter(
        RiskAnalysis.project_id == project_id
    ).order_by(RiskAnalysis.created_at.desc()).first()

    if not analysis:
        # Run first analysis on-demand
        risk_result = analyze_project_risk(project, db)
        analysis = RiskAnalysis(
            project_id=project.id,
            risk_level=risk_result["risk_level"],
            score=risk_result["score"],
            triggered_rules=risk_result["triggered_rules"],
            evidence_json=risk_result["evidence"],
            missing_data_flags=risk_result["missing_data_flags"]
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)

    return RiskAnalysisOut.model_validate(analysis)


@router.post("/{project_id}/risk-analysis/run", response_model=RiskAnalysisOut)
def run_project_risk_analysis(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    risk_result = analyze_project_risk(project, db)
    analysis = RiskAnalysis(
        project_id=project.id,
        risk_level=risk_result["risk_level"],
        score=risk_result["score"],
        triggered_rules=risk_result["triggered_rules"],
        evidence_json=risk_result["evidence"],
        missing_data_flags=risk_result["missing_data_flags"]
    )
    db.add(analysis)

    # Log audit event
    audit = AuditEvent(
        project_id=project.id,
        actor_id=current_user.id,
        event_type="RISK_ANALYSIS_EVALUATED",
        description=f"Deterministic risk analysis evaluated: {analysis.risk_level} (Risk Score: {analysis.score}/100).",
        metadata_json={
            "risk_level": analysis.risk_level,
            "score": analysis.score,
            "triggered_rules_count": len(risk_result["triggered_rules"])
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(analysis)

    return RiskAnalysisOut.model_validate(analysis)
