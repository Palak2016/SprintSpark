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


def test_signup_duplicate_email(client, monkeypatch, db_session):
    # Updated for multi-company Company Portal: signup no longer reveals
    # whether an email already has an account. send-otp answers generically
    # (and sends no code), and signup fails on the unverified code.
    from app.models.user import User

    sent_emails = _mock_email_otp(monkeypatch)
    send = client.post("/api/v1/auth/signup/send-otp", json={
        "email": "manager@workpilot.ai",
        "role": "EMPLOYEE",
        "company_code": "WORKPILOT",
    })
    assert send.status_code == 202
    assert sent_emails == []

    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Duplicate User",
        "email": "manager@workpilot.ai",
        "password": "NewPassword123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
        "company_code": "WORKPILOT",
    })
    assert response.status_code == 400
    assert "already exists" not in response.json()["detail"]
    assert db_session.query(User).filter_by(email="manager@workpilot.ai").count() == 1


def test_manager_signup_uses_email_otp_and_needs_no_phone(client, monkeypatch, db_session):
    from app.core.security import decode_access_token
    from app.models.email_verification import EmailVerification

    sent_emails = _mock_email_otp(monkeypatch)
    email = "new.manager@example.com"
    send_response = client.post("/api/v1/auth/signup/send-otp", json={
        "email": email,
        "role": "ADMIN",
        "also_manager": True,
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
        "role": "ADMIN",
        "also_manager": True,
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
    sent = client.post("/api/v1/auth/signup/send-otp", json={
        "email": email,
        "company_code": "WORKPILOT",
    })
    assert sent.status_code == 202

    response = client.post("/api/v1/auth/signup", json={
        "full_name": "New Employee",
        "email": email,
        "password": "Password123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
        "company_code": "WORKPILOT",
    })
    assert response.status_code == 201
    assert response.json()["user"]["phone_number"] is None
    assert response.json()["user"]["company_id"] is not None


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
    sent = client.post("/api/v1/auth/signup/send-otp", json={
        "email": email,
        "company_code": "WORKPILOT",
    })
    assert sent.status_code == 202

    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Unverified Employee",
        "email": email,
        "password": "Password123!",
        "role": "EMPLOYEE",
        "otp_code": "654321",
        "company_code": "WORKPILOT",
    })
    assert response.status_code == 400
    assert "invalid or expired" in response.json()["detail"]
    assert db_session.query(User).filter_by(email=email).first() is None


def test_email_otp_resend_is_rate_limited(client, monkeypatch):
    sent_emails = _mock_email_otp(monkeypatch)
    request_data = {
        "email": "resend@example.com",
        "company_code": "WORKPILOT",
    }

    first = client.post("/api/v1/auth/signup/send-otp", json=request_data)
    second = client.post("/api/v1/auth/signup/send-otp", json=request_data)

    assert first.status_code == 202
    assert second.status_code == 429
    assert len(sent_emails) == 1


def test_company_manager_signup_returns_join_code(client, monkeypatch):
    # Updated for multi-company Company Portal: the creator becomes the
    # company's designated Company Admin; the join code is only available
    # through the admin-only portal; people joining by code stay PENDING.
    _mock_email_otp(monkeypatch)
    email = "company.owner@example.com"
    company_data = {
        "role": "ADMIN",
        "also_manager": True,
        "company_name": "Signup Company",
        "designation": "Company Manager",
    }
    sent = client.post(
        "/api/v1/auth/signup/send-otp",
        json={"email": email, **company_data},
    )
    assert sent.status_code == 202

    created = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": "Company Owner",
            "email": email,
            "password": "Password123!",
            "otp_code": "123456",
            **company_data,
        },
    )
    assert created.status_code == 201
    owner_headers = {"Authorization": "Bearer " + created.json()["access_token"]}
    company_id = created.json()["user"]["company_id"]
    assert created.json()["user"]["administered_company_ids"] == [company_id]

    summary = client.get("/api/v1/companies/me", headers=owner_headers)
    assert summary.status_code == 200
    assert summary.json()["name"] == "Signup Company"
    assert summary.json()["manager_count"] == 1
    assert summary.json()["is_company_admin"] is True
    assert "join_code" not in summary.json()

    company = client.get(f"/api/v1/companies/{company_id}/portal", headers=owner_headers)
    assert company.status_code == 200
    assert len(company.json()["join_code"]) == 8
    assert [member["email"] for member in company.json()["members"]] == [email]

    first_join_code = company.json()["join_code"]
    regenerated = client.post(
        f"/api/v1/companies/{company_id}/join-code/rotate",
        headers=owner_headers,
    )
    assert regenerated.status_code == 200
    assert regenerated.json()["join_code"] != first_join_code

    old_code_email = "old.code@example.com"
    assert client.post(
        "/api/v1/auth/signup/send-otp",
        json={"email": old_code_email, "role": "EMPLOYEE", "company_code": first_join_code},
    ).status_code == 202
    old_code_signup = client.post("/api/v1/auth/signup", json={
        "full_name": "Old Code",
        "email": old_code_email,
        "password": "Password123!",
        "role": "EMPLOYEE",
        "otp_code": "123456",
        "company_code": first_join_code,
    })
    assert old_code_signup.status_code == 400
    assert old_code_signup.json()["detail"] == "The company code is invalid."

    joining_manager_email = "joining.manager@example.com"
    joining_manager_details = {
        "email": joining_manager_email,
        "role": "MANAGER",
        "company_code": regenerated.json()["join_code"],
        "designation": "Team Manager",
    }
    assert client.post(
        "/api/v1/auth/signup/send-otp",
        json=joining_manager_details,
    ).status_code == 202
    joined_manager = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": "Joining Manager",
            "password": "Password123!",
            "otp_code": "123456",
            **joining_manager_details,
        },
    )
    assert joined_manager.status_code == 201
    assert joined_manager.json()["user"]["company_id"] == company_id
    assert joined_manager.json()["user"]["approval_status"] == "PENDING"
    assert joined_manager.json()["user"]["administered_company_ids"] == []

    employee_email = "signup.employee@example.com"
    employee_details = {
        "email": employee_email,
        "role": "EMPLOYEE",
        "company_code": regenerated.json()["join_code"].lower(),
    }
    assert client.post(
        "/api/v1/auth/signup/send-otp",
        json=employee_details,
    ).status_code == 202
    employee = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": "Company Employee",
            "email": employee_email,
            "password": "Password123!",
            "role": "EMPLOYEE",
            "otp_code": "123456",
            "company_code": regenerated.json()["join_code"],
        },
    )
    assert employee.status_code == 201
    assert employee.json()["user"]["company_id"] == company_id
    assert employee.json()["user"]["approval_status"] == "PENDING"

    refreshed_company = client.get(f"/api/v1/companies/{company_id}/portal", headers=owner_headers)
    assert {
        member["email"] for member in refreshed_company.json()["members"]
    } == {email, joining_manager_email, employee_email}
    assert refreshed_company.json()["pending_count"] == 2


def test_signup_requires_a_valid_company_code(client, monkeypatch):
    # Updated: send-otp no longer reveals whether a code exists; the code is
    # validated at signup, after the email address has been verified.
    _mock_email_otp(monkeypatch)
    payload = {"email": "invalid.code@example.com", "role": "EMPLOYEE", "company_code": "INVALID1"}
    response = client.post("/api/v1/auth/signup/send-otp", json=payload)
    assert response.status_code == 202

    signup = client.post("/api/v1/auth/signup", json={
        **payload,
        "full_name": "Invalid Code",
        "password": "Password123!",
        "otp_code": "123456",
    })
    assert signup.status_code == 400
    assert signup.json()["detail"] == "The company code is invalid."


def test_manager_team_directory_is_company_scoped(client, db_session, manager_token):
    from datetime import date, timedelta

    from app.core.security import get_password_hash
    from app.models.company import Company
    from app.models.project import Project
    from app.models.user import User
    from app.models.task import Task

    manager = db_session.query(User).filter_by(email="manager@workpilot.ai").one()
    other_company = Company(name="Other Company", join_code="OTHER123")
    db_session.add(other_company)
    db_session.flush()
    same_company_user = User(
        email="same-company@example.com",
        full_name="Same Company",
        hashed_password=get_password_hash("Password123!"),
        role="EMPLOYEE",
        company_id=manager.company_id,
        company_name=manager.company_name,
    )
    other_company_user = User(
        email="other-company@example.com",
        full_name="Other Company",
        hashed_password=get_password_hash("Password123!"),
        role="EMPLOYEE",
        company_id=other_company.id,
        company_name=other_company.name,
    )
    db_session.add_all([same_company_user, other_company_user])
    db_session.flush()
    foreign_project = Project(
        name="Other company's project",
        manager_id=other_company_user.id,
        company_id=other_company.id,
        start_date=date.today(),
        target_end_date=date.today() + timedelta(days=1),
    )
    db_session.add(foreign_project)
    db_session.flush()
    db_session.add(Task(
        project_id=foreign_project.id,
        title="Other company task",
        assignee_id=other_company_user.id,
        start_date=date.today(),
        due_date=date.today() + timedelta(days=1),
    ))
    db_session.commit()

    directory = client.get(
        "/api/v1/projects/users/all",
        headers={"Authorization": "Bearer " + manager_token},
    )
    assert directory.status_code == 200
    emails = {user["email"] for user in directory.json()}
    assert "same-company@example.com" in emails
    assert "other-company@example.com" not in emails

    project_response = client.get(
        f"/api/v1/projects/{foreign_project.id}",
        headers={"Authorization": "Bearer " + manager_token},
    )
    assert project_response.status_code == 403

    task_list = client.get(
        "/api/v1/tasks",
        headers={"Authorization": "Bearer " + manager_token},
    )
    assert task_list.status_code == 200
    assert all(
        task["project_id"] != foreign_project.id
        for task in task_list.json()
    )


def test_signup_reports_missing_smtp_configuration(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "SMTP_HOST", None)
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", None)
    response = client.post("/api/v1/auth/signup/send-otp", json={
        "email": "smtp.not.configured@example.com",
        "company_code": "WORKPILOT",
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


def test_signup_phone_numbers_are_normalized_or_rejected_clearly():
    import pytest
    from pydantic import ValidationError
    from app.schemas.auth import UserSignup

    base = {
        "full_name": "Phone Person",
        "email": "phone.person@example.com",
        "password": "Password123!",
        "otp_code": "123456",
        "company_code": "ABCDEF12",
    }
    accepted = {
        "98765 43210": "+919876543210",
        "+91 98765-43210": "+919876543210",
        "0091 9876543210": "+919876543210",
        "09876543210": "+919876543210",
        "(+1) 415-555-0123": "+14155550123",
        "": None,
        "   ": None,
    }
    for typed, stored in accepted.items():
        assert UserSignup(**base, phone_number=typed).phone_number == stored, typed

    for bad in ("12345", "abc", "+0123456789", "+91 98765 43210 99999"):
        with pytest.raises(ValidationError) as err:
            UserSignup(**base, phone_number=bad)
        assert "country code" in str(err.value)
