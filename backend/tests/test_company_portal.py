"""Multi-company Company Portal: authorization, isolation, signup, approvals,
invitations, ownership transfer, rate limiting, assignment script and
migration safety."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.company_access import hash_token, utcnow_naive
from app.core.security import create_access_token, get_password_hash
from app.models.company import Company
from app.models.company_access import (
    CompanyAdmin,
    CompanyAdminTransfer,
    CompanyAuditEvent,
    CompanyInvitation,
)
from app.models.notification import Notification
from app.models.user import User
from tests.conftest import TestingSessionLocal

PASSWORD = "Password123!"


def _mock_email(monkeypatch):
    import app.services.email_verification as ev

    sent = []
    monkeypatch.setattr(ev, "_generate_otp", lambda: "123456")
    monkeypatch.setattr(ev, "_deliver_otp", lambda email, code: sent.append(("otp", email)))
    monkeypatch.setattr(ev, "_deliver_email", lambda email, subject, body: sent.append(("mail", email, body)))
    return sent


def _auth(user):
    return {"Authorization": "Bearer " + create_access_token(subject=user.id, role=user.role)}


def _user(db, email, role, company, status="APPROVED"):
    user = User(
        email=email,
        full_name=email.split("@")[0].replace(".", " ").title(),
        hashed_password=get_password_hash(PASSWORD),
        role=role,
        company_id=company.id if company else None,
        company_name=company.name if company else None,
        approval_status=status,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def world(db_session):
    """Two independent companies, each with its own designated admin."""
    tag = uuid.uuid4().hex[:8]
    a = Company(name=f"Acme {tag}", join_code=f"A{tag[:7]}".upper())
    b = Company(name=f"Globex {tag}", join_code=f"B{tag[:7]}".upper())
    db_session.add_all([a, b])
    db_session.flush()
    w = {
        "tag": tag,
        "a": a,
        "b": b,
        "admin_a": _user(db_session, f"admin.a.{tag}@acme.example.com", "MANAGER", a),
        "manager_a": _user(db_session, f"manager.a.{tag}@acme.example.com", "MANAGER", a),
        "employee_a": _user(db_session, f"employee.a.{tag}@acme.example.com", "EMPLOYEE", a),
        "admin_b": _user(db_session, f"admin.b.{tag}@globex.example.com", "MANAGER", b),
        "employee_b": _user(db_session, f"employee.b.{tag}@globex.example.com", "EMPLOYEE", b),
        "global_admin": _user(db_session, f"root.{tag}@platform.example.com", "ADMIN", a),
    }
    db_session.add_all([
        CompanyAdmin(company_id=a.id, user_id=w["admin_a"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"),
        CompanyAdmin(company_id=b.id, user_id=w["admin_b"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"),
    ])
    db_session.commit()
    return w


def _admin_endpoints(company_id):
    return [
        ("get", f"/api/v1/companies/{company_id}/portal", None),
        ("post", f"/api/v1/companies/{company_id}/join-code/rotate", None),
        ("get", f"/api/v1/companies/{company_id}/invitations", None),
        ("post", f"/api/v1/companies/{company_id}/invitations", {"email": "x@y.example.com", "intended_role": "EMPLOYEE"}),
        ("get", f"/api/v1/companies/{company_id}/analytics", None),
        ("get", f"/api/v1/companies/{company_id}/audit-events", None),
        ("get", f"/api/v1/companies/{company_id}/admin-transfers", None),
        ("post", f"/api/v1/companies/{company_id}/admin-transfers", {"to_user_id": 1, "password": PASSWORD}),
        ("post", f"/api/v1/companies/{company_id}/members/1/approve", {}),
        ("post", f"/api/v1/companies/{company_id}/members/1/reject", {}),
    ]


def _call(client, method, url, body, headers):
    if method == "get":
        return client.get(url, headers=headers)
    return client.post(url, json=body or {}, headers=headers)


# ---------------------------------------------------------------------------
# Authorization & isolation
# ---------------------------------------------------------------------------
def test_manager_and_global_admin_roles_alone_grant_no_portal_access(client, world):
    for who in ("manager_a", "employee_a", "global_admin"):
        for method, url, body in _admin_endpoints(world["a"].id):
            response = _call(client, method, url, body, _auth(world[who]))
            assert response.status_code == 403, (who, url, response.text)


def test_seeded_manager_without_admin_grant_is_denied(client, manager_token, db_session):
    seeded = db_session.query(User).filter_by(email="manager@workpilot.ai").one()
    response = client.get(
        f"/api/v1/companies/{seeded.company_id}/portal",
        headers={"Authorization": "Bearer " + manager_token},
    )
    assert response.status_code == 403


def test_company_admin_cannot_touch_another_company(client, world):
    headers = _auth(world["admin_a"])
    for method, url, body in _admin_endpoints(world["b"].id):
        response = _call(client, method, url, body, headers)
        assert response.status_code == 403, (url, response.text)
    # Non-existent companies look exactly the same (no enumeration).
    missing = client.get("/api/v1/companies/987654/portal", headers=headers)
    other = client.get(f"/api/v1/companies/{world['b'].id}/portal", headers=headers)
    assert missing.status_code == other.status_code == 403
    assert missing.json() == other.json()


def test_company_admin_sees_only_own_company_data(client, world):
    response = client.get(f"/api/v1/companies/{world['a'].id}/portal", headers=_auth(world["admin_a"]))
    assert response.status_code == 200
    emails = {m["email"] for m in response.json()["members"]}
    assert world["employee_a"].email in emails
    assert world["employee_b"].email not in emails
    assert world["admin_b"].email not in emails
    assert response.json()["join_code"] == world["a"].join_code

    administered = client.get("/api/v1/companies/administered", headers=_auth(world["admin_a"]))
    assert [c["id"] for c in administered.json()] == [world["a"].id]

    me = client.get("/api/v1/auth/me", headers=_auth(world["admin_a"]))
    assert me.json()["administered_company_ids"] == [world["a"].id]
    me_manager = client.get("/api/v1/auth/me", headers=_auth(world["manager_a"]))
    assert me_manager.json()["administered_company_ids"] == []


def test_one_user_may_administer_several_companies(client, world, db_session):
    db_session.add(CompanyAdmin(
        company_id=world["b"].id, user_id=world["admin_a"].id, status="REVOKED", grant_reason="ASSIGNMENT_SCRIPT"
    ))
    third = Company(name=f"Initech {world['tag']}", join_code=f"C{world['tag'][:7]}".upper())
    db_session.add(third)
    db_session.flush()
    db_session.add(CompanyAdmin(company_id=third.id, user_id=world["admin_a"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"))
    db_session.commit()
    administered = client.get("/api/v1/companies/administered", headers=_auth(world["admin_a"]))
    assert {c["id"] for c in administered.json()} == {world["a"].id, third.id}
    # A REVOKED grant gives nothing.
    assert client.get(f"/api/v1/companies/{world['b'].id}/portal", headers=_auth(world["admin_a"])).status_code == 403
    assert client.get(f"/api/v1/companies/{third.id}/portal", headers=_auth(world["admin_a"])).status_code == 200


def test_companies_me_never_exposes_join_code_or_members(client, world):
    response = client.get("/api/v1/companies/me", headers=_auth(world["manager_a"]))
    assert response.status_code == 200
    body = response.json()
    assert "join_code" not in body and "members" not in body
    assert body["is_company_admin"] is False
    # The old manager-wide rotation endpoint is gone.
    old = client.post("/api/v1/companies/me/join-code", headers=_auth(world["manager_a"]))
    assert old.status_code in (404, 405)


def test_database_allows_only_one_active_admin_per_company(db_session, world):
    db_session.add(CompanyAdmin(
        company_id=world["a"].id, user_id=world["manager_a"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"
    ))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
    # Revoked history rows are fine.
    db_session.add(CompanyAdmin(
        company_id=world["a"].id, user_id=world["manager_a"].id, status="REVOKED", grant_reason="ASSIGNMENT_SCRIPT"
    ))
    db_session.commit()


# ---------------------------------------------------------------------------
# Signup, join codes, approvals
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("field,value", [
    ("is_admin", True),
    ("company_role", "ADMIN"),
    ("approval_status", "APPROVED"),
    ("administered_company_ids", [1]),
    ("role", "SUPERUSER"),
    ("workspaces", ["admin"]),
])
def test_signup_payload_cannot_self_assign_privileges(client, monkeypatch, field, value):
    _mock_email(monkeypatch)
    base = {
        "email": f"sneaky.{uuid.uuid4().hex[:6]}@x.example.com",
        "role": "ADMIN",
        "company_name": "Sneaky Co",
        "designation": "Boss",
    }
    payload = {**base, field: value}
    assert client.post("/api/v1/auth/signup/send-otp", json=payload).status_code == 422
    signup = client.post("/api/v1/auth/signup", json={
        **payload, "full_name": "Sneaky", "password": PASSWORD, "otp_code": "123456",
    })
    assert signup.status_code == 422


def test_new_company_gets_exactly_one_admin_in_creation_transaction(client, monkeypatch, db_session):
    _mock_email(monkeypatch)
    email = f"founder.{uuid.uuid4().hex[:6]}@new.example.com"
    details = {"email": email, "role": "ADMIN", "company_name": "Brand New Co", "designation": "Founder"}
    assert client.post("/api/v1/auth/signup/send-otp", json=details).status_code == 202
    created = client.post("/api/v1/auth/signup", json={
        **details, "full_name": "Founder", "password": PASSWORD, "otp_code": "123456",
    })
    assert created.status_code == 201
    user = created.json()["user"]
    assert user["approval_status"] == "APPROVED"
    grants = db_session.query(CompanyAdmin).filter_by(company_id=user["company_id"]).all()
    assert [(g.user_id, g.status, g.grant_reason) for g in grants] == [(user["id"], "ACTIVE", "COMPANY_CREATION")]
    events = {e.event_type for e in db_session.query(CompanyAuditEvent).filter_by(company_id=user["company_id"])}
    assert {"COMPANY_CREATED", "COMPANY_ADMIN_GRANTED"} <= events


def test_join_by_code_is_pending_until_own_company_admin_approves(client, monkeypatch, world, db_session):
    _mock_email(monkeypatch)
    email = f"newhire.{world['tag']}@acme.example.com"
    details = {"email": email, "role": "MANAGER", "company_code": world["a"].join_code, "designation": "Lead"}
    assert client.post("/api/v1/auth/signup/send-otp", json=details).status_code == 202
    joined = client.post("/api/v1/auth/signup", json={
        **details, "full_name": "New Hire", "password": PASSWORD, "otp_code": "123456",
    })
    assert joined.status_code == 201
    new_user = joined.json()["user"]
    assert new_user["company_id"] == world["a"].id
    assert new_user["approval_status"] == "PENDING"
    pending_headers = {"Authorization": "Bearer " + joined.json()["access_token"]}

    # Can read their own status, but no business endpoint, manager or not.
    assert client.get("/api/v1/auth/me", headers=pending_headers).status_code == 200
    for method, url, body in [
        ("get", "/api/v1/projects", None),
        ("post", "/api/v1/projects", {"name": "x", "start_date": "2026-10-24", "target_end_date": "2026-11-24"}),
        ("get", "/api/v1/tasks", None),
        ("get", "/api/v1/team-availability", None),
        ("get", "/api/v1/analytics/portfolio", None),
        ("get", "/api/v1/projects/users/all", None),
        ("get", "/api/v1/companies/me", None),
    ]:
        assert _call(client, method, url, body, pending_headers).status_code == 403, url

    # Company A's admin was notified; company B's admin cannot decide.
    assert db_session.query(Notification).filter_by(
        user_id=world["admin_a"].id, type="COMPANY_JOIN_REQUEST"
    ).count() >= 1
    other = client.post(
        f"/api/v1/companies/{world['b'].id}/members/{new_user['id']}/approve",
        json={}, headers=_auth(world["admin_b"]),
    )
    # B's admin is authorized for B only; A's member is not found there.
    assert other.status_code == 404
    db_session.expire_all()
    assert db_session.query(User).filter_by(id=new_user["id"]).one().approval_status == "PENDING"
    # ...and B's admin cannot use A's path at all.
    assert client.post(
        f"/api/v1/companies/{world['a'].id}/members/{new_user['id']}/approve",
        json={}, headers=_auth(world["admin_b"]),
    ).status_code == 403
    # Company A's admin cannot reach B's members through A's path either.
    cross = client.post(
        f"/api/v1/companies/{world['a'].id}/members/{world['employee_b'].id}/approve",
        json={}, headers=_auth(world["admin_a"]),
    )
    assert cross.status_code == 404

    approved = client.post(
        f"/api/v1/companies/{world['a'].id}/members/{new_user['id']}/approve",
        json={"notes": "Welcome"}, headers=_auth(world["admin_a"]),
    )
    assert approved.status_code == 200
    assert approved.json()["approval_status"] == "APPROVED"
    assert client.get("/api/v1/projects", headers=pending_headers).status_code == 200
    # Approval never grants Company Portal access.
    assert client.get(f"/api/v1/companies/{world['a'].id}/portal", headers=pending_headers).status_code == 403


def test_rejected_member_stays_blocked(client, world, db_session):
    pending = _user(db_session, f"reject.me.{world['tag']}@acme.example.com", "EMPLOYEE", world["a"], status="PENDING")
    db_session.commit()
    rejected = client.post(
        f"/api/v1/companies/{world['a'].id}/members/{pending.id}/reject",
        json={}, headers=_auth(world["admin_a"]),
    )
    assert rejected.status_code == 200
    assert rejected.json()["approval_status"] == "REJECTED"
    assert client.get("/api/v1/projects", headers=_auth(pending)).status_code == 403
    # Admins cannot change their own approval.
    self_reject = client.post(
        f"/api/v1/companies/{world['a'].id}/members/{world['admin_a'].id}/reject",
        json={}, headers=_auth(world["admin_a"]),
    )
    assert self_reject.status_code == 400


def test_existing_approved_users_keep_working(client, world):
    assert client.get("/api/v1/projects", headers=_auth(world["manager_a"])).status_code == 200
    assert client.get("/api/v1/tasks", headers=_auth(world["employee_a"])).status_code == 200


def test_rotated_join_code_is_company_scoped(client, monkeypatch, world):
    _mock_email(monkeypatch)
    old_code = world["a"].join_code
    rotated = client.post(f"/api/v1/companies/{world['a'].id}/join-code/rotate", headers=_auth(world["admin_a"]))
    assert rotated.status_code == 200
    new_code = rotated.json()["join_code"]
    assert new_code != old_code

    def join(code, email):
        details = {"email": email, "role": "EMPLOYEE", "company_code": code}
        client.post("/api/v1/auth/signup/send-otp", json=details)
        return client.post("/api/v1/auth/signup", json={
            **details, "full_name": "Joiner", "password": PASSWORD, "otp_code": "123456",
        })

    assert join(old_code, f"old.{world['tag']}@x.example.com").status_code == 400
    joined = join(new_code, f"new.{world['tag']}@x.example.com")
    assert joined.status_code == 201
    assert joined.json()["user"]["company_id"] == world["a"].id
    # B's join code still joins B only.
    joined_b = join(world["b"].join_code, f"bee.{world['tag']}@x.example.com")
    assert joined_b.json()["user"]["company_id"] == world["b"].id


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------
def _invite(client, world, email, role="EMPLOYEE", admin="admin_a", company="a"):
    return client.post(
        f"/api/v1/companies/{world[company].id}/invitations",
        json={"email": email, "intended_role": role},
        headers=_auth(world[admin]),
    )


def _signup_with_invite(client, token, email, role="EMPLOYEE", **extra):
    details = {"email": email, "role": role, "invitation_token": token, **extra}
    if role == "MANAGER":
        details.setdefault("designation", "Lead")
    client.post("/api/v1/auth/signup/send-otp", json=details)
    return client.post("/api/v1/auth/signup", json={
        **details, "full_name": "Invitee", "password": PASSWORD, "otp_code": "123456",
    })


def test_invitation_full_lifecycle(client, monkeypatch, world, db_session):
    sent = _mock_email(monkeypatch)
    email = f"invitee.{world['tag']}@new.example.com"
    created = _invite(client, world, email, role="MANAGER")
    assert created.status_code == 201
    body = created.json()
    token = body["invite_url"].split("invite=")[1]
    assert body["email_sent"] is True and any(m[0] == "mail" and m[1] == email for m in sent)

    stored = db_session.query(CompanyInvitation).filter_by(id=body["id"]).one()
    assert stored.token_hash == hash_token(token) and token not in stored.token_hash
    assert stored.company_id == world["a"].id

    duplicate = _invite(client, world, email)
    assert duplicate.status_code == 409

    preview = client.post("/api/v1/auth/invitations/preview", json={"token": token})
    assert preview.status_code == 200
    assert preview.json()["company_name"] == world["a"].name
    assert preview.json()["intended_role"] == "MANAGER"

    wrong_email = _signup_with_invite(client, token, f"someone.else.{world['tag']}@new.example.com", role="MANAGER")
    assert wrong_email.status_code == 400
    wrong_role = _signup_with_invite(client, token, email, role="EMPLOYEE")
    assert wrong_role.status_code == 400
    mixed = client.post("/api/v1/auth/signup/send-otp", json={
        "email": email, "role": "MANAGER", "designation": "x1",
        "invitation_token": token, "company_code": world["b"].join_code,
    })
    assert mixed.status_code == 422

    accepted = _signup_with_invite(client, token, email, role="MANAGER")
    assert accepted.status_code == 201
    user = accepted.json()["user"]
    assert user["company_id"] == world["a"].id
    assert user["approval_status"] == "APPROVED"
    assert user["administered_company_ids"] == []
    assert db_session.query(CompanyAdmin).filter_by(user_id=user["id"]).count() == 0

    reused = _signup_with_invite(client, token, f"again.{world['tag']}@new.example.com", role="MANAGER")
    assert reused.status_code == 400


def test_invitation_revocation_expiry_and_isolation(client, monkeypatch, world, db_session):
    _mock_email(monkeypatch)
    revoked_email = f"revoked.{world['tag']}@new.example.com"
    created = _invite(client, world, revoked_email).json()
    revoked_token = created["invite_url"].split("invite=")[1]

    # Company B's admin can neither list nor revoke company A's invitations.
    assert client.get(f"/api/v1/companies/{world['a'].id}/invitations", headers=_auth(world["admin_b"])).status_code == 403
    assert client.post(
        f"/api/v1/companies/{world['b'].id}/invitations/{created['id']}/revoke", headers=_auth(world["admin_b"])
    ).status_code == 404
    listed_b = client.get(f"/api/v1/companies/{world['b'].id}/invitations", headers=_auth(world["admin_b"]))
    assert all(i["id"] != created["id"] for i in listed_b.json())

    revoke = client.post(
        f"/api/v1/companies/{world['a'].id}/invitations/{created['id']}/revoke", headers=_auth(world["admin_a"])
    )
    assert revoke.status_code == 200 and revoke.json()["status"] == "REVOKED"
    assert _signup_with_invite(client, revoked_token, revoked_email).status_code == 400

    expired_email = f"expired.{world['tag']}@new.example.com"
    expiring = _invite(client, world, expired_email).json()
    expired_token = expiring["invite_url"].split("invite=")[1]
    row = db_session.query(CompanyInvitation).filter_by(id=expiring["id"]).one()
    row.expires_at = utcnow_naive() - timedelta(minutes=1)
    db_session.commit()
    assert _signup_with_invite(client, expired_token, expired_email).status_code == 400
    db_session.refresh(row)
    assert row.status == "EXPIRED"

    assert client.post("/api/v1/auth/invitations/preview", json={"token": "x" * 40}).status_code == 400


def test_cannot_invite_existing_member(client, monkeypatch, world):
    _mock_email(monkeypatch)
    assert _invite(client, world, world["employee_a"].email).status_code == 409


# ---------------------------------------------------------------------------
# Ownership transfer
# ---------------------------------------------------------------------------
def _active_admins(db, company_id):
    db.expire_all()
    return [a.user_id for a in db.query(CompanyAdmin).filter_by(company_id=company_id, status="ACTIVE")]


def test_ownership_transfer_is_verified_and_atomic(client, world, db_session):
    a_id = world["a"].id
    url = f"/api/v1/companies/{a_id}/admin-transfers"
    admin_h, target_h = _auth(world["admin_a"]), _auth(world["manager_a"])

    assert client.post(url, json={"to_user_id": world["manager_a"].id, "password": "wrong"}, headers=admin_h).status_code == 403
    assert client.post(url, json={"to_user_id": world["employee_b"].id, "password": PASSWORD}, headers=admin_h).status_code == 404
    assert client.post(url, json={"to_user_id": world["admin_a"].id, "password": PASSWORD}, headers=admin_h).status_code == 400
    # Only the company's admin can start a transfer.
    assert client.post(url, json={"to_user_id": world["employee_a"].id, "password": PASSWORD}, headers=target_h).status_code == 403

    created = client.post(url, json={"to_user_id": world["manager_a"].id, "password": PASSWORD}, headers=admin_h)
    assert created.status_code == 201
    transfer_id = created.json()["id"]
    assert client.post(url, json={"to_user_id": world["employee_a"].id, "password": PASSWORD}, headers=admin_h).status_code == 409

    # Nothing changes until the target accepts; company never lacks an admin.
    assert _active_admins(db_session, a_id) == [world["admin_a"].id]
    incoming = client.get("/api/v1/companies/admin-transfers/incoming", headers=target_h)
    assert [t["id"] for t in incoming.json()] == [transfer_id]

    accept = f"/api/v1/companies/admin-transfers/{transfer_id}/accept"
    assert client.post(accept, json={"password": PASSWORD}, headers=_auth(world["employee_a"])).status_code == 404
    assert client.post(accept, json={"password": "wrong"}, headers=target_h).status_code == 403
    assert _active_admins(db_session, a_id) == [world["admin_a"].id]

    done = client.post(accept, json={"password": PASSWORD}, headers=target_h)
    assert done.status_code == 200 and done.json()["status"] == "ACCEPTED"
    assert _active_admins(db_session, a_id) == [world["manager_a"].id]
    assert client.get(f"/api/v1/companies/{a_id}/portal", headers=admin_h).status_code == 403
    assert client.get(f"/api/v1/companies/{a_id}/portal", headers=target_h).status_code == 200
    assert client.post(accept, json={"password": PASSWORD}, headers=target_h).status_code == 409

    events = [e.event_type for e in db_session.query(CompanyAuditEvent).filter_by(company_id=a_id)]
    assert "COMPANY_ADMIN_TRANSFER_REQUESTED" in events and "COMPANY_ADMIN_TRANSFERRED" in events
    revoked = db_session.query(CompanyAdmin).filter_by(company_id=a_id, user_id=world["admin_a"].id).one()
    assert revoked.status == "REVOKED" and revoked.revoke_reason == "OWNERSHIP_TRANSFER"
    # Company B untouched.
    assert _active_admins(db_session, world["b"].id) == [world["admin_b"].id]


def test_transfer_notifications_name_company_and_link_correctly(client, world, db_session):
    a = world["a"]
    # Real accounts often have an empty legacy company_name; messages must use the company row.
    for key in ("admin_a", "employee_a"):
        world[key].company_name = None
    db_session.commit()

    created = client.post(
        f"/api/v1/companies/{a.id}/admin-transfers",
        json={"to_user_id": world["employee_a"].id, "password": PASSWORD},
        headers=_auth(world["admin_a"]),
    ).json()
    request_note = db_session.query(Notification).filter_by(
        user_id=world["employee_a"].id, type="COMPANY_ADMIN_TRANSFER"
    ).one()
    assert a.name in request_note.message and "None" not in request_note.message
    assert "Company Portal" not in request_note.message
    assert request_note.link == "/company-transfer"

    client.post(
        f"/api/v1/companies/admin-transfers/{created['id']}/accept",
        json={"password": PASSWORD},
        headers=_auth(world["employee_a"]),
    )
    done_note = db_session.query(Notification).filter_by(
        user_id=world["admin_a"].id, type="COMPANY_ADMIN_TRANSFER"
    ).one()
    assert a.name in done_note.message
    assert done_note.link == "/manager"  # admin_a is a manager


def test_transfer_rolls_back_completely_on_failure(client, world, db_session, monkeypatch):
    a_id = world["a"].id
    created = client.post(
        f"/api/v1/companies/{a_id}/admin-transfers",
        json={"to_user_id": world["manager_a"].id, "password": PASSWORD},
        headers=_auth(world["admin_a"]),
    ).json()

    import app.api.v1.companies as companies_api

    def boom(*args, **kwargs):
        raise RuntimeError("simulated failure mid-transfer")

    monkeypatch.setattr(companies_api, "record_company_event", boom)
    with pytest.raises(RuntimeError):
        client.post(
            f"/api/v1/companies/admin-transfers/{created['id']}/accept",
            json={"password": PASSWORD},
            headers=_auth(world["manager_a"]),
        )
    db_session.rollback()

    fresh = TestingSessionLocal()
    try:
        admins = [a.user_id for a in fresh.query(CompanyAdmin).filter_by(company_id=a_id, status="ACTIVE")]
        assert admins == [world["admin_a"].id]
        assert fresh.query(CompanyAdminTransfer).filter_by(id=created["id"]).one().status == "PENDING"
    finally:
        fresh.close()


def test_transfer_decline_cancel_and_expiry(client, world, db_session):
    a_id = world["a"].id
    url = f"/api/v1/companies/{a_id}/admin-transfers"
    admin_h = _auth(world["admin_a"])
    first = client.post(url, json={"to_user_id": world["manager_a"].id, "password": PASSWORD}, headers=admin_h).json()
    declined = client.post(f"/api/v1/companies/admin-transfers/{first['id']}/decline", headers=_auth(world["manager_a"]))
    assert declined.json()["status"] == "DECLINED"

    second = client.post(url, json={"to_user_id": world["employee_a"].id, "password": PASSWORD}, headers=admin_h).json()
    # Company B's admin cannot cancel company A's transfer.
    assert client.post(f"/api/v1/companies/admin-transfers/{second['id']}/cancel", headers=_auth(world["admin_b"])).status_code == 403
    cancelled = client.post(f"/api/v1/companies/admin-transfers/{second['id']}/cancel", headers=admin_h)
    assert cancelled.json()["status"] == "CANCELLED"

    third = client.post(url, json={"to_user_id": world["manager_a"].id, "password": PASSWORD}, headers=admin_h).json()
    row = db_session.query(CompanyAdminTransfer).filter_by(id=third["id"]).one()
    row.expires_at = utcnow_naive() - timedelta(minutes=1)
    db_session.commit()
    expired = client.post(
        f"/api/v1/companies/admin-transfers/{third['id']}/accept",
        json={"password": PASSWORD}, headers=_auth(world["manager_a"]),
    )
    assert expired.status_code == 409
    assert _active_admins(db_session, a_id) == [world["admin_a"].id]


def test_transfer_target_must_be_approved(client, world, db_session):
    pending = _user(db_session, f"pending.target.{world['tag']}@acme.example.com", "MANAGER", world["a"], status="PENDING")
    db_session.commit()
    response = client.post(
        f"/api/v1/companies/{world['a'].id}/admin-transfers",
        json={"to_user_id": pending.id, "password": PASSWORD},
        headers=_auth(world["admin_a"]),
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Analytics & audit are company-scoped
# ---------------------------------------------------------------------------
def test_company_analytics_and_audit_are_scoped(client, world, db_session):
    analytics = client.get(f"/api/v1/companies/{world['a'].id}/analytics", headers=_auth(world["admin_a"]))
    assert analytics.status_code == 200
    assert analytics.json()["members"]["employees"] == 1
    client.post(f"/api/v1/companies/{world['b'].id}/join-code/rotate", headers=_auth(world["admin_b"]))
    audit_a = client.get(f"/api/v1/companies/{world['a'].id}/audit-events", headers=_auth(world["admin_a"]))
    assert all(e["event_type"] != "JOIN_CODE_ROTATED" for e in audit_a.json())
    audit_b = client.get(f"/api/v1/companies/{world['b'].id}/audit-events", headers=_auth(world["admin_b"]))
    rotated = [e for e in audit_b.json() if e["event_type"] == "JOIN_CODE_ROTATED"]
    assert rotated and "join_code" not in rotated[0]["metadata_json"]


# ---------------------------------------------------------------------------
# Leak fixes in existing endpoints
# ---------------------------------------------------------------------------
def test_users_without_company_see_no_other_users_or_tasks(client, db_session):
    tag = uuid.uuid4().hex[:6]
    loner = _user(db_session, f"loner.{tag}@none.example.com", "EMPLOYEE", None)
    _user(db_session, f"other.loner.{tag}@none.example.com", "EMPLOYEE", None)
    lonely_manager = _user(db_session, f"lonely.mgr.{tag}@none.example.com", "MANAGER", None)
    db_session.commit()
    assert client.get("/api/v1/projects/users/all", headers=_auth(loner)).json() == []
    assert client.get("/api/v1/projects/users/all", headers=_auth(lonely_manager)).json() == []
    assert client.get("/api/v1/tasks", headers=_auth(loner)).json() == []

    leave = client.post("/api/v1/leave-requests", json={
        "start_date": "2026-12-01", "end_date": "2026-12-02", "reason": "Rest",
    }, headers=_auth(loner))
    assert leave.status_code == 201
    assert db_session.query(Notification).filter_by(user_id=lonely_manager.id).count() == 0


# ---------------------------------------------------------------------------
# OTP / signup do not reveal accounts or codes; rate limiting
# ---------------------------------------------------------------------------
def test_send_otp_response_does_not_reveal_accounts_or_codes(client, monkeypatch, world):
    sent = _mock_email(monkeypatch)
    existing = client.post("/api/v1/auth/signup/send-otp", json={
        "email": world["employee_a"].email, "role": "EMPLOYEE", "company_code": world["a"].join_code,
    })
    fresh = client.post("/api/v1/auth/signup/send-otp", json={
        "email": f"fresh.{world['tag']}@x.example.com", "role": "EMPLOYEE", "company_code": "NOSUCH99",
    })
    assert existing.status_code == fresh.status_code == 202
    assert existing.json() == fresh.json()
    # The existing account owner gets a notice instead of a code.
    assert ("otp", world["employee_a"].email) not in sent
    assert any(m[0] == "mail" and m[1] == world["employee_a"].email for m in sent)


def test_otp_and_signup_endpoints_are_rate_limited(client, monkeypatch):
    _mock_email(monkeypatch)
    statuses = [
        client.post("/api/v1/auth/signup/send-otp", json={
            "email": f"burst{i}.{uuid.uuid4().hex[:4]}@x.example.com", "role": "EMPLOYEE", "company_code": "WORKPILOT",
        }).status_code
        for i in range(12)
    ]
    assert statuses[:10] == [202] * 10
    assert statuses[10:] == [429, 429]

    signup_statuses = [
        client.post("/api/v1/auth/signup", json={
            "email": f"s{i}@x.example.com", "role": "EMPLOYEE", "company_code": "WORKPILOT",
            "full_name": "Burst", "password": PASSWORD, "otp_code": "000000",
        }).status_code
        for i in range(21)
    ]
    assert signup_statuses[-1] == 429

    preview_statuses = [
        client.post("/api/v1/auth/invitations/preview", json={"token": "y" * 40}).status_code
        for _ in range(21)
    ]
    assert preview_statuses[-1] == 429


# ---------------------------------------------------------------------------
# Assignment script
# ---------------------------------------------------------------------------
@pytest.fixture
def script(monkeypatch):
    import scripts.company_admins as module
    from tests.conftest import test_engine

    monkeypatch.setattr(module, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr(module, "engine", test_engine)
    return module


def _snapshot(db):
    db.expire_all()
    users = sorted(
        (u.id, u.role, u.company_id, u.approval_status, u.approval_reviewed_by)
        for u in db.query(User).all()
    )
    companies = sorted((c.id, c.name, c.join_code) for c in db.query(Company).all())
    return users, companies


def test_assignment_script_review_changes_nothing(script, db_session, capsys):
    seeded = db_session.query(User).filter_by(email="manager@workpilot.ai").one()
    before_admins = db_session.query(CompanyAdmin).count()
    before = _snapshot(db_session)
    assert script.main(["review", "--assign", f"{seeded.company_id}={seeded.email}"]) == 0
    out = capsys.readouterr().out
    assert "Proposed admin        : manager@workpilot.ai" in out
    assert "(none - Company Portal administration disabled)" in out
    assert "Dry run only. Nothing was changed." in out
    assert db_session.query(CompanyAdmin).count() == before_admins
    assert _snapshot(db_session) == before


def test_assignment_script_requires_confirmation_and_validates(script, db_session, world, capsys):
    tag = uuid.uuid4().hex[:6]
    lone = Company(name=f"Unassigned {tag}", join_code=f"U{tag}X".upper())
    db_session.add(lone)
    db_session.flush()
    member = _user(db_session, f"chosen.{tag}@lone.example.com", "MANAGER", lone)
    pending = _user(db_session, f"pending.{tag}@lone.example.com", "MANAGER", lone, status="PENDING")
    db_session.commit()
    before = _snapshot(db_session)

    # Wrong phrase: nothing happens.
    assert script.main(["apply", "--assign", f"{lone.id}={member.email}", "--confirm-phrase", "yes"]) == 1
    assert db_session.query(CompanyAdmin).filter_by(company_id=lone.id).count() == 0

    # Invalid proposals are refused without changes.
    for bad in (
        f"{lone.id}={pending.email}",            # not approved
        f"{lone.id}={world['employee_b'].email}",  # other company's user
        f"{world['a'].id}={world['manager_a'].email}",  # already has an admin
    ):
        assert script.main(["apply", "--assign", bad, "--confirm-phrase", "ASSIGN 1 COMPANY ADMIN"]) == 1
    assert db_session.query(CompanyAdmin).filter_by(company_id=lone.id).count() == 0
    db_session.expire_all()
    assert _active_admins(db_session, world["a"].id) == [world["admin_a"].id]

    # Correct phrase: exactly one grant, nothing else modified.
    assert script.main(["apply", "--assign", f"{lone.id}={member.email}", "--confirm-phrase", "ASSIGN 1 COMPANY ADMIN"]) == 0
    db_session.expire_all()
    grants = db_session.query(CompanyAdmin).filter_by(company_id=lone.id).all()
    assert [(g.user_id, g.status, g.grant_reason) for g in grants] == [(member.id, "ACTIVE", "ASSIGNMENT_SCRIPT")]
    assert _snapshot(db_session) == before


# ---------------------------------------------------------------------------
# Migration safety
# ---------------------------------------------------------------------------
def _alembic(url, *args):
    from alembic import command
    from alembic.config import Config
    from app.core.config import settings
    import os

    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(backend, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend, "alembic"))
    previous = settings.DATABASE_URL
    settings.DATABASE_URL = url
    try:
        getattr(command, args[0])(cfg, *args[1:])
    finally:
        settings.DATABASE_URL = previous


def test_migration_is_additive_reversible_and_idempotent(tmp_path):
    import sqlalchemy as sa

    url = f"sqlite:///{tmp_path / 'migration.db'}"
    _alembic(url, "upgrade", "f7a4c2d19b61")
    engine = sa.create_engine(url)
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO companies (id, name, join_code, created_at) VALUES (1, 'Keep Co', 'KEEP1234', CURRENT_TIMESTAMP)"))
        conn.execute(sa.text(
            "INSERT INTO users (id, email, hashed_password, full_name, role, company_id, company_name, approval_status, created_at, updated_at) "
            "VALUES (1, 'keep@co.example.com', 'x', 'Keep', 'MANAGER', 1, 'Keep Co', 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ))
        conn.execute(sa.text(
            "INSERT INTO projects (id, name, manager_id, company_id, status, start_date, target_end_date, created_at, updated_at) "
            "VALUES (1, 'Keep project', 1, 1, 'ACTIVE', '2026-10-01', '2026-12-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ))

    def counts():
        with engine.connect() as conn:
            return {t: conn.execute(sa.text(f"SELECT COUNT(*) FROM {t}")).scalar() for t in ("companies", "users", "projects")}

    def user_row():
        with engine.connect() as conn:
            return tuple(conn.execute(sa.text("SELECT role, company_id, approval_status FROM users WHERE id = 1")).one())

    before, before_user = counts(), user_row()
    _alembic(url, "upgrade", "head")
    inspector = sa.inspect(engine)
    for table in ("company_admins", "company_admin_transfers", "company_invitations", "company_audit_events"):
        assert inspector.has_table(table)
    assert counts() == before and user_row() == before_user
    with engine.connect() as conn:
        # No administrator is assigned automatically.
        assert conn.execute(sa.text("SELECT COUNT(*) FROM company_admins")).scalar() == 0
    with pytest.raises(sa.exc.IntegrityError):
        with engine.begin() as conn:
            conn.execute(sa.text("INSERT INTO company_admins (company_id, user_id, status, grant_reason) VALUES (1, 1, 'ACTIVE', 'T')"))
            conn.execute(sa.text("INSERT INTO company_admins (company_id, user_id, status, grant_reason) VALUES (1, 1, 'ACTIVE', 'T')"))

    _alembic(url, "downgrade", "f7a4c2d19b61")
    inspector = sa.inspect(engine)
    assert not inspector.has_table("company_admins")
    assert counts() == before and user_row() == before_user

    # Tables pre-created by the API's startup create_all must not break upgrade.
    from app.core.database import Base

    Base.metadata.create_all(bind=engine)
    _alembic(url, "upgrade", "head")
    assert counts() == before
    engine.dispose()
