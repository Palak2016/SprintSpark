from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator


class ManagerSignupDetails(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    designation: Optional[str] = Field(default=None, min_length=2, max_length=255)

    @field_validator("company_name", "designation", mode="before")
    @classmethod
    def strip_manager_details(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_manager_details(self):
        if self.role == "MANAGER" and (not self.company_name or not self.designation):
            raise ValueError("Company name and designation are required for manager signup.")
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
    email: EmailStr
    phone_number: Optional[str] = None
    full_name: str
    role: str
    company_name: Optional[str] = None
    designation: Optional[str] = None
    approval_status: str
    approval_reviewed_at: Optional[datetime] = None
    approval_notes: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime


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
