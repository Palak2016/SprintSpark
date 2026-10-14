def test_employee_cannot_create_project(client, employee_token):
    response = client.post("/api/v1/projects", headers={
        "Authorization": f"Bearer {employee_token}"
    }, json={
        "name": "Unauthorized Project",
        "description": "Attempted by employee",
        "start_date": "2026-10-15",
        "target_end_date": "2026-11-15"
    })
    assert response.status_code == 403
    assert "Manager privileges required" in response.json()["detail"]


def test_manager_can_create_project(client, manager_token):
    response = client.post("/api/v1/projects", headers={
        "Authorization": f"Bearer {manager_token}"
    }, json={
        "name": "Authorized Manager Project",
        "description": "Created by Alex Vance",
        "start_date": "2026-10-15",
        "target_end_date": "2026-11-15"
    })
    assert response.status_code == 201
    assert response.json()["name"] == "Authorized Manager Project"


def test_employee_cannot_review_leave(client, employee_token):
    response = client.put("/api/v1/leave-requests/1/review", headers={
        "Authorization": f"Bearer {employee_token}"
    }, json={
        "status": "APPROVED",
        "decision_notes": "Employee trying to approve"
    })
    assert response.status_code == 403
