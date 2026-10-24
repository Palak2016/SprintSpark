import re
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator
from app.schemas.timestamps import UTCDateTime

# E.164: "+", country code, then the number; 8-15 digits in total.
PHONE_PATTERN = re.compile(r"\+[1-9]\d{7,14}")


class SignupDetails(BaseModel):
    # Unknown fields (for example ``is_admin``, ``company_role`` or
    # ``approval_status``) are rejected outright so that nobody can
    # self-assign privileges through the signup payload.
    model_config = ConfigDict(extra="forbid")

    company_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    company_code: Optional[str] = Field(default=None, min_length=6, max_length=16)
    invitation_token: Optional[str] = Field(default=None, min_length=16, max_length=128)
    designation: Optional[str] = Field(default=None, min_length=2, max_length=255)

    @field_validator("company_name", "designation", mode="before")
    @classmethod
    def strip_manager_details(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("company_code", mode="before")
    @classmethod
    def normalize_company_code(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("invitation_token", mode="before")
    @classmethod
    def strip_invitation_token(cls, value):
        return value.strip() if isinstance(value, str) else value

    # Requested only on "Create a company" signups: also make the founder a
    # manager. Without it the founder is an administration-only account.
    also_manager: bool = False

    @model_validator(mode="after")
    def validate_signup_path(self):
        """Three separate signup paths; nothing else is accepted.

        * ADMIN    -> creates a NEW company (company_name) and becomes its
                      Company Admin. Never joins an existing company.
        * MANAGER  -> joins an existing company by invitation or signup code.
        * EMPLOYEE -> joins an existing company by invitation or signup code.

        Admin rights over an existing company are never available here; they
        come only from creating a company or an accepted ownership transfer.
        """
        if self.role == "ADMIN":
            if self.company_code or self.invitation_token:
                raise ValueError(
                    "Creating a company cannot be combined with a company code or invitation."
                )
            if not self.company_name:
                raise ValueError("Enter a company name to create your company.")
            return self

        if self.also_manager:
            raise ValueError("Manager access can only be requested when creating a company.")
        if self.company_name:
            raise ValueError(
                "Managers and employees join an existing company. To create a company, "
                "sign up as its Company Admin."
            )
        if self.role == "MANAGER" and not self.designation:
            raise ValueError("Designation is required for manager signup.")
        if self.invitation_token:
            if self.company_code:
                raise ValueError("An invitation cannot be combined with a company code.")
            return self
        if not self.company_code:
            raise ValueError("Enter your company's signup code or use your invitation link.")
        return self


class UserSignup(SignupDetails):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone_number: Optional[str] = None
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["EMPLOYEE", "MANAGER", "ADMIN"] = "EMPLOYEE"
    otp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("phone_number", mode="before")
    @classmethod
    def normalize_phone_number(cls, value):
        value = normalize_phone(value)
        if value is not None and not PHONE_PATTERN.fullmatch(str(value)):
            raise ValueError(
                "Enter a valid phone number with country code, for example +91 98765 43210."
            )
        return value


def normalize_phone(value):
    """Turn common ways of typing a phone number into +<country><number>.

    "98765 43210", "+91-98765-43210" and "0091 9876543210" all become
    "+919876543210". A bare 10-digit number starting 6-9 is treated as an
    Indian mobile. Anything else is left for the pattern check to reject.
    """
    if not isinstance(value, str):
        return value
    cleaned = re.sub(r"[\s\-().]", "", value)
    if not cleaned:
        return None
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if re.fullmatch(r"0?[6-9]\d{9}", cleaned):
        cleaned = "+91" + cleaned[-10:]
    return cleaned


class SignupOtpRequest(SignupDetails):
    email: EmailStr
    role: Literal["EMPLOYEE", "MANAGER", "ADMIN"] = "EMPLOYEE"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: Optional[int] = None
    email: EmailStr
    phone_number: Optional[str] = None
    full_name: str
    role: str
    company_name: Optional[str] = None
    designation: Optional[str] = None
    approval_status: str
    approval_reviewed_at: Optional[UTCDateTime] = None
    approval_notes: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: UTCDateTime
    # Computed per request from ``company_admins``; informational for the UI.
    # The backend re-checks Company Admin authorization on every request.
    administered_company_ids: list[int] = Field(default_factory=list)
    # Workspaces the server allows, in priority order; the first is where the
    # app lands after sign-in. "admin" = Company Admin console, "manager" =
    # project management, "employee" = personal work. Empty while the account
    # is pending or rejected.
    workspaces: list[Literal["admin", "manager", "employee"]] = Field(default_factory=list)


class UserSimple(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class InvitationPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(..., min_length=16, max_length=128)


class InvitationPreviewOut(BaseModel):
    company_name: str
    email: EmailStr
    intended_role: str
    expires_at: UTCDateTime


class CompanyMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    designation: Optional[str] = None
    approval_status: str
    created_at: UTCDateTime


class CompanyOut(BaseModel):
    id: int
    name: str
    join_code: str
    created_at: UTCDateTime
    employee_count: int
    manager_count: int
    members: list[CompanyMemberOut] = Field(default_factory=list)
