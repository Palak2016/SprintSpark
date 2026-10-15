"""add manager approval fields

Revision ID: 3d91bc2f6a40
Revises: 7c2a4d91e6b3
Create Date: 2026-10-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3d91bc2f6a40"
down_revision: Union[str, Sequence[str], None] = "7c2a4d91e6b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("company_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("designation", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "approval_status",
            sa.String(length=50),
            server_default="APPROVED",
            nullable=False,
        ),
    )
    op.add_column("users", sa.Column("approval_reviewed_by", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("approval_reviewed_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("approval_notes", sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "approval_notes")
    op.drop_column("users", "approval_reviewed_at")
    op.drop_column("users", "approval_reviewed_by")
    op.drop_column("users", "approval_status")
    op.drop_column("users", "designation")
    op.drop_column("users", "company_name")
