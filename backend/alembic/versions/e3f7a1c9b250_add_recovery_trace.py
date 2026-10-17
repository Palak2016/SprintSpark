"""add recovery generation trace and execution report

Revision ID: e3f7a1c9b250
Revises: c502db11207d
Create Date: 2026-10-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3f7a1c9b250"
down_revision: Union[str, Sequence[str], None] = "c502db11207d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recovery_proposals",
        sa.Column(
            "generation_trace",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "proposal_decisions",
        sa.Column(
            "execution_report",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("proposal_decisions", "execution_report")
    op.drop_column("recovery_proposals", "generation_trace")
