from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=False)
    metadata_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    project = relationship("Project", back_populates="audit_events")
    actor = relationship("User")
