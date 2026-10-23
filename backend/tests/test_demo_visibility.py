from app.core.security import create_access_token
from app.models.company import Company
from app.models.user import User, UserRole


def test_manager_team_views_hide_seeded_demo_accounts(client, db_session):
    company = Company(name="Real Company", join_code="REALCO01")
    db_session.add(company)
    db_session.flush()
    manager = User(
        email="real.manager@example.com",
        hashed_password="not-used",
        full_name="Real Manager",
        role=UserRole.MANAGER.value,
        company_id=company.id,
        company_name=company.name,
    )
    employee = User(
        email="real.employee@example.com",
        hashed_password="not-used",
        full_name="Real Employee",
        role=UserRole.EMPLOYEE.value,
        company_id=company.id,
        company_name=company.name,
    )
    db_session.add_all([manager, employee])
    db_session.flush()
    headers = {
        "Authorization": f"Bearer {create_access_token(subject=manager.id, role='MANAGER')}"
    }

    availability = client.get("/api/v1/team-availability", headers=headers)
    assert availability.status_code == 200
    availability_emails = {
        member["user"]["email"] for member in availability.json()
    }
    assert "real.manager@example.com" in availability_emails
    assert "real.employee@example.com" in availability_emails
    assert "manager@workpilot.ai" not in availability_emails
    assert "dev1@workpilot.ai" not in availability_emails
    assert "dev2@workpilot.ai" not in availability_emails

    team_users = client.get("/api/v1/projects/users/all", headers=headers)
    assert team_users.status_code == 200
    team_user_emails = {user["email"] for user in team_users.json()}
    assert "real.manager@example.com" in team_user_emails
    assert "real.employee@example.com" in team_user_emails
    assert "manager@workpilot.ai" not in team_user_emails
    assert "dev1@workpilot.ai" not in team_user_emails
    assert "dev2@workpilot.ai" not in team_user_emails
