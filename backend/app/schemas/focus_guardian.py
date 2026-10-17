from pydantic import BaseModel, ConfigDict, Field
from app.schemas.timestamps import UTCDateTime


class FocusContextCreate(BaseModel):
    task_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=150)
    context: str = Field(min_length=10, max_length=3000)


class FocusContextOut(BaseModel):
    id: int
    user_id: int
    task_id: int
    reason: str
    context: str
    created_at: UTCDateTime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectFocusContextOut(FocusContextOut):
    task_title: str
    employee_name: str