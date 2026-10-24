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
import { CompanyLayout } from './components/company/CompanyLayout';

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
import { CompanyPortalView } from './pages/manager/CompanyPortalView';

// Company Portal Views (designated Company Admin only)
import { CompanyIndexRedirect } from './pages/company/CompanyIndexRedirect';
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

// Role Guard Component
// UI routing only: every API endpoint enforces the same rules server-side.
const ProtectedRoute: React.FC<{
  children: React.ReactElement;
  requiredRole?: 'MANAGER' | 'EMPLOYEE' | 'ADMIN';
  /** Only the designated Company Admin of at least one company. */
  requireCompanyAdmin?: boolean;
  /** Allow signed-in users whose membership is not approved yet. */
  allowUnapproved?: boolean;
}> = ({
  children,
  requiredRole,
  requireCompanyAdmin,
  allowUnapproved,
}) => {
  const { user, isLoading, isManager, isAdmin, isApproved, isCompanyAdmin } = useAuth();

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

  if (requireCompanyAdmin && !isCompanyAdmin) {
    return <Navigate to={isManager ? '/manager' : '/employee'} replace />;
  }

  if (requiredRole === 'MANAGER' && !isManager) {
    return <Navigate to="/employee" replace />;
  }

  if (requiredRole === 'ADMIN' && !isAdmin) {
    return <Navigate to="/employee" replace />;
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
                <ProtectedRoute requiredRole="MANAGER">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ManagerOverview />} />
              {/* Legacy path: Company Portal now lives at /company */}
              <Route path="company" element={<Navigate to="/company" replace />} />
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

            {/* Company Portal: designated Company Admins only. MANAGER or
                ADMIN role alone does not open it. */}
            <Route
              path="/company"
              element={
                <ProtectedRoute requireCompanyAdmin>
                  <CompanyLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CompanyIndexRedirect />} />
              <Route path=":companyId" element={<CompanyPortalView />} />
              <Route path=":companyId/approvals" element={<CompanyApprovalsView />} />
              <Route path=":companyId/invitations" element={<CompanyInvitationsView />} />
              <Route path=":companyId/analytics" element={<CompanyAnalyticsView />} />
              <Route path=":companyId/ownership" element={<CompanyOwnershipView />} />
              <Route path=":companyId/activity" element={<CompanyActivityView />} />
            </Route>

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
                <ProtectedRoute>
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
