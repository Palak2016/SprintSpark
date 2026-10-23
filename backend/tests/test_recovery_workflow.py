from app.models.recovery import RecoveryProposal, ProposalStatus
from app.models.task import Task, TaskStatus
from app.models.audit import AuditEvent


def test_recovery_proposal_generation(client, manager_token):
    response = client.post("/api/v1/projects/1/recovery-proposals/generate", headers={
        "Authorization": f"Bearer {manager_token}"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING_APPROVAL"
    assert len(data["proposed_actions"]) > 0
    assert "Sprint Recovery" in data["title"]


def test_focus_context_informs_recovery_proposal(
    client,
    employee_token,
    manager_token,
    db_session,
):
    task = db_session.get(Task, 3)
    task.status = TaskStatus.BLOCKED.value
    task.is_blocked = True
    task.progress_pct = 40
    task.blocker_reason = "Awaiting identity provider sandbox access."
    db_session.commit()

    context_response = client.post(
        "/api/v1/focus-guardian/context",
        headers={"Authorization": f"Bearer {employee_token}"},
        json={
            "task_id": 3,
            "reason": "Third-Party API & Library Incompatibilities",
            "context": (
                "The identity provider sandbox returns an unsupported signing "
                "algorithm, so the SSO integration cannot be validated yet."
            ),
        },
    )
    assert context_response.status_code == 201

    contexts_response = client.get(
        "/api/v1/focus-guardian/projects/1/contexts",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert contexts_response.status_code == 200
    contexts = contexts_response.json()
    assert len(contexts) == 1
    assert contexts[0]["task_title"] == "Auth & Enterprise SSO Microservice"
    assert contexts[0]["employee_name"] == "Elena Rostova"

    employee_contexts_response = client.get(
        "/api/v1/focus-guardian/projects/1/contexts",
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert employee_contexts_response.status_code == 403

    proposal_response = client.post(
        "/api/v1/projects/1/recovery-proposals/generate",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert proposal_response.status_code == 200
    proposal = proposal_response.json()

    assert len(proposal["focus_contexts"]) == 1
    assert proposal["focus_contexts"][0]["task_title"] == "Auth & Enterprise SSO Microservice"
    assert proposal["focus_contexts"][0]["employee_name"] == "Elena Rostova"

    blocker_action = next(
        action
        for action in proposal["proposed_actions"]
        if action["task_id"] == 3
    )
    assert blocker_action["action_type"] == "ESCALATE_BLOCKER"
    assert blocker_action["proposed_values"]["is_blocked"] is True
    assert "unsupported signing algorithm" in blocker_action["reason"]


def test_manager_approves_recovery_proposal(client, manager_token, db_session):
    # Find the seeded pending proposal
    proposal = db_session.query(RecoveryProposal).filter(
        RecoveryProposal.status == ProposalStatus.PENDING_APPROVAL.value
    ).first()
    assert proposal is not None

    # Manager approves proposal
    response = client.post(f"/api/v1/recovery-proposals/{proposal.id}/decide", headers={
        "Authorization": f"Bearer {manager_token}"
    }, json={
        "decision": "APPROVED",
        "decision_notes": "Approved for immediate sprint realignment."
    })
    assert response.status_code == 200
    dec = response.json()
    assert dec["decision"] == "APPROVED"
    assert len(dec["applied_changes"]) > 0

    # Verify proposal status transitioned to APPROVED
    db_session.refresh(proposal)
    assert proposal.status == ProposalStatus.APPROVED.value

    # Verify audit event was logged
    audit = db_session.query(AuditEvent).filter(
        AuditEvent.event_type == "RECOVERY_PROPOSAL_APPROVED"
    ).first()
    assert audit is not None
    assert "approved recovery proposal" in audit.description
