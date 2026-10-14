import api from './api';

const mockAnalysis = {
  projectId: 101,
  projectName: 'E-commerce Redesign',
  riskScore: 'High Risk',
  reasoning: 'Critical path delayed by 4 business days due to blocked database migration and resource bottlenecks in frontend styling.',
  proposal: {
    id: 'prop-901',
    risk_level: 'High',
    reasoning_summary: 'Re-allocating Alex Chen from minor bug fixes to core database migration will recover 3 days on the critical path, with minimal impact on documentation tasks.',
    recommended_actions: [
      { action: 'Reassign Alex Chen to Database Migration task', priority: 'Critical' },
      { action: 'Defer non-essential CSS updates to Sprint 4', priority: 'Medium' },
      { action: 'Schedule automated backup verification via n8n workflow', priority: 'Low' }
    ]
  }
};

const mockAutomations = [
  { id: 1, tool: 'n8n Webhook Sync', target: 'Jira to MySQL', complexity: 'Low', timeSavings: 'Estimated 4 hrs/week', risk: 'Low', status: 'Suggested' },
  { id: 2, tool: 'Python Script (Pandas)', target: 'Weekly Analytics Report Generation', complexity: 'Medium', timeSavings: 'Estimated 2.5 hrs/week', risk: 'Medium', status: 'Approved' },
];

export const analyzeProject = async (projectId) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: mockAnalysis }), 1500);
  });
};

export const generateRecoveryPlan = async (projectId) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: mockAnalysis.proposal }), 2000);
  });
};

export const approveRecoveryPlan = async (proposalId, status) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true, proposalId, status }), 1000);
  });
};

export const getAutomationAdvisor = async () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: mockAutomations }), 1200);
  });
};

export const submitFocusGuardianFeedback = async (data) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true, loggedData: data }), 1000);
  });
};