import api from './api';

// MOCK DATA: Simulating a backend response
const mockDashboardData = {
  tasks: [
    { id: 1, title: 'Design Landing Page', status: 'In Progress', priority: 'High' },
    { id: 2, title: 'Fix Auth Bug', status: 'Pending', priority: 'Critical' },
    { id: 3, title: 'Update Documentation', status: 'Completed', priority: 'Low' },
  ],
  deadlines: [
    { id: 101, project: 'Q3 Marketing Site', date: '2026-10-20' },
    { id: 102, project: 'API Migration', date: '2026-11-05' },
  ],
  leaveStatus: {
    balance: 14,
    pendingRequests: 1,
    nextLeave: '2026-12-24',
  }
};

export const getEmployeeDashboard = async () => {
  // Simulate a network call with a 1.5s delay to show loading animation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: mockDashboardData });
    }, 1500);
  });
};