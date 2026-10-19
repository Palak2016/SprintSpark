from datetime import date, timedelta


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _submit_leave(client, employee_token):
    start_date = date.today() + timedelta(days=14)
    response = client.post(
        "/api/v1/leave-requests",
        headers=_auth(employee_token),
        json={
            "start_date": start_date.isoformat(),
            "end_date": (start_date + timedelta(days=2)).isoformat(),
            "reason": "Notification test",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_leave_request_notifies_manager(
    client,
    employee_token,
    manager_token,
):
    leave = _submit_leave(client, employee_token)

    response = client.get(
        "/api/v1/notifications",
        headers=_auth(manager_token),
    )

    assert response.status_code == 200
    assert any(
        notification["title"] == "Leave Request from Elena Rostova"
        and str(leave["start_date"]) in notification["message"]
        for notification in response.json()
    )


def test_leave_decision_notifies_employee_with_reviewer(
    client,
    employee_token,
    manager_token,
):
    approved_leave = _submit_leave(client, employee_token)
    rejected_leave = _submit_leave(client, employee_token)

    for leave, decision in (
        (approved_leave, "APPROVED"),
        (rejected_leave, "REJECTED"),
    ):
        response = client.put(
            f"/api/v1/leave-requests/{leave['id']}/review",
            headers=_auth(manager_token),
            json={
                "status": decision,
                "decision_notes": "Reviewed by manager",
            },
        )
        assert response.status_code == 200

    response = client.get(
        "/api/v1/notifications",
        headers=_auth(employee_token),
    )

    assert response.status_code == 200
    notifications = response.json()
    for decision in ("APPROVED", "REJECTED"):
        assert any(
            notification["title"] == f"Leave Request {decision}"
            and "by Alex Vance." in notification["message"]
            and "Reviewed by manager" in notification["message"]
            for notification in notifications
        )


def test_task_assignment_notifies_assignee(
    client,
    employee_token,
    manager_token,
):
    start_date = date.today()
    task_data = {
        "project_id": 1,
        "title": "Assigned notification test",
        "start_date": start_date.isoformat(),
        "due_date": (start_date + timedelta(days=5)).isoformat(),
    }

    assigned_response = client.post(
        "/api/v1/tasks",
        headers=_auth(manager_token),
        json={**task_data, "assignee_id": 2},
    )
    assert assigned_response.status_code == 201

    unassigned_response = client.post(
        "/api/v1/tasks",
        headers=_auth(manager_token),
        json={**task_data, "title": "Reassigned notification test"},
    )
    assert unassigned_response.status_code == 201

    update_response = client.put(
        f"/api/v1/tasks/{unassigned_response.json()['id']}",
        headers=_auth(manager_token),
        json={"assignee_id": 2},
    )
    assert update_response.status_code == 200

    response = client.get(
        "/api/v1/notifications",
        headers=_auth(employee_token),
    )

    assert response.status_code == 200
    titles = [notification["title"] for notification in response.json()]
    assert "Task Assigned: Assigned notification test" in titles
    assert "Task Assigned: Reassigned notification test" in titles


def test_project_assignment_notifies_employee(
    client,
    employee_token,
    manager_token,
):
    today = date.today()
    project_response = client.post(
        "/api/v1/projects",
        headers=_auth(manager_token),
        json={
            "name": "Project assignment notification test",
            "description": "Verify employee project assignment notifications.",
            "start_date": today.isoformat(),
            "target_end_date": (today + timedelta(days=14)).isoformat(),
        },
    )
    assert project_response.status_code == 201
    project = project_response.json()

    assignment_response = client.post(
        f"/api/v1/projects/{project['id']}/members",
        headers=_auth(manager_token),
        json={
            "user_id": 2,
            "role_in_project": "Project Member",
        },
    )
    assert assignment_response.status_code == 201

    response = client.get(
        "/api/v1/notifications",
        headers=_auth(employee_token),
    )

    assert response.status_code == 200
    assert any(
        notification["title"]
        == f"Project Assigned: {project['name']}"
        and "Alex Vance" in notification["message"]
        and project["name"] in notification["message"]
        and notification["link"] == "/employee"
        for notification in response.json()
    )


def test_daily_update_notifies_project_manager(
    client,
    employee_token,
    manager_token,
):
    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]

    update_response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "progress_pct": task["progress_pct"],
            "update_notes": "Completed the implementation verification.",
        },
    )
    assert update_response.status_code == 201

    response = client.get(
        "/api/v1/notifications",
        headers=_auth(manager_token),
    )

    assert response.status_code == 200
    assert any(
        notification["type"] == "DAILY_UPDATE_SUBMITTED"
        and notification["title"] == f"Daily Update: {task['title']}"
        and "Elena Rostova" in notification["message"]
        and "implementation verification" in notification["message"]
        and notification["link"] == "/manager/daily-updates"
        for notification in response.json()
    )


def test_work_log_notifies_project_manager_and_is_visible_to_managers(
    client,
    employee_token,
    manager_token,
):
    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]

    log_response = client.post(
        "/api/v1/work-logs",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "hours_spent": 2,
            "notes": "Completed integration checks.",
        },
    )
    assert log_response.status_code == 201

    notifications_response = client.get(
        "/api/v1/notifications",
        headers=_auth(manager_token),
    )
    assert notifications_response.status_code == 200
    assert any(
        notification["type"] == "WORK_LOG_SUBMITTED"
        and notification["title"] == f"Work Log Submitted: {task['title']}"
        and "Elena Rostova logged 2 hours" in notification["message"]
        and notification["link"] == "/manager/work-logs"
        for notification in notifications_response.json()
    )

    logs_response = client.get(
        "/api/v1/work-logs",
        headers=_auth(manager_token),
    )
    assert logs_response.status_code == 200
    assert any(
        log["id"] == log_response.json()["id"]
        and log["user"]["full_name"] == "Elena Rostova"
        for log in logs_response.json()
    )


def test_my_tasks_progress_update_notifies_project_manager(
    client,
    employee_token,
    manager_token,
):
    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]

    progress_response = client.post(
        f"/api/v1/tasks/{task['id']}/progress",
        headers=_auth(employee_token),
        json={
            "progress_pct": min(100, task["progress_pct"] + 5),
            "notes": "Completed the next integration step.",
        },
    )
    assert progress_response.status_code == 200

    notifications_response = client.get(
        "/api/v1/notifications",
        headers=_auth(manager_token),
    )

    assert notifications_response.status_code == 200
    assert any(
        notification["type"] == "DAILY_UPDATE_SUBMITTED"
        and notification["title"] == f"Daily Update: {task['title']}"
        and "Completed the next integration step" in notification["message"]
        for notification in notifications_response.json()
    )
