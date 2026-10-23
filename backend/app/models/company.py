from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    join_code = Column(String(16), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    users = relationship("User", back_populates="company")
    projects = relationship("Project", back_populates="company")
