import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class RiskAnalysis(Base):
    __tablename__ = "risk_analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_level = Column(String(50), default=RiskLevel.LOW.value, nullable=False)
    score = Column(Float, default=0.0, nullable=False)  # 0 to 100 risk score
    triggered_rules = Column(JSON, default=list, nullable=False)  # list of triggered rule objects
    evidence_json = Column(JSON, default=dict, nullable=False)    # metrics, slack, blockers, leave overlap
    missing_data_flags = Column(JSON, default=list, nullable=False) # list of missing fields/unassigned tasks
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="risk_analyses")
    recovery_proposals = relationship("RecoveryProposal", back_populates="risk_analysis", cascade="all, delete-orphan")
