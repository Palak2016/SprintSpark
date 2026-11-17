"""Excel (.xlsx) downloads of work logs and daily updates.

Plain functions: they take rows already loaded (and permission-filtered) by
the API and return the file bytes. Nothing is calculated except totals, so
the file shows exactly the stored records.
"""

import io
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Sequence
from zoneinfo import ZoneInfo

import xlsxwriter

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _local(value: Optional[datetime], tz: ZoneInfo) -> Optional[datetime]:
    """Stored timestamps are UTC wall-clock values; show them in local time."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(tz).replace(tzinfo=None)


def _build(
    sheet_name: str,
    title: str,
    columns: Sequence[Dict[str, Any]],
    rows: Sequence[Sequence[Any]],
    generated_at: datetime,
    tz_name: str,
    total_column: Optional[str] = None,
) -> bytes:
    """One sheet: title lines, then an Excel table (filters, frozen header)."""
    buffer = io.BytesIO()
    workbook = xlsxwriter.Workbook(buffer, {"in_memory": True})
    sheet = workbook.add_worksheet(sheet_name)

    formats = {
        "title": workbook.add_format({"bold": True, "font_size": 14}),
        "note": workbook.add_format({"font_color": "#666666"}),
        "date": workbook.add_format({"num_format": "yyyy-mm-dd", "valign": "top"}),
        "datetime": workbook.add_format({"num_format": "yyyy-mm-dd hh:mm", "valign": "top"}),
        "number": workbook.add_format({"num_format": "0.00", "valign": "top"}),
        "integer": workbook.add_format({"num_format": "0", "valign": "top"}),
        "text": workbook.add_format({"valign": "top"}),
        "wrap": workbook.add_format({"text_wrap": True, "valign": "top"}),
    }

    sheet.write_string(0, 0, title, formats["title"])
    sheet.write_string(
        1, 0,
        f"Generated {generated_at:%Y-%m-%d %H:%M} ({tz_name}) · {len(rows)} record(s)",
        formats["note"],
    )

    header_row = 3
    first_data_row = header_row + 1
    for col, column in enumerate(columns):
        sheet.set_column(col, col, column.get("width", 14))

    for r, values in enumerate(rows, start=first_data_row):
        for c, (column, value) in enumerate(zip(columns, values)):
            kind = column.get("kind", "text")
            if value is None or value == "":
                sheet.write_blank(r, c, None, formats["text"])
            elif kind == "date":
                sheet.write_datetime(r, c, datetime.combine(value, datetime.min.time()), formats["date"])
            elif kind == "datetime":
                sheet.write_datetime(r, c, value, formats["datetime"])
            elif kind in ("number", "integer"):
                sheet.write_number(r, c, value, formats[kind])
            else:
                # Always text: employee-written notes are never run as formulas.
                sheet.write_string(r, c, str(value), formats["wrap" if kind == "wrap" else "text"])

    last_row = first_data_row + max(len(rows), 1) - 1
    table_columns = []
    for column in columns:
        spec: Dict[str, Any] = {"header": column["header"]}
        if total_column and column["header"] == total_column:
            spec["total_function"] = "sum"
            spec["format"] = formats["number"]
        elif total_column and column is columns[0]:
            spec["total_string"] = "Total"
        table_columns.append(spec)
    sheet.add_table(
        header_row, 0,
        last_row + (1 if total_column else 0), len(columns) - 1,
        {
            "columns": table_columns,
            "style": "Table Style Medium 2",
            "total_row": bool(total_column),
        },
    )
    sheet.freeze_panes(first_data_row, 0)
    workbook.close()
    return buffer.getvalue()


def work_logs_workbook(logs: Sequence[Any], tz_name: str, now: Optional[datetime] = None) -> bytes:
    """``logs``: WorkLog rows with ``task`` (and its ``project``) and ``user`` loaded."""
    tz = ZoneInfo(tz_name)
    columns = [
        {"header": "Log date", "kind": "date", "width": 12},
        {"header": "Project", "width": 28},
        {"header": "Task ID", "kind": "integer", "width": 9},
        {"header": "Task", "width": 34},
        {"header": "Employee", "width": 22},
        {"header": "Hours", "kind": "number", "width": 9},
        {"header": "Notes", "kind": "wrap", "width": 60},
        {"header": "Logged at", "kind": "datetime", "width": 17},
    ]
    rows: List[List[Any]] = []
    for log in logs:
        task = log.task
        rows.append([
            log.log_date,
            task.project.name if task is not None and task.project is not None else None,
            log.task_id,
            task.title if task is not None else None,
            log.user.full_name if log.user is not None else None,
            float(log.hours_spent),
            (log.notes or "").strip() or None,
            _local(log.created_at, tz),
        ])
    generated = _local(now or datetime.now(timezone.utc), tz)
    return _build("Work Logs", "Work logs", columns, rows, generated, tz_name, total_column="Hours")


def daily_updates_workbook(updates: Sequence[Any], tz_name: str, now: Optional[datetime] = None) -> bytes:
    """``updates``: DailyUpdate rows with ``task`` (and its ``project``) and ``user`` loaded."""
    tz = ZoneInfo(tz_name)
    columns = [
        {"header": "Date", "kind": "date", "width": 12},
        {"header": "Project", "width": 28},
        {"header": "Task ID", "kind": "integer", "width": 9},
        {"header": "Task", "width": 34},
        {"header": "Employee", "width": 22},
        {"header": "Progress %", "kind": "integer", "width": 11},
        {"header": "Blocked", "width": 9},
        {"header": "Blocker notes", "kind": "wrap", "width": 40},
        {"header": "Update notes", "kind": "wrap", "width": 60},
        {"header": "Submitted at", "kind": "datetime", "width": 17},
    ]
    rows: List[List[Any]] = []
    for update in updates:
        task = update.task
        rows.append([
            update.date,
            task.project.name if task is not None and task.project is not None else None,
            update.task_id,
            task.title if task is not None else None,
            update.user.full_name if update.user is not None else None,
            int(update.progress_pct),
            "Yes" if update.is_blocked else "No",
            ((update.blocker_notes or "").strip() or None) if update.is_blocked else None,
            (update.update_notes or "").strip() or None,
            _local(update.created_at, tz),
        ])
    generated = _local(now or datetime.now(timezone.utc), tz)
    return _build("Daily Updates", "Daily updates", columns, rows, generated, tz_name)


def export_filename(kind: str, today: date) -> str:
    return f"workpilot-{kind}-{today.isoformat()}.xlsx"
