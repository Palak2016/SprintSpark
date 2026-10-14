"""add_user_phone_number

Revision ID: 7c2a4d91e6b3
Revises: 53a635e93534
Create Date: 2026-10-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c2a4d91e6b3"
down_revision: Union[str, Sequence[str], None] = "53a635e93534"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index(op.f("ix_users_phone_number"), "users", ["phone_number"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_phone_number"), table_name="users")
    op.drop_column("users", "phone_number")
