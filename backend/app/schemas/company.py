from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.auth import CompanyMemberOut
from app.schemas.timestamps import UTCDateTime


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CompanySummaryOut(BaseModel):
    """What any approved manager of the company may see (no join code, no
    member directory)."""

    id: int
    name: str
    created_at: UTCDateTime
    employee_count: int
    manager_count: int
    is_company_admin: bool


class AdministeredCompanyOut(BaseModel):
    id: int
    name: str
    pending_approvals: int


class CompanyPortalOut(BaseModel):
    id: int
    name: str
    join_code: str
    created_at: UTCDateTime
    employee_count: int
    manager_count: int
    pending_count: int
    admin_user_id: int
    members: List[CompanyMemberOut] = Field(default_factory=list)


class MemberDecision(_Strict):
    notes: Optional[str] = Field(default=None, max_length=1000)


class InvitationCreate(_Strict):
    email: EmailStr
    intended_role: Literal["MANAGER", "EMPLOYEE"]

    @field_validator("email", mode="after")
    @classmethod
    def lower_email(cls, value):
        return value.lower()


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    intended_role: str
    status: str
    expires_at: UTCDateTime
    created_at: UTCDateTime
    accepted_at: Optional[UTCDateTime] = None
    revoked_at: Optional[UTCDateTime] = None


class InvitationCreatedOut(InvitationOut):
    # Returned only once, at creation. Only a hash is stored server-side.
    invite_url: str
    email_sent: bool


class TransferCreate(_Strict):
    to_user_id: int
    password: str = Field(..., min_length=1, max_length=128)


class TransferAccept(_Strict):
    password: str = Field(..., min_length=1, max_length=128)


class TransferOut(BaseModel):
    id: int
    company_id: int
    company_name: str
    from_user_id: int
    from_user_name: str
    to_user_id: int
    to_user_name: str
    status: str
    expires_at: UTCDateTime
    created_at: UTCDateTime
    decided_at: Optional[UTCDateTime] = None


class CompanyAuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: Optional[int] = None
    event_type: str
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    created_at: UTCDateTime
