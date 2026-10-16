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
