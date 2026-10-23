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

Add one key to `backend/.env` (the existing settings are reused; no SDK is
needed):

```dotenv
OPENAI_API_KEY=...        # or GEMINI_API_KEY=...
# Optional
LLM_PROVIDER=openai       # openai | gemini; defaults to the first key found
OPENAI_MODEL=gpt-4o-mini  # set to the model your account uses
GEMINI_MODEL=gemini-2.0-flash
LLM_TIMEOUT_SECONDS=45
RECOVERY_REQUIRE_LLM=false
```

**Fallback:** with no key, or if the model call fails, the rule-based planner
is used and the proposal is labelled `RULE_BASED_FALLBACK` with
`generation_trace.llm.invoked` and `llm.status` showing exactly what happened.
Set `RECOVERY_REQUIRE_LLM=true` to return HTTP 503 instead of falling back.

`GET /api/v1/recovery-planner/status` shows which provider and model will be
used (never the key). The model receives task, capacity and risk facts and
employee blocker notes; it does not receive email addresses or leave reasons.

Run `alembic upgrade head` after pulling: migration `e3f7a1c9b250` adds
`recovery_proposals.generation_trace` and `proposal_decisions.execution_report`.
