def test_circular_dependency_rejection(client, manager_token):
    # Task 2 depends on Task 1 in seed data.
    # Attempting to make Task 1 depend on Task 2 must fail!
    response = client.post("/api/v1/tasks/1/dependencies", headers={
        "Authorization": f"Bearer {manager_token}"
    }, json={
        "prerequisite_task_id": 2
    })
    assert response.status_code == 400
    assert "Circular dependency" in response.json()["detail"]


def test_self_dependency_rejection(client, manager_token):
    # Task 2 cannot depend on itself
    response = client.post("/api/v1/tasks/2/dependencies", headers={
        "Authorization": f"Bearer {manager_token}"
    }, json={
        "prerequisite_task_id": 2
    })
    assert response.status_code == 400
    assert "Circular dependency" in response.json()["detail"]


def test_blocker_reporting_and_clearing(client, employee_token):
    # Report blocker on Task 2
    resp_block = client.post("/api/v1/tasks/2/blocker", headers={
        "Authorization": f"Bearer {employee_token}"
    }, json={
        "is_blocked": True,
        "blocker_reason": "Waiting on database replica port opening"
    })
    assert resp_block.status_code == 200
    assert resp_block.json()["is_blocked"] is True
    assert resp_block.json()["status"] == "BLOCKED"

    # Clear blocker
    resp_clear = client.post("/api/v1/tasks/2/blocker", headers={
        "Authorization": f"Bearer {employee_token}"
    }, json={
        "is_blocked": False
    })
    assert resp_clear.status_code == 200
    assert resp_clear.json()["is_blocked"] is False
    assert resp_clear.json()["status"] == "IN_PROGRESS"
