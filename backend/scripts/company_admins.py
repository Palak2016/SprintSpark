"""Review and assign designated Company Admins for EXISTING companies.

Nothing is assigned automatically. You name the administrator for each
company explicitly; the script never picks one for you (for example by
"earliest manager").

    # 1. Dry run: list every company, its members and current admin
    python -m scripts.company_admins review

    # 2. Dry run with proposals: shows what WOULD be assigned, with checks
    python -m scripts.company_admins review --assign 3=alice@acme.com --assign 7=bob@globex.com

    # 3. Apply after review (asks you to type a confirmation phrase)
    python -m scripts.company_admins apply --assign 3=alice@acme.com --assign 7=bob@globex.com

You can also put proposals in a CSV file with columns ``company_id,email``
and pass ``--assign-file proposals.csv``.

``apply`` only inserts rows into ``company_admins`` and
``company_audit_events``. It never changes users, roles, approvals,
memberships, projects or any other business data, and it refuses any
company that already has an active Company Admin (use the ownership
transfer flow in the Company Portal for those).
"""

import argparse
import csv
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional

from sqlalchemy import inspect

from app.core.database import SessionLocal, engine
from app.models.company import Company
from app.models.company_access import (
    CompanyAdmin,
    CompanyAdminGrantReason,
    CompanyAdminStatus,
    CompanyAuditEvent,
)
from app.models.user import ManagerApprovalStatus, User


@dataclass
class Proposal:
    company_id: int
    email: str
    user: Optional[User] = None
    problems: List[str] = None


def _parse_assignments(values: List[str], file_path: Optional[str]) -> Dict[int, str]:
    proposals: Dict[int, str] = {}
    pairs = []
    for value in values or []:
        if "=" not in value:
            raise SystemExit(f"--assign must look like COMPANY_ID=email, got: {value}")
        company_id, email = value.split("=", 1)
        pairs.append((company_id, email))
    if file_path:
        with open(file_path, newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                pairs.append((row["company_id"], row["email"]))
    for company_id, email in pairs:
        try:
            cid = int(company_id.strip())
        except ValueError:
            raise SystemExit(f"Invalid company id: {company_id!r}")
        if cid in proposals:
            raise SystemExit(f"Company {cid} has more than one proposed admin. Only one is allowed.")
        proposals[cid] = email.strip().lower()
    return proposals


def _check_migrated() -> None:
    if not inspect(engine).has_table("company_admins"):
        raise SystemExit(
            "The company_admins table does not exist. Run `alembic upgrade head` first."
        )


def _validate(db, proposals: Dict[int, str]) -> List[Proposal]:
    results = []
    for company_id, email in sorted(proposals.items()):
        proposal = Proposal(company_id=company_id, email=email, problems=[])
        company = db.query(Company).filter(Company.id == company_id).first()
        if company is None:
            proposal.problems.append("company does not exist")
        user = db.query(User).filter(User.email == email).first()
        proposal.user = user
        if user is None:
            proposal.problems.append("no user with this email")
        elif user.company_id != company_id:
            proposal.problems.append("user is not a member of this company")
        elif user.approval_status != ManagerApprovalStatus.APPROVED.value:
            proposal.problems.append(f"user is {user.approval_status}, not APPROVED")
        if company is not None and db.query(CompanyAdmin.id).filter(
            CompanyAdmin.company_id == company_id,
            CompanyAdmin.status == CompanyAdminStatus.ACTIVE.value,
        ).first():
            proposal.problems.append("company already has an active Company Admin (use ownership transfer)")
        results.append(proposal)
    return results


def _print_review(db, proposals: Dict[int, str]) -> None:
    companies = db.query(Company).order_by(Company.id).all()
    print(f"\n{len(companies)} compan{'y' if len(companies) == 1 else 'ies'} found\n")
    for company in companies:
        admin = (
            db.query(CompanyAdmin)
            .filter(
                CompanyAdmin.company_id == company.id,
                CompanyAdmin.status == CompanyAdminStatus.ACTIVE.value,
            )
            .first()
        )
        members = (
            db.query(User)
            .filter(User.company_id == company.id)
            .order_by(User.role, User.created_at, User.id)
            .all()
        )
        print(f"Company #{company.id}: {company.name}")
        if admin is not None:
            admin_user = db.query(User).filter(User.id == admin.user_id).first()
            print(f"  Current Company Admin : {admin_user.full_name} <{admin_user.email}>")
            # The app ignores grants held by accounts that are not approved.
            if admin_user.company_id != company.id:
                print("  NOTE                  : this admin belongs to another company (multi-company admin)")
            if admin_user.approval_status != ManagerApprovalStatus.APPROVED.value:
                print(f"  WARNING               : this admin is {admin_user.approval_status}; the grant has no effect")
        else:
            print("  Current Company Admin : (none - Company Portal administration disabled)")
        proposed = proposals.get(company.id)
        print(f"  Proposed admin        : {proposed or '(none proposed)'}")
        print(f"  Members ({len(members)}):")
        for member in members:
            print(
                f"    - #{member.id:<5} {member.role:<9} {member.approval_status:<9} "
                f"{member.full_name} <{member.email}>"
            )
        print()
    unlinked = db.query(User).filter(User.company_id.is_(None)).count()
    if unlinked:
        print(f"Note: {unlinked} user(s) are not linked to any company.\n")


def _print_validation(results: List[Proposal]) -> bool:
    if not results:
        print("No proposals given. Use --assign COMPANY_ID=email to propose administrators.")
        return False
    ok = True
    print("Proposed assignments:")
    for proposal in results:
        status = "OK" if not proposal.problems else "REJECTED: " + "; ".join(proposal.problems)
        print(f"  company #{proposal.company_id} -> {proposal.email}: {status}")
        ok = ok and not proposal.problems
    print()
    return ok


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["review", "apply"])
    parser.add_argument("--assign", action="append", default=[], metavar="COMPANY_ID=EMAIL")
    parser.add_argument("--assign-file", metavar="CSV")
    parser.add_argument(
        "--confirm-phrase",
        help="Non-interactive confirmation; must equal the phrase printed by `apply`.",
    )
    args = parser.parse_args(argv)

    _check_migrated()
    proposals = _parse_assignments(args.assign, args.assign_file)
    db = SessionLocal()
    try:
        _print_review(db, proposals)
        results = _validate(db, proposals)
        valid = _print_validation(results)

        if args.command == "review":
            print("Dry run only. Nothing was changed.")
            return 0 if valid or not results else 1

        if not valid:
            print("Fix the rejected proposals above. Nothing was changed.")
            return 1

        phrase = f"ASSIGN {len(results)} COMPANY ADMIN{'S' if len(results) != 1 else ''}"
        print(f"To apply, type exactly: {phrase}")
        typed = args.confirm_phrase if args.confirm_phrase is not None else input("> ").strip()
        if typed != phrase:
            print("Confirmation did not match. Nothing was changed.")
            return 1

        for proposal in results:
            db.add(CompanyAdmin(
                company_id=proposal.company_id,
                user_id=proposal.user.id,
                status=CompanyAdminStatus.ACTIVE.value,
                grant_reason=CompanyAdminGrantReason.ASSIGNMENT_SCRIPT.value,
                granted_by=None,
            ))
            db.add(CompanyAuditEvent(
                company_id=proposal.company_id,
                actor_id=None,
                event_type="COMPANY_ADMIN_GRANTED",
                metadata_json={
                    "user_id": proposal.user.id,
                    "reason": CompanyAdminGrantReason.ASSIGNMENT_SCRIPT.value,
                },
            ))
        db.commit()
        print(f"Assigned {len(results)} Company Admin(s).")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
