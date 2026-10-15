import hashlib
import hmac
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.email_verification import EmailVerification

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


def _generate_otp() -> str:
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def _hash_otp(email: str, otp_code: str) -> str:
    message = f"{email.lower()}:{otp_code}".encode("utf-8")
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def _smtp_settings() -> tuple[str, int, str, str | None, str | None, bool, bool]:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email verification is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL.",
        )
    if bool(settings.SMTP_USERNAME) != bool(settings.SMTP_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMTP_USERNAME and SMTP_PASSWORD must both be configured, or both left empty.",
        )
    if settings.SMTP_USE_SSL and settings.SMTP_STARTTLS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Choose SMTP SSL or STARTTLS, not both.",
        )
    return (
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        settings.SMTP_FROM_EMAIL,
        settings.SMTP_USERNAME,
        settings.SMTP_PASSWORD,
        settings.SMTP_USE_SSL,
        settings.SMTP_STARTTLS,
    )


def _deliver_otp(email: str, otp_code: str) -> None:
    host, port, sender, username, password, use_ssl, starttls = _smtp_settings()
    message = EmailMessage()
    message["Subject"] = "Your WorkPilot verification code"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        f"Your WorkPilot verification code is {otp_code}.\n\n"
        f"It expires in {OTP_EXPIRY_MINUTES} minutes. "
        "If you did not request this code, you can ignore this email."
    )

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=10, context=ssl.create_default_context()) as smtp:
                if username and password:
                    smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                if starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if username and password:
                    smtp.login(username, password)
                smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send the verification email. Check the SMTP server settings.",
        ) from exc


def send_signup_otp(email: str, db: Session) -> None:
    normalized_email = email.lower()
    now = datetime.now(timezone.utc)
    verification = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == normalized_email)
        .first()
    )
    if verification:
        last_sent_at = verification.last_sent_at
        if last_sent_at.tzinfo is None:
            last_sent_at = last_sent_at.replace(tzinfo=timezone.utc)
        seconds_since_last_send = (now - last_sent_at).total_seconds()
        if seconds_since_last_send < OTP_RESEND_COOLDOWN_SECONDS:
            wait_seconds = OTP_RESEND_COOLDOWN_SECONDS - int(seconds_since_last_send)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_seconds} seconds before requesting another code.",
            )

    otp_code = _generate_otp()
    _deliver_otp(normalized_email, otp_code)
    expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    if verification:
        verification.code_hash = _hash_otp(normalized_email, otp_code)
        verification.attempts = 0
        verification.expires_at = expires_at
        verification.last_sent_at = now
    else:
        db.add(
            EmailVerification(
                email=normalized_email,
                code_hash=_hash_otp(normalized_email, otp_code),
                attempts=0,
                expires_at=expires_at,
                last_sent_at=now,
            )
        )
    db.commit()


def verify_signup_otp(email: str, otp_code: str, db: Session) -> bool:
    normalized_email = email.lower()
    verification = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == normalized_email)
        .first()
    )
    if verification is None:
        return False

    now = datetime.now(timezone.utc)
    expires_at = verification.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now or verification.attempts >= OTP_MAX_ATTEMPTS:
        db.delete(verification)
        db.commit()
        return False

    if not hmac.compare_digest(
        verification.code_hash,
        _hash_otp(normalized_email, otp_code),
    ):
        verification.attempts += 1
        if verification.attempts >= OTP_MAX_ATTEMPTS:
            db.delete(verification)
        db.commit()
        return False

    db.delete(verification)
    db.commit()
    return True
