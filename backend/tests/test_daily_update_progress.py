from types import SimpleNamespace

from app.models.task import Task


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _employee_task(client, employee_token):
    response = client.get(
        "/api/v1/tasks?project_id=1&assignee_id=2",
        headers=_auth(employee_token),
    )
    assert response.status_code == 200
    return response.json()[0]


def test_progress_analysis_uses_task_context_and_gemini_estimate(
    client,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task = _employee_task(client, employee_token)

    def fake_model(system_prompt, user_prompt, **_kwargs):
        assert "Task title:" in user_prompt
        assert task["title"] in user_prompt
        assert "completed the API integration" in user_prompt
        return SimpleNamespace(
            content={
                "progress_pct": 38,
                "explanation": "The API integration is complete; remaining work is not reported.",
            },
            provider="gemini",
            model="gpt-test",
            latency_ms=1,
        )

    monkeypatch.setattr(
        progress_estimator,
        "resolve_config",
        lambda: SimpleNamespace(provider="gemini"),
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
    result = response.json()
    assert result["progress_pct"] == max(task["progress_pct"], 38)
    assert result["explanation"] == (
        "AI estimate: The API integration is complete; remaining work is not reported."
    )
    assert result["analysis_token"]


def test_progress_estimator_uses_gemini_model(
    monkeypatch,
):
    from app.services import progress_estimator

    config = SimpleNamespace(provider="gemini", model="gemini-test")

    def fake_model(_system_prompt, user_prompt, config=None):
        assert "Current completion: 12%" in user_prompt
        assert config.provider == "gemini"
        return SimpleNamespace(
            content={"progress_pct": 36, "explanation": "One milestone is complete."},
            provider="gemini",
            model="gemini-test",
            latency_ms=1,
        )

    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: config)
    monkeypatch.setattr(progress_estimator, "call_json_model", fake_model)

    progress, explanation = progress_estimator.estimate_task_progress(
        SimpleNamespace(
            title="Implement dashboard",
            description="Build the dashboard and reports.",
            progress_pct=12,
            status="IN_PROGRESS",
        ),
        "Completed dashboard filtering.",
    )

    assert progress == 36
    assert explanation == "AI estimate: One milestone is complete."


def test_progress_analysis_accepts_configured_openai_provider(
    client,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    config = SimpleNamespace(provider="openai", model="openai-test")

    def fake_model(_system_prompt, _user_prompt, config=None):
        assert config.provider == "openai"
        return SimpleNamespace(
            content={"progress_pct": 36, "explanation": "The first milestone is complete."},
            provider="openai",
            model="openai-test",
            latency_ms=1,
        )

    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: config)
    monkeypatch.setattr(progress_estimator, "call_json_model", fake_model)
    task = _employee_task(client, employee_token)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed the first API milestone and verified the endpoint.",
        },
    )

    assert response.status_code == 200
    assert response.json()["progress_pct"] >= 36


def test_analyzed_estimate_is_the_value_saved_on_submit(
    client,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs
    from app.services import drift_analysis_service

    task = _employee_task(client, employee_token)
    calls = []

    def fake_estimate(_task, notes):
        calls.append(notes)
        return 74, "AI estimate: the reported work covers most requirements."

    monkeypatch.setattr(work_logs, "estimate_task_progress", fake_estimate)
    monkeypatch.setattr(drift_analysis_service, "resolve_config", lambda: None)
    notes = "Completed the task's main workflow and verified it."
    analysis = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={"task_id": task["id"], "update_notes": notes},
    )
    assert analysis.status_code == 200
    estimate = analysis.json()

    submission = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "analysis_token": estimate["analysis_token"],
            "update_notes": notes,
        },
    )

    assert submission.status_code == 201
    assert submission.json()["progress_pct"] == estimate["progress_pct"] == 74
    assert submission.json()["agenda_drift"]["alignment_status"] == "NEEDS_CLARIFICATION"
    assert submission.json()["agenda_drift"]["confidence_score"] < 60
    assert calls == [notes]

    history = client.get(
        "/api/v1/agenda-drift/my-drift",
        headers=_auth(employee_token),
    )
    assert history.status_code == 200
    assert any(
        record["daily_update_id"] == submission.json()["id"]
        for record in history.json()
    )


def test_daily_update_is_saved_if_agenda_analysis_persistence_fails(
    client,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs
    from sqlalchemy.exc import SQLAlchemyError

    task = _employee_task(client, employee_token)
    monkeypatch.setattr(
        work_logs,
        "estimate_task_progress",
        lambda _task, _notes: (42, "AI estimate: progress is underway."),
    )

    def fail_agenda_persistence(*_args, **_kwargs):
        raise SQLAlchemyError("agenda persistence unavailable")

    monkeypatch.setattr(
        work_logs,
        "analyze_and_persist_daily_update",
        fail_agenda_persistence,
    )
    response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed the first implementation milestone.",
        },
    )

    assert response.status_code == 201
    result = response.json()
    assert result["agenda_drift"] is None
    assert "daily update was saved" in result["agenda_drift_note"].lower()
    history = client.get(
        "/api/v1/daily-updates?user_id=2",
        headers=_auth(employee_token),
    )
    assert history.status_code == 200
    assert any(update["id"] == result["id"] for update in history.json())


def test_analyzed_estimate_rejects_changed_notes(
    client,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs

    task = _employee_task(client, employee_token)
    monkeypatch.setattr(
        work_logs,
        "estimate_task_progress",
        lambda _task, _notes: (58, "AI estimate: partial completion."),
    )
    analysis = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed database schema and tests.",
        },
    )
    assert analysis.status_code == 200

    submission = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "analysis_token": analysis.json()["analysis_token"],
            "update_notes": "Completed database schema and tests plus deployment.",
        },
    )

    assert submission.status_code == 409
    assert "Analyze the update again" in submission.json()["detail"]


def test_full_task_completion_language_can_set_progress_to_100(
    client,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs
    from app.services import progress_estimator

    task = _employee_task(client, employee_token)

    def completion_estimate(_task, notes):
        assert notes == "Completed this task."
        return 100, "AI estimate: the update states the entire assigned task is complete."

    monkeypatch.setattr(work_logs, "estimate_task_progress", completion_estimate)
    notes = "Completed this task."
    analysis = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={"task_id": task["id"], "update_notes": notes},
    )

    assert analysis.status_code == 200
    assert analysis.json()["progress_pct"] == 100
    assert "completed this task" in progress_estimator.SYSTEM_PROMPT.lower()

    submission = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "analysis_token": analysis.json()["analysis_token"],
            "update_notes": notes,
        },
    )

    assert submission.status_code == 201
    assert submission.json()["progress_pct"] == 100


def test_progress_analysis_falls_back_to_current_progress_without_ai(
    client,
    employee_token,
    monkeypatch,
):
    from app.services import progress_estimator

    task = _employee_task(client, employee_token)
    monkeypatch.setattr(progress_estimator, "resolve_config", lambda: None)

    response = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed implementation of the assigned API endpoint.",
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["ai_available"] is False
    assert result["progress_pct"] == task["progress_pct"]
    assert result["analysis_token"]
    assert "You can still submit" in result["explanation"]


def test_gemini_503_still_allows_daily_update_and_agenda_record(
    client,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs
    from app.services import drift_analysis_service
    from app.services.llm_client import LLMError

    task = _employee_task(client, employee_token)

    def unavailable_estimate(*_args, **_kwargs):
        raise LLMError("HTTP_ERROR", "Gemini returned HTTP 503.")

    monkeypatch.setattr(
        work_logs,
        "estimate_task_progress",
        unavailable_estimate,
    )
    monkeypatch.setattr(drift_analysis_service, "resolve_config", lambda: None)
    notes = "Implemented the first backend endpoint and tested its validation."
    requested_progress = min(100, task["progress_pct"] + 10)

    analysis = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={"task_id": task["id"], "update_notes": notes},
    )
    assert analysis.status_code == 200
    assert analysis.json()["ai_available"] is False
    manual = client.post(
        "/api/v1/daily-updates/analyze-progress",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": notes,
            "manual_progress_pct": requested_progress,
        },
    )
    assert manual.status_code == 200
    assert manual.json()["progress_pct"] == requested_progress
    assert manual.json()["ai_available"] is False
    assert f"Manual progress set to {requested_progress}%" in manual.json()["explanation"]

    submission = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "analysis_token": manual.json()["analysis_token"],
            "update_notes": notes,
        },
    )
    assert submission.status_code == 201
    assert submission.json()["progress_pct"] == requested_progress
    assert submission.json()["agenda_drift"]["alignment_status"] == "NEEDS_CLARIFICATION"

    drift_records = client.get(
        "/api/v1/agenda-drift/my-drift",
        headers=_auth(employee_token),
    )
    assert drift_records.status_code == 200
    assert any(
        record["daily_update_id"] == submission.json()["id"]
        for record in drift_records.json()
    )


def test_daily_update_submission_returns_openai_rate_limit_to_client(
    client,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs
    from app.services.llm_client import LLMError

    task = _employee_task(client, employee_token)

    def rate_limited_estimate(_task, _notes):
        raise LLMError(
            "RATE_LIMITED",
            "OpenAI rate limit reached. Wait briefly before retrying.",
        )

    monkeypatch.setattr(work_logs, "estimate_task_progress", rate_limited_estimate)

    response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed validation for the task acceptance criteria.",
        },
    )

    assert response.status_code == 429
    assert "Wait briefly before retrying" in response.json()["detail"]


def test_daily_update_submission_returns_payment_required_to_client(
    client,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs
    from app.services.llm_client import LLMError

    task = _employee_task(client, employee_token)

    def payment_required_estimate(_task, _notes):
        raise LLMError(
            "PAYMENT_REQUIRED",
            "Wayjet requires an active balance. Add funds and retry.",
        )

    monkeypatch.setattr(
        work_logs,
        "estimate_task_progress",
        payment_required_estimate,
    )

    response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed validation for the task acceptance criteria.",
        },
    )

    assert response.status_code == 402
    assert "Add funds" in response.json()["detail"]


def test_submission_calculates_and_persists_progress_with_ai(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs

    task = _employee_task(client, employee_token)
    db_task = db_session.get(Task, task["id"])
    db_task.progress_pct = 10
    db_session.commit()

    calls = []

    def fake_estimate(task_arg, notes):
        calls.append((task_arg.progress_pct, notes))
        return 42, "AI estimate: the reported deliverables represent 42% completion."

    monkeypatch.setattr(work_logs, "estimate_task_progress", fake_estimate)

    response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "progress_pct": 99,
            "update_notes": "Completed API validation and added integration tests.",
        },
    )

    assert response.status_code == 201
    assert response.json()["progress_pct"] == 42
    assert calls == [
        (10, "Completed API validation and added integration tests.")
    ]
    db_session.refresh(db_task)
    assert db_task.progress_pct == 42


def test_submission_estimate_builds_on_saved_progress(
    client,
    db_session,
    employee_token,
    monkeypatch,
):
    from app.api.v1 import work_logs

    task = _employee_task(client, employee_token)
    db_task = db_session.get(Task, task["id"])
    db_task.progress_pct = 10
    db_session.commit()

    def fake_estimate(task_arg, notes):
        assert task_arg.progress_pct == 10
        assert notes == "Finished the first implementation milestone."
        return 27, "AI estimate: the first milestone is complete."

    monkeypatch.setattr(work_logs, "estimate_task_progress", fake_estimate)

    first = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Finished the first implementation milestone.",
        },
    )
    assert first.status_code == 201
    db_session.refresh(db_task)
    assert db_task.progress_pct == 27

    def lower_estimate(task_arg, _notes):
        assert task_arg.progress_pct == 27
        return 20, "AI estimate: this update adds no verified progress."

    monkeypatch.setattr(work_logs, "estimate_task_progress", lower_estimate)
    second = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Reviewed existing work; no new deliverable completed.",
        },
    )

    assert second.status_code == 201
    assert second.json()["progress_pct"] == 27
    db_session.refresh(db_task)
    assert db_task.progress_pct == 27


def test_project_manager_can_submit_ai_progress_for_project_task(
    client,
    manager_token,
    monkeypatch,
):
    from app.api.v1 import work_logs

    tasks_response = client.get(
        "/api/v1/tasks?project_id=1",
        headers=_auth(manager_token),
    )
    assert tasks_response.status_code == 200
    task = tasks_response.json()[0]
    monkeypatch.setattr(
        work_logs,
        "estimate_task_progress",
        lambda _task, _notes: (31, "AI estimate: work is partially complete."),
    )

    response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(manager_token),
        json={
            "task_id": task["id"],
            "update_notes": "Reviewed and completed the first acceptance criterion.",
        },
    )

    assert response.status_code == 201
    assert response.json()["user_id"] == 1
    assert response.json()["progress_pct"] == max(task["progress_pct"], 31)


def test_employee_cannot_submit_update_for_another_users_task(
    client,
    employee_token,
):
    response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": 1,
            "update_notes": "Completed the assigned implementation work.",
        },
    )

    assert response.status_code == 403


def test_ai_progress_flows_into_project_completion(
    client,
    employee_token,
    manager_token,
    monkeypatch,
):
    from app.api.v1 import work_logs

    task = _employee_task(client, employee_token)
    monkeypatch.setattr(
        work_logs,
        "estimate_task_progress",
        lambda _task, _notes: (83, "AI estimate: the reported work is nearly complete."),
    )

    update_response = client.post(
        "/api/v1/daily-updates",
        headers=_auth(employee_token),
        json={
            "task_id": task["id"],
            "update_notes": "Completed the core work and verified all acceptance tests.",
        },
    )
    assert update_response.status_code == 201
    assert update_response.json()["progress_pct"] == 83

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
