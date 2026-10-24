"""Company Portal API.

Every ``/companies/{company_id}/...`` endpoint is authorized by
``require_company_admin``: only the ACTIVE designated Company Admin of that
specific company may use it. The platform roles MANAGER and ADMIN do not
grant access, and every query below is filtered by the ``company_id`` from
the path after that check.
"""

from datetime import timedelta
from secrets import choice
from string import ascii_uppercase, digits
from typing import List
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.analytics import build_portfolio_rows
from app.core.company_access import (
    administered_company_ids,
    as_naive_utc,
    get_active_admin,
    hash_token,
    is_company_admin,
    new_token,
    record_company_event,
    require_company_admin,
    utcnow_naive,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_manager
from app.core.security import verify_password
from app.models.company import Company
from app.models.company_access import (
    CompanyAdmin,
    CompanyAdminGrantReason,
    CompanyAdminStatus,
    CompanyAdminTransfer,
    CompanyAuditEvent,
    CompanyInvitation,
    InvitationStatus,
    TransferStatus,
)
from app.models.notification import Notification
from app.models.project import Project
from app.models.user import ManagerApprovalStatus, User, UserRole
from app.schemas.auth import CompanyMemberOut
from app.schemas.company import (
    AdministeredCompanyOut,
    CompanyAuditEventOut,
    CompanyPortalOut,
    CompanySummaryOut,
    InvitationCreate,
    InvitationCreatedOut,
    InvitationOut,
    MemberDecision,
    TransferAccept,
    TransferCreate,
    TransferOut,
)
from app.services.email_verification import send_company_invitation_email
from app.services.project_analytics import portfolio_health


router = APIRouter(prefix="/companies", tags=["Companies"])
JOIN_CODE_CHARACTERS = ascii_uppercase + digits
INVITATION_TTL_DAYS = 7
TRANSFER_TTL_HOURS = 72


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _company_or_404(db: Session, company_id: int) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        # Only reachable after require_company_admin succeeded.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found.")
    return company


def _role_counts(db: Session, company_id: int, approved_only: bool = True) -> dict:
    query = db.query(User.role, func.count(User.id)).filter(User.company_id == company_id)
    if approved_only:
        query = query.filter(User.approval_status == ManagerApprovalStatus.APPROVED.value)
    return dict(query.group_by(User.role).all())


def _pending_count(db: Session, company_id: int) -> int:
    return (
        db.query(func.count(User.id))
        .filter(
            User.company_id == company_id,
            User.approval_status == ManagerApprovalStatus.PENDING.value,
        )
        .scalar()
    )


def _portal(db: Session, company: Company) -> CompanyPortalOut:
    counts = _role_counts(db, company.id)
    members = (
        db.query(User)
        .filter(User.company_id == company.id)
        .order_by(User.role, User.full_name, User.id)
        .all()
    )
    admin = get_active_admin(db, company.id)
    return CompanyPortalOut(
        id=company.id,
        name=company.name,
        join_code=company.join_code,
        created_at=company.created_at,
        employee_count=counts.get(UserRole.EMPLOYEE.value, 0),
        manager_count=counts.get(UserRole.MANAGER.value, 0),
        pending_count=_pending_count(db, company.id),
        admin_user_id=admin.user_id,
        members=[CompanyMemberOut.model_validate(m) for m in members],
    )


def _member_of_company(db: Session, company_id: int, user_id: int) -> User:
    member = (
        db.query(User)
        .filter(User.id == user_id, User.company_id == company_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this company.")
    return member


def _expire_stale_invitations(db: Session, company_id: int) -> None:
    now = utcnow_naive()
    stale = (
        db.query(CompanyInvitation)
        .filter(
            CompanyInvitation.company_id == company_id,
            CompanyInvitation.status == InvitationStatus.PENDING.value,
            CompanyInvitation.expires_at <= now,
        )
        .all()
    )
    for invitation in stale:
        invitation.status = InvitationStatus.EXPIRED.value
    if stale:
        db.commit()


def _expire_stale_transfers(db: Session, company_id: int) -> None:
    now = utcnow_naive()
    stale = (
        db.query(CompanyAdminTransfer)
        .filter(
            CompanyAdminTransfer.company_id == company_id,
            CompanyAdminTransfer.status == TransferStatus.PENDING.value,
            CompanyAdminTransfer.expires_at <= now,
        )
        .all()
    )
    for transfer in stale:
        transfer.status = TransferStatus.EXPIRED.value
        transfer.decided_at = now
    if stale:
        db.commit()


def _transfer_out(transfer: CompanyAdminTransfer) -> TransferOut:
    return TransferOut(
        id=transfer.id,
        company_id=transfer.company_id,
        company_name=transfer.company.name,
        from_user_id=transfer.from_user_id,
        from_user_name=transfer.from_user.full_name,
        to_user_id=transfer.to_user_id,
        to_user_name=transfer.to_user.full_name,
        status=transfer.status,
        expires_at=transfer.expires_at,
        created_at=transfer.created_at,
        decided_at=transfer.decided_at,
    )


def _check_password(user: User, password: str) -> None:
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password confirmation failed.")


# ---------------------------------------------------------------------------
# Not company-admin specific
# ---------------------------------------------------------------------------
@router.get("/me", response_model=CompanySummaryOut)
def get_my_company(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Summary of the caller's own company for the Manager Overview card.

    Deliberately excludes the join code and member directory, which are
    Company Admin-only.
    """
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This manager is not linked to a company.",
        )
    company = _company_or_404(db, current_user.company_id)
    counts = _role_counts(db, company.id)
    return CompanySummaryOut(
        id=company.id,
        name=company.name,
        created_at=company.created_at,
        employee_count=counts.get(UserRole.EMPLOYEE.value, 0),
        manager_count=counts.get(UserRole.MANAGER.value, 0),
        is_company_admin=is_company_admin(db, current_user, company.id),
    )


@router.get("/administered", response_model=List[AdministeredCompanyOut])
def list_administered_companies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ids = administered_company_ids(db, current_user)
    if not ids:
        return []
    companies = db.query(Company).filter(Company.id.in_(ids)).order_by(Company.name).all()
    return [
        AdministeredCompanyOut(id=c.id, name=c.name, pending_approvals=_pending_count(db, c.id))
        for c in companies
    ]


# Static transfer routes are declared before /{company_id}/... routes.
@router.get("/admin-transfers/incoming", response_model=List[TransferOut])
def incoming_transfers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = utcnow_naive()
    transfers = (
        db.query(CompanyAdminTransfer)
        .filter(
            CompanyAdminTransfer.to_user_id == current_user.id,
            CompanyAdminTransfer.status == TransferStatus.PENDING.value,
        )
        .all()
    )
    return [_transfer_out(t) for t in transfers if as_naive_utc(t.expires_at) > now]


def _load_transfer(db: Session, transfer_id: int, lock: bool = False) -> CompanyAdminTransfer:
    query = db.query(CompanyAdminTransfer).filter(CompanyAdminTransfer.id == transfer_id)
    if lock:
        query = query.with_for_update()
    transfer = query.first()
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found.")
    return transfer


@router.post("/admin-transfers/{transfer_id}/accept", response_model=TransferOut)
def accept_transfer(
    transfer_id: int,
    data: TransferAccept,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transfer = _load_transfer(db, transfer_id, lock=True)
    if transfer.to_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found.")
    _check_password(current_user, data.password)
    now = utcnow_naive()
    if transfer.status != TransferStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This transfer is no longer pending.")
    if as_naive_utc(transfer.expires_at) <= now:
        transfer.status = TransferStatus.EXPIRED.value
        transfer.decided_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This transfer has expired.")
    if current_user.company_id != transfer.company_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You are no longer a member of this company.")

    current_admin = (
        db.query(CompanyAdmin)
        .filter(
            CompanyAdmin.company_id == transfer.company_id,
            CompanyAdmin.status == CompanyAdminStatus.ACTIVE.value,
        )
        .with_for_update()
        .first()
    )
    if current_admin is None or current_admin.user_id != transfer.from_user_id:
        transfer.status = TransferStatus.CANCELLED.value
        transfer.decided_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The company administrator changed since this transfer was requested.",
        )

    # One transaction: revoke the old grant, create the new one, close the
    # transfer. Either all of it is committed or none of it is, so the
    # company is never left without an active administrator.
    try:
        current_admin.status = CompanyAdminStatus.REVOKED.value
        current_admin.revoked_at = now
        current_admin.revoked_by = current_user.id
        current_admin.revoke_reason = CompanyAdminGrantReason.OWNERSHIP_TRANSFER.value
        db.flush()
        db.add(CompanyAdmin(
            company_id=transfer.company_id,
            user_id=current_user.id,
            status=CompanyAdminStatus.ACTIVE.value,
            grant_reason=CompanyAdminGrantReason.OWNERSHIP_TRANSFER.value,
            granted_by=transfer.from_user_id,
        ))
        transfer.status = TransferStatus.ACCEPTED.value
        transfer.decided_at = now
        record_company_event(db, transfer.company_id, current_user.id, "COMPANY_ADMIN_TRANSFERRED", {
            "transfer_id": transfer.id,
            "from_user_id": transfer.from_user_id,
            "to_user_id": current_user.id,
        })
        db.add(Notification(
            user_id=transfer.from_user_id,
            type="COMPANY_ADMIN_TRANSFER",
            title="Company administration transferred",
            message=f"{current_user.full_name} is now the Company Admin of {transfer.company.name}.",
            link="/employee" if transfer.from_user.role == UserRole.EMPLOYEE.value else "/manager",
        ))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The transfer could not be completed. Nothing was changed.",
        )
    db.refresh(transfer)
    return _transfer_out(transfer)


@router.post("/admin-transfers/{transfer_id}/decline", response_model=TransferOut)
def decline_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transfer = _load_transfer(db, transfer_id)
    if transfer.to_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found.")
    if transfer.status != TransferStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This transfer is no longer pending.")
    transfer.status = TransferStatus.DECLINED.value
    transfer.decided_at = utcnow_naive()
    record_company_event(db, transfer.company_id, current_user.id, "COMPANY_ADMIN_TRANSFER_DECLINED", {
        "transfer_id": transfer.id,
    })
    db.commit()
    db.refresh(transfer)
    return _transfer_out(transfer)


@router.post("/admin-transfers/{transfer_id}/cancel", response_model=TransferOut)
def cancel_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transfer = _load_transfer(db, transfer_id)
    require_company_admin(db, current_user, transfer.company_id)
    if transfer.status != TransferStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This transfer is no longer pending.")
    transfer.status = TransferStatus.CANCELLED.value
    transfer.decided_at = utcnow_naive()
    record_company_event(db, transfer.company_id, current_user.id, "COMPANY_ADMIN_TRANSFER_CANCELLED", {
        "transfer_id": transfer.id,
    })
    db.commit()
    db.refresh(transfer)
    return _transfer_out(transfer)


# ---------------------------------------------------------------------------
# Company Admin endpoints, scoped to /{company_id}
# ---------------------------------------------------------------------------
@router.get("/{company_id}/portal", response_model=CompanyPortalOut)
def get_company_portal(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    return _portal(db, _company_or_404(db, company_id))


@router.post("/{company_id}/join-code/rotate", response_model=CompanyPortalOut)
def rotate_join_code(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    company = _company_or_404(db, company_id)
    while True:
        join_code = "".join(choice(JOIN_CODE_CHARACTERS) for _ in range(8))
        if not db.query(Company.id).filter(Company.join_code == join_code).first():
            break
    company.join_code = join_code
    # The code itself is not written to the audit log.
    record_company_event(db, company.id, current_user.id, "JOIN_CODE_ROTATED", {})
    db.commit()
    db.refresh(company)
    return _portal(db, company)


def _decide_member(db: Session, admin: User, company_id: int, user_id: int, approve: bool, notes):
    require_company_admin(db, admin, company_id)
    member = _member_of_company(db, company_id, user_id)
    if member.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own approval.")
    allowed_from = (
        {ManagerApprovalStatus.PENDING.value, ManagerApprovalStatus.REJECTED.value}
        if approve
        else {ManagerApprovalStatus.PENDING.value}
    )
    if member.approval_status not in allowed_from:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This member is already {member.approval_status.lower()}.",
        )
    new_status = ManagerApprovalStatus.APPROVED.value if approve else ManagerApprovalStatus.REJECTED.value
    member.approval_status = new_status
    member.approval_reviewed_by = admin.id
    member.approval_reviewed_at = utcnow_naive()
    member.approval_notes = notes
    record_company_event(
        db, company_id, admin.id,
        "MEMBER_APPROVED" if approve else "MEMBER_REJECTED",
        {"user_id": member.id, "role": member.role},
    )
    db.add(Notification(
        user_id=member.id,
        type="COMPANY_MEMBERSHIP",
        title="Membership approved" if approve else "Membership not approved",
        message=(
            f"Your account for {member.company.name} has been approved."
            if approve
            else f"Your request to join {member.company.name} was not approved."
        ),
        link="/login",
    ))
    db.commit()
    db.refresh(member)
    return CompanyMemberOut.model_validate(member)


@router.post("/{company_id}/members/{user_id}/approve", response_model=CompanyMemberOut)
def approve_member(
    company_id: int,
    user_id: int,
    data: MemberDecision,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _decide_member(db, current_user, company_id, user_id, True, data.notes)


@router.post("/{company_id}/members/{user_id}/reject", response_model=CompanyMemberOut)
def reject_member(
    company_id: int,
    user_id: int,
    data: MemberDecision,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _decide_member(db, current_user, company_id, user_id, False, data.notes)


@router.get("/{company_id}/invitations", response_model=List[InvitationOut])
def list_invitations(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    _expire_stale_invitations(db, company_id)
    invitations = (
        db.query(CompanyInvitation)
        .filter(CompanyInvitation.company_id == company_id)
        .order_by(CompanyInvitation.created_at.desc(), CompanyInvitation.id.desc())
        .all()
    )
    return [InvitationOut.model_validate(i) for i in invitations]


@router.post("/{company_id}/invitations", response_model=InvitationCreatedOut, status_code=status.HTTP_201_CREATED)
def create_invitation(
    company_id: int,
    data: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    company = _company_or_404(db, company_id)
    _expire_stale_invitations(db, company_id)
    if db.query(User.id).filter(User.company_id == company_id, User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This person is already a member of this company.")

    token = new_token()
    invitation = CompanyInvitation(
        company_id=company_id,
        email=data.email,
        intended_role=data.intended_role,
        token_hash=hash_token(token),
        status=InvitationStatus.PENDING.value,
        invited_by=current_user.id,
        expires_at=utcnow_naive() + timedelta(days=INVITATION_TTL_DAYS),
    )
    db.add(invitation)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email. Revoke it first.",
        )
    record_company_event(db, company_id, current_user.id, "INVITATION_CREATED", {
        "invitation_id": invitation.id,
        "email": invitation.email,
        "role": invitation.intended_role,
    })
    db.commit()
    db.refresh(invitation)

    invite_url = (
        f"{settings.FRONTEND_BASE_URL.rstrip('/')}/signup?invite={quote(token)}"
    )
    email_sent = send_company_invitation_email(invitation.email, company.name, invite_url, INVITATION_TTL_DAYS)
    return InvitationCreatedOut(
        **InvitationOut.model_validate(invitation).model_dump(),
        invite_url=invite_url,
        email_sent=email_sent,
    )


@router.post("/{company_id}/invitations/{invitation_id}/revoke", response_model=InvitationOut)
def revoke_invitation(
    company_id: int,
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    invitation = (
        db.query(CompanyInvitation)
        .filter(CompanyInvitation.id == invitation_id, CompanyInvitation.company_id == company_id)
        .first()
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    if invitation.status != InvitationStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending invitations can be revoked.")
    invitation.status = InvitationStatus.REVOKED.value
    invitation.revoked_at = utcnow_naive()
    invitation.revoked_by = current_user.id
    record_company_event(db, company_id, current_user.id, "INVITATION_REVOKED", {"invitation_id": invitation.id})
    db.commit()
    db.refresh(invitation)
    return InvitationOut.model_validate(invitation)


@router.get("/{company_id}/analytics")
def company_analytics(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    _company_or_404(db, company_id)
    _expire_stale_invitations(db, company_id)
    status_counts = dict(
        db.query(User.approval_status, func.count(User.id))
        .filter(User.company_id == company_id)
        .group_by(User.approval_status)
        .all()
    )
    approved = _role_counts(db, company_id)
    projects = db.query(Project).filter(Project.company_id == company_id).all()
    pending_invitations = (
        db.query(func.count(CompanyInvitation.id))
        .filter(
            CompanyInvitation.company_id == company_id,
            CompanyInvitation.status == InvitationStatus.PENDING.value,
        )
        .scalar()
    )
    return {
        "members": {
            "managers": approved.get(UserRole.MANAGER.value, 0),
            "employees": approved.get(UserRole.EMPLOYEE.value, 0),
            "pending": status_counts.get(ManagerApprovalStatus.PENDING.value, 0),
            "rejected": status_counts.get(ManagerApprovalStatus.REJECTED.value, 0),
        },
        "pending_invitations": pending_invitations,
        "project_count": len(projects),
        "portfolio": portfolio_health(build_portfolio_rows(projects, db)),
    }


@router.get("/{company_id}/audit-events", response_model=List[CompanyAuditEventOut])
def company_audit_events(
    company_id: int,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    events = (
        db.query(CompanyAuditEvent)
        .filter(CompanyAuditEvent.company_id == company_id)
        .order_by(CompanyAuditEvent.created_at.desc(), CompanyAuditEvent.id.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [CompanyAuditEventOut.model_validate(e) for e in events]


@router.get("/{company_id}/admin-transfers", response_model=List[TransferOut])
def list_company_transfers(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    _expire_stale_transfers(db, company_id)
    transfers = (
        db.query(CompanyAdminTransfer)
        .filter(CompanyAdminTransfer.company_id == company_id)
        .order_by(CompanyAdminTransfer.created_at.desc(), CompanyAdminTransfer.id.desc())
        .all()
    )
    return [_transfer_out(t) for t in transfers]


@router.post("/{company_id}/admin-transfers", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def request_transfer(
    company_id: int,
    data: TransferCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_company_admin(db, current_user, company_id)
    _check_password(current_user, data.password)
    if data.to_user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already the Company Admin.")
    target = _member_of_company(db, company_id, data.to_user_id)
    if target.approval_status != ManagerApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ownership can only be transferred to an approved member of this company.",
        )
    _expire_stale_transfers(db, company_id)
    transfer = CompanyAdminTransfer(
        company_id=company_id,
        from_user_id=current_user.id,
        to_user_id=target.id,
        status=TransferStatus.PENDING.value,
        expires_at=utcnow_naive() + timedelta(hours=TRANSFER_TTL_HOURS),
    )
    db.add(transfer)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A transfer is already pending for this company. Cancel it first.",
        )
    record_company_event(db, company_id, current_user.id, "COMPANY_ADMIN_TRANSFER_REQUESTED", {
        "transfer_id": transfer.id,
        "to_user_id": target.id,
    })
    db.add(Notification(
        user_id=target.id,
        type="COMPANY_ADMIN_TRANSFER",
        title="Company Admin transfer request",
        message=(
            f"{current_user.full_name} wants to make you the Company Admin of "
            f"{transfer.company.name}. Open this notification, or Admin Transfer in the "
            f"sidebar, to accept or decline."
        ),
        link="/company-transfer",
    ))
    db.commit()
    db.refresh(transfer)
    return _transfer_out(transfer)
