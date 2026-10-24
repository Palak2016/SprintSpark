"""Signup paths and Admin console member management.

* "Create a company" (role ADMIN) is the only signup that creates a company.
* Managers and employees join an existing company (code or invitation).
* Company Admins edit designations, grant/revoke Manager access and
  deactivate/reactivate accounts of their own company only, with audit events.
"""

import uuid
from datetime import date

import pytest

from app.models.company import Company
from app.models.company_access import CompanyAdmin, CompanyAdminTransfer, CompanyAuditEvent
from app.models.notification import Notification
from app.models.user import User
from tests.test_company_portal import PASSWORD, _auth, _mock_email, _user, world  # noqa: F401  (fixture)


def _signup(client, monkeypatch, **details):
    _mock_email(monkeypatch)
    email = details.pop("email", f"person.{uuid.uuid4().hex[:8]}@example.com")
    otp_fields = {k: v for k, v in details.items() if k != "full_name"}
    sent = client.post("/api/v1/auth/signup/send-otp", json={"email": email, **otp_fields})
    response = client.post("/api/v1/auth/signup", json={
        "email": email, "full_name": "Test Person", "password": PASSWORD, "otp_code": "123456", **details,
    })
    return sent, response


def _events(db, company_id, event_type):
    db.expire_all()
    return db.query(CompanyAuditEvent).filter_by(company_id=company_id, event_type=event_type).all()


def _member(client, world, user_key, action, method="post", body=None, admin="admin_a", company="a"):  # noqa: F811
    url = f"/api/v1/companies/{world[company].id}/members/{world[user_key].id}/{action}"
    return getattr(client, method)(url, json=body if body is not None else {}, headers=_auth(world[admin]))


# ---------------------------------------------------------------------------
# Signup paths
# ---------------------------------------------------------------------------
def test_admin_signup_can_explicitly_include_manager_access(client, monkeypatch):
    name = f"Founder Co {uuid.uuid4().hex[:6]}"
    _, response = _signup(client, monkeypatch, role="ADMIN", company_name=name, also_manager=True)
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["role"] == "MANAGER"
    assert user["workspaces"] == ["admin", "manager"]


def test_manager_signup_joins_existing_company_and_never_creates_one(client, monkeypatch, world, db_session):  # noqa: F811
    before = db_session.query(Company).count()
    _, response = _signup(client, monkeypatch, role="MANAGER", company_code=world["a"].join_code, designation="Team Lead")
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["company_id"] == world["a"].id and user["approval_status"] == "PENDING"
    assert user["administered_company_ids"] == [] and user["workspaces"] == []
    db_session.expire_all()
    assert db_session.query(Company).count() == before


@pytest.mark.parametrize("details", [
    # Managers and employees cannot create companies any more.
    {"role": "MANAGER", "company_name": "Sneaky Manager Co", "designation": "Lead"},
    {"role": "EMPLOYEE", "company_name": "Sneaky Employee Co"},
    # The Admin path cannot be used to join (and take over) an existing company.
    {"role": "ADMIN", "company_name": "X", "company_code": "PLACEHOLDER"},
    {"role": "ADMIN", "company_code": "PLACEHOLDER"},
    # Manager access cannot be requested outside company creation.
    {"role": "EMPLOYEE", "company_code": "PLACEHOLDER", "also_manager": True},
    # Nothing to join.
    {"role": "MANAGER", "designation": "Lead"},
])
def test_invalid_signup_combinations_are_rejected(client, monkeypatch, world, details):  # noqa: F811
    details = {k: (world["a"].join_code if v == "PLACEHOLDER" else v) for k, v in details.items()}
    sent, response = _signup(client, monkeypatch, **details)
    assert sent.status_code == 422
    assert response.status_code == 422


def test_admin_path_cannot_use_an_invitation(client, monkeypatch, world):  # noqa: F811
    _, response = _signup(client, monkeypatch, role="ADMIN", invitation_token="x" * 40)
    assert response.status_code == 422


def test_employee_signup_by_code_still_works(client, monkeypatch, world, db_session):  # noqa: F811
    _, response = _signup(client, monkeypatch, role="EMPLOYEE", company_code=world["a"].join_code)
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["role"] == "EMPLOYEE" and user["approval_status"] == "PENDING"
    approved = client.post(
        f"/api/v1/companies/{world['a'].id}/members/{user['id']}/approve", json={}, headers=_auth(world["admin_a"]),
    )
    assert approved.status_code == 200
    me = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + response.json()["access_token"]})
    assert me.json()["workspaces"] == ["employee"]


# ---------------------------------------------------------------------------
# Designation
# ---------------------------------------------------------------------------
def test_admin_edits_designation_with_audit_event(client, world, db_session):  # noqa: F811
    response = _member(client, world, "employee_a", "designation", "patch", {"designation": "  HR   Head "})
    assert response.status_code == 200, response.text
    assert response.json()["designation"] == "HR Head"

    events = _events(db_session, world["a"].id, "MEMBER_DESIGNATION_CHANGED")
    assert len(events) == 1
    assert events[0].actor_id == world["admin_a"].id
    assert events[0].metadata_json["user_id"] == world["employee_a"].id
    assert events[0].metadata_json["to"] == "HR Head"

    # Shown everywhere the member appears; role and access unchanged.
    me = client.get("/api/v1/auth/me", headers=_auth(world["employee_a"])).json()
    assert me["designation"] == "HR Head" and me["role"] == "EMPLOYEE"
    portal = client.get(f"/api/v1/companies/{world['a'].id}/portal", headers=_auth(world["admin_a"])).json()
    assert {m["id"]: m["designation"] for m in portal["members"]}[world["employee_a"].id] == "HR Head"

    # Same value again records nothing; clearing works; junk is rejected.
    _member(client, world, "employee_a", "designation", "patch", {"designation": "HR Head"})
    assert len(_events(db_session, world["a"].id, "MEMBER_DESIGNATION_CHANGED")) == 1
    assert _member(client, world, "employee_a", "designation", "patch", {"designation": ""}).json()["designation"] is None
    assert _member(client, world, "employee_a", "designation", "patch", {"designation": "x"}).status_code == 422
    assert _member(client, world, "employee_a", "designation", "patch", {"designation": "y" * 300}).status_code == 422


def test_only_the_company_admin_edits_designations(client, world):  # noqa: F811
    for who in ("manager_a", "employee_a", "global_admin"):
        response = _member(client, world, "employee_a", "designation", "patch", {"designation": "CEO"}, admin=who)
        assert response.status_code == 403, who


# ---------------------------------------------------------------------------
# Manager access
# ---------------------------------------------------------------------------
def test_admin_grants_and_revokes_manager_access(client, world, db_session):  # noqa: F811
    today = str(date.today())
    project = {"name": "Promotion project", "start_date": today, "target_end_date": today}
    employee_h = _auth(world["employee_a"])
    assert client.post("/api/v1/projects", headers=employee_h, json=project).status_code == 403

    granted = _member(client, world, "employee_a", "role", "put", {"role": "MANAGER"})
    assert granted.status_code == 200 and granted.json()["role"] == "MANAGER"
    assert client.get("/api/v1/auth/me", headers=employee_h).json()["workspaces"] == ["manager"]
    assert client.post("/api/v1/projects", headers=employee_h, json=project).status_code == 201
    # Designation is untouched by a permission change.
    db_session.expire_all()
    assert db_session.get(User, world["employee_a"].id).designation == world["employee_a"].designation

    revoked = _member(client, world, "employee_a", "role", "put", {"role": "EMPLOYEE"})
    assert revoked.status_code == 200
    assert client.get("/api/v1/auth/me", headers=employee_h).json()["workspaces"] == ["employee"]
    assert client.post("/api/v1/projects", headers=employee_h, json=project).status_code == 403

    changes = [e.metadata_json for e in _events(db_session, world["a"].id, "MEMBER_ROLE_CHANGED")]
    assert [(c["from"], c["to"]) for c in changes] == [("EMPLOYEE", "MANAGER"), ("MANAGER", "EMPLOYEE")]
    assert changes[1]["led_projects"] == 1
    assert db_session.query(Notification).filter_by(user_id=world["employee_a"].id, title="Your access changed").count() == 2


def test_nobody_can_raise_their_own_permissions(client, world):  # noqa: F811
    # Not the admin: 403 even for their own account.
    assert _member(client, world, "employee_a", "role", "put", {"role": "MANAGER"}, admin="employee_a").status_code == 403
    assert _member(client, world, "manager_a", "role", "put", {"role": "MANAGER"}, admin="manager_a").status_code == 403
    # Unknown roles and extra fields are rejected outright.
    assert _member(client, world, "employee_a", "role", "put", {"role": "OWNER"}).status_code == 422
    assert _member(client, world, "employee_a", "role", "put", {"role": "MANAGER", "is_admin": True}).status_code == 422
    # "Administration-only" is reserved for the Company Admin's own account.
    assert _member(client, world, "employee_a", "role", "put", {"role": "ADMIN"}).status_code == 400


def test_company_admin_can_switch_own_project_role(client, world):  # noqa: F811
    admin_h = _auth(world["admin_a"])
    assert _member(client, world, "admin_a", "role", "put", {"role": "ADMIN"}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=admin_h).json()["workspaces"] == ["admin"]
    # Still the Company Admin, but no manager rights.
    assert client.get(f"/api/v1/companies/{world['a'].id}/portal", headers=admin_h).status_code == 200
    assert client.get("/api/v1/analytics/portfolio", headers=admin_h).status_code == 403
    assert _member(client, world, "admin_a", "role", "put", {"role": "MANAGER"}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=admin_h).json()["workspaces"] == ["admin", "manager"]


# ---------------------------------------------------------------------------
# Deactivation
# ---------------------------------------------------------------------------
def test_deactivation_blocks_sessions_and_reactivation_restores(client, world, db_session):  # noqa: F811
    old_session = _auth(world["employee_a"])
    assert client.get("/api/v1/tasks", headers=old_session).status_code == 200

    off = _member(client, world, "employee_a", "deactivate", body={"notes": "Left the company"})
    assert off.status_code == 200 and off.json()["approval_status"] == "DEACTIVATED"

    # Existing session: blocked on every protected API.
    for path in ("/api/v1/tasks", "/api/v1/projects", "/api/v1/notifications", "/api/v1/leave-requests"):
        response = client.get(path, headers=old_session)
        assert response.status_code == 403, path
        assert "deactivated" in response.json()["detail"]
    me = client.get("/api/v1/auth/me", headers=old_session).json()
    assert me["approval_status"] == "DEACTIVATED" and me["workspaces"] == []

    # A brand-new login is blocked the same way.
    login = client.post("/api/v1/auth/login", json={"email": world["employee_a"].email, "password": PASSWORD})
    new_session = {"Authorization": "Bearer " + login.json()["access_token"]}
    assert login.json()["user"]["workspaces"] == []
    assert client.get("/api/v1/tasks", headers=new_session).status_code == 403

    # Approvals cannot be used to bring them back.
    assert _member(client, world, "employee_a", "approve").status_code == 409

    on = _member(client, world, "employee_a", "reactivate")
    assert on.status_code == 200 and on.json()["approval_status"] == "APPROVED"
    assert client.get("/api/v1/tasks", headers=old_session).status_code == 200
    assert client.get("/api/v1/auth/me", headers=new_session).json()["workspaces"] == ["employee"]

    for event_type in ("MEMBER_DEACTIVATED", "MEMBER_REACTIVATED"):
        [event] = _events(db_session, world["a"].id, event_type)
        assert event.actor_id == world["admin_a"].id
        assert event.metadata_json["user_id"] == world["employee_a"].id
        assert event.created_at is not None
    # Nothing was deleted.
    db_session.expire_all()
    assert db_session.get(User, world["employee_a"].id) is not None


def test_deactivation_state_rules(client, world):  # noqa: F811
    assert _member(client, world, "employee_a", "reactivate").status_code == 409  # not deactivated
    _member(client, world, "employee_a", "deactivate")
    assert _member(client, world, "employee_a", "deactivate").status_code == 409  # already off
    assert _member(client, world, "employee_a", "role", "put", {"role": "MANAGER"}).status_code == 409


def test_admin_cannot_lock_out_the_company(client, world, db_session):  # noqa: F811
    # Not themselves...
    assert _member(client, world, "admin_a", "deactivate").status_code == 400
    # ...and never another account that is a Company Admin somewhere.
    third = Company(name=f"Initech {world['tag']}", join_code=f"N{world['tag'][:7]}".upper())
    db_session.add(third)
    db_session.flush()
    db_session.add(CompanyAdmin(company_id=third.id, user_id=world["manager_a"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"))
    db_session.commit()
    response = _member(client, world, "manager_a", "deactivate")
    assert response.status_code == 409 and "Transfer" in response.json()["detail"]


def test_deactivating_a_transfer_recipient_cancels_the_transfer(client, world, db_session):  # noqa: F811
    created = client.post(
        f"/api/v1/companies/{world['a'].id}/admin-transfers",
        json={"to_user_id": world["employee_a"].id, "password": PASSWORD},
        headers=_auth(world["admin_a"]),
    ).json()
    assert _member(client, world, "employee_a", "deactivate").status_code == 200
    db_session.expire_all()
    assert db_session.get(CompanyAdminTransfer, created["id"]).status == "CANCELLED"
    accept = client.post(
        f"/api/v1/companies/admin-transfers/{created['id']}/accept",
        json={"password": PASSWORD}, headers=_auth(world["employee_a"]),
    )
    assert accept.status_code == 403  # account is deactivated
    assert [a.user_id for a in db_session.query(CompanyAdmin).filter_by(company_id=world["a"].id, status="ACTIVE")] == [world["admin_a"].id]


def test_pending_members_are_rejected_not_deactivated(client, world, db_session):  # noqa: F811
    world["pending"] = _user(db_session, f"waiting.{world['tag']}@acme.example.com", "EMPLOYEE", world["a"], status="PENDING")
    db_session.commit()
    assert _member(client, world, "pending", "deactivate").status_code == 409


# ---------------------------------------------------------------------------
# Company boundaries
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("action,method,body", [
    ("designation", "patch", {"designation": "Hacked"}),
    ("role", "put", {"role": "MANAGER"}),
    ("deactivate", "post", {}),
    ("reactivate", "post", {}),
])
def test_one_company_cannot_manage_another_companys_members(client, world, db_session, action, method, body):  # noqa: F811
    # Company B's admin, using company A's URL: not their company.
    assert _member(client, world, "employee_a", action, method, body, admin="admin_b", company="a").status_code == 403
    # Company B's admin, smuggling company A's member into company B's URL.
    assert _member(client, world, "employee_a", action, method, body, admin="admin_b", company="b").status_code == 404
    db_session.expire_all()
    member = db_session.get(User, world["employee_a"].id)
    assert member.designation != "Hacked" and member.role == "EMPLOYEE" and member.approval_status == "APPROVED"
