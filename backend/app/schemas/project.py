from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserSimple
from app.schemas.timestamps import UTCDateTime


class ProjectMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    role_in_project: str
    joined_at: UTCDateTime
    user: UserSimple


class ProjectMemberAdd(BaseModel):
    user_id: int
    role_in_project: str = "Contributor"


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    start_date: date
    target_end_date: date
    status: Optional[str] = "ACTIVE"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    status: Optional[str] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    manager_id: int
    status: str
    start_date: date
    target_end_date: date
    created_at: UTCDateTime
    updated_at: UTCDateTime
    manager: Optional[UserSimple] = None
    members: List[ProjectMemberOut] = []
    
    task_count: Optional[int] = 0
    completed_task_count: Optional[int] = 0
    completion_percentage: Optional[int] = 0
    latest_risk_level: Optional[str] = "LOW"
