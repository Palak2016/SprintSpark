"""Company-level administration, invitations, ownership transfers and audit.

Company Admin authority is granted per company through ``company_admins``.
It is deliberately independent of the platform-wide ``users.role`` column:
neither ``MANAGER`` nor ``ADMIN`` grants Company Portal access on its own.
"""

import enum

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class CompanyAdminStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class CompanyAdminGrantReason(str, enum.Enum):
    COMPANY_CREATION = "COMPANY_CREATION"
    ASSIGNMENT_SCRIPT = "ASSIGNMENT_SCRIPT"
    OWNERSHIP_TRANSFER = "OWNERSHIP_TRANSFER"


class TransferStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class InvitationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class CompanyAdmin(Base):
    __tablename__ = "company_admins"
    __table_args__ = (
        # Exactly one ACTIVE designated admin per company is enforced by the
        # database, not only by application code.
        Index(
            "uq_company_admins_one_active",
            "company_id",
            unique=True,
            sqlite_where=text("status = 'ACTIVE'"),
            postgresql_where=text("status = 'ACTIVE'"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        String(20),
        nullable=False,
        default=CompanyAdminStatus.ACTIVE.value,
    )
    grant_reason = Column(String(50), nullable=False)
    granted_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=func.now(), nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    revoke_reason = Column(String(255), nullable=True)

    company = relationship("Company")
    user = relationship("User", foreign_keys=[user_id])


class CompanyAdminTransfer(Base):
    __tablename__ = "company_admin_transfers"
    __table_args__ = (
        Index(
            "uq_company_admin_transfers_one_pending",
            "company_id",
            unique=True,
            sqlite_where=text("status = 'PENDING'"),
            postgresql_where=text("status = 'PENDING'"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    to_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(
        String(20), nullable=False, default=TransferStatus.PENDING.value
    )
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    decided_at = Column(DateTime, nullable=True)

    company = relationship("Company")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])


class CompanyInvitation(Base):
    __tablename__ = "company_invitations"
    __table_args__ = (
        Index(
            "uq_company_invitations_one_pending_email",
            "company_id",
            "email",
            unique=True,
            sqlite_where=text("status = 'PENDING'"),
            postgresql_where=text("status = 'PENDING'"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Stored lower-cased.
    email = Column(String(255), nullable=False, index=True)
    intended_role = Column(String(20), nullable=False)
    # HMAC-SHA256 of the token; the raw token is never stored.
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    status = Column(
        String(20), nullable=False, default=InvitationStatus.PENDING.value
    )
    invited_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    accepted_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    company = relationship("Company")


class CompanyAuditEvent(Base):
    __tablename__ = "company_audit_events"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_type = Column(String(100), nullable=False, index=True)
    metadata_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
