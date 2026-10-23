import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';

// Pages
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';

// Layout
import { DashboardLayout } from './components/dashboard/DashboardLayout';

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
const ProtectedRoute: React.FC<{
  children: React.ReactElement;
  requiredRole?: 'MANAGER' | 'EMPLOYEE' | 'ADMIN';
}> = ({
  children,
  requiredRole
}) => {
  const { user, isLoading, isManager, isAdmin } = useAuth();

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
              <Route path="company" element={<CompanyPortalView />} />
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
