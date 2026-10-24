from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import uuid4
from app.core import rate_limit
from app.core.company_access import (
    administered_company_ids,
    as_naive_utc,
    get_active_admin,
    hash_token,
    record_company_event,
    utcnow_naive,
)
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_authenticated_user
from app.models.company import Company
from app.models.company_access import (
    CompanyAdmin,
    CompanyAdminGrantReason,
    CompanyAdminStatus,
    CompanyInvitation,
    InvitationStatus,
)
from app.models.notification import Notification
from app.models.user import User, ManagerApprovalStatus
from app.schemas.auth import (
    InvitationPreviewOut,
    InvitationPreviewRequest,
    SignupOtpRequest,
    Token,
    UserLogin,
    UserOut,
    UserSignup,
)
from app.services.email_verification import (
    send_account_exists_notice,
    send_signup_otp,
    verify_signup_otp,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

GENERIC_OTP_MESSAGE = (
    "If these details can be used to sign up, a verification code has been "
    "sent to your email address."
)
INVALID_INVITATION = "This invitation is invalid or has expired."


def user_out(db: Session, user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.administered_company_ids = administered_company_ids(db, user)
    return out


def _load_pending_invitation(db: Session, token: str) -> CompanyInvitation:
    invitation = (
        db.query(CompanyInvitation)
        .filter(CompanyInvitation.token_hash == hash_token(token))
        .first()
    )
    if invitation is None or invitation.status != InvitationStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_INVITATION)
    if as_naive_utc(invitation.expires_at) <= utcnow_naive():
        invitation.status = InvitationStatus.EXPIRED.value
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_INVITATION)
    return invitation


@router.post("/signup/send-otp", status_code=status.HTTP_202_ACCEPTED)
def send_signup_verification(
    data: SignupOtpRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = data.email.lower()
    rate_limit.enforce(f"otp-ip:{rate_limit.client_ip(request)}", limit=10, window_seconds=600)
    rate_limit.enforce(f"otp-email:{email}", limit=5, window_seconds=3600)

    # The response is the same whether or not the email already has an
    # account and whether or not the company code / invitation is valid;
    # those are checked at signup, after the email has been verified.
    if db.query(User).filter(User.email == email).first():
        rate_limit.enforce(f"otp-exists-cooldown:{email}", limit=1, window_seconds=60)
        send_account_exists_notice(email)
        return {"message": GENERIC_OTP_MESSAGE}

    send_signup_otp(data.email, db)
    return {"message": GENERIC_OTP_MESSAGE}


@router.post("/invitations/preview", response_model=InvitationPreviewOut)
def preview_invitation(
    data: InvitationPreviewRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    rate_limit.enforce(f"invite-preview-ip:{rate_limit.client_ip(request)}", limit=20, window_seconds=600)
    invitation = _load_pending_invitation(db, data.token)
    return InvitationPreviewOut(
        company_name=invitation.company.name,
        email=invitation.email,
        intended_role=invitation.intended_role,
        expires_at=invitation.expires_at,
    )


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(data: UserSignup, request: Request, db: Session = Depends(get_db)):
    rate_limit.enforce(f"signup-ip:{rate_limit.client_ip(request)}", limit=20, window_seconds=600)
    email = data.email.lower()

    # Prove ownership of the email first, so nothing below can be used to
    # probe which accounts, codes or invitations exist.
    if not verify_signup_otp(email, data.otp_code, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code is invalid or expired.",
        )

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists"
        )

    if data.phone_number and db.query(User).filter(User.phone_number == data.phone_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this phone number already exists",
        )

    now = utcnow_naive()
    invitation = None
    creating_company = False

    if data.invitation_token:
        invitation = _load_pending_invitation(db, data.invitation_token)
        if invitation.email != email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation was issued to a different email address.",
            )
        if invitation.intended_role != data.role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This invitation is for a {invitation.intended_role.lower()} account.",
            )
        company = invitation.company
        approval_status = ManagerApprovalStatus.APPROVED.value
    elif data.company_code:
        company = db.query(Company).filter(
            func.upper(Company.join_code) == data.company_code
        ).first()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The company code is invalid.",
            )
        # Joining by code never grants access on its own: the company's
        # Company Admin must approve the new member.
        approval_status = ManagerApprovalStatus.PENDING.value
    else:
        company = Company(
            name=data.company_name.strip(),
            join_code=uuid4().hex[:8].upper(),
        )
        db.add(company)
        db.flush()
        creating_company = True
        approval_status = ManagerApprovalStatus.APPROVED.value

    new_user = User(
        email=email,
        phone_number=data.phone_number,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
        company_name=company.name,
        company_id=company.id,
        designation=data.designation,
        approval_status=approval_status,
        avatar_url=f"https://api.dicebear.com/7.x/initials/svg?seed={data.full_name}"
    )
    db.add(new_user)
    db.flush()

    if creating_company:
        # The verified creator of a new company is its initial (and only)
        # designated Company Admin, granted in the same transaction.
        db.add(CompanyAdmin(
            company_id=company.id,
            user_id=new_user.id,
            status=CompanyAdminStatus.ACTIVE.value,
            grant_reason=CompanyAdminGrantReason.COMPANY_CREATION.value,
            granted_by=new_user.id,
        ))
        record_company_event(db, company.id, new_user.id, "COMPANY_CREATED", {"name": company.name})
        record_company_event(db, company.id, new_user.id, "COMPANY_ADMIN_GRANTED", {
            "user_id": new_user.id,
            "reason": CompanyAdminGrantReason.COMPANY_CREATION.value,
        })
    elif invitation is not None:
        invitation.status = InvitationStatus.ACCEPTED.value
        invitation.accepted_at = now
        invitation.accepted_user_id = new_user.id
        new_user.approval_reviewed_by = invitation.invited_by
        new_user.approval_reviewed_at = now
        new_user.approval_notes = "Joined through a company invitation."
        record_company_event(db, company.id, new_user.id, "INVITATION_ACCEPTED", {
            "invitation_id": invitation.id,
            "user_id": new_user.id,
            "role": new_user.role,
        })
    else:
        record_company_event(db, company.id, new_user.id, "MEMBER_JOIN_REQUESTED", {
            "user_id": new_user.id,
            "role": new_user.role,
        })
        admin = get_active_admin(db, company.id)
        if admin is not None:
            db.add(Notification(
                user_id=admin.user_id,
                type="COMPANY_JOIN_REQUEST",
                title="New member awaiting approval",
                message=f"{new_user.full_name} ({new_user.role.lower()}) asked to join {company.name}.",
                link="/company",
            ))

    db.commit()
    db.refresh(new_user)

    token = create_access_token(subject=new_user.id, role=new_user.role)
    return Token(
        access_token=token,
        token_type="bearer",
        user=user_out(db, new_user),
    )


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    token = create_access_token(subject=user.id, role=user.role)
    return Token(
        access_token=token,
        token_type="bearer",
        user=user_out(db, user),
    )


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    return user_out(db, current_user)
