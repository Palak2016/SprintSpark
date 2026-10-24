"""Admin / Manager / Employee separation.

Company administration comes only from an ACTIVE ``company_admins`` row for
the specific company. ``/auth/me`` (and login/signup) report the workspaces the
server allows, which the frontend uses for routing; every API re-checks.
"""

import uuid
from datetime import date, timedelta

import pytest

from app.models.company import Company
from app.models.company_access import CompanyAdmin, CompanyAdminTransfer
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.core.security import create_access_token
from tests.conftest import TestingSessionLocal
from tests.test_company_portal import PASSWORD, _auth, _mock_email, _user, world  # noqa: F401  (fixture)


def _me(client, user):
    response = client.get("/api/v1/auth/me", headers=_auth(user))
    assert response.status_code == 200, response.text
    return response.json()


def _signup_company(client, monkeypatch, email, company_name, also_manager=False):
    _mock_email(monkeypatch)
    details = {"role": "ADMIN", "company_name": company_name, "designation": "Founder"}
    if also_manager:
        details["also_manager"] = True
    assert client.post("/api/v1/auth/signup/send-otp", json={"email": email, **details}).status_code == 202
    return client.post("/api/v1/auth/signup", json={
        "full_name": "Founding Person",
        "email": email,
        "password": PASSWORD,
        "otp_code": "123456",
        **details,
    })


# ---------------------------------------------------------------------------
# Company creation
# ---------------------------------------------------------------------------
def test_company_creator_becomes_company_admin_and_lands_in_admin_console(client, monkeypatch, db_session):
    tag = uuid.uuid4().hex[:8]
    response = _signup_company(client, monkeypatch, f"founder.{tag}@example.com", f"Founded {tag}")
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    # Administration only: no Manager access unless explicitly requested.
    assert user["workspaces"] == ["admin"]
    assert user["role"] == "ADMIN"
    assert user["administered_company_ids"] == [user["company_id"]]
    assert user["company_name"] == f"Founded {tag}"

    admins = db_session.query(CompanyAdmin).filter_by(company_id=user["company_id"]).all()
    assert [(a.user_id, a.status, a.grant_reason) for a in admins] == [(user["id"], "ACTIVE", "COMPANY_CREATION")]
    portal = client.get(
        f"/api/v1/companies/{user['company_id']}/portal",
        headers={"Authorization": "Bearer " + response.json()["access_token"]},
    )
    assert portal.status_code == 200


def test_company_creation_and_admin_grant_are_atomic(client, monkeypatch):
    import app.api.v1.auth as auth_api

    tag = uuid.uuid4().hex[:8]
    email, name = f"atomic.{tag}@example.com", f"Atomic {tag}"

    def boom(*args, **kwargs):
        raise RuntimeError("simulated failure while recording the admin grant")

    monkeypatch.setattr(auth_api, "record_company_event", boom)
    with pytest.raises(RuntimeError):
        _signup_company(client, monkeypatch, email, name)

    fresh = TestingSessionLocal()
    try:
        assert fresh.query(Company).filter_by(name=name).count() == 0
        assert fresh.query(User).filter_by(email=email).count() == 0
    finally:
        fresh.close()


def test_joining_by_code_never_grants_admin(client, monkeypatch, world):  # noqa: F811
    _mock_email(monkeypatch)
    email = f"joiner.{world['tag']}@example.com"
    details = {"role": "MANAGER", "company_code": world["a"].join_code, "designation": "Lead"}
    client.post("/api/v1/auth/signup/send-otp", json={"email": email, **details})
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Joining Manager", "email": email, "password": PASSWORD, "otp_code": "123456", **details,
    })
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["approval_status"] == "PENDING"
    assert user["workspaces"] == [] and user["administered_company_ids"] == []


# ---------------------------------------------------------------------------
# Workspaces reported to the frontend (login routing)
# ---------------------------------------------------------------------------
def test_login_reports_workspaces_for_each_role(client, world, db_session):  # noqa: F811
    login = lambda u: client.post("/api/v1/auth/login", json={"email": u.email, "password": PASSWORD})  # noqa: E731
    assert login(world["admin_a"]).json()["user"]["workspaces"] == ["admin", "manager"]
    assert login(world["manager_a"]).json()["user"]["workspaces"] == ["manager"]
    assert login(world["employee_a"]).json()["user"]["workspaces"] == ["employee"]

    # An employee can be a Company Admin too; they keep their employee workspace.
    db_session.query(CompanyAdmin).filter_by(user_id=world["admin_b"].id).update({"status": "REVOKED"})
    db_session.add(CompanyAdmin(company_id=world["b"].id, user_id=world["employee_b"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"))
    db_session.commit()
    assert login(world["employee_b"]).json()["user"]["workspaces"] == ["admin", "employee"]
    assert login(world["admin_b"]).json()["user"]["workspaces"] == ["manager"]


def test_pending_and_rejected_accounts_get_no_workspace(client, world, db_session):  # noqa: F811
    for status_ in ("PENDING", "REJECTED"):
        user = _user(db_session, f"{status_.lower()}.{world['tag']}@acme.example.com", "MANAGER", world["a"], status=status_)
        db_session.commit()
        me = _me(client, user)
        assert me["workspaces"] == [] and me["approval_status"] == status_
        assert client.get("/api/v1/projects", headers=_auth(user)).status_code == 403


def test_pending_company_admin_grant_is_ignored(client, world, db_session):  # noqa: F811
    world["admin_a"].approval_status = "PENDING"
    db_session.commit()
    assert _me(client, world["admin_a"])["workspaces"] == []
    assert client.get(f"/api/v1/companies/{world['a'].id}/portal", headers=_auth(world["admin_a"])).status_code == 403


def test_expired_session_is_rejected(client, world):  # noqa: F811
    expired = create_access_token(world["admin_a"].id, "MANAGER", timedelta(seconds=-5))
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


# ---------------------------------------------------------------------------
# Admin-only and manager-only APIs
# ---------------------------------------------------------------------------
ADMIN_READS = ("portal", "invitations", "analytics", "audit-events", "admin-transfers")


def test_manager_and_employee_cannot_use_admin_apis(client, world):  # noqa: F811
    cid = world["a"].id
    for who in ("manager_a", "employee_a", "global_admin"):
        for path in ADMIN_READS:
            assert client.get(f"/api/v1/companies/{cid}/{path}", headers=_auth(world[who])).status_code == 403, (who, path)
        assert client.post(f"/api/v1/companies/{cid}/join-code/rotate", headers=_auth(world[who])).status_code == 403
        assert client.get("/api/v1/companies/administered", headers=_auth(world[who])).json() == []


def test_employee_cannot_use_manager_only_operations(client, world):  # noqa: F811
    headers = _auth(world["employee_a"])
    today = str(date.today())
    assert client.post("/api/v1/projects", headers=headers, json={
        "name": "Not allowed", "start_date": today, "target_end_date": today,
    }).status_code == 403
    assert client.get("/api/v1/analytics/portfolio", headers=headers).status_code == 403
    assert client.get("/api/v1/team-availability", headers=headers).status_code == 403


def test_company_admin_uses_admin_apis_for_own_company_only(client, world):  # noqa: F811
    headers = _auth(world["admin_a"])
    for path in ADMIN_READS:
        assert client.get(f"/api/v1/companies/{world['a'].id}/{path}", headers=headers).status_code == 200, path
        assert client.get(f"/api/v1/companies/{world['b'].id}/{path}", headers=headers).status_code == 403, path
    assert client.post(f"/api/v1/companies/{world['b'].id}/members/{world['employee_b'].id}/approve", headers=headers, json={}).status_code == 403


def test_member_listing_and_analytics_are_tenant_scoped(client, world, db_session):  # noqa: F811
    today = date.today()
    for company, lead in ((world["a"], world["admin_a"]), (world["b"], world["admin_b"])):
        project = Project(name=f"P {company.name}", manager_id=lead.id, company_id=company.id,
                          start_date=today, target_end_date=today + timedelta(days=9), status="ACTIVE")
        db_session.add(project)
        db_session.flush()
        db_session.add(ProjectMember(project_id=project.id, user_id=lead.id, role_in_project="Project Manager"))
    db_session.commit()

    portal = client.get(f"/api/v1/companies/{world['a'].id}/portal", headers=_auth(world["admin_a"])).json()
    member_ids = {m["id"] for m in portal["members"]}
    assert world["employee_a"].id in member_ids and world["employee_b"].id not in member_ids
    assert db_session.query(User).filter(User.id.in_(member_ids), User.company_id != world["a"].id).count() == 0

    analytics = client.get(f"/api/v1/companies/{world['a'].id}/analytics", headers=_auth(world["admin_a"])).json()
    names = {p["name"] for p in analytics["portfolio"]["projects"]}
    assert names == {f"P {world['a'].name}"}
    assert analytics["project_count"] == 1


def test_global_admin_role_is_company_scoped(client, world, db_session):  # noqa: F811
    """users.role=ADMIN without a company_admins grant gives nothing: no
    project workspace, no admin console, never another company."""
    today = date.today()
    other = Project(name=f"Globex secret {world['tag']}", manager_id=world["admin_b"].id, company_id=world["b"].id,
                    start_date=today, target_end_date=today + timedelta(days=5), status="ACTIVE")
    db_session.add(other)
    db_session.commit()
    headers = _auth(world["global_admin"])
    assert other.id not in {p["id"] for p in client.get("/api/v1/projects", headers=headers).json()}
    assert client.get(f"/api/v1/projects/{other.id}", headers=headers).status_code == 403
    assert client.get(f"/api/v1/companies/{world['b'].id}/portal", headers=headers).status_code == 403
    team = {u["id"] for u in client.get("/api/v1/projects/users/all", headers=headers).json()}
    assert world["employee_b"].id not in team
    tasks = client.get("/api/v1/tasks", headers=headers).json()
    assert all(t["project_id"] != other.id for t in tasks)
    assert _me(client, world["global_admin"])["workspaces"] == []
    today_str = str(today)
    assert client.post("/api/v1/projects", headers=headers, json={
        "name": "Nope", "start_date": today_str, "target_end_date": today_str,
    }).status_code == 403


# ---------------------------------------------------------------------------
# Ownership transfer
# ---------------------------------------------------------------------------
def _active_admins(company_id):
    fresh = TestingSessionLocal()
    try:
        return [a.user_id for a in fresh.query(CompanyAdmin).filter_by(company_id=company_id, status="ACTIVE")]
    finally:
        fresh.close()


def test_transfer_validates_initiator_and_recipient(client, world):  # noqa: F811
    url = f"/api/v1/companies/{world['a'].id}/admin-transfers"
    admin_h = _auth(world["admin_a"])
    # Not the admin, wrong password, recipient in another company, self.
    assert client.post(url, json={"to_user_id": world["employee_a"].id, "password": PASSWORD}, headers=_auth(world["manager_a"])).status_code == 403
    assert client.post(url, json={"to_user_id": world["employee_a"].id, "password": "nope"}, headers=admin_h).status_code == 403
    assert client.post(url, json={"to_user_id": world["employee_b"].id, "password": PASSWORD}, headers=admin_h).status_code == 404
    assert client.post(url, json={"to_user_id": world["admin_a"].id, "password": PASSWORD}, headers=admin_h).status_code == 400
    assert _active_admins(world["a"].id) == [world["admin_a"].id]


def test_repeated_and_invalid_transfers_never_leave_two_admins(client, world):  # noqa: F811
    url = f"/api/v1/companies/{world['a'].id}/admin-transfers"
    admin_h = _auth(world["admin_a"])
    first = client.post(url, json={"to_user_id": world["manager_a"].id, "password": PASSWORD}, headers=admin_h)
    assert first.status_code == 201
    # A second request while one is pending is refused.
    assert client.post(url, json={"to_user_id": world["employee_a"].id, "password": PASSWORD}, headers=admin_h).status_code == 409

    accept = f"/api/v1/companies/admin-transfers/{first.json()['id']}/accept"
    target_h = _auth(world["manager_a"])
    assert client.post(accept, json={"password": "wrong"}, headers=target_h).status_code == 403
    assert client.post(accept, json={"password": PASSWORD}, headers=_auth(world["employee_a"])).status_code == 404
    assert client.post(accept, json={"password": PASSWORD}, headers=target_h).status_code == 200
    # Replaying the acceptance, or cancelling afterwards, changes nothing.
    assert client.post(accept, json={"password": PASSWORD}, headers=target_h).status_code == 409
    assert client.post(f"/api/v1/companies/admin-transfers/{first.json()['id']}/cancel", headers=admin_h).status_code in (403, 409)
    assert _active_admins(world["a"].id) == [world["manager_a"].id]


def test_former_admin_loses_admin_rights_immediately(client, world, db_session):  # noqa: F811
    url = f"/api/v1/companies/{world['a'].id}/admin-transfers"
    created = client.post(url, json={"to_user_id": world["employee_a"].id, "password": PASSWORD}, headers=_auth(world["admin_a"])).json()
    client.post(f"/api/v1/companies/admin-transfers/{created['id']}/accept", json={"password": PASSWORD}, headers=_auth(world["employee_a"]))

    former = _me(client, world["admin_a"])
    assert former["workspaces"] == ["manager"]  # keeps their own project role
    assert former["administered_company_ids"] == []
    for path in ADMIN_READS:
        assert client.get(f"/api/v1/companies/{world['a'].id}/{path}", headers=_auth(world["admin_a"])).status_code == 403

    new_admin = _me(client, world["employee_a"])
    assert new_admin["workspaces"] == ["admin", "employee"]
    assert client.get(f"/api/v1/companies/{world['a'].id}/portal", headers=_auth(world["employee_a"])).status_code == 200
    assert db_session.query(CompanyAdminTransfer).filter_by(id=created["id"]).one().status == "ACCEPTED"


# ---------------------------------------------------------------------------
# Several administered companies
# ---------------------------------------------------------------------------
def test_admin_of_several_companies_is_checked_per_company(client, world, db_session):  # noqa: F811
    third = Company(name=f"Umbrella {world['tag']}", join_code=f"U{world['tag'][:7]}".upper())
    db_session.add(third)
    db_session.flush()
    db_session.add(CompanyAdmin(company_id=third.id, user_id=world["admin_a"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"))
    db_session.commit()

    me = _me(client, world["admin_a"])
    assert set(me["administered_company_ids"]) == {world["a"].id, third.id}
    assert me["workspaces"] == ["admin", "manager"]
    headers = _auth(world["admin_a"])
    assert client.get(f"/api/v1/companies/{third.id}/portal", headers=headers).status_code == 200
    assert client.get(f"/api/v1/companies/{world['b'].id}/portal", headers=headers).status_code == 403
