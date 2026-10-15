def _mock_email_otp(monkeypatch):
    import app.services.email_verification as email_verification

    sent_emails = []
    monkeypatch.setattr(email_verification, "_generate_otp", lambda: "123456")
    monkeypatch.setattr(
        email_verification,
        "_deliver_otp",
        lambda email, otp_code: sent_emails.append((email, otp_code)),
    )
    return sent_emails


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
        "password": "NewPassword123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
    })
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_manager_signup_uses_email_otp_and_needs_no_phone(client, monkeypatch, db_session):
    from app.core.security import decode_access_token
    from app.models.email_verification import EmailVerification

    sent_emails = _mock_email_otp(monkeypatch)
    email = "new.manager@example.com"
    send_response = client.post("/api/v1/auth/signup/send-otp", json={
        "email": email,
        "role": "MANAGER",
        "company_name": "Example Corporation",
        "designation": "Engineering Team Lead",
    })

    assert send_response.status_code == 202
    assert "email address" in send_response.json()["message"]
    assert sent_emails == [(email, "123456")]
    stored_code = db_session.query(EmailVerification).filter_by(email=email).one()
    assert stored_code.code_hash != "123456"

    response = client.post("/api/v1/auth/signup", json={
        "full_name": "New Manager",
        "email": email,
        "password": "Password123!",
        "role": "MANAGER",
        "otp_code": "123456",
        "company_name": "Example Corporation",
        "designation": "Engineering Team Lead",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] == "MANAGER"
    assert data["user"]["approval_status"] == "APPROVED"
    assert data["user"]["phone_number"] is None
    assert data["user"]["company_name"] == "Example Corporation"
    assert data["user"]["designation"] == "Engineering Team Lead"
    assert decode_access_token(data["access_token"])["role"] == "MANAGER"
    assert db_session.query(EmailVerification).filter_by(email=email).first() is None

    manager_access = client.get(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert manager_access.status_code == 200


def test_employee_signup_can_keep_optional_phone(client, monkeypatch):
    _mock_email_otp(monkeypatch)
    email = "new.employee@example.com"
    sent = client.post("/api/v1/auth/signup/send-otp", json={"email": email})
    assert sent.status_code == 202

    response = client.post("/api/v1/auth/signup", json={
        "full_name": "New Employee",
        "email": email,
        "password": "Password123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
    })
    assert response.status_code == 201
    assert response.json()["user"]["phone_number"] is None


def test_manager_signup_requires_company_and_designation(client):
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "New Manager",
        "email": "new.manager@example.com",
        "password": "Password123!",
        "role": "MANAGER",
        "otp_code": "123456",
    })
    assert response.status_code == 422


def test_signup_rejects_invalid_email_otp_without_creating_account(client, monkeypatch, db_session):
    from app.models.user import User

    _mock_email_otp(monkeypatch)
    email = "unverified.employee@example.com"
    sent = client.post("/api/v1/auth/signup/send-otp", json={"email": email})
    assert sent.status_code == 202

    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Unverified Employee",
        "email": email,
        "password": "Password123!",
        "role": "EMPLOYEE",
        "otp_code": "654321",
    })
    assert response.status_code == 400
    assert "invalid or expired" in response.json()["detail"]
    assert db_session.query(User).filter_by(email=email).first() is None


def test_email_otp_resend_is_rate_limited(client, monkeypatch):
    sent_emails = _mock_email_otp(monkeypatch)
    request_data = {"email": "resend@example.com"}

    first = client.post("/api/v1/auth/signup/send-otp", json=request_data)
    second = client.post("/api/v1/auth/signup/send-otp", json=request_data)

    assert first.status_code == 202
    assert second.status_code == 429
    assert len(sent_emails) == 1


def test_signup_reports_missing_smtp_configuration(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "SMTP_HOST", None)
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", None)
    response = client.post("/api/v1/auth/signup/send-otp", json={
        "email": "smtp.not.configured@example.com",
    })

    assert response.status_code == 503
    assert "SMTP_HOST and SMTP_FROM_EMAIL" in response.json()["detail"]


def test_email_otp_is_delivered_using_configured_smtp(monkeypatch):
    from email import message_from_string
    from app.core.config import settings
    import app.services.email_verification as email_verification

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "sender@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "smtp-test-password")
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", "sender@example.com")
    monkeypatch.setattr(settings, "SMTP_USE_SSL", False)
    monkeypatch.setattr(settings, "SMTP_STARTTLS", True)
    sent_messages = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ("smtp.example.com", 587, 10)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self, context):
            assert context is not None

        def login(self, username, password):
            assert (username, password) == ("sender@example.com", "smtp-test-password")

        def send_message(self, message):
            sent_messages.append(message)

    monkeypatch.setattr(email_verification.smtplib, "SMTP", FakeSMTP)
    email_verification._deliver_otp("recipient@example.com", "123456")

    assert len(sent_messages) == 1
    message = message_from_string(sent_messages[0].as_string())
    assert message["To"] == "recipient@example.com"
    assert "123456" in message.get_payload()


def test_get_me(client, manager_token):
    response = client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {manager_token}"
    })
    assert response.status_code == 200
    assert response.json()["email"] == "manager@workpilot.ai"


def test_demo_endpoints_are_removed(client):
    assert client.get("/api/v1/demo/accounts").status_code == 404
    assert client.post("/api/v1/demo/reset-seed").status_code == 404
