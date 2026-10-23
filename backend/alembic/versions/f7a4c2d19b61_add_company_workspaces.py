"""add company workspaces and company-scoped records

Revision ID: f7a4c2d19b61
Revises: e3f7a1c9b250
Create Date: 2026-10-23
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "f7a4c2d19b61"
down_revision: Union[str, Sequence[str], None] = "e3f7a1c9b250"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if not inspector.has_table("companies"):
        op.create_table(
            "companies",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("join_code", sa.String(length=16), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.UniqueConstraint("join_code", name="uq_companies_join_code"),
        )
        inspector = sa.inspect(connection)

    for table_name in ("users", "projects"):
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        foreign_keys = inspector.get_foreign_keys(table_name)
        has_company_fk = any(
            foreign_key["constrained_columns"] == ["company_id"]
            and foreign_key["referred_table"] == "companies"
            for foreign_key in foreign_keys
        )
        if "company_id" not in columns or not has_company_fk:
            with op.batch_alter_table(table_name) as batch_op:
                if "company_id" not in columns:
                    batch_op.add_column(
                        sa.Column("company_id", sa.Integer(), nullable=True)
                    )
                if not has_company_fk:
                    batch_op.create_foreign_key(
                        f"fk_{table_name}_company_id_companies",
                        "companies",
                        ["company_id"],
                        ["id"],
                        ondelete="SET NULL",
                    )
            inspector = sa.inspect(connection)

    for table_name in ("companies", "users", "projects"):
        indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        index_name = f"ix_{table_name}_id"
        if index_name not in indexes:
            op.create_index(index_name, table_name, ["id"])
        inspector = sa.inspect(connection)
    for table_name in ("users", "projects"):
        indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        index_name = f"ix_{table_name}_company_id"
        if index_name not in indexes:
            op.create_index(index_name, table_name, ["company_id"])
        inspector = sa.inspect(connection)
    company_indexes = {
        index["name"]: index for index in inspector.get_indexes("companies")
    }
    if "ix_companies_join_code" not in company_indexes:
        op.create_index(
            "ix_companies_join_code",
            "companies",
            ["join_code"],
            unique=True,
        )

    companies = sa.table(
        "companies",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("join_code", sa.String()),
        sa.column("created_at", sa.DateTime()),
    )
    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("role", sa.String()),
        sa.column("company_name", sa.String()),
        sa.column("company_id", sa.Integer()),
    )
    projects = sa.table(
        "projects",
        sa.column("id", sa.Integer()),
        sa.column("manager_id", sa.Integer()),
        sa.column("company_id", sa.Integer()),
    )
    project_members = sa.table(
        "project_members",
        sa.column("user_id", sa.Integer()),
        sa.column("project_id", sa.Integer()),
    )
    manager_rows = connection.execute(
        sa.select(users.c.id, users.c.company_name).where(
            users.c.role == "MANAGER"
        )
    ).all()
    company_ids_by_name = {}
    for manager_id, existing_name in manager_rows:
        name = existing_name.strip() if existing_name else ""
        if name and name in company_ids_by_name:
            company_id = company_ids_by_name[name]
        else:
            name = name or f"Company {manager_id}"
            join_code = uuid4().hex[:8].upper()
            connection.execute(
                companies.insert().values(
                    name=name,
                    join_code=join_code,
                    created_at=sa.func.now(),
                )
            )
            company_id = connection.execute(
                sa.select(companies.c.id).where(
                    companies.c.join_code == join_code
                )
            ).scalar_one()
            if existing_name:
                company_ids_by_name[name] = company_id
            else:
                connection.execute(
                    users.update()
                    .where(users.c.id == manager_id)
                    .values(company_name=name)
                )
        connection.execute(
            users.update()
            .where(users.c.id == manager_id)
            .values(company_id=company_id)
        )
        if existing_name:
            connection.execute(
                users.update()
                .where(
                    users.c.role == "EMPLOYEE",
                    users.c.company_name == existing_name,
                )
                .values(company_id=company_id)
            )
    connection.execute(
        projects.update().values(
            company_id=sa.select(users.c.company_id)
            .where(users.c.id == projects.c.manager_id)
            .scalar_subquery()
        )
    )
    membership_rows = connection.execute(
        sa.select(project_members.c.user_id, projects.c.company_id)
        .select_from(
            project_members.join(
                projects, project_members.c.project_id == projects.c.id
            )
        )
        .where(projects.c.company_id.is_not(None))
        .distinct()
    ).all()
    user_companies = {}
    for user_id, company_id in membership_rows:
        user_companies.setdefault(user_id, set()).add(company_id)
    for user_id, company_ids in user_companies.items():
        if len(company_ids) == 1:
            connection.execute(
                users.update()
                .where(users.c.id == user_id, users.c.company_id.is_(None))
                .values(company_id=next(iter(company_ids)))
            )


def downgrade() -> None:
    op.drop_index("ix_projects_company_id", table_name="projects")
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_constraint(
            "fk_projects_company_id_companies", type_="foreignkey"
        )
        batch_op.drop_column("company_id")
    op.drop_index("ix_users_company_id", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint(
            "fk_users_company_id_companies", type_="foreignkey"
        )
        batch_op.drop_column("company_id")
    op.drop_index("ix_companies_join_code", table_name="companies")
    op.drop_index("ix_companies_id", table_name="companies")
    op.drop_table("companies")
