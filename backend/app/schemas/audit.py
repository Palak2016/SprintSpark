from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.auth import UserSimple
from app.schemas.timestamps import UTCDateTime


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    actor_id: Optional[int] = None
    event_type: str
    description: str
    metadata_json: Dict[str, Any] = {}
    created_at: UTCDateTime
    actor: Optional[UserSimple] = None


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: UTCDateTime
