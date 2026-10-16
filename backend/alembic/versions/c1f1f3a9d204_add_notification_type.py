"""add notification type

Revision ID: c1f1f3a9d204
Revises: 8b6e2a91c4f0
Create Date: 2026-10-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1f1f3a9d204"
down_revision: Union[str, Sequence[str], None] = "8b6e2a91c4f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column(
            "type",
            sa.String(length=100),
            nullable=False,
            server_default="GENERAL",
        ),
    )


def downgrade() -> None:
    op.drop_column("notifications", "type")
