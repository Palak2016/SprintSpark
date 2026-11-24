from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserSimple
from app.schemas.timestamps import UTCDateTime


class WorkLogCreate(BaseModel):
    task_id: int
    hours_spent: float = Field(..., gt=0.0, le=24.0)
    notes: Optional[str] = None
    log_date: Optional[date] = None


class WorkLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    hours_spent: float
    notes: Optional[str] = None
    log_date: date
    created_at: UTCDateTime
    user: Optional[UserSimple] = None


class DailyUpdateCreate(BaseModel):
    task_id: int
    analysis_token: Optional[str] = None
    # Indexes of previewed signals the employee removed before submitting.
    rejected_signal_indexes: List[int] = Field(default_factory=list, max_length=20)
    is_blocked: bool = False
    blocker_notes: Optional[str] = None
    update_notes: str = Field(..., min_length=5, max_length=4000)
    date: Optional[date] = None


class DailyUpdateProgressAnalysisRequest(BaseModel):
    task_id: int
    update_notes: str = Field(..., min_length=5, max_length=4000)
    manual_progress_pct: Optional[int] = Field(None, ge=0, le=100)


class ExtractedSignalOut(BaseModel):
    """One validated item extracted from the update, shown for review."""
    index: int
    kind: str
    related_task_id: Optional[int] = None
    related_task_title: Optional[str] = None
    effort_share: Optional[float] = None
    evidence: str


class DailyUpdateProgressAnalysisOut(BaseModel):
    progress_pct: int = Field(..., ge=0, le=100)
    explanation: str = Field(..., min_length=1, max_length=500)
    analysis_token: str = Field(..., min_length=1)
    signals: List[ExtractedSignalOut] = []
    ai_available: bool = True


class DailyUpdateAgendaDriftOut(BaseModel):
    alignment_status: str
    alignment_score: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    drift_explanation: str
    recommended_actions: List[str] = Field(default_factory=list)
    manager_notified: bool = False
    recovery_proposal_id: Optional[int] = None
    recovery_proposal_status: Optional[str] = None


class DailyUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    progress_pct: int
    is_blocked: bool
    blocker_notes: Optional[str] = None
    update_notes: Optional[str] = None
    date: date
    created_at: UTCDateTime
    user: Optional[UserSimple] = None


class DailyUpdateSubmissionOut(DailyUpdateOut):
    agenda_drift: Optional[DailyUpdateAgendaDriftOut] = None
    agenda_drift_note: Optional[str] = None
