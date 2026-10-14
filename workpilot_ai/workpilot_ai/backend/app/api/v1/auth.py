from hmac import compare_digest
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import UserLogin, UserSignup, SignupOtpRequest, Token, UserOut
from app.core.config import settings
from app.services.sms_service import send_signup_otp, verify_signup_otp

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _require_manager_invite(invite_code: str | None) -> None:
    configured_code = settings.MANAGER_SIGNUP_INVITE_CODE
    if not configured_code or not invite_code or not compare_digest(invite_code, configured_code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A valid manager invitation code is required.",
        )


@router.post("/signup/send-otp", status_code=status.HTTP_202_ACCEPTED)
def send_signup_verification(data: SignupOtpRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists",
        )
    if db.query(User).filter(User.phone_number == data.phone_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this phone number already exists",
        )
    if data.role == UserRole.MANAGER.value:
        _require_manager_invite(data.manager_invite_code)
    send_signup_otp(data.phone_number)
    return {"message": "A verification code has been sent to your phone."}


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(data: UserSignup, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == data.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists"
        )

    if db.query(User).filter(User.phone_number == data.phone_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this phone number already exists",
        )

    if data.role == UserRole.MANAGER.value:
        _require_manager_invite(data.manager_invite_code)

    if not verify_signup_otp(data.phone_number, data.otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code is invalid or expired.",
        )

    new_user = User(
        email=data.email.lower(),
        phone_number=data.phone_number,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
        avatar_url=f"https://api.dicebear.com/7.x/initials/svg?seed={data.full_name}"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(subject=new_user.id, role=new_user.role)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(new_user)
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
        user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
