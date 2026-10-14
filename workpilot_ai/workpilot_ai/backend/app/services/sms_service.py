import requests
from fastapi import HTTPException, status
from app.core.config import settings


def _twilio_credentials() -> tuple[str, str, str]:
    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN
    service_sid = settings.TWILIO_VERIFY_SERVICE_SID
    if not account_sid or not auth_token or not service_sid:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Phone verification is not configured. Set the Twilio Verify credentials.",
        )
    if not account_sid.startswith("AC") or not service_sid.startswith("VA"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Invalid Twilio SID format. TWILIO_ACCOUNT_SID must start with AC, "
                "and TWILIO_VERIFY_SERVICE_SID must be the Verify Service SID starting with VA."
            ),
        )
    return account_sid, auth_token, service_sid


def _twilio_error_detail(endpoint: str, status_code: int, error_code: object) -> str:
    if error_code == 20003:
        return "Twilio rejected the credentials. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
    if error_code == 20404:
        if endpoint == "VerificationCheck":
            return "The verification code is invalid or expired."
        return (
            "Twilio Verify service not found. Check that TWILIO_VERIFY_SERVICE_SID "
            "is the Verify Service SID starting with VA."
        )
    if error_code == 60200:
        return "Twilio rejected the phone number. Enter it in international format, including the country code."
    if error_code == 60203:
        return "Too many verification attempts. Wait before requesting another code."
    if error_code == 60205:
        return "SMS is not enabled for this destination country in your Twilio account."
    return f"Twilio Verify rejected the request (HTTP {status_code}). Check your Twilio Verify configuration."


def _post_twilio(endpoint: str, data: dict[str, str]) -> dict:
    account_sid, auth_token, service_sid = _twilio_credentials()
    url = f"https://verify.twilio.com/v2/Services/{service_sid}/{endpoint}"
    try:
        response = requests.post(
            url,
            data=data,
            auth=(account_sid, auth_token),
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the phone verification service.",
        ) from exc

    if not response.ok:
        try:
            error_code = response.json().get("code")
        except (ValueError, AttributeError):
            error_code = None
        if endpoint == "VerificationCheck" and response.status_code == 404 and error_code == 20404:
            return {"status": "pending"}
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_twilio_error_detail(endpoint, response.status_code, error_code),
        )
    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The phone verification service returned an invalid response.",
        ) from exc


def send_signup_otp(phone_number: str) -> None:
    _post_twilio("Verifications", {"To": phone_number, "Channel": "sms"})


def verify_signup_otp(phone_number: str, otp_code: str) -> bool:
    result = _post_twilio(
        "VerificationCheck",
        {"To": phone_number, "Code": otp_code},
    )
    return result.get("status") == "approved"
