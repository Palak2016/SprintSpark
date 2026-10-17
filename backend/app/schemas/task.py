from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserSimple
from app.schemas.timestamps import UTCDateTime


class TaskDependencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    prerequisite_task_id: int
    created_at: UTCDateTime
    prerequisite_task_title: Optional[str] = None
    prerequisite_task_status: Optional[str] = None


class TaskDependencyCreate(BaseModel):
    prerequisite_task_id: int


class TaskCreate(BaseModel):
    project_id: int
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    priority: str = "MEDIUM"
    status: str = "TODO"
    estimated_hours: float = Field(default=0.0, ge=0.0)
    start_date: date
    due_date: date
    prerequisite_ids: Optional[List[int]] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    progress_pct: Optional[int] = Field(None, ge=0, le=100)
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    is_blocked: Optional[bool] = None
    blocker_reason: Optional[str] = None


class TaskProgressUpdate(BaseModel):
    progress_pct: int = Field(..., ge=0, le=100)
    status: Optional[str] = None
    notes: Optional[str] = None


class TaskBlockerReport(BaseModel):
    is_blocked: bool
    blocker_reason: Optional[str] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    priority: str
    status: str
    estimated_hours: float
    actual_hours: float
    progress_pct: int
    start_date: date
    due_date: date
    is_blocked: bool
    blocker_reason: Optional[str] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
    assignee: Optional[UserSimple] = None
    dependencies: List[TaskDependencyOut] = []
    dependents: List[TaskDependencyOut] = []
