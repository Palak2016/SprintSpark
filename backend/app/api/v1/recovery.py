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
from app.services.approval_service import apply_recovery_decision

router = APIRouter(tags=["AI Recovery Proposals"])


@router.get("/projects/{project_id}/recovery-proposals", response_model=List[RecoveryProposalOut])
def list_project_recovery_proposals(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    proposals = db.query(RecoveryProposal).filter(
        RecoveryProposal.project_id == project_id
    ).order_by(RecoveryProposal.created_at.desc()).all()
    return [RecoveryProposalOut.model_validate(p) for p in proposals]


@router.post("/projects/{project_id}/recovery-proposals/generate", response_model=RecoveryProposalOut)
def generate_recovery_proposal(
    project_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result_state = run_recovery_workflow(project_id, db)
    proposal_id = result_state.get("proposal_record_id")
    if not proposal_id:
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
