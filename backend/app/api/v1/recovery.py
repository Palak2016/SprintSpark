from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.models.user import User
from app.models.project import Project
from app.models.recovery import RecoveryProposal
from app.schemas.recovery import RecoveryProposalOut, ProposalDecisionCreate, ProposalDecisionOut
from app.services.recovery_graph import run_recovery_workflow
from app.services.approval_service import apply_recovery_decision, ensure_can_manage_project
from app.services.llm_client import describe_config

router = APIRouter(tags=["AI Recovery Proposals"])


def _project_or_404(project_id: int, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/recovery-planner/status")
def recovery_planner_status(current_user: User = Depends(require_manager)):
    """Which planner will run: shows the configured provider/model only
    (never the key)."""
    config = describe_config()
    return {
        "llm_configured": config["configured"],
        "provider": config["provider"],
        "model": config["model"],
        "mode_when_recovery_needed": "AI_HYBRID" if config["configured"] else "RULE_BASED_FALLBACK",
    }


@router.get("/projects/{project_id}/recovery-proposals", response_model=List[RecoveryProposalOut])
def list_project_recovery_proposals(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_can_manage_project(current_user, _project_or_404(project_id, db))
    proposals = db.query(RecoveryProposal).filter(
        RecoveryProposal.project_id == project_id
    ).order_by(RecoveryProposal.created_at.desc(), RecoveryProposal.id.desc()).all()
    return [RecoveryProposalOut.model_validate(p) for p in proposals]


@router.post("/projects/{project_id}/recovery-proposals/generate", response_model=RecoveryProposalOut)
def generate_recovery_proposal(
    project_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    project = _project_or_404(project_id, db)
    ensure_can_manage_project(current_user, project)

    result_state = run_recovery_workflow(project_id, db, actor_id=current_user.id)
    proposal_id = result_state.get("proposal_record_id")
    if not proposal_id:
        if result_state.get("error"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=result_state["error"],
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recovery proposal: {result_state.get('validation_errors', ['Unknown error'])}"
        )

    proposal = db.query(RecoveryProposal).filter(RecoveryProposal.id == proposal_id).first()
    return RecoveryProposalOut.model_validate(proposal)


@router.get("/recovery-proposals/{proposal_id}", response_model=RecoveryProposalOut)
def get_recovery_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    proposal = db.query(RecoveryProposal).filter(RecoveryProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recovery proposal not found")
    ensure_can_manage_project(current_user, _project_or_404(proposal.project_id, db))
    return RecoveryProposalOut.model_validate(proposal)


@router.post("/recovery-proposals/{proposal_id}/decide", response_model=ProposalDecisionOut)
def decide_recovery_proposal(
    proposal_id: int,
    data: ProposalDecisionCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    decision_record = apply_recovery_decision(
        proposal_id=proposal_id,
        decider=current_user,
        decision=data.decision,
        decision_notes=data.decision_notes or "",
        db=db
    )
    return ProposalDecisionOut.model_validate(decision_record)
