from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserSimple


class ProposedAction(BaseModel):
    action_id: str
    action_type: str
    task_id: int
    task_title: str
    original_values: Dict[str, Any]
    proposed_values: Dict[str, Any]
    reason: str
    expected_impact: str


class ProposalDecisionCreate(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|REJECTED|DEFERRED)$")
    decision_notes: Optional[str] = None


class ProposalDecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    proposal_id: int
    decider_id: int
    decision: str
    decision_notes: Optional[str] = None
    applied_changes: List[Dict[str, Any]] = []
    decided_at: datetime
    decider: Optional[UserSimple] = None


class FocusContextEvidence(BaseModel):
    id: int
    task_id: int
    task_title: str
    user_id: int
    employee_name: str
    reason: str
    context: str
    created_at: datetime


class RecoveryProposalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    risk_analysis_id: Optional[int] = None
    title: str
    summary: str
    proposed_actions: List[ProposedAction] = []
    focus_contexts: List[FocusContextEvidence] = []
    rationale: str
    assumptions: List[str] = []
    status: str
    created_at: datetime
    decisions: List[ProposalDecisionOut] = []
