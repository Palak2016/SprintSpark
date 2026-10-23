from datetime import date, timedelta

from app.models.focus_context import FocusContext
from app.models.project import Project
from app.models.task import Task


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_delete_project_removes_task_focus_contexts(
    client,
    db_session,
    manager_token,
):
    today = date.today()
    project = Project(
        name="Project deletion with focus context",
        description="Regression test for deleting linked task context.",
        manager_id=1,
        company_id=1,
        status="ACTIVE",
        start_date=today,
        target_end_date=today + timedelta(days=7),
    )
    db_session.add(project)
    db_session.flush()

    task = Task(
        project_id=project.id,
        title="Task with focus context",
        assignee_id=2,
        priority="MEDIUM",
        status="TODO",
        estimated_hours=4,
        actual_hours=0,
        progress_pct=0,
        start_date=today,
        due_date=today + timedelta(days=3),
        is_blocked=False,
    )
    db_session.add(task)
    db_session.flush()

    context = FocusContext(
        user_id=2,
        task_id=task.id,
        reason="Dependency delay",
        context="Waiting for access required to continue.",
    )
    db_session.add(context)
    db_session.commit()
    project_id = project.id
    task_id = task.id
    context_id = context.id

    response = client.delete(
        f"/api/v1/projects/{project_id}",
        headers=_auth(manager_token),
    )

    assert response.status_code == 204
    assert db_session.get(Project, project_id) is None
    assert db_session.get(Task, task_id) is None
    assert db_session.get(FocusContext, context_id) is None
