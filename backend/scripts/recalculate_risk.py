"""Daily risk recalculation for every active project.

Risk changes as time passes even when nobody edits anything (deadlines get
closer, updates go stale), so run this once a day, early in the morning in
RISK_TIMEZONE. A new history row is recorded only when a project's result
actually changes.

Run from the backend folder:

    python -m scripts.recalculate_risk
    python -m scripts.recalculate_risk --as-of 2026-11-18   # replay a date

Schedule it with Windows Task Scheduler or cron, for example 06:30 daily.
"""

import argparse
from datetime import date

from app.core.database import SessionLocal
import app.models  # noqa: F401  (register all models)
from app.services.risk_service import project_today, recompute_active_projects


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--as-of", type=date.fromisoformat, default=None,
                        help="Score as of this date (YYYY-MM-DD). Defaults to today in RISK_TIMEZONE.")
    args = parser.parse_args()
    as_of = args.as_of or project_today()

    db = SessionLocal()
    try:
        evaluated, recorded = recompute_active_projects(db, as_of)
    finally:
        db.close()
    print(f"Risk recalculated for {evaluated} project(s) as of {as_of}; {recorded} changed.")


if __name__ == "__main__":
    main()
