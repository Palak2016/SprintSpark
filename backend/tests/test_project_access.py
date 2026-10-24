"""Project visibility: lead, assigned member, or Company Admin only.

Sharing a company with a project must not be enough to see or change it.
"""

import uuid
from datetime import date, timedelta

import pytest

from app.models.company import Company
from app.models.company_access import CompanyAdmin
from app.models.project import Project, ProjectMember
from app.models.recovery import RecoveryProposal
from app.models.task import Task
from app.models.work_log import DailyUpdate, WorkLog
from tests.test_company_portal import _auth, _user

TODAY = date.today()


def _project(db, name, company, lead, members=()):
    project = Project(
        name=name,
        manager_id=lead.id,
        company_id=company.id,
        start_date=TODAY,
        target_end_date=TODAY + timedelta(days=30),
        status="ACTIVE",
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=lead.id, role_in_project="Project Manager"))
    for user in members:
        db.add(ProjectMember(project_id=project.id, user_id=user.id, role_in_project="Contributor"))
    db.flush()
    return project


def _task(db, project, title, assignee=None):
    task = Task(
        project_id=project.id,
        title=title,
        assignee_id=assignee.id if assignee else None,
        start_date=TODAY,
        due_date=TODAY + timedelta(days=5),
        estimated_hours=4,
    )
    db.add(task)
    db.flush()
    return task


@pytest.fixture
def org(db_session):
    """Company A with two projects and assorted people; company B with one project."""
    tag = uuid.uuid4().hex[:8]
    a = Company(name=f"Initech {tag}", join_code=f"I{tag[:7]}".upper())
    b = Company(name=f"Hooli {tag}", join_code=f"H{tag[:7]}".upper())
    db_session.add_all([a, b])
    db_session.flush()

    u = lambda key, role, company: _user(db_session, f"{key}.{tag}@example.com", role, company)  # noqa: E731
    w = {
        "a": a,
        "b": b,
        "lead": u("lead", "MANAGER", a),
        "assigned_mgr": u("assigned", "MANAGER", a),
        "other_lead": u("otherlead", "MANAGER", a),
        "outsider_mgr": u("outsider", "MANAGER", a),
        "member_emp": u("memberemp", "EMPLOYEE", a),
        "loose_emp": u("looseemp", "EMPLOYEE", a),
        "admin_a": u("admina", "MANAGER", a),
        "admin_b": u("adminb", "MANAGER", b),
        "lead_b": u("leadb", "MANAGER", b),
    }
    # Company A's admin is a manager who is on no project at all.
    db_session.add(CompanyAdmin(company_id=a.id, user_id=w["admin_a"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"))
    db_session.add(CompanyAdmin(company_id=b.id, user_id=w["admin_b"].id, status="ACTIVE", grant_reason="ASSIGNMENT_SCRIPT"))

    w["p1"] = _project(db_session, f"Apollo {tag}", a, w["lead"], members=[w["assigned_mgr"], w["member_emp"]])
    w["p2"] = _project(db_session, f"Borealis {tag}", a, w["other_lead"])
    w["pb"] = _project(db_session, f"Cobalt {tag}", b, w["lead_b"])

    w["t1"] = _task(db_session, w["p1"], "Design schema", assignee=w["member_emp"])
    w["t1b"] = _task(db_session, w["p1"], "Write migration")
    w["t2"] = _task(db_session, w["p2"], "Borealis secret task")
    w["tb"] = _task(db_session, w["pb"], "Cobalt secret task")

    db_session.add(WorkLog(task_id=w["t2"].id, user_id=w["other_lead"].id, hours_spent=2, log_date=TODAY))
    db_session.add(DailyUpdate(task_id=w["t2"].id, user_id=w["other_lead"].id, progress_pct=10, date=TODAY))
    w["proposal2"] = RecoveryProposal(
        project_id=w["p2"].id, title="Borealis plan", summary="s", rationale="r",
        proposed_actions=[], focus_contexts=[], assumptions=[],
        # Not pending, so other tests that pick "the pending proposal" ignore it.
        status="REJECTED",
    )
    db_session.add(w["proposal2"])
    db_session.commit()
    return w


def _ids(response):
    assert response.status_code == 200, response.text
    return {item["id"] for item in response.json()}


def _project_ids(client, user):
    return _ids(client.get("/api/v1/projects", headers=_auth(user)))


def _ours(org, ids):
    """Only the projects created by this test (the seeded demo data is ignored)."""
    return ids & {org["p1"].id, org["p2"].id, org["pb"].id}


# ---------------------------------------------------------------------------
# Project list and detail
# ---------------------------------------------------------------------------
def test_manager_sees_projects_they_lead(client, org):
    assert _ours(org, _project_ids(client, org["lead"])) == {org["p1"].id}
    assert client.get(f"/api/v1/projects/{org['p1'].id}", headers=_auth(org["lead"])).status_code == 200


def test_manager_sees_projects_they_are_assigned_to(client, org):
    assert _ours(org, _project_ids(client, org["assigned_mgr"])) == {org["p1"].id}
    assert client.get(f"/api/v1/projects/{org['p1'].id}", headers=_auth(org["assigned_mgr"])).status_code == 200


def test_manager_cannot_see_unrelated_projects_in_own_company(client, org):
    assert _ours(org, _project_ids(client, org["outsider_mgr"])) == set()
    assert _ours(org, _project_ids(client, org["lead"])) == {org["p1"].id}  # not p2
    for pid in (org["p1"].id, org["p2"].id):
        r = client.get(f"/api/v1/projects/{pid}", headers=_auth(org["outsider_mgr"]))
        assert r.status_code == 403
    assert client.get(f"/api/v1/projects/{org['p2'].id}", headers=_auth(org["lead"])).status_code == 403


def test_employee_sees_only_assigned_projects(client, org):
    assert _ours(org, _project_ids(client, org["member_emp"])) == {org["p1"].id}
    assert _ours(org, _project_ids(client, org["loose_emp"])) == set()
    assert client.get(f"/api/v1/projects/{org['p1'].id}", headers=_auth(org["loose_emp"])).status_code == 403
    assert client.get(f"/api/v1/projects/{org['p2'].id}", headers=_auth(org["member_emp"])).status_code == 403


def test_company_admin_sees_every_project_in_own_company_only(client, org):
    admin = org["admin_a"]
    assert _ours(org, _project_ids(client, admin)) == {org["p1"].id, org["p2"].id}
    detail = client.get(f"/api/v1/projects/{org['p2'].id}", headers=_auth(admin))
    assert detail.status_code == 200
    # Project team is visible to the Company Admin.
    assert {m["user_id"] for m in detail.json()["members"]} == {org["other_lead"].id}

    portfolio = client.get("/api/v1/analytics/portfolio", headers=_auth(admin))
    assert portfolio.status_code == 200
    names = {p["name"] for p in portfolio.json()["projects"]}
    assert {org["p1"].name, org["p2"].name} <= names and org["pb"].name not in names

    tasks = _ids(client.get("/api/v1/tasks", headers=_auth(admin)))
    assert {org["t1"].id, org["t2"].id} <= tasks and org["tb"].id not in tasks


def test_no_cross_company_access(client, org):
    for who in ("lead", "admin_a"):
        assert org["pb"].id not in _project_ids(client, org[who])
        assert client.get(f"/api/v1/projects/{org['pb'].id}", headers=_auth(org[who])).status_code == 403
    for pid in (org["p1"].id, org["p2"].id):
        assert client.get(f"/api/v1/projects/{pid}", headers=_auth(org["admin_b"])).status_code == 403
    assert _ours(org, _project_ids(client, org["admin_b"])) == {org["pb"].id}


def test_revoked_company_admin_loses_company_wide_view(client, org, db_session):
    row = db_session.query(CompanyAdmin).filter_by(user_id=org["admin_a"].id).one()
    row.status = "REVOKED"
    db_session.commit()
    assert _ours(org, _project_ids(client, org["admin_a"])) == set()


# ---------------------------------------------------------------------------
# Related APIs enforce the same rule
# ---------------------------------------------------------------------------
def _read_endpoints(org, project_key, task_key):
    pid, tid = org[project_key].id, org[task_key].id
    return [
        f"/api/v1/projects/{pid}",
        f"/api/v1/tasks/{tid}",
        f"/api/v1/analytics/projects/{pid}",
        f"/api/v1/projects/{pid}/risk-analysis",
        f"/api/v1/projects/{pid}/audit-trail",
        f"/api/v1/focus-guardian/projects/{pid}/contexts",
        f"/api/v1/projects/{pid}/recovery-proposals",
    ]


def test_related_read_apis_refuse_unrelated_manager(client, org):
    headers = _auth(org["lead"])  # leads p1, not p2
    for url in _read_endpoints(org, "p2", "t2"):
        assert client.get(url, headers=headers).status_code == 403, url
    assert client.get(f"/api/v1/recovery-proposals/{org['proposal2'].id}", headers=headers).status_code == 403

    # Lists silently leave out the other project's records.
    tasks = _ids(client.get("/api/v1/tasks", headers=headers))
    assert org["t1"].id in tasks and org["t2"].id not in tasks
    assert _ids(client.get(f"/api/v1/tasks?project_id={org['p2'].id}", headers=headers)) == set()
    logs = client.get("/api/v1/work-logs", headers=headers).json()
    assert all(log["task_id"] != org["t2"].id for log in logs)
    updates = client.get("/api/v1/daily-updates", headers=headers).json()
    assert all(u["task_id"] != org["t2"].id for u in updates)
    portfolio = client.get("/api/v1/analytics/portfolio", headers=headers).json()
    assert org["p2"].name not in {p["name"] for p in portfolio["projects"]}


def test_related_read_apis_allow_lead_and_assigned_manager(client, org):
    for who in ("lead", "assigned_mgr"):
        headers = _auth(org[who])
        for url in _read_endpoints(org, "p1", "t1"):
            # 404 is fine (e.g. no risk analysis yet); only access is under test.
            assert client.get(url, headers=headers).status_code in (200, 404), (who, url)
    # The Company Admin's view also covers related records.
    for url in _read_endpoints(org, "p2", "t2"):
        assert client.get(url, headers=_auth(org["admin_a"])).status_code in (200, 404), url


def test_related_write_apis_refuse_unrelated_manager(client, org, db_session):
    headers = _auth(org["outsider_mgr"])
    p1, t1, t1b = org["p1"].id, org["t1"].id, org["t1b"].id
    attempts = [
        ("put", f"/api/v1/projects/{p1}", {"name": "Hijacked"}),
        ("post", f"/api/v1/projects/{p1}/members", {"user_id": org["outsider_mgr"].id}),
        ("delete", f"/api/v1/projects/{p1}/members/{org['member_emp'].id}", None),
        ("post", "/api/v1/tasks", {
            "project_id": p1, "title": "Injected", "start_date": str(TODAY), "due_date": str(TODAY),
        }),
        ("put", f"/api/v1/tasks/{t1}", {"title": "Renamed"}),
        ("post", f"/api/v1/tasks/{t1}/dependencies", {"prerequisite_task_id": t1b}),
        ("post", "/api/v1/work-logs", {"task_id": t1, "hours_spent": 1}),
        ("post", f"/api/v1/projects/{p1}/recovery-proposals/generate", None),
        ("delete", f"/api/v1/tasks/{t1}", None),
        ("delete", f"/api/v1/projects/{p1}", None),
    ]
    for method, url, body in attempts:
        kwargs = {"headers": headers}
        if body is not None:
            kwargs["json"] = body
        response = getattr(client, method)(url, **kwargs)
        assert response.status_code == 403, (method, url, response.status_code, response.text)

    db_session.expire_all()
    project = db_session.get(Project, p1)
    assert project is not None and project.name == org["p1"].name
    assert db_session.get(Task, t1).title == "Design schema"
    assert db_session.query(ProjectMember).filter_by(project_id=p1, user_id=org["outsider_mgr"].id).count() == 0


def test_assigned_manager_keeps_existing_workflows(client, org, db_session):
    headers = _auth(org["assigned_mgr"])
    p1 = org["p1"].id
    created = client.post("/api/v1/tasks", headers=headers, json={
        "project_id": p1, "title": "New task", "start_date": str(TODAY), "due_date": str(TODAY + timedelta(days=2)),
    })
    assert created.status_code in (200, 201), created.text
    assert client.put(f"/api/v1/tasks/{org['t1b'].id}", headers=headers, json={"title": "Write migrations"}).status_code == 200
    assert client.post(f"/api/v1/projects/{p1}/members", headers=headers, json={"user_id": org["loose_emp"].id}).status_code == 201
    # The newly added employee can now see the project.
    assert org["p1"].id in _project_ids(client, org["loose_emp"])


def test_creating_a_project_makes_it_visible_to_creator_only(client, org):
    created = client.post("/api/v1/projects", headers=_auth(org["outsider_mgr"]), json={
        "name": "Fresh start", "start_date": str(TODAY), "target_end_date": str(TODAY + timedelta(days=10)),
    })
    assert created.status_code == 201, created.text
    new_id = created.json()["id"]
    assert new_id in _project_ids(client, org["outsider_mgr"])
    assert new_id not in _project_ids(client, org["lead"])
    assert new_id in _project_ids(client, org["admin_a"])
