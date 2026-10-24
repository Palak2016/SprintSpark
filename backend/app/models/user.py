import enum
from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Enum, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    """Project role of an account inside its company.

    MANAGER and EMPLOYEE open the Manager / Employee workspace. ADMIN means an
    administration-only account (for example a company founder who does not
    manage projects): it has no project workspace and grants nothing by
    itself. Company administration always comes from ``company_admins``.
    """

    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"
    ADMIN = "ADMIN"


class ManagerApprovalStatus(str, enum.Enum):
    """Account / membership status. Only APPROVED accounts may use the app."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    # Switched off by the Company Admin; reversible, keeps all history.
    DEACTIVATED = "DEACTIVATED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.EMPLOYEE.value, nullable=False)
    company_name = Column(String(255), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    designation = Column(String(255), nullable=True)
    approval_status = Column(
        String(50),
        default=ManagerApprovalStatus.APPROVED.value,
        nullable=False,
    )
    approval_reviewed_by = Column(Integer, nullable=True)
    approval_reviewed_at = Column(DateTime, nullable=True)
    approval_notes = Column(String(1000), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    managed_projects = relationship("Project", back_populates="manager", foreign_keys="Project.manager_id")
    company = relationship("Company", back_populates="users")
    project_memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    work_logs = relationship("WorkLog", back_populates="user", cascade="all, delete-orphan")
    daily_updates = relationship("DailyUpdate", back_populates="user", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="user", foreign_keys="LeaveRequest.user_id", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
