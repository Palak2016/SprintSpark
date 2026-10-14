import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ProjectTasks from './pages/ProjectTasks';
import LeaveRequestForm from './pages/LeaveRequestForm';
import LeaveManagement from './pages/LeaveManagement';
import RecoveryPlanner from './pages/RecoveryPlanner';
import AutomationAdvisor from './pages/AutomationAdvisor';
import WorkLog from './pages/WorkLog';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EmployeeDashboard />} />
        <Route path="/tasks" element={<ProjectTasks />} />
        <Route path="/leave" element={<LeaveRequestForm />} />
        <Route path="/work-log" element={<WorkLog />} />

        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/manager/leave" element={<LeaveManagement />} />
        <Route path="/manager/recovery" element={<RecoveryPlanner />} />
        <Route path="/manager/automation" element={<AutomationAdvisor />} />
      </Routes>
    </Router>
  );
}

export default App;