import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProposalStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DEFERRED = "DEFERRED"
    SUPERSEDED = "SUPERSEDED"


class RecoveryProposal(Base):
    __tablename__ = "recovery_proposals"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_analysis_id = Column(Integer, ForeignKey("risk_analyses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    proposed_actions = Column(JSON, default=list, nullable=False)  # list of action dicts
    rationale = Column(Text, nullable=False)
    assumptions = Column(JSON, default=list, nullable=False)       # list of strings
    status = Column(String(50), default=ProposalStatus.PENDING_APPROVAL.value, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="recovery_proposals")
    risk_analysis = relationship("RiskAnalysis", back_populates="recovery_proposals")
    decisions = relationship("ProposalDecision", back_populates="proposal", cascade="all, delete-orphan")


class ProposalDecision(Base):
    __tablename__ = "proposal_decisions"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("recovery_proposals.id", ondelete="CASCADE"), nullable=False, index=True)
    decider_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    decision = Column(String(50), nullable=False)  # APPROVED, REJECTED, DEFERRED
    decision_notes = Column(Text, nullable=True)
    applied_changes = Column(JSON, default=list, nullable=False)  # snapshot of what was mutated
    decided_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    proposal = relationship("RecoveryProposal", back_populates="decisions")
    decider = relationship("User")
