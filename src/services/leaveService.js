import api from './api';

// MOCK DATA: Employee's past requests
let mockPastRequests = [
  { id: 1, startDate: '2026-08-15', endDate: '2026-08-18', reason: 'Family vacation', status: 'Approved' },
  { id: 2, startDate: '2026-09-10', endDate: '2026-09-11', reason: 'Medical appointment', status: 'Rejected' },
];

// MOCK DATA: Manager's pending approval queue with impact analysis
let mockManagerRequests = [
  {
    id: 101,
    employeeName: 'Alex Chen',
    role: 'Frontend Developer',
    startDate: '2026-11-20',
    endDate: '2026-11-25',
    reason: 'Attending a tech conference',
    impact: { delayedTasks: 2, capacityDrop: 20, criticalOverlaps: 0 }
  },
  {
    id: 102,
    employeeName: 'Marcus Ray',
    role: 'Backend Developer',
    startDate: '2026-12-01',
    endDate: '2026-12-05',
    reason: 'Personal leave',
    impact: { delayedTasks: 4, capacityDrop: 33, criticalOverlaps: 1 }
  }
];

export const getLeaveRequests = async () => {
  return new Promise((resolve) => setTimeout(() => resolve({ data: mockPastRequests }), 1000));
};

export const submitLeaveRequest = async (formData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 1. Ek naya request object banate hain
      const newRequest = { 
        id: Date.now(), 
        ...formData, 
        status: 'Pending',
        // Manager panel ko kuch extra details chahiye hoti hain, wo yahan dal dete hain
        employeeName: 'Komal', // Aapka naam
        role: 'AI/ML Developer',
        impact: { delayedTasks: 1, capacityDrop: 10, criticalOverlaps: 0 }
      };

      // 2. Ise Employee ki history list mein add karo
      mockPastRequests = [newRequest, ...mockPastRequests];

      // 3. Ise Manager ki pending list mein bhi add karo (Ye line missing thi!)
      mockManagerRequests = [newRequest, ...mockManagerRequests];

      resolve({ data: newRequest });
    }, 1500);
  });
};

export const getManagerLeaveRequests = async () => {
  return new Promise((resolve) => setTimeout(() => resolve({ data: mockManagerRequests }), 1200));
};

export const updateLeaveStatus = async (id, status) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      mockManagerRequests = mockManagerRequests.filter(req => req.id !== id);
      resolve({ success: true, id, status });
    }, 1000);
  });
};