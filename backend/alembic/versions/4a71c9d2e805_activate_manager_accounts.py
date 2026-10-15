"""activate manager accounts without admin approval

Revision ID: 4a71c9d2e805
Revises: 3d91bc2f6a40
Create Date: 2026-10-15
"""
from typing import Sequence, Union

from alembic import op


revision: str = "4a71c9d2e805"
down_revision: Union[str, Sequence[str], None] = "3d91bc2f6a40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET approval_status = 'APPROVED' WHERE role = 'MANAGER'"
    )


def downgrade() -> None:
    pass
