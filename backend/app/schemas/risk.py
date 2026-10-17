from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.timestamps import UTCDateTime


class TriggeredRule(BaseModel):
    rule_id: str
    rule_name: str
    severity: str
    description: str
    evidence: Dict[str, Any]
    affected_task_ids: List[int] = []


class MissingDataFlag(BaseModel):
    field_or_type: str
    message: str
    task_id: Optional[int] = None


class RiskAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    risk_level: str
    score: float
    triggered_rules: List[TriggeredRule] = []
    evidence_json: Dict[str, Any] = {}
    missing_data_flags: List[MissingDataFlag] = []
    created_at: UTCDateTime
