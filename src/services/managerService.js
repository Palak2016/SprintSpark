import api from './api';

// MOCK DATA: Manager Dashboard Overview
const mockManagerDashboard = {
  projectHealth: [
    { id: 1, name: 'AI Finance Assistant', status: 'On Track', risk: 'Low' },
    { id: 2, name: 'E-commerce Redesign', status: 'At Risk', risk: 'High' },
    { id: 3, name: 'Mobile App V2', status: 'Delayed', risk: 'Medium' },
  ],
  teamWorkload: [
    { id: 1, member: 'Alex Chen', capacity: 85 },
    { id: 2, member: 'Sarah Jenkins', capacity: 100 },
    { id: 3, member: 'Marcus Ray', capacity: 45 },
  ],
  highRiskTasks: [
    { id: 101, title: 'Database Migration', project: 'E-commerce Redesign', assignee: 'Alex Chen' },
    { id: 102, title: 'Payment Gateway Integration', project: 'Mobile App V2', assignee: 'Sarah Jenkins' },
  ]
};

// MOCK DATA: Task Board (Kanban/List)
const mockTasks = [
  { id: 1, title: 'Setup Authentication', status: 'Done', priority: 'High', assignee: 'Alex Chen' },
  { id: 2, title: 'Design Database Schema', status: 'In Progress', priority: 'Critical', assignee: 'Sarah Jenkins' },
  { id: 3, title: 'Build UI Components', status: 'In Progress', priority: 'Medium', assignee: 'Marcus Ray' },
  { id: 4, title: 'Write API Documentation', status: 'Todo', priority: 'Low', assignee: 'Alex Chen' },
  { id: 5, title: 'Client Feedback Implementation', status: 'Review', priority: 'High', assignee: 'Sarah Jenkins' },
];

export const getManagerDashboard = async () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: mockManagerDashboard }), 1500);
  });
};

export const getProjectTasks = async (projectId = 'default') => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: mockTasks }), 1500);
  });
};