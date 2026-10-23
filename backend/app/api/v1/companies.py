from secrets import choice
from string import ascii_uppercase, digits

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_manager
from app.models.company import Company
from app.models.user import User, UserRole
from app.schemas.auth import CompanyMemberOut, CompanyOut


router = APIRouter(prefix="/companies", tags=["Companies"])
JOIN_CODE_CHARACTERS = ascii_uppercase + digits


@router.get("/me", response_model=CompanyOut)
def get_my_company(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This manager is not linked to a company.",
        )

    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    counts = dict(
        db.query(User.role, func.count(User.id))
        .filter(User.company_id == company.id)
        .group_by(User.role)
        .all()
    )
    members = (
        db.query(User)
        .filter(User.company_id == company.id)
        .order_by(User.role, User.full_name, User.id)
        .all()
    )
    return CompanyOut(
        id=company.id,
        name=company.name,
        join_code=company.join_code,
        created_at=company.created_at,
        employee_count=counts.get(UserRole.EMPLOYEE.value, 0),
        manager_count=counts.get(UserRole.MANAGER.value, 0),
        members=[
            CompanyMemberOut.model_validate(member)
            for member in members
        ],
    )


@router.post("/me/join-code", response_model=CompanyOut)
def generate_company_join_code(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This manager is not linked to a company.",
        )

    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    while True:
        join_code = "".join(choice(JOIN_CODE_CHARACTERS) for _ in range(8))
        if not db.query(Company.id).filter(Company.join_code == join_code).first():
            break

    company.join_code = join_code
    db.commit()
    db.refresh(company)

    return get_my_company(current_user=current_user, db=db)
