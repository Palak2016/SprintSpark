def test_employee_submit_leave_request(client, employee_token):
    response = client.post("/api/v1/leave-requests", headers={
        "Authorization": f"Bearer {employee_token}"
    }, json={
        "start_date": "2026-11-01",
        "end_date": "2026-11-05",
        "reason": "Personal family leave"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["reason"] == "Personal family leave"


def test_leave_end_before_start_rejection(client, employee_token):
    response = client.post("/api/v1/leave-requests", headers={
        "Authorization": f"Bearer {employee_token}"
    }, json={
        "start_date": "2026-11-10",
        "end_date": "2026-11-05",
        "reason": "Invalid dates"
    })
    assert response.status_code == 400
    assert "End date cannot be prior" in response.json()["detail"]


def test_team_availability_calculation(client, manager_token):
    response = client.get("/api/v1/team-availability", headers={
        "Authorization": f"Bearer {manager_token}"
    })
    assert response.status_code == 200
    avail = response.json()
    assert len(avail) >= 3
    # Elena or Marcus should have active task counts > 0
    assert any(m["active_task_count"] > 0 for m in avail)
