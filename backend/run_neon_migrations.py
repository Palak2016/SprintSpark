import os
from getpass import getpass

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# Collect Neon credentials without saving them in this script.
host = input("Neon host: ").strip()
database = input("Database name: ").strip()
username = input("Database username: ").strip()
password = getpass("Neon database password: ")

url = URL.create(
    "postgresql+psycopg",
    username=username,
    password=password,
    host=host,
    port=5432,
    database=database,
    query={"sslmode": "require"},
)

# Override DATABASE_URL only for this Python process.
os.environ["DATABASE_URL"] = url.render_as_string(
    hide_password=False
)

# Confirm the target before applying migrations.
engine = create_engine(url, pool_pre_ping=True)
try:
    with engine.connect() as conn:
        db_name = conn.execute(
            text("SELECT current_database()")
        ).scalar_one()
        role = conn.execute(
            text("SELECT current_user")
        ).scalar_one()

        print(f"\nTarget database: {db_name}")
        print(f"Connected role: {role}")

        if db_name != "neondb":
            raise RuntimeError(
                "Unexpected database. Migrations cancelled."
            )
finally:
    engine.dispose()

confirm = input(
    "\nType MIGRATE to create/update the schema in Neon: "
).strip()

if confirm != "MIGRATE":
    print("Cancelled. No migrations were run.")
    raise SystemExit(0)

from alembic.config import Config
from alembic import command

config = Config("alembic.ini")
command.upgrade(config, "head")

print("\nNeon schema migration completed.")