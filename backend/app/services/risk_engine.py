"""Project risk engine entry points.

The scoring itself lives in ``risk_scoring`` (pure and deterministic) and the
data loading in ``risk_snapshot``. This module keeps the original function
names used elsewhere in the app.
"""

from datetime import date, timedelta
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.project import Project


def calculate_business_days(start_d: date, end_d: date) -> int:
    if end_d < start_d:
        return 0
    days = 0
    cur = start_d
    while cur <= end_d:
        if cur.weekday() < 5:  # Monday to Friday
            days += 1
        cur += timedelta(days=1)
    return max(1, days)


def analyze_project_risk(project: Project, db: Session, as_of: Optional[date] = None) -> Dict[str, Any]:
    """Score a project without storing a history row.

    Returns risk_level, score, factor_breakdown, triggered_rules, evidence,
    missing_data_flags, confidence and the reproducibility fields
    (engine_version, config_version, as_of, input_hash).
    """
    from app.services.risk_service import evaluate_project

    return evaluate_project(db, project, as_of)
