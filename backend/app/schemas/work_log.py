from datetime import date
from typing import Optional
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
    progress_pct: int = Field(..., ge=0, le=100)
    is_blocked: bool = False
    blocker_notes: Optional[str] = None
    update_notes: Optional[str] = None
    date: Optional[date] = None


class DailyUpdateProgressAnalysisRequest(BaseModel):
    task_id: int
    update_notes: str = Field(..., min_length=5, max_length=4000)


class DailyUpdateProgressAnalysisOut(BaseModel):
    progress_pct: int = Field(..., ge=0, le=100)
    explanation: str = Field(..., min_length=1, max_length=500)


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
