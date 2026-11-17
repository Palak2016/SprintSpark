import enum
from datetime import date
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, Date, ForeignKey, UniqueConstraint, event, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TaskStatus(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    priority = Column(String(50), default=TaskPriority.MEDIUM.value, nullable=False)
    status = Column(String(50), default=TaskStatus.TODO.value, nullable=False, index=True)
    estimated_hours = Column(Float, default=0.0, nullable=False)
    actual_hours = Column(Float, default=0.0, nullable=False)
    progress_pct = Column(Integer, default=0, nullable=False)
    start_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    is_blocked = Column(Boolean, default=False, nullable=False)
    blocker_reason = Column(Text, nullable=True)
    # Set automatically whenever is_blocked turns on (see the listener below);
    # the risk engine ages blockers from this date.
    blocked_since = Column(Date, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assignee_id])
    work_logs = relationship("WorkLog", back_populates="task", cascade="all, delete-orphan")
    daily_updates = relationship("DailyUpdate", back_populates="task", cascade="all, delete-orphan")
    
    # Task dependencies: prerequisites that this task depends upon
    dependencies = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.task_id",
        back_populates="task",
        cascade="all, delete-orphan"
    )
    # Tasks that depend on this task
    dependents = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.prerequisite_task_id",
        back_populates="prerequisite_task",
        cascade="all, delete-orphan"
    )


class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    prerequisite_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    task = relationship("Task", foreign_keys=[task_id], back_populates="dependencies")
    prerequisite_task = relationship("Task", foreign_keys=[prerequisite_task_id], back_populates="dependents")

    __table_args__ = (
        UniqueConstraint("task_id", "prerequisite_task_id", name="uq_task_prerequisite"),
    )


# active_history loads the stored value first, so re-saving a task that is
# already blocked never resets the date its blocker started.
@event.listens_for(Task.is_blocked, "set", active_history=True)
def _track_blocked_since(target, value, oldvalue, _initiator):
    """Keep blocked_since in step with is_blocked on every code path."""
    if value and oldvalue is not True:
        target.blocked_since = date.today()
    elif not value:
        target.blocked_since = None
