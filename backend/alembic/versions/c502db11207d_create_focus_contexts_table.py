"""create focus contexts table

Revision ID: c502db11207d
Revises: d4a8bc20e761
Create Date: 2026-10-17 16:25:43.234950

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c502db11207d'
down_revision: Union[str, Sequence[str], None] = 'd4a8bc20e761'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the focus_contexts table."""
    op.create_table(
        "focus_contexts",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=150), nullable=False),
        sa.Column("context", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
    )


def downgrade() -> None:
    """Drop the focus_contexts table."""
    op.drop_table("focus_contexts")
