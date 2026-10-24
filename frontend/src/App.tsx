import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';

// Pages
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { PendingApproval } from './pages/PendingApproval';

// Layout
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { AdminLayout } from './components/admin/AdminLayout';
import { Workspace } from './utils/workspace';

// Manager Views
import { ManagerOverview } from './pages/manager/ManagerOverview';
import { ProjectsView } from './pages/manager/ProjectsView';
import { TasksView } from './pages/manager/TasksView';
import { TeamAvailabilityView } from './pages/manager/TeamAvailabilityView';
import { LeaveManagementView } from './pages/manager/LeaveManagementView';
import { RiskIntelligenceView } from './pages/manager/RiskIntelligenceView';
import { RecoveryPlansView } from './pages/manager/RecoveryPlansView';
import { AuditHistoryView } from './pages/manager/AuditHistoryView';
import { SettingsView } from './pages/manager/SettingsView';

// Admin console (designated Company Admins only)
import { AdminIndexRedirect, LegacyCompanyRedirect } from './pages/admin/AdminIndexRedirect';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminMembersView } from './pages/admin/AdminMembersView';
import { AdminSettingsView } from './pages/admin/AdminSettingsView';
import { CompanyApprovalsView } from './pages/company/CompanyApprovalsView';
import { CompanyInvitationsView } from './pages/company/CompanyInvitationsView';
import { CompanyAnalyticsView } from './pages/company/CompanyAnalyticsView';
import { CompanyOwnershipView } from './pages/company/CompanyOwnershipView';
import { CompanyActivityView } from './pages/company/CompanyActivityView';
import { IncomingTransfersView } from './pages/company/IncomingTransfersView';

// Employee Views
import { EmployeeOverview } from './pages/employee/EmployeeOverview';
import { MyTasksView } from './pages/employee/MyTasksView';
import { WorkLogsView } from './pages/employee/WorkLogsView';
import { DailyUpdatesView } from './pages/employee/DailyUpdatesView';
import { EmployeeLeaveView } from './pages/employee/EmployeeLeaveView';
import { FocusGuardianView } from './pages/employee/FocusGuardianView';
import { ProfileSettingsView } from './pages/employee/ProfileSettingsView';
import { AccountSettingsView } from './pages/employee/AccountSettingsView';

// Route guard. UI routing only: every API endpoint enforces the same rules
// server-side. Workspace access comes from the server's /auth/me answer.
const ProtectedRoute: React.FC<{
  children: React.ReactElement;
  /** Workspace this route belongs to; omitted = any approved user. */
  workspace?: Workspace;
  /** Allow signed-in users whose membership is not approved yet. */
  allowUnapproved?: boolean;
}> = ({ children, workspace, allowUnapproved }) => {
  const { user, isLoading, isApproved, canOpen, workspaces, homePath } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-forest-700 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isApproved && !allowUnapproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (workspace && !canOpen(workspace)) {
    // Prefer the user's own project workspace, so a manager or employee link
    // (e.g. from a notification) never bounces into the Admin console.
    const ownWorkspace = workspaces.find((w) => w !== 'admin');
    return <Navigate to={ownWorkspace ? `/${ownWorkspace}` : homePath} replace />;
  }

  return children;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <Routes>
            {/* Public Marketing & Auth */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/pending-approval"
              element={
                <ProtectedRoute allowUnapproved>
                  <PendingApproval />
                </ProtectedRoute>
              }
            />

            {/* Manager Workspace Routes */}
            <Route
              path="/manager"
              element={
                <ProtectedRoute workspace="manager">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ManagerOverview />} />
              {/* Legacy path: company administration lives in the Admin console */}
              <Route path="company" element={<Navigate to="/admin" replace />} />
              <Route path="projects" element={<ProjectsView />} />
              <Route path="tasks" element={<TasksView />} />
              <Route path="my-tasks" element={<MyTasksView />} />
              <Route path="daily-updates" element={<DailyUpdatesView />} />
              <Route path="work-logs" element={<WorkLogsView />} />
              <Route path="team" element={<TeamAvailabilityView />} />
              <Route path="leave" element={<LeaveManagementView />} />
              <Route path="risk" element={<RiskIntelligenceView />} />
              <Route path="recovery" element={<RecoveryPlansView />} />
              <Route path="audit" element={<AuditHistoryView />} />
              <Route path="settings" element={<SettingsView />} />
            </Route>

            {/* Admin console: designated Company Admins only. The MANAGER or
                ADMIN role alone does not open it, and each company in the URL
                is checked again by AdminLayout and by every API call. */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute workspace="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminIndexRedirect />} />
              <Route path=":companyId" element={<Navigate to="overview" replace />} />
              <Route path=":companyId/overview" element={<AdminOverview />} />
              <Route path=":companyId/members" element={<AdminMembersView />} />
              <Route path=":companyId/approvals" element={<CompanyApprovalsView />} />
              <Route path=":companyId/invitations" element={<CompanyInvitationsView />} />
              <Route path=":companyId/analytics" element={<CompanyAnalyticsView />} />
              <Route path=":companyId/activity" element={<CompanyActivityView />} />
              <Route path=":companyId/ownership" element={<CompanyOwnershipView />} />
              <Route path=":companyId/settings" element={<AdminSettingsView />} />
              <Route path=":companyId/*" element={<Navigate to="overview" replace />} />
            </Route>

            {/* Old Company Portal links */}
            <Route path="/company" element={<Navigate to="/admin" replace />} />
            <Route path="/company/:companyId" element={<LegacyCompanyRedirect />} />
            <Route path="/company/:companyId/:section" element={<LegacyCompanyRedirect />} />

            {/* Accept / decline an incoming Company Admin transfer */}
            <Route
              path="/company-transfer"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<IncomingTransfersView />} />
            </Route>

            {/* Employee Workspace Routes */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute workspace="employee">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmployeeOverview />} />
              <Route path="tasks" element={<MyTasksView />} />
              <Route path="work-logs" element={<WorkLogsView />} />
              <Route path="daily-updates" element={<DailyUpdatesView />} />
              <Route path="leave" element={<EmployeeLeaveView />} />
              <Route path="focus" element={<FocusGuardianView />} />
              <Route path="settings" element={<AccountSettingsView />} />
            </Route>

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ProfileSettingsView />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
