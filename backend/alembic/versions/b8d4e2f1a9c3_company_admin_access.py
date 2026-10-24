"""add company-level admin, invitation, ownership-transfer and audit tables

Additive only: creates four new tables and their indexes. No existing
table, column or row is modified, and no administrator is assigned to any
existing company (use ``python -m scripts.company_admins`` for that, after
review).

Each step checks whether the object already exists, because the API's
startup ``create_all`` may have created the tables before this migration ran.

Revision ID: b8d4e2f1a9c3
Revises: f7a4c2d19b61
Create Date: 2026-10-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8d4e2f1a9c3"
down_revision: Union[str, Sequence[str], None] = "f7a4c2d19b61"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_TABLES = (
    "company_audit_events",
    "company_invitations",
    "company_admin_transfers",
    "company_admins",
)


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _index_names(table: str) -> set:
    return {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(table)}


def _create_index(name, table, columns, unique=False, where=None):
    if name in _index_names(table):
        return
    kwargs = {}
    if where is not None:
        kwargs["sqlite_where"] = sa.text(where)
        kwargs["postgresql_where"] = sa.text(where)
    op.create_index(name, table, columns, unique=unique, **kwargs)


def upgrade() -> None:
    if not _has_table("company_admins"):
        op.create_table(
            "company_admins",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "company_id",
                sa.Integer(),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("grant_reason", sa.String(length=50), nullable=False),
            sa.Column(
                "granted_by",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column(
                "revoked_by",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("revoke_reason", sa.String(length=255), nullable=True),
        )
    _create_index("ix_company_admins_id", "company_admins", ["id"])
    _create_index("ix_company_admins_company_id", "company_admins", ["company_id"])
    _create_index("ix_company_admins_user_id", "company_admins", ["user_id"])
    _create_index(
        "uq_company_admins_one_active",
        "company_admins",
        ["company_id"],
        unique=True,
        where="status = 'ACTIVE'",
    )

    if not _has_table("company_admin_transfers"):
        op.create_table(
            "company_admin_transfers",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "company_id",
                sa.Integer(),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "from_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "to_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("decided_at", sa.DateTime(), nullable=True),
        )
    _create_index("ix_company_admin_transfers_id", "company_admin_transfers", ["id"])
    _create_index(
        "ix_company_admin_transfers_company_id",
        "company_admin_transfers",
        ["company_id"],
    )
    _create_index(
        "uq_company_admin_transfers_one_pending",
        "company_admin_transfers",
        ["company_id"],
        unique=True,
        where="status = 'PENDING'",
    )

    if not _has_table("company_invitations"):
        op.create_table(
            "company_invitations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "company_id",
                sa.Integer(),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("intended_role", sa.String(length=20), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column(
                "invited_by",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
            sa.Column(
                "accepted_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column(
                "revoked_by",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
    _create_index("ix_company_invitations_id", "company_invitations", ["id"])
    _create_index(
        "ix_company_invitations_company_id", "company_invitations", ["company_id"]
    )
    _create_index("ix_company_invitations_email", "company_invitations", ["email"])
    _create_index(
        "ix_company_invitations_token_hash",
        "company_invitations",
        ["token_hash"],
        unique=True,
    )
    _create_index(
        "uq_company_invitations_one_pending_email",
        "company_invitations",
        ["company_id", "email"],
        unique=True,
        where="status = 'PENDING'",
    )

    if not _has_table("company_audit_events"):
        op.create_table(
            "company_audit_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "company_id",
                sa.Integer(),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "actor_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("event_type", sa.String(length=100), nullable=False),
            sa.Column("metadata_json", sa.JSON(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
    _create_index("ix_company_audit_events_id", "company_audit_events", ["id"])
    _create_index(
        "ix_company_audit_events_company_id", "company_audit_events", ["company_id"]
    )
    _create_index(
        "ix_company_audit_events_event_type", "company_audit_events", ["event_type"]
    )


def downgrade() -> None:
    # Drops only the tables this revision added. Existing companies, users,
    # projects and all other business data are untouched.
    for table in NEW_TABLES:
        if _has_table(table):
            op.drop_table(table)
