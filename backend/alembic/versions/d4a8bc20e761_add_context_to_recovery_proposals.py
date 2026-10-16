"""add Focus Guardian context to recovery proposals

Revision ID: d4a8bc20e761
Revises: c1f1f3a9d204
Create Date: 2026-10-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4a8bc20e761"
down_revision: Union[str, Sequence[str], None] = "c1f1f3a9d204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recovery_proposals",
        sa.Column(
            "focus_contexts",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("recovery_proposals", "focus_contexts")
