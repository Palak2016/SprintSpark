import enum
from sqlalchemy import Column, Integer, String, Text, Float, Date, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class RiskTrigger(str, enum.Enum):
    MANUAL = "MANUAL"
    INITIAL = "INITIAL"
    DAILY_UPDATE = "DAILY_UPDATE"
    TASK_CHANGE = "TASK_CHANGE"
    DEPENDENCY_CHANGE = "DEPENDENCY_CHANGE"
    BLOCKER_CHANGE = "BLOCKER_CHANGE"
    LEAVE_CHANGE = "LEAVE_CHANGE"
    SUGGESTION_REVIEWED = "SUGGESTION_REVIEWED"
    RECOVERY_APPLIED = "RECOVERY_APPLIED"
    RECOVERY_WORKFLOW = "RECOVERY_WORKFLOW"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    DAILY_JOB = "DAILY_JOB"


class RiskAnalysis(Base):
    __tablename__ = "risk_analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_level = Column(String(50), default=RiskLevel.LOW.value, nullable=False)
    score = Column(Float, default=0.0, nullable=False)  # 0 to 100 risk score
    triggered_rules = Column(JSON, default=list, nullable=False)  # list of triggered rule objects
    evidence_json = Column(JSON, default=dict, nullable=False)    # metrics, slack, blockers, leave overlap
    missing_data_flags = Column(JSON, default=list, nullable=False) # list of missing fields/unassigned tasks
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Reproducibility: which inputs and which scoring rules produced this row.
    engine_version = Column(String(20), nullable=True)
    config_version = Column(String(100), nullable=True)
    as_of_date = Column(Date, nullable=True)
    input_hash = Column(String(64), nullable=True, index=True)
    # Explainability: per-factor contributions and what changed since the previous row.
    factor_breakdown = Column(JSON, default=list, nullable=False)
    confidence = Column(JSON, default=dict, nullable=False)
    trigger_type = Column(String(50), nullable=True)
    trigger_ref_id = Column(Integer, nullable=True)
    triggered_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    previous_analysis_id = Column(Integer, ForeignKey("risk_analyses.id", ondelete="SET NULL"), nullable=True)
    score_delta = Column(Float, nullable=True)
    change_explanation = Column(JSON, default=dict, nullable=False)

    project = relationship("Project", back_populates="risk_analyses")
    recovery_proposals = relationship("RecoveryProposal", back_populates="risk_analysis", cascade="all, delete-orphan")


class RiskConfig(Base):
    """Versioned scoring configuration. Rows are never edited: a change adds a row.

    A project-scoped row overrides a company-scoped row; with neither, the
    built-in default (risk_scoring.DEFAULT_CONFIG) is used.
    """

    __tablename__ = "risk_configs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    weights = Column(JSON, nullable=False)
    thresholds = Column(JSON, nullable=False)
    params = Column(JSON, default=dict, nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    @property
    def version(self) -> str:
        scope = "project" if self.project_id else "company"
        return f"{scope}:{self.id}"


class SignalKind(str, enum.Enum):
    # Effort reported in a daily update (feeds the focus ratio).
    PLANNED = "PLANNED"
    UNPLANNED_PROJECT = "UNPLANNED_PROJECT"
    UNPLANNED_OTHER = "UNPLANNED_OTHER"
    REWORK = "REWORK"
    # Mentions that need a person to confirm before they change project data.
    BLOCKER = "BLOCKER"
    DEPENDENCY = "DEPENDENCY"
    SCOPE_CHANGE = "SCOPE_CHANGE"


EFFORT_KINDS = {
    SignalKind.PLANNED.value,
    SignalKind.UNPLANNED_PROJECT.value,
    SignalKind.UNPLANNED_OTHER.value,
    SignalKind.REWORK.value,
}


class SignalStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"            # employee kept it when submitting the update
    PENDING_REVIEW = "PENDING_REVIEW"  # suggestion waiting for the manager
    ACCEPTED = "ACCEPTED"              # manager accepted the suggestion
    REJECTED = "REJECTED"              # manager rejected it


class DailyUpdateSignal(Base):
    """Validated information extracted from a daily update.

    Every row quotes the update text it came from (evidence) and only refers
    to tasks that exist in the same project.
    """

    __tablename__ = "daily_update_signals"

    id = Column(Integer, primary_key=True, index=True)
    daily_update_id = Column(Integer, ForeignKey("daily_updates.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    related_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    effort_share = Column(Float, nullable=True)
    evidence = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, index=True)
    update_date = Column(Date, nullable=False, index=True)
    model = Column(String(100), nullable=True)
    prompt_version = Column(String(20), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    daily_update = relationship("DailyUpdate")
    task = relationship("Task", foreign_keys=[task_id])
    related_task = relationship("Task", foreign_keys=[related_task_id])
