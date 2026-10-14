from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserSignup(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone_number: str = Field(..., pattern=r"^\+[1-9]\d{7,14}$")
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["EMPLOYEE", "MANAGER"] = "EMPLOYEE"
    otp_code: str = Field(..., min_length=4, max_length=10, pattern=r"^\d+$")
    manager_invite_code: Optional[str] = Field(default=None, max_length=128)


class SignupOtpRequest(BaseModel):
    email: EmailStr
    phone_number: str = Field(..., pattern=r"^\+[1-9]\d{7,14}$")
    role: Literal["EMPLOYEE", "MANAGER"] = "EMPLOYEE"
    manager_invite_code: Optional[str] = Field(default=None, max_length=128)


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
