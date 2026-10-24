export type UserRole = 'MANAGER' | 'EMPLOYEE' | 'ADMIN';

export interface UserSimple {
  id: number;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

export interface User extends UserSimple {
  created_at: string;
  phone_number?: string;
  company_name?: string;
  designation?: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approval_reviewed_at?: string;
  approval_notes?: string;
  company_id?: number;
  /** Companies this user is the designated Company Admin of (UI hint only;
   * the backend re-checks authorization on every request). */
  administered_company_ids?: number[];
}

/** Company Admin-only portal data (includes the join code and members). */
export interface Company {
  id: number;
  name: string;
  join_code: string;
  created_at: string;
  employee_count: number;
  manager_count: number;
  pending_count: number;
  admin_user_id: number;
  members: CompanyMember[];
}

/** What any approved manager may see about their own company. */
export interface CompanySummary {
  id: number;
  name: string;
  created_at: string;
  employee_count: number;
  manager_count: number;
  is_company_admin: boolean;
}

export interface AdministeredCompany {
  id: number;
  name: string;
  pending_approvals: number;
}

export interface CompanyInvitation {
  id: number;
  email: string;
  intended_role: 'MANAGER' | 'EMPLOYEE';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
}

export interface CompanyInvitationCreated extends CompanyInvitation {
  invite_url: string;
  email_sent: boolean;
}

export interface InvitationPreview {
  company_name: string;
  email: string;
  intended_role: 'MANAGER' | 'EMPLOYEE';
  expires_at: string;
}

export interface CompanyAdminTransfer {
  id: number;
  company_id: number;
  company_name: string;
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  decided_at?: string | null;
}

export interface CompanyAuditEvent {
  id: number;
  actor_id?: number | null;
  event_type: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface CompanyAnalytics {
  members: {
    managers: number;
    employees: number;
    pending: number;
    rejected: number;
  };
  pending_invitations: number;
  project_count: number;
  portfolio: {
    distribution: { risk_level: string; count: number }[];
    projects: {
      project_id: number;
      name: string;
      status: string;
      risk_level: string | null;
    }[];
  };
}

export interface CompanyMember {
  id: number;
  full_name: string;
  email: string;
  role: 'MANAGER' | 'EMPLOYEE' | string;
  designation?: string;
  approval_status: string;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user_id: number;
  role_in_project: string;
  joined_at: string;
  user: UserSimple;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  manager_id: number;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  start_date: string;
  target_end_date: string;
  created_at: string;
  updated_at: string;
  manager?: UserSimple;
  members: ProjectMember[];
  task_count?: number;
  completed_task_count?: number;
  completion_percentage?: number;
  latest_risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

export interface TaskDependency {
  id: number;
  task_id: number;
  prerequisite_task_id: number;
  created_at: string;
  prerequisite_task_title?: string;
  prerequisite_task_status?: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  assignee_id?: number;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_hours: number;
  actual_hours: number;
  progress_pct: number;
  start_date: string;
  due_date: string;
  is_blocked: boolean;
  blocker_reason?: string;
  created_at: string;
  updated_at: string;
  assignee?: UserSimple;
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
}

export interface WorkLog {
  id: number;
  task_id: number;
  user_id: number;
  hours_spent: number;
  notes?: string;
  log_date: string;
  created_at: string;
  user?: UserSimple;
}

export interface DailyUpdate {
  id: number;
  task_id: number;
  user_id: number;
  progress_pct: number;
  is_blocked: boolean;
  blocker_notes?: string;
  update_notes?: string;
  date: string;
  created_at: string;
  user?: UserSimple;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  status: LeaveStatus;
  reviewed_by?: number;
  reviewed_at?: string;
  decision_notes?: string;
  created_at: string;
  user?: UserSimple;
  reviewer?: UserSimple;
}

export interface TriggeredRule {
  rule_id: string;
  rule_name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence: Record<string, any>;
  affected_task_ids: number[];
}

export interface MissingDataFlag {
  field_or_type: string;
  message: string;
  task_id?: number;
}

export interface RiskAnalysis {
  id: number;
  project_id: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
  score: number;
  triggered_rules: TriggeredRule[];
  evidence_json: Record<string, any>;
  missing_data_flags: MissingDataFlag[];
  created_at: string;
}

export type ProposedActionType =
  | 'REASSIGN'
  | 'EXTEND_DEADLINE'
  | 'RESCHEDULE'
  | 'REPRIORITIZE'
  | 'RESOLVE_DEPENDENCY'
  | 'ESCALATE_BLOCKER'
  | 'SPLIT_EFFORT';

export interface ActionValidation {
  status: 'VALID' | 'ADVISORY' | 'INVALID';
  errors: string[];
  warnings: string[];
}

export interface ProposedAction {
  action_id: string;
  action_type: ProposedActionType;
  task_id: number;
  task_title: string;
  original_values: Record<string, any>;
  proposed_values: Record<string, any>;
  reason: string;
  expected_impact: string;
  /** 'AI' = suggested by the language model, 'RULE' = rule-based planner. */
  source?: 'AI' | 'RULE' | null;
  is_advisory?: boolean;
  validation?: ActionValidation | null;
}

export type GenerationMode = 'AI_HYBRID' | 'RULE_BASED_FALLBACK' | 'RULE_BASED';

export interface LLMTrace {
  invoked: boolean;
  provider?: string | null;
  model?: string | null;
  status?: 'SUCCEEDED' | 'SUCCEEDED_NO_STRATEGIES' | 'FAILED' | 'NOT_CONFIGURED' | 'SKIPPED' | null;
  error?: string | null;
  error_category?: string | null;
  latency_ms?: number | null;
  skip_reason?: string | null;
  prompt_version?: string | null;
}

export interface ScheduleRow {
  task_id: number;
  title: string;
  assignee_id?: number | null;
  assignee_name?: string | null;
  status: TaskStatus;
  is_blocked: boolean;
  start_date: string;
  due_date: string;
  projected_start?: string | null;
  projected_finish?: string | null;
  late: boolean;
  slip_business_days: number;
}

export interface WorkloadRow {
  user_id: number | null;
  name: string;
  role?: string | null;
  open_task_count: number;
  remaining_hours: number;
  capacity_hours: number;
  utilization_pct: number | null;
  over_capacity: boolean;
  leave_business_days: number;
}

export interface StrategyTrace {
  strategy_id: string;
  name: string;
  approach: string;
  source: 'AI' | 'RULE';
  summary: string;
  benefits: string[];
  trade_offs: string[];
  assumptions: string[];
  risks: string[];
  selected: boolean;
  actions: {
    action_type: ProposedActionType;
    task_id: number;
    task_title: string;
    proposed_values: Record<string, any>;
    reason: string;
    validation: ActionValidation;
  }[];
  evaluation: {
    accepted_action_count: number;
    rejected_action_count: number;
    projected_completion_before?: string | null;
    projected_completion_after?: string | null;
    business_days_saved?: number | null;
    late_tasks_before?: number;
    late_tasks_after?: number;
  };
}

export interface ScheduleComparison {
  label: string;
  method: string;
  assumptions: string[];
  computed_for: string;
  target_end_date?: string | null;
  before: { projected_completion?: string | null; business_days_vs_target?: number | null; tasks: ScheduleRow[] };
  after: { projected_completion?: string | null; business_days_vs_target?: number | null; tasks: ScheduleRow[] };
  business_days_saved?: number | null;
  changed_task_ids: number[];
  dependency_conflicts_before: { task_id: number; prerequisite_id: number; task_due: string; prerequisite_due: string }[];
  workload_before: WorkloadRow[];
  workload_after: WorkloadRow[];
}

export interface GenerationTrace {
  run_id?: string | null;
  status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  generation_mode?: GenerationMode | null;
  llm?: LLMTrace | null;
  graph_nodes: string[];
  deterministic_findings: Record<string, any>;
  ai_analysis?: {
    delay_explanation?: string | null;
    recommended_strategy_id?: string | null;
    recommendation_reason?: string | null;
  } | null;
  selected_strategy_id?: string | null;
  selection_reason?: string | null;
  strategies: StrategyTrace[];
  rejected_actions: {
    strategy_id: string;
    source: 'AI' | 'RULE';
    action_type: string;
    task_id: number;
    errors: string[];
  }[];
  validation: {
    status?: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'PASSED_WITH_REJECTIONS';
    errors?: string[];
    warnings?: string[];
    validated_at?: string;
  };
  schedule_comparison: Partial<ScheduleComparison>;
}

export interface ExecutionReport {
  status?: 'SUCCEEDED' | 'NOT_APPLICABLE';
  revalidated_at?: string;
  applied_count?: number;
  advisory_not_applied?: { task_id: number; action_type: string; note: string }[];
  warnings?: string[];
  errors?: string[];
}

export interface ProposalDecision {
  id: number;
  proposal_id: number;
  decider_id: number;
  decision: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  decision_notes?: string;
  applied_changes: any[];
  execution_report?: ExecutionReport;
  decided_at: string;
  decider?: UserSimple;
}

export interface FocusGuardianContext {
  id: number;
  task_id: number;
  task_title: string;
  user_id: number;
  employee_name: string;
  reason: string;
  context: string;
  created_at: string;
}

export interface RecoveryProposal {
  id: number;
  project_id: number;
  risk_analysis_id?: number;
  title: string;
  summary: string;
  proposed_actions: ProposedAction[];
  focus_contexts: FocusGuardianContext[];
  rationale: string;
  assumptions: string[];
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'SUPERSEDED';
  created_at: string;
  decisions: ProposalDecision[];
  generation_trace?: GenerationTrace;
}

export interface RecoveryPlannerStatus {
  llm_configured: boolean;
  provider: string | null;
  model: string | null;
  mode_when_recovery_needed: GenerationMode;
}

export interface ProjectAnalytics {
  project_id: number;
  project_name: string;
  generated_for: string;
  target_end_date: string;
  summary: {
    task_count: number;
    open_task_count: number;
    estimated_hours_total: number;
    completed_hours_estimate: number;
    completion_pct: number | null;
    remaining_hours: number;
    capacity_hours_until_target: number;
    unestimated_open_tasks: number;
  };
  status_distribution: { status: TaskStatus; count: number }[];
  deadlines: {
    window_days: number;
    overdue: DeadlineRow[];
    upcoming: DeadlineRow[];
  };
  workload: {
    horizon_start: string;
    horizon_end: string;
    hours_per_day: number;
    members: WorkloadRow[];
  };
  projection: {
    projected_completion: string | null;
    target_end_date: string | null;
    business_days_vs_target: number | null;
    feasible: boolean;
    method: string;
    assumptions: string[];
    late_task_ids: number[];
  };
  progress_trend: {
    available: boolean;
    reason: string | null;
    method: string;
    tasks_included: number;
    tasks_total: number;
    points: { date: string; planned_pct: number; actual_pct: number }[];
  };
  risk_history: {
    available: boolean;
    reason: string | null;
    points: { created_at: string; score: number; risk_level: string }[];
  };
}

export interface DeadlineRow {
  task_id: number;
  title: string;
  assignee_name?: string | null;
  due_date: string;
  days_from_today: number;
  status: TaskStatus;
  is_blocked: boolean;
  priority: TaskPriority;
}

export interface PortfolioHealth {
  distribution: { risk_level: string; count: number }[];
  projects: {
    project_id: number;
    name: string;
    status: string;
    target_end_date: string;
    risk_level: string | null;
    risk_score: number | null;
    analyzed_at: string | null;
  }[];
}

export interface AuditEvent {
  id: number;
  project_id: number;
  actor_id?: number;
  event_type: string;
  description: string;
  metadata_json: Record<string, any>;
  created_at: string;
  actor?: UserSimple;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface TeamMemberAvailability {
  user: UserSimple;
  active_task_count: number;
  total_remaining_hours: number;
  capacity_status: 'OVERLOADED' | 'OPTIMAL' | 'AVAILABLE';
  is_on_leave_today: boolean;
  upcoming_leaves: {
    id: number;
    start_date: string;
    end_date: string;
    reason?: string;
  }[];
}
