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

export interface ProposedAction {
  action_id: string;
  action_type: 'REASSIGN' | 'EXTEND_DEADLINE' | 'RESOLVE_DEPENDENCY' | 'ESCALATE_BLOCKER' | 'SPLIT_EFFORT';
  task_id: number;
  task_title: string;
  original_values: Record<string, any>;
  proposed_values: Record<string, any>;
  reason: string;
  expected_impact: string;
}

export interface ProposalDecision {
  id: number;
  proposal_id: number;
  decider_id: number;
  decision: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  decision_notes?: string;
  applied_changes: any[];
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
