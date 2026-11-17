"""Excel downloads of work logs and daily updates."""

import io
import re
import zipfile
from datetime import date, datetime
from types import SimpleNamespace as NS
from xml.etree import ElementTree

from app.services.excel_export import daily_updates_workbook, work_logs_workbook

NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_cells(content: bytes) -> dict:
    """{"A1": value} for the first sheet. Text cells give str, formulas give "=...",
    numbers give float. Enough to check what Excel will show."""
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ElementTree.fromstring(z.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in si.iter(f"{NS_MAIN}t")) for si in root.iter(f"{NS_MAIN}si")]
        sheet = ElementTree.fromstring(z.read("xl/worksheets/sheet1.xml"))
    cells = {}
    for c in sheet.iter(f"{NS_MAIN}c"):
        formula, value = c.find(f"{NS_MAIN}f"), c.find(f"{NS_MAIN}v")
        if formula is not None:
            cells[c.get("r")] = "=" + (formula.text or "")
        elif value is not None:
            cells[c.get("r")] = shared[int(value.text)] if c.get("t") == "s" else float(value.text)
    return cells


def excel_date(d: datetime) -> float:
    return (d - datetime(1899, 12, 30)).total_seconds() / 86400


PROJECT = NS(name="Client Portal v2")
TASK = NS(title="Payments API", project=PROJECT)
USER = NS(full_name="Ravi Kumar")


def test_work_logs_workbook_shows_stored_records():
    logs = [
        NS(log_date=date(2026, 11, 17), task=TASK, task_id=12, user=USER, hours_spent=6.5,
           notes='=HYPERLINK("http://x") fixed webhook', created_at=datetime(2026, 11, 17, 12, 0)),
        NS(log_date=date(2026, 11, 18), task=TASK, task_id=12, user=USER, hours_spent=2,
           notes=None, created_at=datetime(2026, 11, 18, 4, 30)),
    ]
    cells = read_cells(work_logs_workbook(logs, "Asia/Kolkata", now=datetime(2026, 11, 18)))
    assert [cells[f"{c}4"] for c in "ABCDEFGH"] == [
        "Log date", "Project", "Task ID", "Task", "Employee", "Hours", "Notes", "Logged at",
    ]
    assert cells["A5"] == excel_date(datetime(2026, 11, 17))
    assert cells["B5"] == "Client Portal v2" and cells["E5"] == "Ravi Kumar" and cells["F5"] == 6.5
    # Employee text is stored as text, never as a formula.
    assert cells["G5"] == '=HYPERLINK("http://x") fixed webhook' and not cells["G5"].startswith("=SUB")
    # Stored UTC timestamps are shown in local time (12:00 UTC = 17:30 IST).
    assert abs(cells["H5"] - excel_date(datetime(2026, 11, 17, 17, 30))) < 1e-6
    assert "G6" not in cells  # missing notes stay blank
    assert cells["A7"] == "Total" and cells["F7"].startswith("=SUBTOTAL(109")
    assert "2 record(s)" in cells["A2"] and "Asia/Kolkata" in cells["A2"]


def test_daily_updates_workbook_and_empty_export():
    updates = [NS(date=date(2026, 11, 17), task=TASK, task_id=12, user=USER, progress_pct=40, is_blocked=False,
                  blocker_notes="old note", update_notes="Half done", created_at=datetime(2026, 11, 17, 13, 0))]
    cells = read_cells(daily_updates_workbook(updates, "Asia/Kolkata"))
    assert cells["F5"] == 40 and cells["G5"] == "No" and cells["I5"] == "Half done"
    assert "H5" not in cells  # blocker notes only when the update is blocked

    empty = read_cells(work_logs_workbook([], "Asia/Kolkata"))
    assert "0 record(s)" in empty["A2"] and empty["A4"] == "Log date"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _text(response) -> str:
    return " ".join(str(v) for v in read_cells(response.content).values())


def test_employee_downloads_only_their_own_work_logs(client, employee_token):
    response = client.get("/api/v1/work-logs/export", headers=_auth(employee_token))
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert re.search(r'filename="workpilot-work-logs-\d{4}-\d{2}-\d{2}\.xlsx"', response.headers["content-disposition"])
    text = _text(response)
    assert "Elena Rostova" in text
    assert "Marcus Chen" not in text  # another employee's logs on the same project


def test_manager_download_matches_the_team_list(client, manager_token):
    listed = client.get("/api/v1/work-logs", headers=_auth(manager_token)).json()
    response = client.get("/api/v1/work-logs/export", headers=_auth(manager_token))
    assert response.status_code == 200
    text = _text(response)
    assert f"{len(listed)} record(s)" in text
    assert "Elena Rostova" in text and "Marcus Chen" in text


def test_daily_updates_download_and_filters(client, employee_token):
    response = client.get("/api/v1/daily-updates/export?user_id=2", headers=_auth(employee_token))
    assert response.status_code == 200
    assert "Elena Rostova" in _text(response)

    future = client.get("/api/v1/daily-updates/export?date_from=2099-01-01", headers=_auth(employee_token))
    assert future.status_code == 200 and "0 record(s)" in _text(future)

    bad = client.get("/api/v1/daily-updates/export?date_from=2026-11-10&date_to=2026-11-01",
                     headers=_auth(employee_token))
    assert bad.status_code == 400


def test_manager_downloads_team_daily_updates(client, manager_token):
    listed = client.get("/api/v1/daily-updates", headers=_auth(manager_token)).json()
    response = client.get("/api/v1/daily-updates/export", headers=_auth(manager_token))
    assert response.status_code == 200
    text = _text(response)
    assert f"{len(listed)} record(s)" in text
    assert "Elena Rostova" in text  # an employee on the manager's project


def test_download_requires_sign_in(client):
    assert client.get("/api/v1/work-logs/export").status_code == 401
