"""add email verification codes

Revision ID: 8b6e2a91c4f0
Revises: 4a71c9d2e805
Create Date: 2026-10-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8b6e2a91c4f0"
down_revision: Union[str, Sequence[str], None] = "4a71c9d2e805"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "email_verifications" not in inspector.get_table_names():
        op.create_table(
            "email_verifications",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("code_hash", sa.String(length=64), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("last_sent_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    index_names = {
        index["name"] for index in sa.inspect(bind).get_indexes("email_verifications")
    }
    email_index = op.f("ix_email_verifications_email")
    if email_index not in index_names:
        op.create_index(email_index, "email_verifications", ["email"], unique=True)
    id_index = op.f("ix_email_verifications_id")
    if id_index not in index_names:
        op.create_index(id_index, "email_verifications", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_email_verifications_id"), table_name="email_verifications")
    op.drop_index(op.f("ix_email_verifications_email"), table_name="email_verifications")
    op.drop_table("email_verifications")
