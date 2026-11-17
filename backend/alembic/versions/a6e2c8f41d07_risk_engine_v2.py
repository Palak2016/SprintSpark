"""risk engine v2: reproducible, explainable risk history and update signals

Additive only: new nullable/defaulted columns on risk_analyses and tasks, and
two new tables. Existing rows are kept; blocked tasks get blocked_since
backfilled from their last update.

Each step checks whether the object already exists, because the API's
startup ``create_all`` may have created the tables or columns before this
migration ran.

Revision ID: a6e2c8f41d07
Revises: b8d4e2f1a9c3
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6e2c8f41d07"
down_revision: Union[str, Sequence[str], None] = "b8d4e2f1a9c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(name: str) -> bool:
    return _inspector().has_table(name)


def _columns(table: str) -> set:
    return {c["name"] for c in _inspector().get_columns(table)}


def _index_names(table: str) -> set:
    return {ix["name"] for ix in _inspector().get_indexes(table)}


def _fk_names(table: str) -> set:
    return {fk.get("name") for fk in _inspector().get_foreign_keys(table) if fk.get("name")}


def _create_index(name: str, table: str, columns) -> None:
    if name not in _index_names(table):
        op.create_index(name, table, columns)


RISK_ANALYSIS_COLUMNS = (
    ("engine_version", lambda: sa.Column("engine_version", sa.String(20), nullable=True)),
    ("config_version", lambda: sa.Column("config_version", sa.String(100), nullable=True)),
    ("as_of_date", lambda: sa.Column("as_of_date", sa.Date(), nullable=True)),
    ("input_hash", lambda: sa.Column("input_hash", sa.String(64), nullable=True)),
    ("factor_breakdown", lambda: sa.Column("factor_breakdown", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))),
    ("confidence", lambda: sa.Column("confidence", sa.JSON(), nullable=False, server_default=sa.text("'{}'"))),
    ("trigger_type", lambda: sa.Column("trigger_type", sa.String(50), nullable=True)),
    ("trigger_ref_id", lambda: sa.Column("trigger_ref_id", sa.Integer(), nullable=True)),
    ("triggered_by_id", lambda: sa.Column("triggered_by_id", sa.Integer(), nullable=True)),
    ("previous_analysis_id", lambda: sa.Column("previous_analysis_id", sa.Integer(), nullable=True)),
    ("score_delta", lambda: sa.Column("score_delta", sa.Float(), nullable=True)),
    ("change_explanation", lambda: sa.Column("change_explanation", sa.JSON(), nullable=False, server_default=sa.text("'{}'"))),
)


def upgrade() -> None:
    # --- risk_analyses: history columns -------------------------------------
    existing = _columns("risk_analyses")
    missing = [(name, make) for name, make in RISK_ANALYSIS_COLUMNS if name not in existing]
    if missing:
        added = {name for name, _ in missing}
        with op.batch_alter_table("risk_analyses") as batch:
            for _, make in missing:
                batch.add_column(make())
            # Foreign keys only for columns this migration added; create_all
            # already defines them for columns it created.
            if "triggered_by_id" in added:
                batch.create_foreign_key(
                    "fk_risk_analyses_triggered_by", "users",
                    ["triggered_by_id"], ["id"], ondelete="SET NULL",
                )
            if "previous_analysis_id" in added:
                batch.create_foreign_key(
                    "fk_risk_analyses_previous", "risk_analyses",
                    ["previous_analysis_id"], ["id"], ondelete="SET NULL",
                )
    _create_index("ix_risk_analyses_input_hash", "risk_analyses", ["input_hash"])

    # --- tasks.blocked_since --------------------------------------------------
    if "blocked_since" not in _columns("tasks"):
        with op.batch_alter_table("tasks") as batch:
            batch.add_column(sa.Column("blocked_since", sa.Date(), nullable=True))
    # Tasks already blocked: best available start date is their last update.
    day_expr = "date(updated_at)" if op.get_bind().dialect.name == "sqlite" else "CAST(updated_at AS DATE)"
    op.execute(sa.text(
        f"UPDATE tasks SET blocked_since = {day_expr} "
        "WHERE blocked_since IS NULL AND (is_blocked = :yes OR status = 'BLOCKED')"
    ).bindparams(yes=True))

    # --- risk_configs -----------------------------------------------------------
    if not _has_table("risk_configs"):
        op.create_table(
            "risk_configs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
            sa.Column("weights", sa.JSON(), nullable=False),
            sa.Column("thresholds", sa.JSON(), nullable=False),
            sa.Column("params", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    for column in ("id", "company_id", "project_id"):
        _create_index(f"ix_risk_configs_{column}", "risk_configs", [column])

    # --- daily_update_signals -------------------------------------------------
    if not _has_table("daily_update_signals"):
        op.create_table(
            "daily_update_signals",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("daily_update_id", sa.Integer(), sa.ForeignKey("daily_updates.id", ondelete="CASCADE"), nullable=False),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("kind", sa.String(30), nullable=False),
            sa.Column("related_task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
            sa.Column("effort_share", sa.Float(), nullable=True),
            sa.Column("evidence", sa.Text(), nullable=False),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("update_date", sa.Date(), nullable=False),
            sa.Column("model", sa.String(100), nullable=True),
            sa.Column("prompt_version", sa.String(20), nullable=True),
            sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    for column in ("id", "daily_update_id", "project_id", "task_id", "user_id", "status", "update_date"):
        _create_index(f"ix_daily_update_signals_{column}", "daily_update_signals", [column])


def downgrade() -> None:
    if _has_table("daily_update_signals"):
        op.drop_table("daily_update_signals")
    if _has_table("risk_configs"):
        op.drop_table("risk_configs")
    if "blocked_since" in _columns("tasks"):
        with op.batch_alter_table("tasks") as batch:
            batch.drop_column("blocked_since")

    existing = _columns("risk_analyses")
    to_drop = [name for name, _ in reversed(RISK_ANALYSIS_COLUMNS) if name in existing]
    if "ix_risk_analyses_input_hash" in _index_names("risk_analyses"):
        op.drop_index("ix_risk_analyses_input_hash", table_name="risk_analyses")
    if to_drop:
        fks = _fk_names("risk_analyses")
        with op.batch_alter_table("risk_analyses") as batch:
            for fk in ("fk_risk_analyses_previous", "fk_risk_analyses_triggered_by"):
                if fk in fks:
                    batch.drop_constraint(fk, type_="foreignkey")
            for name in to_drop:
                batch.drop_column(name)
