# Backend configuration

## Email OTP signup

Signup verification sends a six-digit, single-use code to the submitted email.
Codes expire after 10 minutes, allow up to five attempts, and can be resent
after 60 seconds. Phone numbers are optional and are not verified.

## Company workspaces

A manager can create a company during signup. The company workspace then
provides a join code from the manager portal. Employees and additional
managers must enter that code to join; signup checks that it identifies an
existing company. The Company Portal shows the company roster and can generate
a replacement join code; replacing it invalidates the previous code for new
signups. Users and projects are stored with a company foreign key,
and manager-facing project, team, leave, and work data is scoped to that
company.

Apply the company workspace migration using the same `alembic upgrade head`
command below. Existing manager company names are migrated into workspaces;
records without a known company remain unassigned until they are associated
with a company.

Configure SMTP in `backend/.env`. For Gmail, use an app password rather than
your regular account password:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-sender@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM_EMAIL=your-sender@gmail.com
SMTP_USE_SSL=false
SMTP_STARTTLS=true
```

For an SMTP provider using implicit SSL (usually port 465), set
`SMTP_USE_SSL=true` and `SMTP_STARTTLS=false`. Never commit real SMTP credentials.

Apply database migrations after checkout:

```powershell
alembic upgrade head
```

Start the WorkPilot API from `backend` with `python run_server.py`; it listens
on `127.0.0.1:8001`. The frontend Vite server proxies `/api` to this port so
the API does not collide with other local services using port `8000`.

## AI recovery planner

`POST /api/v1/projects/{id}/recovery-proposals/generate` runs a LangGraph
workflow (`app/services/recovery_graph.py`):

```
context_collector -> risk_analyzer -> leave_impact -> schedule_analyzer
    -> recovery_planner -> output_validator -> approval_queue
```

| Step | What it does | Uses an LLM? |
| --- | --- | --- |
| risk_analyzer | Rule-based risk score (`risk_engine.py`) | No |
| schedule_analyzer | Remaining work, capacity, leave, projected completion (`recovery_scheduler.py`) | No |
| recovery_planner | Asks the model for 2-3 recovery strategies; also builds the rule-based plan as a baseline | **Yes**, when recovery is needed and a key is set |
| output_validator | Checks every action against project data, re-simulates each strategy, picks one (`recovery_validation.py`) | No |
| approval_queue | Saves the proposal as `PENDING_APPROVAL` with a `generation_trace` | No |

Nothing is applied until the project's manager approves. Approval re-checks
the proposal against current data and refuses (HTTP 409) if anything it
touches has changed.

### Configure the model

Add your Gemini key to `backend/.env` (the existing settings are reused; no SDK is
needed):

```dotenv
GEMINI_API_KEY=...
LLM_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash
LLM_TIMEOUT_SECONDS=45
RECOVERY_REQUIRE_LLM=false

# Optional
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
WAYJET_API_KEY=...
LLM_PROVIDER=openai       # gemini | openai | wayjet
```

**Fallback:** with no key, or if the model call fails, the rule-based planner
is used and the proposal is labelled `RULE_BASED_FALLBACK` with
`generation_trace.llm.invoked` and `llm.status` showing exactly what happened.
Set `RECOVERY_REQUIRE_LLM=true` to return HTTP 503 instead of falling back.

`GET /api/v1/recovery-planner/status` shows which provider and model will be
used (never the key). The model receives task, capacity and risk facts and
employee blocker notes; it does not receive email addresses or leave reasons.

Daily task progress is estimated from submitted work notes by Gemini. Progress
updates are not saved if the model is unavailable, and there is no rule-based
progress fallback.

Run `alembic upgrade head` after pulling: migration `e3f7a1c9b250` adds
`recovery_proposals.generation_trace` and `proposal_decisions.execution_report`.

## Roles, workspaces and the Admin console

One account per person, one password. Three separate things decide what it can do:

| Concept | Stored in | Grants |
|---|---|---|
| Account status | `users.approval_status`: `PENDING`, `APPROVED`, `REJECTED`, `DEACTIVATED` | Nothing unless `APPROVED` (checked on every request) |
| Project role | `users.role`: `MANAGER`, `EMPLOYEE`, or `ADMIN` (administration-only, no project workspace) | Manager or Employee workspace, inside the account's own company |
| Company Admin | ACTIVE row in `company_admins` (one per company) | Admin console and `/api/v1/companies/{id}/...` for that company only |
| Designation | `users.designation` | Nothing. A job title such as "HR Head" |

Workspaces follow from these (`/auth/me`, `/auth/login` and `/auth/signup`
return them as `workspaces`, most specific first):

| Account | `workspaces` | Lands on |
|---|---|---|
| Company Admin, role `ADMIN` | `["admin"]` | Admin console |
| Company Admin, role `MANAGER` | `["admin", "manager"]` | Admin console (switch to Manager in the sidebar) |
| Company Admin, role `EMPLOYEE` | `["admin", "employee"]` | Admin console |
| Manager | `["manager"]` | `/manager` |
| Employee | `["employee"]` | `/employee` |
| Pending, rejected or deactivated | `[]` | Status page |
| Approved, no admin grant, role `ADMIN` | `[]` | "No workspace available" page |

- `workspaces` is a routing hint only; every endpoint re-checks on the server.
- `users.role = "ADMIN"` never means company administration and never crosses
  companies: on its own it grants nothing.
- Managers see and manage only projects they lead (`projects.manager_id`) or are
  assigned to (`project_members`); Company Admins see all projects of their own
  company (see `app/core/tenancy.py`). Manager rights (creating projects,
  editing tasks, reviewing leave) need `role = MANAGER`.
- One account belongs to one company. A person can administer several companies
  (one `company_admins` grant each, checked per company in the URL), but
  belonging to several companies with different project roles needs separate
  accounts for now.

## Signup paths

`POST /api/v1/auth/signup/send-otp` then `POST /api/v1/auth/signup`, with
`role` choosing one of three paths (anything else is rejected with 422):

| Path | `role` | Required | Result |
|---|---|---|---|
| Create a company | `ADMIN` | `company_name`; optional `designation`, `also_manager` | New company and an ACTIVE `company_admins` grant for the creator, in one transaction. Role `ADMIN`, or `MANAGER` when `also_manager` is true |
| Manager | `MANAGER` | `designation` + `company_code` or `invitation_token` | Joins that company; `PENDING` with a code, `APPROVED` with an invitation |
| Employee | `EMPLOYEE` | `company_code` or `invitation_token` | Same as manager |

- Managers and employees can no longer create companies, and the Admin path
  cannot join an existing company, so admin rights over an existing company are
  only ever obtained through an accepted ownership transfer.
- Unknown fields (`is_admin`, `workspaces`, `approval_status`, ...) are rejected.
- Frontend: `/signup` (or `/signup?type=admin` to open "Create a company").

## Account lifecycle and member management

Company Admins manage members of their own company from Admin console → Members.
Every action is recorded in `company_audit_events` with the actor, the affected
user, the change and the time (shown under Activity).

| Endpoint | Does | Rules |
|---|---|---|
| `PATCH /companies/{id}/members/{user_id}/designation` | Set or clear the job title | Grants nothing; 2-255 characters |
| `PUT /companies/{id}/members/{user_id}/role` | Grant or revoke Manager access (`MANAGER` / `EMPLOYEE`) | `ADMIN` (administration-only) only for the Company Admin's own account; not for deactivated or rejected accounts |
| `POST /companies/{id}/members/{user_id}/deactivate` | Switch the account off (`DEACTIVATED`) | Not yourself; never a Company Admin (transfer the role first); only active accounts; cancels pending admin transfers to that person |
| `POST /companies/{id}/members/{user_id}/reactivate` | Switch it back on (`APPROVED`) | Only deactivated accounts |

- All four require the caller to be the active Company Admin of `{id}`, and the
  member must belong to `{id}` (404 otherwise), so IDs from another company
  cannot be managed.
- Deactivation deletes nothing (projects, tasks, logs and history stay). Tokens
  are stateless JWTs with no refresh tokens; every protected request re-reads
  the account, so existing and new sessions of a deactivated account get 403
  immediately. `/auth/me` still answers so the app can show the status page.

**Migration:** none needed. `users.role` and `users.approval_status` are plain
text columns, so `ADMIN` (administration-only) and `DEACTIVATED` are new values
only. No existing account used `ADMIN`; existing managers and employees keep
their access, and no one is promoted.

## Company administration (Admin console)

Each company has exactly one designated **Company Admin**, stored in
`company_admins` and enforced by a partial unique index. The platform roles
`MANAGER` and `ADMIN` do **not** grant company administration on their own;
every `/api/v1/companies/{company_id}/...` endpoint checks for an ACTIVE grant
for that specific company.

The Admin console (frontend `/admin/{companyId}/...`) has Overview, Members,
Approvals, Invitations, Analytics, Activity, Ownership and Settings. Old
`/company/...` links redirect there.

- Creating a company at signup ("Create a company" path) makes the verified
  creator its Company Admin (same transaction as the company) and sends them
  to the Admin console.
- Joining with a company code creates a `PENDING` account that the company's
  admin must approve. `PENDING`/`REJECTED` users can sign in but cannot use any
  business endpoint.
- Invitations are company-scoped, email-bound and role-bound, expire after 7 days,
  are stored only as HMAC hashes, and never grant admin rights.
- Ownership transfers need the current admin's password, the recipient's
  acceptance (with their password), and complete in a single transaction.
- Set `FRONTEND_BASE_URL` in `.env` so invitation links point at your frontend.

**Upgrading an existing database** (back up first; the migration only adds tables):

```bash
alembic upgrade head          # adds company_admins, company_admin_transfers,
                              # company_invitations, company_audit_events
```

Existing companies have **no** Company Admin after the upgrade; everything else
keeps working. Review and assign administrators explicitly:

```bash
python -m scripts.company_admins review                      # dry run
python -m scripts.company_admins review --assign 1=alice@acme.com
python -m scripts.company_admins apply  --assign 1=alice@acme.com   # asks for a typed confirmation
```

Rollback: `alembic downgrade f7a4c2d19b61` drops only the four new tables.

The Admin console and workspace changes need no further migration. The review
command also flags admin grants held by accounts that are not `APPROVED` (the
app ignores those grants) and admins who belong to another company.
