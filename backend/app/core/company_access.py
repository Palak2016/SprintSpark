"""Company-level authorization helpers for the Company Portal.

Company Admin access comes only from an ACTIVE row in ``company_admins`` for
the specific company. The platform-wide ``users.role`` (MANAGER / ADMIN) is
never sufficient on its own.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.company_access import (
    CompanyAdmin,
    CompanyAdminStatus,
    CompanyAuditEvent,
)
from app.models.user import ManagerApprovalStatus, User

COMPANY_ADMIN_FORBIDDEN = "Company administrator access is required for this company."


def utcnow_naive() -> datetime:
    """UTC 'now' without tzinfo, matching the naive DateTime columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"company-token:{token}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def is_approved(user: User) -> bool:
    return user.approval_status == ManagerApprovalStatus.APPROVED.value


def get_active_admin(db: Session, company_id: int) -> Optional[CompanyAdmin]:
    return (
        db.query(CompanyAdmin)
        .filter(
            CompanyAdmin.company_id == company_id,
            CompanyAdmin.status == CompanyAdminStatus.ACTIVE.value,
        )
        .first()
    )


def administered_company_ids(db: Session, user: User) -> List[int]:
    if not is_approved(user):
        return []
    rows = (
        db.query(CompanyAdmin.company_id)
        .filter(
            CompanyAdmin.user_id == user.id,
            CompanyAdmin.status == CompanyAdminStatus.ACTIVE.value,
        )
        .order_by(CompanyAdmin.company_id)
        .all()
    )
    return [company_id for (company_id,) in rows]


def is_company_admin(db: Session, user: User, company_id: int) -> bool:
    if not is_approved(user):
        return False
    return (
        db.query(CompanyAdmin.id)
        .filter(
            CompanyAdmin.company_id == company_id,
            CompanyAdmin.user_id == user.id,
            CompanyAdmin.status == CompanyAdminStatus.ACTIVE.value,
        )
        .first()
        is not None
    )


def require_company_admin(db: Session, user: User, company_id: int) -> None:
    """403 unless ``user`` is the ACTIVE designated admin of ``company_id``.

    The same response is returned whether or not the company exists, so the
    check cannot be used to discover other companies.
    """
    if not is_company_admin(db, user, company_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=COMPANY_ADMIN_FORBIDDEN,
        )


def record_company_event(
    db: Session,
    company_id: int,
    actor_id: Optional[int],
    event_type: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    db.add(
        CompanyAuditEvent(
            company_id=company_id,
            actor_id=actor_id,
            event_type=event_type,
            metadata_json=metadata or {},
        )
    )
