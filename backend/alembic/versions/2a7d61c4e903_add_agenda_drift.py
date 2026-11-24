"""add agenda drift analyses

Revision ID: 2a7d61c4e903
Revises: a6e2c8f41d07
Create Date: 2026-11-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2a7d61c4e903"
down_revision: Union[str, Sequence[str], None] = "a6e2c8f41d07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if not inspector.has_table("agenda_drifts"):
        op.create_table(
            "agenda_drifts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("employee_id", sa.Integer(), nullable=False),
            sa.Column("task_id", sa.Integer(), nullable=False),
            sa.Column("daily_update_id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("recovery_proposal_id", sa.Integer(), nullable=True),
            sa.Column("alignment_status", sa.String(length=32), nullable=False),
            sa.Column("alignment_score", sa.Integer(), nullable=False),
            sa.Column("confidence_score", sa.Integer(), nullable=False),
            sa.Column("drift_explanation", sa.Text(), nullable=False),
            sa.Column("detected_mismatches", sa.JSON(), nullable=False),
            sa.Column("recommended_actions", sa.JSON(), nullable=False),
            sa.Column("reported_blockers", sa.Text(), nullable=True),
            sa.Column("employee_clarification", sa.Text(), nullable=True),
            sa.Column("manager_review_status", sa.String(length=32), nullable=False),
            sa.Column("manager_feedback", sa.Text(), nullable=True),
            sa.Column("analysis_details", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["employee_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["daily_update_id"], ["daily_updates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["recovery_proposal_id"], ["recovery_proposals.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("daily_update_id", name="uq_agenda_drift_daily_update"),
        )

    indexes = {
        "ix_agenda_drifts_id": ["id"],
        "ix_agenda_drifts_employee_id": ["employee_id"],
        "ix_agenda_drifts_task_id": ["task_id"],
        "ix_agenda_drifts_project_id": ["project_id"],
        "ix_agenda_drifts_alignment_status": ["alignment_status"],
        "ix_agenda_drifts_manager_review_status": ["manager_review_status"],
    }
    existing_indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("agenda_drifts")}
    for name, columns in indexes.items():
        if name not in existing_indexes:
            op.create_index(name, "agenda_drifts", columns)


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("agenda_drifts"):
        op.drop_table("agenda_drifts")
