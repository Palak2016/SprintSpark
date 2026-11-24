from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.timestamps import UTCDateTime


class AgendaDriftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    employee_name: str
    task_id: int
    task_title: str
    task_priority: str
    task_due_date: str
    project_id: int
    daily_update_id: int
    daily_update_notes: str
    progress_pct: int
    is_blocked: bool
    alignment_status: str
    alignment_score: int
    confidence_score: int
    drift_explanation: str
    detected_mismatches: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    reported_blockers: Optional[str] = None
    employee_clarification: Optional[str] = None
    manager_review_status: str
    manager_feedback: Optional[str] = None
    recovery_proposal_id: Optional[int] = None
    analysis_details: Dict[str, Any] = Field(default_factory=dict)
    created_at: UTCDateTime
    updated_at: UTCDateTime


class AgendaDriftReview(BaseModel):
    decision: str = Field(..., pattern="^(ACKNOWLEDGED|DISMISSED)$")
    feedback: Optional[str] = Field(None, max_length=1500)


class AgendaDriftClarification(BaseModel):
    clarification: str = Field(..., min_length=5, max_length=1500)
