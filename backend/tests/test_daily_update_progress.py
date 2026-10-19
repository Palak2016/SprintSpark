from types import SimpleNamespace

from app.models.task import Task


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_daily_update_progress_analysis_updates_progress_estimate(
    client,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]

    def fake_model(system_prompt, user_prompt):
        assert "Task title:" in user_prompt
        assert task["title"] in user_prompt
        assert "completed the API integration" in user_prompt
        return SimpleNamespace(
            content={
                "progress_pct": 88,
                "explanation": "The reported integration work completes most remaining implementation.",
            },
            provider="test",
            model="test-model",
            latency_ms=1,
        )

    monkeypatch.setattr(
        progress_estimator,
        "resolve_config",
        lambda: SimpleNamespace(provider="test"),
    )
    monkeypatch.setattr(progress_estimator, "call_json_model", fake_model)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "I completed the API integration and verified the response.",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "progress_pct": 88,
        "explanation": "AI estimate: The reported integration work completes most remaining implementation.",
    }


def test_daily_update_progress_analysis_works_without_ai_key(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_session.get(Task, task["id"]).description = (
        "Build API integration and review performance."
    )
    db_session.commit()

    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    def unexpected_model_call(*args, **kwargs):
        raise AssertionError("No model call should be made without a key")

    monkeypatch.setattr(
        progress_estimator,
        "call_json_model",
        unexpected_model_call,
    )

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Implemented the API and tested the integration. Next, will review performance.",
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["progress_pct"] == task["progress_pct"] + 16
    assert "No AI provider is configured" in result["explanation"]
    assert "2 completed work item(s)" in result["explanation"]


def test_rule_based_progress_estimate_varies_with_update_detail(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_session.get(Task, task["id"]).description = (
        "Build API integration with authentication, validation, "
        "deployment, and monitoring."
    )
    db_session.commit()
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    brief_response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Built API.",
        },
    )
    detailed_response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": (
                "Built API integration with authentication, validation, "
                "deployment, and monitoring."
            ),
        },
    )

    assert brief_response.status_code == 200
    assert detailed_response.status_code == 200
    assert (
        detailed_response.json()["progress_pct"]
        > brief_response.json()["progress_pct"]
    )


def test_rule_based_progress_counts_added_components_in_listed_update(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_session.get(Task, task["id"]).description = (
        "Complete database setup, AI pipeline, authentication, "
        "and authorization."
    )
    db_session.commit()
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": (
                "1. worked till database setup\n"
                "2. added ai pipeline\n"
                "3. authentication and authorization added"
            ),
        },
    )

    assert response.status_code == 200
    estimate = response.json()
    assert estimate["progress_pct"] > task["progress_pct"] + 3
    assert "2 completed work item(s)" in estimate["explanation"]
    assert "1 in-progress work item(s)" in estimate["explanation"]


def test_rule_based_progress_counts_work_even_when_task_scope_differs(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_session.get(Task, task["id"]).description = (
        "Set up PostgreSQL database schema and CDC replication."
    )
    db_session.commit()
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Added the AI pipeline.",
        },
    )

    assert response.status_code == 200
    assert response.json()["progress_pct"] > task["progress_pct"]
    assert "1 completed work item(s)" in response.json()["explanation"]


def test_ai_estimate_cannot_discard_recognized_update_evidence(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_session.get(Task, task["id"]).description = (
        "Build a customer-facing dashboard and reporting tools."
    )
    db_session.commit()

    monkeypatch.setattr(
        progress_estimator,
        "resolve_config",
        lambda: SimpleNamespace(provider="test"),
    )
    monkeypatch.setattr(
        progress_estimator,
        "call_json_model",
        lambda *_args, **_kwargs: SimpleNamespace(
            content={"progress_pct": 0, "explanation": "No progress found."},
            provider="test",
            model="test-model",
            latency_ms=1,
        ),
    )

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": (
                "1. worked till database setup\n"
                "2. added ai pipeline\n"
                "3. authentication and authorization added"
            ),
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["progress_pct"] > task["progress_pct"]
    assert "raised to account for completed and in-progress work" in (
        result["explanation"]
    )


def test_daily_update_progress_analysis_recognizes_done_phrase(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_session.get(Task, task["id"]).description = (
        "Build the admin dashboard with React and TypeScript."
    )
    db_session.commit()

    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Done till admin dashboard with React and TypeScript.",
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["progress_pct"] > task["progress_pct"]
    assert "1 completed work item(s)" in result["explanation"]


def test_daily_update_progress_sets_explicitly_completed_work_to_100(
    client,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": (
                "Work is completed from my end, waiting for update."
            ),
        },
    )

    assert response.status_code == 200
    assert response.json()["progress_pct"] == 100
    assert "work is complete" in response.json()["explanation"]


def test_full_completion_phrases_set_progress_to_100(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_session.get(Task, task["id"]).progress_pct = 13
    db_session.commit()
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    for update_notes in (
        "The task is fully completed.",
        "I have completed the whole task.",
        "Everything completed from my end.",
        "Completed from my end, waiting for the update.",
        "Completed.",
    ):
        response = client.post(
            "/api/v1/daily-updates/analyze-progress",
            headers=_auth(employee_token),
            json={
                "task_id": task["id"],
                "update_notes": update_notes,
            },
        )

        assert response.status_code == 200
        assert response.json()["progress_pct"] == 100, update_notes


def test_completing_one_deliverable_does_not_mark_entire_task_complete(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_task = db_session.get(Task, task["id"])
    db_task.progress_pct = 13
    db_task.description = (
        "Complete database setup and authentication implementation."
    )
    db_session.commit()
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed the database setup.",
        },
    )

    assert response.status_code == 200
    assert 13 < response.json()["progress_pct"] < 100


def test_daily_update_progress_builds_on_last_submitted_estimate(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_task = db_session.get(Task, task["id"])
    db_task.progress_pct = 10
    db_task.description = (
        "Set up the database schema and implement authentication."
    )
    db_session.commit()
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    first_estimate_response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed the database schema setup.",
        },
    )
    assert first_estimate_response.status_code == 200
    first_estimate = first_estimate_response.json()["progress_pct"]
    assert first_estimate > 10

    submit_response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "progress_pct": first_estimate,
            "update_notes": "Completed the database schema setup.",
        },
    )
    assert submit_response.status_code == 201
    db_session.refresh(db_task)
    assert db_task.progress_pct == first_estimate

    second_estimate_response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Implemented authentication.",
        },
    )

    assert second_estimate_response.status_code == 200
    second_estimate = second_estimate_response.json()["progress_pct"]
    assert second_estimate > first_estimate
    assert f"from {first_estimate}%" in (
        second_estimate_response.json()["explanation"]
    )

    second_submission = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "progress_pct": second_estimate,
            "update_notes": "Implemented authentication.",
        },
    )
    assert second_submission.status_code == 201
    db_session.refresh(db_task)
    assert db_task.progress_pct == second_estimate

    lower_submission = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "progress_pct": first_estimate,
            "update_notes": "No additional work reported.",
        },
    )
    assert lower_submission.status_code == 201
    assert lower_submission.json()["progress_pct"] == second_estimate
    db_session.refresh(db_task)
    assert db_task.progress_pct == second_estimate


def test_ai_estimate_never_reduces_saved_progress(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_task = db_session.get(Task, task["id"])
    db_task.progress_pct = 10
    db_task.description = "Implement backend authentication."
    db_session.commit()

    monkeypatch.setattr(
        progress_estimator,
        "resolve_config",
        lambda: SimpleNamespace(provider="test"),
    )
    monkeypatch.setattr(
        progress_estimator,
        "call_json_model",
        lambda *_args, **_kwargs: SimpleNamespace(
            content={"progress_pct": 0, "explanation": "No change."},
            provider="test",
            model="test-model",
            latency_ms=1,
        ),
    )

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Reviewed the existing authentication work.",
        },
    )

    assert response.status_code == 200
    assert response.json()["progress_pct"] >= 10


def test_ai_estimate_receives_saved_progress_as_new_update_baseline(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task_response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert task_response.status_code == 200
    task = task_response.json()[0]
    db_task = db_session.get(Task, task["id"])
    db_task.progress_pct = 10
    db_session.commit()

    def fake_model(_system_prompt, user_prompt):
        assert "Current completion: 10%" in user_prompt
        return SimpleNamespace(
            content={
                "progress_pct": 15,
                "explanation": "The new update adds five points of work.",
            },
            provider="test",
            model="test-model",
            latency_ms=1,
        )

    monkeypatch.setattr(
        progress_estimator,
        "resolve_config",
        lambda: SimpleNamespace(provider="test"),
    )
    monkeypatch.setattr(progress_estimator, "call_json_model", fake_model)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Finished the next backend milestone.",
        },
    )

    assert response.status_code == 200
    assert response.json()["progress_pct"] == 15


def test_daily_update_progress_analysis_only_allows_assignee(
    client,
    employee_token,
):
    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": 1,
            "update_notes": "I completed the assigned implementation work.",
        },
    )

    assert response.status_code == 403


def test_daily_update_progress_is_reflected_in_project_progress(
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
            "progress_pct": 83,
            "update_notes": "Progress updated for project rollup test.",
        },
    )
    assert update_response.status_code == 201

    tasks_response = client.get(
        "/api/v1/tasks?project_id=1",
        headers=_auth(manager_token),
    )
    assert tasks_response.status_code == 200
    tasks = tasks_response.json()
    expected_progress = round(
        sum(item["progress_pct"] for item in tasks) / len(tasks)
    )

    project_response = client.get(
        "/api/v1/projects/1",
        headers=_auth(manager_token),
    )
    assert project_response.status_code == 200
    assert project_response.json()["completion_percentage"] == expected_progress
