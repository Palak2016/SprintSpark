def test_login_successful(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "manager@workpilot.ai",
        "password": "Password123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "manager@workpilot.ai"
    assert data["user"]["role"] == "MANAGER"


def test_login_invalid_password(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "manager@workpilot.ai",
        "password": "WrongPassword123!"
    })
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_signup_duplicate_email(client):
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Duplicate User",
        "email": "manager@workpilot.ai",
        "phone_number": "+14155552674",
        "password": "NewPassword123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
    })
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_signup_sends_sms_otp_and_returns_jwt_after_verification(client, monkeypatch):
    from app.core.config import settings
    from app.core.security import decode_access_token
    import app.services.sms_service as sms_service

    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC-test")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VERIFY_SERVICE_SID", "VA-test")
    calls = []

    class TwilioResponse:
        ok = True

        def __init__(self, status_value):
            self.status_value = status_value

        def json(self):
            return {"status": self.status_value}

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return TwilioResponse("pending" if url.endswith("/Verifications") else "approved")

    monkeypatch.setattr(sms_service.requests, "post", fake_post)

    phone_number = "+14155552671"
    sent = client.post("/api/v1/auth/signup/send-otp", json={
        "email": "new.employee@example.com",
        "phone_number": phone_number,
        "role": "EMPLOYEE",
    })
    assert sent.status_code == 202
    assert calls[0][1]["data"] == {"To": phone_number, "Channel": "sms"}

    response = client.post("/api/v1/auth/signup", json={
        "full_name": "New Employee",
        "email": "new.employee@example.com",
        "phone_number": phone_number,
        "password": "Password123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] == "EMPLOYEE"
    assert data["user"]["phone_number"] == phone_number
    assert decode_access_token(data["access_token"])["role"] == "EMPLOYEE"
    assert calls[1][1]["data"] == {"To": phone_number, "Code": "123456"}


def test_manager_signup_requires_invitation_code(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MANAGER_SIGNUP_INVITE_CODE", "manager-invite")
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "New Manager",
        "email": "new.manager@example.com",
        "phone_number": "+14155552672",
        "password": "Password123!",
        "role": "MANAGER",
        "otp_code": "123456",
    })
    assert response.status_code == 403
    assert response.json()["detail"] == "A valid manager invitation code is required."


def test_manager_signup_with_invitation_returns_manager_jwt(client, monkeypatch):
    from app.core.config import settings
    from app.core.security import decode_access_token
    import app.services.sms_service as sms_service

    monkeypatch.setattr(settings, "MANAGER_SIGNUP_INVITE_CODE", "manager-invite")
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC-test")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VERIFY_SERVICE_SID", "VA-test")

    class TwilioResponse:
        ok = True

        def json(self):
            return {"status": "approved"}

    monkeypatch.setattr(sms_service.requests, "post", lambda *args, **kwargs: TwilioResponse())
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Invited Manager",
        "email": "invited.manager@example.com",
        "phone_number": "+14155552675",
        "password": "Password123!",
        "role": "MANAGER",
        "otp_code": "123456",
        "manager_invite_code": "manager-invite",
    })

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] == "MANAGER"
    assert decode_access_token(data["access_token"])["role"] == "MANAGER"


def test_signup_rejects_invalid_phone_otp_without_creating_account(client, monkeypatch):
    from app.core.config import settings
    import app.services.sms_service as sms_service

    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC-test")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VERIFY_SERVICE_SID", "VA-test")

    class TwilioResponse:
        ok = True

        def json(self):
            return {"status": "pending"}

    monkeypatch.setattr(sms_service.requests, "post", lambda *args, **kwargs: TwilioResponse())
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Unverified Employee",
        "email": "unverified.employee@example.com",
        "phone_number": "+14155552673",
        "password": "Password123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
    })
    assert response.status_code == 400
    assert "invalid or expired" in response.json()["detail"]


def test_signup_reports_invalid_verify_service_sid_format(monkeypatch):
    import pytest
    from fastapi import HTTPException
    from app.core.config import settings
    from app.services.sms_service import _twilio_credentials

    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC-test")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VERIFY_SERVICE_SID", "AC-wrong-sid-type")

    with pytest.raises(HTTPException) as exc_info:
        _twilio_credentials()

    assert exc_info.value.status_code == 503
    assert "Verify Service SID starting with VA" in exc_info.value.detail


def test_signup_reports_twilio_authentication_error(client, monkeypatch):
    from app.core.config import settings
    import app.services.sms_service as sms_service

    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC-test")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VERIFY_SERVICE_SID", "VA-test")

    class TwilioResponse:
        ok = False
        status_code = 401

        def json(self):
            return {"code": 20003}

    monkeypatch.setattr(sms_service.requests, "post", lambda *args, **kwargs: TwilioResponse())
    response = client.post("/api/v1/auth/signup/send-otp", json={
        "email": "credentials.test@example.com",
        "phone_number": "+14155552676",
        "role": "EMPLOYEE",
    })
    assert response.status_code == 502
    assert "Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN" in response.json()["detail"]


def test_get_me(client, manager_token):
    response = client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {manager_token}"
    })
    assert response.status_code == 200
    assert response.json()["email"] == "manager@workpilot.ai"


def test_demo_endpoints_are_removed(client):
    assert client.get("/api/v1/demo/accounts").status_code == 404
    assert client.post("/api/v1/demo/reset-seed").status_code == 404
