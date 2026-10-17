
from getpass import getpass

from sqlalchemy import create_engine, inspect, MetaData, select, text
from sqlalchemy.engine import URL

from app.core.config import settings


# ---------------------------------------------------------
# 1. Connect to the local PostgreSQL source and Neon target
# ---------------------------------------------------------

source_engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

target_engine = None

try:
    # Refuse to copy from the SQLite backup or wrong database.
    if source_engine.dialect.name != "postgresql":
        raise RuntimeError(
            "Source is not PostgreSQL. Nothing was copied."
        )

    with source_engine.connect() as conn:
        source_db = conn.execute(
            text("SELECT current_database()")
        ).scalar_one()

    print("Local source database:", source_db)

    if source_db != "workpilot":
        raise RuntimeError(
            "Expected local database 'workpilot'. "
            "Nothing was copied."
        )

    host = input("Neon host: ").strip()
    database = input("Neon database name: ").strip()
    username = input("Neon database username: ").strip()
    password = getpass("Neon database password: ")

    target_url = URL.create(
        "postgresql+psycopg",
        username=username,
        password=password,
        host=host,
        port=5432,
        database=database,
        query={"sslmode": "require"},
    )

    target_engine = create_engine(
        target_url,
        pool_pre_ping=True,
    )

    with target_engine.connect() as conn:
        target_db = conn.execute(
            text("SELECT current_database()")
        ).scalar_one()

    print("Hosted target database:", target_db)

    if target_db != "neondb":
        raise RuntimeError(
            "Expected Neon database 'neondb'. "
            "Nothing was copied."
        )

    # -----------------------------------------------------
    # 2. Inspect both schemas
    # -----------------------------------------------------

    source_inspector = inspect(source_engine)
    target_inspector = inspect(target_engine)

    source_names = set(
        source_inspector.get_table_names(schema="public")
    )
    target_names = set(
        target_inspector.get_table_names(schema="public")
    )

    excluded = {"alembic_version"}

    source_app = source_names - excluded
    target_app = target_names - excluded

    if source_app != target_app:
        print("Source-only tables:", sorted(source_app - target_app))
        print("Target-only tables:", sorted(target_app - source_app))
        raise RuntimeError(
            "Table schemas differ. Nothing was copied."
        )

    source_meta = MetaData()
    target_meta = MetaData()

    source_meta.reflect(
        bind=source_engine,
        schema="public",
        only=sorted(source_app),
    )
    target_meta.reflect(
        bind=target_engine,
        schema="public",
        only=sorted(target_app),
    )

    # Ensure every table has the same columns before copying.
    for name in sorted(source_app):
        src = source_meta.tables[f"public.{name}"]
        dst = target_meta.tables[f"public.{name}"]

        if set(src.c.keys()) != set(dst.c.keys()):
            print(f"Column mismatch in table: {name}")
            raise RuntimeError(
                "Column schemas differ. Nothing was copied."
            )

    # -----------------------------------------------------
    # 3. Check destination is empty and read source records
    # -----------------------------------------------------

    with target_engine.connect() as conn:
        existing_counts = {
            name: conn.execute(
                text(f'SELECT COUNT(*) FROM public."{name}"')
            ).scalar_one()
            for name in sorted(target_app)
        }

    if any(existing_counts.values()):
        print("Destination application data already exists:")
        for name, count in existing_counts.items():
            if count:
                print(f"  {name}: {count}")
        raise RuntimeError(
            "Destination is not empty. Import cancelled "
            "to prevent overwriting or duplicating data."
        )

    source_rows = {}

    with source_engine.connect() as conn:
        for name in sorted(source_app):
            table = source_meta.tables[f"public.{name}"]
            rows = conn.execute(select(table)).mappings().all()
            source_rows[name] = [dict(row) for row in rows]

    print("\nSource records to copy:")
    for name in sorted(source_app):
        print(f"  {name}: {len(source_rows[name])}")

    print(
        "\nTotal application records:",
        sum(len(rows) for rows in source_rows.values()),
    )

    # -----------------------------------------------------
    # 4. Determine parent-before-child insertion order
    # -----------------------------------------------------

    dependencies = {name: set() for name in source_app}

    for name in source_app:
        foreign_keys = target_inspector.get_foreign_keys(
            name,
            schema="public",
        )

        for fk in foreign_keys:
            parent = fk.get("referred_table")
            if parent in source_app and parent != name:
                dependencies[name].add(parent)

    order = []
    remaining = {
        name: set(parents)
        for name, parents in dependencies.items()
    }

    while remaining:
        ready = sorted(
            name for name, parents in remaining.items()
            if not parents
        )

        if not ready:
            print(
                "\nCircular table dependencies detected:",
                remaining,
            )
            raise RuntimeError(
                "Could not safely determine insertion order. "
                "Nothing was copied."
            )

        for name in ready:
            order.append(name)
            del remaining[name]

        for parents in remaining.values():
            parents.difference_update(ready)

    print("\nPlanned insertion order:")
    print(" -> ".join(order))

    confirm = input(
        "\nType COPY DATA to import these records into Neon: "
    ).strip()

    if confirm != "COPY DATA":
        print("Cancelled. No data was copied.")
        raise SystemExit(0)

    # -----------------------------------------------------
    # 5. Copy everything in one Neon transaction
    # -----------------------------------------------------

    with target_engine.begin() as conn:
        # Recheck destination immediately before importing.
        for name in source_app:
            count = conn.execute(
                text(f'SELECT COUNT(*) FROM public."{name}"')
            ).scalar_one()

            if count != 0:
                raise RuntimeError(
                    f"{name} is no longer empty. Import cancelled."
                )

        for name in order:
            rows = source_rows[name]

            if rows:
                destination = target_meta.tables[
                    f"public.{name}"
                ]
                conn.execute(destination.insert(), rows)

            print(f"Copied {name}: {len(rows)} rows")

        # Reset sequence-backed primary keys so future inserts
        # do not collide with the imported IDs.
        for name in order:
            table = target_meta.tables[f"public.{name}"]

            for column in table.primary_key.columns:
                sequence = conn.execute(
                    text("""
                        SELECT pg_get_serial_sequence(
                            :table_name, :column_name
                        )
                    """),
                    {
                        "table_name": f"public.{name}",
                        "column_name": column.name,
                    },
                ).scalar_one_or_none()

                if sequence is None:
                    continue

                maximum = conn.execute(
                    select(column.table.c[column.name].__class__)
                    if False else
                    text(
                        f'SELECT MAX("{column.name}") '
                        f'FROM public."{name}"'
                    )
                ).scalar_one()

                if maximum is None:
                    conn.execute(
                        text("""
                            SELECT setval(
                                CAST(:sequence AS regclass), 1, false
                            )
                        """),
                        {"sequence": sequence},
                    )
                else:
                    conn.execute(
                        text("""
                            SELECT setval(
                                CAST(:sequence AS regclass),
                                :value,
                                true
                            )
                        """),
                        {
                            "sequence": sequence,
                            "value": maximum,
                        },
                    )

    # -----------------------------------------------------
    # 6. Verify final counts
    # -----------------------------------------------------

    print("\nImport transaction committed.")
    print("\nVerification:")

    source_total = sum(len(rows) for rows in source_rows.values())
    target_total = 0

    with target_engine.connect() as conn:
        for name in sorted(target_app):
            actual = conn.execute(
                text(f'SELECT COUNT(*) FROM public."{name}"')
            ).scalar_one()

            expected = len(source_rows[name])
            status = "OK" if actual == expected else "MISMATCH"

            print(
                f"  {name}: source={expected}, "
                f"Neon={actual} [{status}]"
            )
            target_total += actual

    print("\nSource application rows:", source_total)
    print("Neon application rows:", target_total)

    if source_total != target_total:
        print("WARNING: Overall row counts differ.")
    else:
        print("Row-count verification passed.")

except SystemExit:
    raise
except Exception as exc:
    print("\nTRANSFER STOPPED:", exc)
    print(
        "If an error occurred during the import transaction, "
        "Neon should have rolled back that transaction."
    )
    raise
finally:
    source_engine.dispose()
    if target_engine is not None:
        target_engine.dispose()
