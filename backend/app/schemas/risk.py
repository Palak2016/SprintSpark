from datetime import date
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.timestamps import UTCDateTime


class TriggeredRule(BaseModel):
    rule_id: str
    rule_name: str
    severity: str
    description: str
    evidence: Dict[str, Any]
    affected_task_ids: List[int] = []
    factor: Optional[str] = None


class MissingDataFlag(BaseModel):
    field_or_type: str
    message: str
    task_id: Optional[int] = None


class FactorContributor(BaseModel):
    task_id: int
    task_title: str
    detail: str


class RiskFactor(BaseModel):
    key: str
    label: str
    weight: float
    value: float
    contribution: float
    summary: str
    details: Dict[str, Any] = {}
    contributors: List[FactorContributor] = []


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
    # Engine v2 fields (empty for rows recorded before the upgrade).
    engine_version: Optional[str] = None
    config_version: Optional[str] = None
    as_of_date: Optional[date] = None
    input_hash: Optional[str] = None
    factor_breakdown: List[RiskFactor] = []
    confidence: Dict[str, Any] = {}
    trigger_type: Optional[str] = None
    trigger_ref_id: Optional[int] = None
    previous_analysis_id: Optional[int] = None
    score_delta: Optional[float] = None
    change_explanation: Dict[str, Any] = {}


class RiskHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    risk_level: str
    score: float
    score_delta: Optional[float] = None
    trigger_type: Optional[str] = None
    trigger_ref_id: Optional[int] = None
    as_of_date: Optional[date] = None
    config_version: Optional[str] = None
    change_explanation: Dict[str, Any] = {}
    created_at: UTCDateTime


class RiskConfigIn(BaseModel):
    weights: Dict[str, float]
    thresholds: Dict[str, float] = Field(default_factory=lambda: {"medium": 20.0, "high": 50.0})
    params: Dict[str, float] = {}
    notes: Optional[str] = Field(default=None, max_length=1000)


class RiskConfigOut(BaseModel):
    version: str
    scope: Literal["default", "company", "project"]
    weights: Dict[str, float]
    thresholds: Dict[str, float]
    params: Dict[str, float]
    notes: Optional[str] = None
    created_at: Optional[UTCDateTime] = None


class RiskSuggestionOut(BaseModel):
    id: int
    project_id: int
    task_id: int
    task_title: str
    related_task_id: Optional[int] = None
    related_task_title: Optional[str] = None
    user_id: int
    employee_name: Optional[str] = None
    kind: str
    evidence: str
    status: str
    update_date: date
    created_at: UTCDateTime


class RiskSuggestionReview(BaseModel):
    decision: Literal["ACCEPT", "REJECT"]
    notes: Optional[str] = Field(default=None, max_length=1000)
