from sqlalchemy import Column, DateTime, Integer, String, func

from app.core.database import Base


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    code_hash = Column(String(64), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_sent_at = Column(DateTime, nullable=False)
    created_at = Column(
        DateTime,
        default=func.now(),
        nullable=False,
    )
