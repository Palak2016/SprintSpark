import api from './api';

let mockWorkLogs = [
  { id: 1, task: 'Design Landing Page', hours: '4.5', notes: 'Completed layout and mobile responsiveness', date: '2026-10-14' },
  { id: 2, task: 'Fix Auth Bug', hours: '2.0', notes: 'Resolved JWT token expiration edge case', date: '2026-10-13' }
];

export const getWorkLogs = async () => {
  return new Promise((resolve) => setTimeout(() => resolve({ data: mockWorkLogs }), 1000));
};

export const submitWorkLog = async (logData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newLog = { id: Date.now(), ...logData, date: new Date().toISOString().split('T')[0] };
      mockWorkLogs = [newLog, ...mockWorkLogs];
      resolve({ data: newLog });
    }, 1200);
  });
};