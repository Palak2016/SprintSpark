# WorkPilot AI: Whole-Project Viva Walkthrough

This guide explains the whole WorkPilot AI (SprintSpark) project: its purpose,
architecture, role-based pages, core functionality, and how information moves
between the React frontend, FastAPI backend, and database. It then traces the
authentication-to-recovery flow in more detail.

## Part I: Explain the whole project

### 1. What problem does the project solve?

WorkPilot AI is a project-delivery and workforce-planning application. A manager
defines projects, tasks, owners, priorities, due dates, and dependencies.
Employees report progress, work performed, blockers, and leave. The backend
uses this operational data to calculate project risk and schedule projections.
AI can help interpret update text or suggest recovery strategies, but
deterministic backend rules validate important facts and authorized managers
control consequential changes.

The central design idea is **decision support, not autonomous management**:
analysis can recommend an action, but it does not bypass permission checks or
manager approval.

### 2. System architecture: where a request travels

```text
React page
  -> shared API client (fetch + bearer header)
  -> FastAPI route (/api/v1/...)
  -> authentication / role / company / project checks
  -> schema validation + business service
  -> SQLAlchemy models and relational database
  -> JSON response -> React state -> page or dashboard refresh
```

The frontend is a React + TypeScript single-page application. React Router
changes the visible page without a full page load. `AuthContext` holds the
signed-in user and permissions for navigation; `ProjectContext` holds the
projects and the current project selection. Most screens call the shared
`frontend/src/services/api.ts` client rather than calling `fetch` themselves.

The backend is a FastAPI application. Routes receive validated request data,
the authenticated user, and a SQLAlchemy database session through FastAPI
dependency injection. Routers call database models and service modules for
business logic. Pydantic schemas validate input/output shapes; SQLAlchemy maps
Python objects to tables. Alembic migrations evolve the schema.

LangGraph is used for the multi-step recovery-planning workflow. The system
also calls configured hosted language-model providers for selected text
analysis and strategy suggestions. Risk scores, access control, schedule
simulation, action validation, and task mutations stay in backend code.

### 3. Application startup and the first screen

1. `frontend/src/main.tsx` mounts the React application and global styles.
2. `frontend/src/App.tsx` creates the router, wraps routes with
   `AuthProvider` and `ProjectProvider`, and maps URLs to page components.
3. `AuthContext.tsx` checks `localStorage` for `workpilot_token`. If present,
   it calls `/api/v1/auth/me` before treating the user as signed in.
4. `ProtectedRoute` in `App.tsx` waits for that check. It sends a signed-out
   user to `/login`, an unapproved user to `/pending-approval`, and a user
   without the requested workspace to a workspace they can open.
5. Once signed in, `ProjectContext.tsx` loads the user's authorized projects.
   The shared dashboard top bar and project context let project pages operate
   on the active project; changing it refreshes project-scoped page data.
6. `DashboardLayout.tsx` supplies the common top bar, sidebar, responsive
   layout, and React Router `<Outlet>`. Selecting a sidebar item changes the
   nested route and the component shown inside that outlet.

For a local run, start the backend and frontend in separate terminals:

```powershell
Set-Location SprintSpark\backend
python run_server.py
```

```powershell
Set-Location SprintSpark\frontend
npm run dev
```

The backend listens on `127.0.0.1:8002`; the Vite development server proxies
`/api` requests to it. The frontend package has a separate `build`, `lint`, and
`test` script. The backend defaults to SQLite for local operation and can use
PostgreSQL when `DATABASE_URL` is configured.

The URL-to-page wiring is in `frontend/src/App.tsx`; the actual sidebar labels
and links are in `frontend/src/components/dashboard/Sidebar.tsx`.

### 4. Navigation map

| Who / URL | Page or purpose |
| --- | --- |
| `/` | Public landing page |
| `/login`, `/signup` | Sign in or create an account |
| `/pending-approval` | Explains that a company admin must approve the membership |
| `/manager` | Manager overview |
| `/manager/projects` | Create/select projects, manage project details and membership |
| `/manager/tasks` | Project task board; switch between list, Kanban, calendar, and timeline views |
| `/manager/my-tasks` | Manager's own assigned work |
| `/manager/daily-updates`, `/manager/work-logs` | Review project updates and recorded work |
| `/manager/agenda-drift` | Review agenda-alignment records and employee context |
| `/manager/team`, `/manager/leave` | Team capacity/availability and leave decisions |
| `/manager/risk` | Risk score, risk history, scoring configuration, and update-derived suggestions |
| `/manager/recovery` | Generate and review recovery proposals |
| `/manager/audit`, `/manager/settings` | Project activity history and manager preferences |
| `/employee` | Employee overview |
| `/employee/tasks` | Assigned tasks and task-related actions |
| `/employee/daily-updates`, `/employee/work-logs` | Submit progress updates and work logs |
| `/employee/agenda-drift`, `/employee/focus` | Review alignment results or submit technical work context |
| `/employee/leave`, `/employee/settings` | Submit/check leave and manage account settings |
| `/admin/{companyId}/...` | Company Admin console: overview, members, approvals, invitations, analytics, activity, ownership, settings |
| `/company-transfer` | Review an incoming Company Admin ownership transfer |
| `/profile` | Shared profile view |

Manager, employee, and admin pages use the same dashboard shell, but each
workspace has different navigation. A Company Admin may also have a manager or
employee project role; the sidebar/workspace switcher only offers workspaces
the server returned. The company ID in an Admin URL is checked against the
current user's admin grants.

Legacy `/company/...` URLs redirect to the Admin console. Unknown URLs return
to `/`. The login screen currently contains a `/forgot-password` link, but
there is no matching route or password-reset API in this project version.

### 5. Functionality tour: what each part does

| Functionality | How it works and where it goes next |
| --- | --- |
| **Company and membership management** | Signup can create a company or request to join an existing one. Company Admin pages approve/reject members, issue invitations, manage member roles/status, view company activity/analytics, and manage ownership. The browser calls company endpoints in `backend/app/api/v1/companies.py`; the backend scopes each operation to that company. |
| **Projects** | A manager creates a project, chooses its dates/description, and adds members. The project is selected in the shared project context. `ProjectsView.tsx` uses the project API; the backend's `projects.py` checks company and project access. |
| **Tasks and dependencies** | Managers create and edit tasks, assign owners, set estimated hours, priority, dates, status, blockers, and prerequisite tasks. `TasksView.tsx` presents the same project tasks as list, Kanban, calendar, or timeline; `TaskModal`, `TaskKanban`, `TaskList`, `TaskCalendar`, and `TaskTimeline` are UI components. `tasks.py` validates changes and prevents invalid dependency relationships/cycles. |
| **Employee task work** | Employees open `/employee/tasks`, select an assigned task, submit progress/blocker information, and can record hours. The backend checks that the task is assigned/visible to that user before saving changes. |
| **Work logs** | A work log records hours, date, and optional notes against a task. Saving a log updates task actual-hours totals and can start a TODO task. Managers and employees see different permitted log data; work logs and daily updates can be exported to Excel. |
| **Daily progress updates** | The employee writes what happened. The app can ask the configured model to estimate progress and extract evidence-based signals; the employee can remove extracted signals or use a manual progress value when estimation is unavailable. A signed analysis token binds an analysis to its task, notes, user, and current progress. Submission saves the update, synchronizes task progress/status/blocker fields, records audit data, and triggers related risk and agenda analysis. |
| **Agenda Alignment / drift** | After an eligible employee daily update, backend analysis compares the update with the task/project plan and recent context. It stores a score/status, evidence, confidence, and suggested next steps. Employees can clarify their own record; managers can review it. An off-track result may create a pending advisory recovery proposal. Drift is a planning signal, not an employee-performance score. |
| **Focus Guardian context** | Employees can voluntarily attach a reason and technical note to one of their assigned tasks. The API saves it and notifies the responsible project manager. Managers can inspect the notes, and recovery generation can include saved project context. This is a context-submission feature, not covert tracking. |
| **Leave and capacity** | Employees submit dated leave requests and see their statuses. Managers review requests. Approved leave is included in availability and schedule/capacity calculations; pending/rejected leave is not treated as approved time off. |
| **Risk Intelligence** | Risk endpoints return a deterministic 0-100 project score, level, rules/factors, and history. The five bounded factors are schedule variance, delivery forecast, blockers, dependency-plan conflicts, and update freshness; default weights are 30/30/20/10/10. Levels start at MEDIUM 20 and HIGH 50 by default, and managers can version the project's scoring configuration. Signals extracted from updates (blocker, dependency, scope change) wait in a manager-review queue; accepting a suggestion can make a controlled project-data change. Risk is an estimate based on available data, not a delivery guarantee. |
| **Recovery plans** | When recovery is needed, the manager starts the LangGraph workflow. The workflow loads context, analyzes risk/leave/schedule, requests candidate strategies from an LLM, validates and re-simulates each one, and queues a pending proposal. Manager approval revalidates current data before applying anything. See Part II below. |
| **Dashboards and analytics** | Manager and employee overview pages summarize their permitted data. Project analytics compute status/deadline/progress trends; company analytics are scoped to a company admin's company. These are computed from stored project data, not separate sources of truth. |
| **Audit and notifications** | Important changes create project or company audit records. Notifications are shown in the shared UI; the user can mark one or all as read. They inform the user but do not grant permission to follow a link. |
| **Profile and preferences** | Profile/account pages update user-facing details or settings. Account status, role, and Company Admin grants still come from backend records and cannot be granted by changing browser state. |

### 6. Main end-to-end user journeys

#### Journey A: Create a project and deliver work

```text
Manager signs in
 -> Manager Overview
 -> Projects: create/select project and add members
 -> Tasks Board: create tasks, assign owners, set deadlines/dependencies
 -> Employee My Tasks: work on assigned task
 -> Daily Updates and/or Work Logs: report progress, time, blockers
 -> Manager Overview / Analytics / Risk: review project state
```

All pages share the active project selection. The browser sends the relevant
project/task IDs to the API, but the backend verifies the caller can access
those records; knowing an ID is not authorization.

#### Journey B: Daily update to agenda/risk review

```text
Employee Daily Updates
 -> analyze progress (AI estimate or manual value)
 -> employee reviews extracted signals
 -> submit update
 -> backend saves task progress and update
 -> risk signals + agenda drift analysis are persisted
 -> employee may add clarification
 -> manager reviews Agenda Alignment / Risk Suggestions
```

Progress estimation is assistive. Server-side validation enforces monotonic
progress and checks that the analysis token still matches the submitted task
and notes. If model analysis fails, the UI can preserve current progress or
allow manual progress instead of inventing an AI result.

#### Journey C: Leave request to schedule impact

```text
Employee Leave Requests -> submit
 -> manager Leave Requests -> approve/reject
 -> approved leave affects availability and risk/schedule calculations
 -> manager reviews team capacity or generates a fresh recovery proposal
```

Approval of leave does not itself auto-apply a task reassignment. It changes
the availability facts used by planning and risk analysis.

#### Journey D: Project risk to recovery execution

```text
Manager Risk Intelligence -> inspect score/history/rules
 -> Recovery Plans -> generate proposal
 -> review actions, assumptions, validation and schedule comparison
 -> approve / reject / defer
 -> if approved and still valid: apply task changes and record the result
```

The proposal is a snapshot of a suggestion, not an immediate task update. If
relevant data changed after generation, approval fails safely with a conflict
and the manager can generate a new proposal.

### 7. Frontend and backend file map

| Layer | File | Responsibility |
| --- | --- | --- |
| Frontend bootstrap | [main.tsx](../frontend/src/main.tsx), [App.tsx](../frontend/src/App.tsx) | Mount React, provide contexts, register URL routes, and guard protected workspaces. |
| Shared identity | [AuthContext.tsx](../frontend/src/context/AuthContext.tsx), [workspace.ts](../frontend/src/utils/workspace.ts) | Restore/login/logout, expose user and server-provided workspaces, choose navigation destinations. |
| Shared project state | [ProjectContext.tsx](../frontend/src/context/ProjectContext.tsx) | Load visible projects and track the active project. |
| API client | [api.ts](../frontend/src/services/api.ts) | Send JSON requests, attach bearer tokens, parse errors, download exports, expose typed feature methods. |
| Shared dashboard | [DashboardLayout.tsx](../frontend/src/components/dashboard/DashboardLayout.tsx), [Sidebar.tsx](../frontend/src/components/dashboard/Sidebar.tsx), [Topbar.tsx](../frontend/src/components/dashboard/Topbar.tsx) | Shared shell, navigation, workspace/project controls, and nested page outlet. |
| Company Admin layout | [AdminLayout.tsx](../frontend/src/components/admin/AdminLayout.tsx) | Load administered companies, verify selected company, and provide Admin navigation. |
| Backend startup/router | [main.py](../backend/app/main.py), [api/v1/__init__.py](../backend/app/api/v1/__init__.py) | Create FastAPI app, configure middleware, and mount versioned API routers. |
| Auth endpoints/security | [auth.py](../backend/app/api/v1/auth.py), [security.py](../backend/app/core/security.py), [dependencies.py](../backend/app/core/dependencies.py) | Signup/login/me, password hashing/JWT, current-user and role checks. |
| Project/task APIs | [projects.py](../backend/app/api/v1/projects.py), [tasks.py](../backend/app/api/v1/tasks.py) | Project and task CRUD, membership, blocker, progress, and dependency operations. |
| Work activity APIs | [work_logs.py](../backend/app/api/v1/work_logs.py), [leave.py](../backend/app/api/v1/leave.py) | Daily updates, work logs, exports, leave requests, decisions, and availability. |
| Risk/agenda APIs | [risk.py](../backend/app/api/v1/risk.py), [agenda_drift.py](../backend/app/api/v1/agenda_drift.py), [focus_guardian.py](../backend/app/api/v1/focus_guardian.py) | Risk results/config/review, agenda drift, and employee-submitted focus context. |
| Company API | [companies.py](../backend/app/api/v1/companies.py) | Company-scoped admin, approvals, invitations, member changes, and ownership transfers. |
| Recovery API/workflow | [recovery.py](../backend/app/api/v1/recovery.py), [recovery_graph.py](../backend/app/services/recovery_graph.py), [approval_service.py](../backend/app/services/approval_service.py) | Start/read/decide recovery proposals and run/revalidate/apply the workflow. |
| Data models | [models/](../backend/app/models) | SQLAlchemy records for users, companies, projects, tasks, logs, leave, risk, proposals, notifications, and audit history. |

### 8. Backend API modules at a glance

All application APIs are mounted below `/api/v1`. The feature-to-router map is:

| Feature | Router |
| --- | --- |
| Signup, login, current user | `auth.py` |
| Projects and project membership | `projects.py` |
| Tasks, progress, blockers, dependencies | `tasks.py` |
| Daily updates and work logs/exports | `work_logs.py` |
| Leave requests and team availability | `leave.py` |
| Risk analysis, history, config, update signals | `risk.py` |
| Recovery plan generation and decisions | `recovery.py` |
| Employee Focus Guardian notes | `focus_guardian.py` |
| Agenda Alignment records/review/clarification | `agenda_drift.py` |
| Company members, invitations, transfers, analytics | `companies.py` |
| Notifications | `notifications.py` |
| Project audit history | `audit.py` |
| Project and portfolio analytics | `analytics.py` |

Use the route decorators in each router to see the exact HTTP method and path.
FastAPI's interactive API documentation is available at `/docs` when the
backend is running.

### 9. Important data and domain concepts

- **Company** is the tenant boundary. A user and project belong to a company;
  company-admin endpoints also check the company ID in the URL.
- **Project membership** controls project visibility. Managers work only with
  projects they lead or are assigned to; access is checked on the server.
- **Task dependency** means one task is a prerequisite for another. It affects
  valid task order and projected completion dates.
- **Work log** is actual time recorded against a task. **Daily update** is a
  dated statement of progress/blocker/context; they are related but not the
  same record.
- **Risk analysis** is a reproducible snapshot from task, capacity, leave,
  blocker, dependency, and update-freshness facts. History records the
  assessment and relevant configuration/version data.
- **Daily update signal** is a candidate blocker/dependency/scope change
  extracted from user-provided notes. It waits for manager review instead of
  silently changing the project.
- **Agenda drift record** stores a task update's alignment status, evidence,
  confidence, employee clarification, and manager review state.
- **Recovery proposal** stores suggested changes and their provenance.
  **Proposal decision** stores a manager's later choice and execution report.
- **Audit event** is a durable record of significant business actions; it is
  separate from a normal UI notification.

The code defaults to SQLite for local development and can be configured for
PostgreSQL using `DATABASE_URL`; SQLAlchemy is the ORM and Alembic provides
versioned migrations. The backend startup path is described in
[backend/README.md](../backend/README.md).

### 10. Scope: implemented behavior versus product vision

The top-level README describes some product goals and possible future
integrations. Viva explanations should distinguish those from features wired
into the current routes:

- The current repository has working project/task, work activity, leave,
  risk, agenda-drift, company-admin, analytics, notification, audit, and
  recovery API modules and corresponding pages.
- The README's **Automation Advisor** is a product concept, but this repository
  has no automation page, automation API router, or automation-execution
  workflow registered in the current app. Do not claim that it executes
  n8n/Python automations.
- The agent workflow diagram in the README is a conceptual overview. The
  implemented recovery graph is the concrete workflow described in Part II;
  other features use their own APIs/services and should not be described as
  nodes in that recovery graph.
- The top-level README's sample API table is illustrative in places. For
  operational endpoints, use the actual decorators under
  `backend/app/api/v1/` or the running `/docs` page.

### 11. Short whole-project viva explanation

“WorkPilot AI is a full-stack project and workforce-planning system. Managers
organize company projects, assign dependent tasks, and monitor delivery.
Employees update task progress, record work, report blockers, provide context,
and request leave. React pages use a shared API client to send requests to a
FastAPI backend. The backend checks identity, approval, role, company and
project access, validates data, and stores it through SQLAlchemy.

“Risk and schedule calculations are deterministic and use project facts such
as remaining work, deadlines, dependencies, blockers, team capacity, and
approved leave. AI assists with text interpretation and recovery suggestions,
but suggestions are validated by backend rules. A manager must review and
approve a recovery proposal before valid task changes are applied. The system
also records audits and notifications so important actions remain traceable.”

## Part II: Authentication-to-recovery deep dive

### 1. The flow at a glance

```text
Browser
  App.tsx -> AuthContext.tsx -> services/api.ts
                                  |
                                  v
FastAPI app/main.py -> api/v1/__init__.py
  -> auth.py (signup/login/me) -> core/security.py and core/dependencies.py
  -> approved manager workspace -> RecoveryPlansView.tsx
  -> recovery API -> recovery_graph.py
       context -> risk -> leave -> schedule -> AI planner -> validation
       -> pending proposal
  -> manager decision -> approval_service.py
       revalidate current data -> apply actions in transaction -> audit/risk update
```

In the diagram, arrows show the usual runtime call path, not imports alone.
The browser handles screens and navigation; the backend is authoritative for
identity, approval, role, project access, and task changes.

### 2. Account creation and email verification

### Frontend path

1. `frontend/src/main.tsx` mounts the React application.
2. `frontend/src/App.tsx` provides `BrowserRouter`, `AuthProvider`, and
   `ProjectProvider`, then registers `/signup`.
3. `frontend/src/pages/Signup.tsx` collects the user's details and one of the
   supported signup paths. It first calls `api.sendSignupOtp(...)`, then, after
   the code is entered, calls `signup(...)` from `AuthContext`.
4. `frontend/src/services/api.ts` sends those requests to `/api/v1/auth/...`.
5. On success, the page navigates to the home path calculated from the
   server-returned user.

### Backend path

1. `backend/app/main.py` creates the FastAPI app and mounts the versioned router.
   `backend/app/api/v1/__init__.py` registers the authentication and recovery
   routers under `/api/v1`.
2. `backend/app/api/v1/auth.py` handles `POST /auth/signup/send-otp`. It
   normalizes the email, applies rate limits, and calls
   `backend/app/services/email_verification.py`.
3. The email service creates a six-digit OTP, stores an HMAC hash rather than
   the code, emails it through SMTP, and enforces a 10-minute expiry, five
   attempts, and a 60-second resend cooldown. Successful verification consumes
   the code.
4. `POST /auth/signup` verifies that OTP before creating an account. The
   `UserSignup` schema in `backend/app/schemas/auth.py` validates input and
   rejects extra fields, so a client cannot add a field to self-grant a role.
5. `auth.py` hashes the password, creates the user and company membership, and
   assigns the account's initial approval state. Signup by company code is
   `PENDING`; an accepted invitation and the creator of a new company are
   `APPROVED`. A company creator also receives a Company Admin grant; this is
   separate from the project role.
6. The endpoint returns a bearer access token and a `UserOut` object. The
   response includes `approval_status`, role, allowed `workspaces`, and any
   administered company IDs.

The three signup paths are intentionally different:

| Signup choice | Result |
| --- | --- |
| `ADMIN` with a new company name | Creates a company; creator becomes its Company Admin. They are a project manager only if `also_manager` was selected. |
| `MANAGER` with a company code | Requests to join that company; pending until a Company Admin approves. Manager signup also requires a designation. |
| `EMPLOYEE` with a company code | Requests to join that company; pending until a Company Admin approves. |
| Manager or employee invitation | Joins the invitation's company and role after the backend checks the invitation's email, role, status, and expiry. |

### 3. Sign-in, session restoration, and access control

### Sign-in and session restoration

1. `/login` is rendered by `frontend/src/pages/Login.tsx`.
2. The submit handler calls `login(...)` from `frontend/src/context/AuthContext.tsx`.
3. The context calls `api.login(...)` in `frontend/src/services/api.ts`, which
   sends `POST /api/v1/auth/login`.
4. `backend/app/api/v1/auth.py` looks up the normalized email and compares the
   submitted password with the stored bcrypt hash using
   `backend/app/core/security.py`. A mismatch returns HTTP 401.
5. On success, the backend creates a signed JWT and returns it with the user.
   The frontend saves the token as `workpilot_token` in `localStorage` and
   updates its auth context.
6. On a later browser load, `AuthContext.tsx` finds the saved token and calls
   `GET /api/v1/auth/me`. Only after the backend confirms the token and reloads
   the user does the app restore the signed-in state.

`services/api.ts` adds `Authorization: Bearer <token>` to requests when a token
exists. `core/security.py` signs and decodes the JWT using the configured
secret, algorithm, and expiry. The token's `sub` identifies the user; the
backend fetches that user from the database on protected requests.

### Authorization and navigation

- `backend/app/core/dependencies.py` contains the backend authentication
  dependencies. `get_authenticated_user` validates the token and loads the
  account. `get_current_user` additionally requires `APPROVED`; `require_manager`
  additionally requires the `MANAGER` project role.
- `/auth/me` uses `get_authenticated_user`, so a pending member can still
  retrieve their account state. Business endpoints use the approved-user
  dependency and reject pending, rejected, or deactivated accounts.
- `auth.py` computes the `workspaces` field from approval, role, company, and
  active Company Admin grants. `frontend/src/utils/workspace.ts` uses that
  server-provided list to select a home route.
- `ProtectedRoute` in `frontend/src/App.tsx` redirects signed-out visitors to
  `/login`, unapproved users to `/pending-approval`, and users without access
  to the requested workspace to their permitted workspace.
- These frontend checks improve navigation, but are not security controls.
  Backend dependencies and project/tenant checks authorize each API call.

An expired or invalid token produces HTTP 401. The shared request handler in
`services/api.ts` clears the stored token and emits
`workpilot:session-expired`; `AuthContext.tsx` clears the in-memory user too.
There is no refresh-token flow. The login page's “Remember me” checkbox is
currently only UI state; it does not change token lifetime or persistence.

### 4. Getting from the manager workspace to recovery plans

1. The user's home route is typically `/manager` for a manager.
   `App.tsx` protects the manager routes with `ProtectedRoute` and renders
   `DashboardLayout`.
2. `ProjectProvider` in `frontend/src/context/ProjectContext.tsx` loads visible
   projects through `api.getProjects()` and keeps an `activeProject`.
3. The manager selects **Recovery Plans**, which is the `/manager/recovery`
   route in `App.tsx`, rendered by
   `frontend/src/pages/manager/RecoveryPlansView.tsx`.
4. That page checks planner availability with
   `GET /api/v1/recovery-planner/status`, lists prior proposals with
   `GET /api/v1/projects/{project_id}/recovery-proposals`, and can load saved
   employee Focus Guardian context for the active project.
5. When the manager chooses to generate a plan, the page calls
   `api.generateRecoveryProposal(projectId)`, which posts to
   `POST /api/v1/projects/{project_id}/recovery-proposals/generate`.

The API requires a manager account and checks that the caller can manage that
project before starting planning. `backend/app/api/v1/recovery.py` is the HTTP
layer; it delegates the work to `run_recovery_workflow(...)` in
`backend/app/services/recovery_graph.py`.

### 5. How the recovery-planning graph works

The workflow is a LangGraph `StateGraph`. Each node reads or updates a shared
`RecoveryWorkflowState`; edges determine which node runs next. The configured
sequence is defined in `build_recovery_workflow()`:

| Node | File/function | What happens |
| --- | --- | --- |
| `context_collector` | `recovery_graph.py:context_collector_node` | Loads the project, tasks, dependencies, members, recent daily updates, and saved employee context from the database. If the project is missing, the graph stops. |
| `risk_analyzer` | `recovery_graph.py:risk_analyzer_node` | Recomputes deterministic project risk through `risk_service.py` and attaches the analysis to the graph state. |
| `leave_impact` | `recovery_graph.py:leave_impact_node` | Loads approved leave for project members. Pending or rejected leave does not reduce availability. |
| `schedule_analyzer` | `recovery_graph.py:schedule_analyzer_node`; `recovery_scheduler.py` | Calculates remaining work, capacity, task ordering, dependency constraints, projected dates, lateness, and schedule feasibility. This is deterministic code, not an LLM calculation. |
| `recovery_planner` | `recovery_graph.py:recovery_planner_node`; `recovery_ai_planner.py` | Builds project facts and asks the configured model for one or more candidate strategies in JSON. The parser limits and normalizes the returned strategies/actions. |
| `output_validator` | `recovery_graph.py:output_validator_node`; `recovery_validation.py` and `recovery_scheduler.py` | Checks proposed actions against real project tasks, members, allowed values, and task state; simulates each usable strategy again; compares projected schedules; selects a usable strategy. |
| `approval_queue` | `recovery_graph.py:approval_queue_node` | Saves the validated plan as `PENDING_APPROVAL`, stores the generation trace and audit event, and marks older pending plans for that project `SUPERSEDED`. |

The schedule simulator in `recovery_scheduler.py` uses documented assumptions:
six focused hours per person per business day, Monday-to-Friday workdays,
approved leave skipped, remaining task effort based on estimated hours and
reported progress, and prerequisites completed before dependent tasks begin.
It assumes blocked work resumes after two business days and does not model
public holidays. These are projections, not guaranteed finish dates.

The LLM is a proposal generator, not the authority on project facts. It is
given project/task facts, recent update text, approved leave dates, capacity,
and employee notes. The model facts exclude email addresses, leave reasons,
and API keys. The response is still treated as untrusted: the backend validates
actions and re-simulates schedules before displaying a proposal.

### Short-circuit and error cases

- If deterministic risk is low, the schedule is feasible, and there are no
  actionable rules, the planner skips generation and returns “no action needed”
  (the API returns HTTP 409).
- If recovery is needed but no LLM provider is configured, generation fails
  (HTTP 503); it does not silently create a rule-based proposal.
- If a configured model call fails, a rule-based fallback may be produced.
  That fallback must pass the same validator and schedule simulation as an AI
  strategy. If no strategy has usable actions, nothing is saved.
- HTTP 403 indicates an approval, role, or project-access denial. HTTP 401
  indicates invalid or expired authentication.

### 6. Reviewing and deciding a proposal

1. After generation, `RecoveryPlansView.tsx` reloads the project proposals and
   opens the returned plan in `frontend/src/components/risk/RecoveryReviewModal.tsx`.
2. The review UI displays the proposal status, suggested task changes,
   rationale, assumptions, before/after schedule comparison, validation
   results, and generation trace. `RecoveryInsights.tsx` contains supporting
   trace and schedule views.
3. The manager chooses approve, reject, or defer. The modal calls
   `api.decideRecoveryProposal(...)` in `services/api.ts`, which sends
   `POST /api/v1/recovery-proposals/{proposal_id}/decide`.
4. `backend/app/api/v1/recovery.py` calls
   `apply_recovery_decision(...)` in
   `backend/app/services/approval_service.py`.
5. For approval only, the backend rebuilds current project context and validates
   the stored actions again. It checks whether relevant task fields have
   changed since the proposal was made. A stale or now-invalid proposal returns
   HTTP 409 and applies nothing; the manager should generate a fresh plan.
6. If revalidation succeeds, valid non-advisory actions are applied in one
   database transaction. Advisory actions are recorded but do not modify task
   data. The proposal decision, applied-change report, and audit event are
   stored. If task changes were applied, project risk is recomputed.
7. The UI refreshes its proposal list. Approved plans show execution results;
   rejected and deferred plans are recorded without applying their actions.

The supported task actions are validated operations such as reassignment,
rescheduling/deadline extension, reprioritization, and blocker/dependency
handling. `approval_service.py` contains the actual mutations. Generating a
proposal, by itself, never modifies tasks.

### 7. Data and API objects to know

- **User**: account record including role, password hash, company, and approval
  status (`backend/app/models/user.py`).
- **Project / Task**: the business records and dependency relationships used
  to calculate risk and schedule.
- **RecoveryProposal**: saved plan, proposed actions, status, rationale, and
  `generation_trace` (`backend/app/models/recovery.py`).
- **ProposalDecision**: manager's approve/reject/defer choice, notes, actual
  applied changes, and execution report.
- **Generation trace**: evidence of the graph run, LLM/provider status,
  deterministic findings, strategy selection, validation, and schedule
  comparison. Useful for explaining why a plan was produced.
- **Audit event**: durable record of proposal generation and decisions.

The important API contracts are:

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
GET  /api/v1/projects/{project_id}/recovery-proposals
POST /api/v1/projects/{project_id}/recovery-proposals/generate
POST /api/v1/recovery-proposals/{proposal_id}/decide
```

### 8. Key terms for the viva

| Term | Meaning in this project |
| --- | --- |
| Authentication | Proving who the user is, here by email/password or a signed session token. |
| Authorization | Deciding what the authenticated user may access; enforced by backend dependencies and project/company checks. |
| Password hash | One-way bcrypt representation stored instead of a readable password. Verification compares a password against that hash. |
| OTP | One-time email verification code used to prove control of an email address during signup. |
| JWT / bearer token | Signed token sent in the `Authorization` header. The API decodes it and retrieves the account. |
| Role | Project-level account type such as `MANAGER` or `EMPLOYEE`; it is not the same as Company Admin status. |
| Approval status | Membership state such as `PENDING`, `APPROVED`, or `DEACTIVATED`; business APIs require an approved account. |
| Workspace | UI destination derived from server-returned role, status, and admin grants. It is not a substitute for backend authorization. |
| Dependency injection | FastAPI supplies shared concerns such as the database session and authenticated user to endpoint functions with `Depends(...)`. |
| ORM | SQLAlchemy maps Python models to database tables and rows. |
| Deterministic analysis | Same inputs and date produce the same result; used for risk, capacity, scheduling, and validation. |
| LLM | Language model used to suggest explanations and recovery strategies from supplied project facts. |
| LangGraph node / edge / state | A processing step / transition rule / shared workflow data object in the recovery pipeline. |
| Validation | Deterministic checking that a suggestion refers to real tasks and allowed changes and remains consistent with project data. |
| Schedule simulation | A model-based projection of task finish dates under stated assumptions; not a promise or measured outcome. |
| Proposal vs. decision | A proposal is a pending suggestion. A decision is the manager's later action; only successful approval applies valid changes. |
| Transaction | A group of database changes committed together or rolled back together if application fails. |

### 9. A concise viva answer

“The React app starts in `App.tsx`, where `AuthProvider` restores the saved
bearer token by calling `/auth/me`. Login is sent through the shared API client
to FastAPI's `/auth/login`; the backend verifies the bcrypt password, issues a
signed JWT, and returns the user and server-computed workspaces. Protected
screens guide the user to the correct workspace, while backend dependencies
enforce approval, manager role, and project access on every business request.

“From the manager's Recovery Plans page, the frontend posts the active project
ID to the recovery endpoint. The backend runs a LangGraph that collects project
context, recalculates deterministic risk, includes approved leave, simulates
the schedule, asks the configured LLM for candidate strategies, validates and
re-simulates them, then saves a pending proposal with its trace. Nothing is
changed at generation time. If the manager approves, the backend checks
authorization and revalidates against current task data; stale proposals are
rejected without changes. Only then are valid actions applied transactionally
and recorded in the decision and audit history.”

### 10. Notes and boundaries

- This guide concerns **project recovery planning**, not account/password
  recovery. The login screen currently links to `/forgot-password`, but the
  route and password-reset API are not registered in the current app.
- The “Remember me for 30 days” checkbox is not wired to a separate persistence
  policy; the current auth context stores the access token in `localStorage`.
- Some company creators are administration-only (`role = ADMIN`) unless they
  also choose manager access. The recovery generation and decision endpoints
  use `require_manager`, so a Company Admin grant alone does not satisfy that
  manager-role requirement.
- The backend README has environment setup, SMTP settings, LLM provider
  configuration, and migration details:
  [backend README](../backend/README.md).
