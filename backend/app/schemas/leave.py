from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserSimple
from app.schemas.timestamps import UTCDateTime


class LeaveRequestCreate(BaseModel):
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    decision_notes: Optional[str] = None


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None
    status: str
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[UTCDateTime] = None
    decision_notes: Optional[str] = None
    created_at: UTCDateTime
    user: Optional[UserSimple] = None
    reviewer: Optional[UserSimple] = None
