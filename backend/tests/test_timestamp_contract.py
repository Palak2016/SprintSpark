from datetime import datetime, timedelta, timezone

from app.models.audit import AuditEvent
from app.models.notification import Notification
from app.schemas.audit import AuditEventOut, NotificationOut


def test_database_timestamp_defaults_and_api_outputs_are_utc(db_session):
    before = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=2)
    notification = Notification(
        user_id=1,
        title="Timestamp contract test",
        message="Checking database-generated time",
    )
    audit_event = AuditEvent(
        project_id=1,
        event_type="TIMESTAMP_CONTRACT_TEST",
        description="Checking database-generated time",
    )

    db_session.add_all([notification, audit_event])
    db_session.commit()
    db_session.refresh(notification)
    db_session.refresh(audit_event)
    after = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=2)

    for schema in (
        NotificationOut.model_validate(notification),
        AuditEventOut.model_validate(audit_event),
    ):
        assert before <= schema.created_at.replace(tzinfo=None) <= after
        assert schema.created_at.utcoffset() == timedelta(0)
        assert schema.model_dump(mode="json")["created_at"].endswith("+00:00")


def test_api_timestamp_schema_normalizes_explicit_offsets_to_utc():
    source = datetime(
        2026,
        10,
        17,
        18,
        27,
        tzinfo=timezone(timedelta(hours=5, minutes=30)),
    )
    schema = NotificationOut(
        id=1,
        user_id=1,
        type="system",
        title="Offset test",
        message="Explicit offset",
        is_read=False,
        created_at=source,
    )

    assert schema.created_at.isoformat() == "2026-10-17T12:57:00+00:00"


def test_notification_and_activity_endpoints_return_explicit_utc(
    client,
    db_session,
    manager_token,
):
    notification = Notification(
        user_id=1,
        title="Timestamp API test",
        message="Checking notification serialization",
    )
    audit_event = AuditEvent(
        project_id=1,
        event_type="TIMESTAMP_API_TEST",
        description="Checking activity serialization",
    )
    db_session.add_all([notification, audit_event])
    db_session.commit()

    headers = {"Authorization": f"Bearer {manager_token}"}
    notification_response = client.get(
        "/api/v1/notifications",
        headers=headers,
    )
    audit_response = client.get(
        "/api/v1/projects/1/audit-trail",
        headers=headers,
    )

    assert notification_response.status_code == 200
    assert audit_response.status_code == 200
    notification_json = next(
        item
        for item in notification_response.json()
        if item["title"] == "Timestamp API test"
    )
    audit_json = next(
        item
        for item in audit_response.json()
        if item["description"] == "Checking activity serialization"
    )
    assert notification_json["created_at"].endswith("+00:00")
    assert audit_json["created_at"].endswith("+00:00")
