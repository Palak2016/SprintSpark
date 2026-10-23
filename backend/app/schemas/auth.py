from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator
from app.schemas.timestamps import UTCDateTime


class ManagerSignupDetails(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    company_code: Optional[str] = Field(default=None, min_length=6, max_length=16)
    designation: Optional[str] = Field(default=None, min_length=2, max_length=255)

    @field_validator("company_name", "designation", mode="before")
    @classmethod
    def strip_manager_details(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("company_code", mode="before")
    @classmethod
    def normalize_company_code(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_manager_details(self):
        if self.role == "MANAGER":
            if not self.designation:
                raise ValueError("Designation is required for manager signup.")
            if bool(self.company_name) == bool(self.company_code):
                raise ValueError(
                    "Provide a company name to create a company or a company code to join one."
                )
        elif not self.company_code:
            raise ValueError("A company code is required to join a company.")
        return self


class UserSignup(ManagerSignupDetails):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone_number: Optional[str] = Field(default=None, pattern=r"^\+[1-9]\d{7,14}$")
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["EMPLOYEE", "MANAGER"] = "EMPLOYEE"
    otp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class SignupOtpRequest(ManagerSignupDetails):
    email: EmailStr
    role: Literal["EMPLOYEE", "MANAGER"] = "EMPLOYEE"


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
