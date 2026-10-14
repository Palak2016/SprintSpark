from app.models.recovery import RecoveryProposal, ProposalStatus
from app.models.task import Task
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
