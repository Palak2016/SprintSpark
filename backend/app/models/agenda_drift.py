from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class AgendaDrift(Base):
    __tablename__ = "agenda_drifts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    daily_update_id = Column(
        Integer,
        ForeignKey("daily_updates.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    recovery_proposal_id = Column(
        Integer,
        ForeignKey("recovery_proposals.id", ondelete="SET NULL"),
        nullable=True,
    )
    alignment_status = Column(String(32), nullable=False, index=True)
    alignment_score = Column(Integer, nullable=False)
    confidence_score = Column(Integer, nullable=False)
    drift_explanation = Column(Text, nullable=False)
    detected_mismatches = Column(JSON, default=list, nullable=False)
    recommended_actions = Column(JSON, default=list, nullable=False)
    reported_blockers = Column(Text, nullable=True)
    employee_clarification = Column(Text, nullable=True)
    manager_review_status = Column(
        String(32),
        default="PENDING_REVIEW",
        nullable=False,
        index=True,
    )
    manager_feedback = Column(Text, nullable=True)
    analysis_details = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("User")
    task = relationship("Task")
    daily_update = relationship("DailyUpdate")
    project = relationship("Project")
    recovery_proposal = relationship("RecoveryProposal")

    __table_args__ = (
        UniqueConstraint("daily_update_id", name="uq_agenda_drift_daily_update"),
    )
