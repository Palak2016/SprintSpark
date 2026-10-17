from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    hours_spent = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    log_date = Column(Date, default=func.current_date(), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    task = relationship("Task", back_populates="work_logs")
    user = relationship("User", back_populates="work_logs")


class DailyUpdate(Base):
    __tablename__ = "daily_updates"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    progress_pct = Column(Integer, nullable=False)
    is_blocked = Column(Boolean, default=False, nullable=False)
    blocker_notes = Column(Text, nullable=True)
    update_notes = Column(Text, nullable=True)
    date = Column(Date, default=func.current_date(), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    task = relationship("Task", back_populates="daily_updates")
    user = relationship("User", back_populates="daily_updates")
