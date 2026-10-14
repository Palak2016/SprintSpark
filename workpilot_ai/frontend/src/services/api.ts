import {
  User, Project, Task, WorkLog, DailyUpdate, LeaveRequest,
  RiskAnalysis, RecoveryProposal, ProposalDecision, AuditEvent,
  Notification, TeamMemberAvailability, UserSimple
} from '../types';

const API_BASE = '/api/v1';

class ApiService {
  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem('workpilot_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      // If unauthorized on protected endpoint, clear token
      if (endpoint !== '/auth/login' && endpoint !== '/auth/signup') {
        localStorage.removeItem('workpilot_token');
        localStorage.removeItem('workpilot_user');
      }
    }

    if (!res.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errorData = await res.json();
        errorMsg = errorData.detail || errorData.message || errorMsg;
      } catch {
        errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // --- Auth ---
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async sendSignupOtp(
    email: string,
    phone_number: string,
    role: 'EMPLOYEE' | 'MANAGER',
    manager_invite_code?: string
  ): Promise<{ message: string }> {
    return this.request('/auth/signup/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, phone_number, role, manager_invite_code })
    });
  }

  async signup(data: {
    full_name: string;
    email: string;
    phone_number: string;
    password: string;
    role: 'EMPLOYEE' | 'MANAGER';
    otp_code: string;
    manager_invite_code?: string;
  }): Promise<{ access_token: string; user: User }> {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMe(): Promise<User> {
    return this.request('/auth/me');
  }

  // --- Projects ---
  async getProjects(): Promise<Project[]> {
    return this.request('/projects');
  }

  async getProject(id: number): Promise<Project> {
    return this.request(`/projects/${id}`);
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateProject(id: number, data: Partial<Project>): Promise<Project> {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async addProjectMember(projectId: number, userId: number, roleInProject: string): Promise<any> {
    return this.request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role_in_project: roleInProject })
    });
  }

  async removeProjectMember(projectId: number, userId: number): Promise<any> {
    return this.request(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE'
    });
  }

  async getAllUsers(): Promise<UserSimple[]> {
    return this.request('/projects/users/all');
  }

  // --- Tasks ---
  async getTasks(params?: { project_id?: number; assignee_id?: number; status_filter?: string; priority?: string }): Promise<Task[]> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.append('project_id', params.project_id.toString());
    if (params?.assignee_id) searchParams.append('assignee_id', params.assignee_id.toString());
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);
    if (params?.priority) searchParams.append('priority', params.priority);
    const qs = searchParams.toString();
    return this.request(`/tasks${qs ? `?${qs}` : ''}`);
  }

  async createTask(data: Partial<Task> & { prerequisite_ids?: number[] }): Promise<Task> {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateTask(id: number, data: Partial<Task>): Promise<Task> {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteTask(id: number): Promise<any> {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  }

  async updateTaskProgress(id: number, progressPct: number, status?: string, notes?: string): Promise<Task> {
    return this.request(`/tasks/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progress_pct: progressPct, status, notes })
    });
  }

  async reportBlocker(id: number, isBlocked: boolean, blockerReason?: string): Promise<Task> {
    return this.request(`/tasks/${id}/blocker`, {
      method: 'POST',
      body: JSON.stringify({ is_blocked: isBlocked, blocker_reason: blockerReason })
    });
  }

  async addTaskDependency(taskId: number, prerequisiteTaskId: number): Promise<any> {
    return this.request(`/tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ prerequisite_task_id: prerequisiteTaskId })
    });
  }

  async removeTaskDependency(taskId: number, prerequisiteTaskId: number): Promise<any> {
    return this.request(`/tasks/${taskId}/dependencies/${prerequisiteTaskId}`, {
      method: 'DELETE'
    });
  }

  // --- Work Logs & Daily Updates ---
  async getWorkLogs(params?: { task_id?: number; user_id?: number }): Promise<WorkLog[]> {
    const searchParams = new URLSearchParams();
    if (params?.task_id) searchParams.append('task_id', params.task_id.toString());
    if (params?.user_id) searchParams.append('user_id', params.user_id.toString());
    const qs = searchParams.toString();
    return this.request(`/work-logs${qs ? `?${qs}` : ''}`);
  }

  async createWorkLog(taskId: number, hoursSpent: number, notes?: string, logDate?: string): Promise<WorkLog> {
    return this.request('/work-logs', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, hours_spent: hoursSpent, notes, log_date: logDate })
    });
  }

  async getDailyUpdates(params?: { task_id?: number; user_id?: number }): Promise<DailyUpdate[]> {
    const searchParams = new URLSearchParams();
    if (params?.task_id) searchParams.append('task_id', params.task_id.toString());
    if (params?.user_id) searchParams.append('user_id', params.user_id.toString());
    const qs = searchParams.toString();
    return this.request(`/daily-updates${qs ? `?${qs}` : ''}`);
  }

  async submitDailyUpdate(data: { task_id: number; progress_pct: number; is_blocked: boolean; blocker_notes?: string; update_notes?: string; date?: string }): Promise<DailyUpdate> {
    return this.request('/daily-updates', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --- Leave Requests & Availability ---
  async getLeaveRequests(params?: { user_id?: number; status_filter?: string }): Promise<LeaveRequest[]> {
    const searchParams = new URLSearchParams();
    if (params?.user_id) searchParams.append('user_id', params.user_id.toString());
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);
    const qs = searchParams.toString();
    return this.request(`/leave-requests${qs ? `?${qs}` : ''}`);
  }

  async submitLeaveRequest(startDate: string, endDate: string, reason?: string): Promise<LeaveRequest> {
    return this.request('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ start_date: startDate, end_date: endDate, reason })
    });
  }

  async reviewLeaveRequest(leaveId: number, status: 'APPROVED' | 'REJECTED', decisionNotes?: string): Promise<LeaveRequest> {
    return this.request(`/leave-requests/${leaveId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, decision_notes: decisionNotes })
    });
  }

  async getTeamAvailability(): Promise<TeamMemberAvailability[]> {
    return this.request('/team-availability');
  }

  // --- Risk Intelligence ---
  async getRiskAnalysis(projectId: number): Promise<RiskAnalysis> {
    return this.request(`/projects/${projectId}/risk-analysis`);
  }

  async runRiskAnalysis(projectId: number): Promise<RiskAnalysis> {
    return this.request(`/projects/${projectId}/risk-analysis/run`, {
      method: 'POST'
    });
  }

  // --- AI Recovery Proposals ---
  async getRecoveryProposals(projectId: number): Promise<RecoveryProposal[]> {
    return this.request(`/projects/${projectId}/recovery-proposals`);
  }

  async generateRecoveryProposal(projectId: number): Promise<RecoveryProposal> {
    return this.request(`/projects/${projectId}/recovery-proposals/generate`, {
      method: 'POST'
    });
  }

  async decideRecoveryProposal(proposalId: number, decision: 'APPROVED' | 'REJECTED' | 'DEFERRED', decisionNotes?: string): Promise<ProposalDecision> {
    return this.request(`/recovery-proposals/${proposalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, decision_notes: decisionNotes })
    });
  }

  // --- Audit Trail ---
  async getAuditTrail(projectId: number): Promise<AuditEvent[]> {
    return this.request(`/projects/${projectId}/audit-trail`);
  }

  // --- Notifications ---
  async getNotifications(): Promise<Notification[]> {
    return this.request('/notifications');
  }

  async markNotificationRead(id: number): Promise<Notification> {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT'
    });
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.request('/notifications/read-all', {
      method: 'PUT'
    });
  }

}

export const api = new ApiService();
