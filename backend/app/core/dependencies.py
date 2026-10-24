from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import ManagerApprovalStatus, User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Authenticated *and approved* user.

    Users who joined a company by code stay PENDING until that company's
    Company Admin approves them; PENDING and REJECTED users can still sign in
    and read ``/auth/me`` (which uses ``get_authenticated_user``) but cannot
    use any business endpoint, including manager actions.
    """
    user = get_authenticated_user(token, db)
    if user.approval_status != ManagerApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                ManagerApprovalStatus.PENDING.value: "Your account is awaiting approval by your company administrator.",
                ManagerApprovalStatus.DEACTIVATED.value: "Your account has been deactivated by your company administrator.",
            }.get(user.approval_status, "Your company administrator has not approved this account."),
        )
    return user


def get_authenticated_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    return user


def require_manager(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != UserRole.MANAGER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Manager privileges required"
        )
    return current_user


def require_employee(
    current_user: User = Depends(get_current_user)
) -> User:
    # All authenticated active users are employees or managers
    return current_user
