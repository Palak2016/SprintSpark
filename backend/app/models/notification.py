
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type = Column(
        String(100),
        nullable=False,
        default="GENERAL",
    )

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)

    is_read = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime,
        default=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="notifications")
