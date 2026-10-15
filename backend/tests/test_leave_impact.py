from datetime import date, timedelta

from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole


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


def test_team_availability_calculation(client, manager_token, db_session):
    employee = User(
        email="availability.employee@example.com",
        hashed_password="not-used",
        full_name="Availability Employee",
        role=UserRole.EMPLOYEE.value,
    )
    db_session.add(employee)
    db_session.flush()
    db_session.add(Task(
        project_id=1,
        title="Availability test task",
        assignee_id=employee.id,
        status=TaskStatus.TODO.value,
        estimated_hours=8,
        start_date=date.today(),
        due_date=date.today() + timedelta(days=1),
    ))
    db_session.flush()

    response = client.get("/api/v1/team-availability", headers={
        "Authorization": f"Bearer {manager_token}"
    })
    assert response.status_code == 200
    avail = response.json()
    assert all(
        member["user"]["email"] not in {
            "manager@workpilot.ai",
            "dev1@workpilot.ai",
            "dev2@workpilot.ai",
        }
        for member in avail
    )
    employee_availability = next(
        member for member in avail
        if member["user"]["email"] == "availability.employee@example.com"
    )
    assert employee_availability["active_task_count"] == 1
