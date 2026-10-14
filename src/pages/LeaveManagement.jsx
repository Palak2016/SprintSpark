import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { getManagerLeaveRequests, updateLeaveStatus } from '../services/leaveService';

const LeaveManagement = () => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionStatus, setActionStatus] = useState({ loading: false, id: null });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await getManagerLeaveRequests();
      setRequests(response.data);
    } catch (err) {
      console.error('Failed to load pending requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    setActionStatus({ loading: true, id });
    try {
      await updateLeaveStatus(id, status);
      setRequests(requests.filter(req => req.id !== id));
      if (selectedRequest?.id === id) setSelectedRequest(null);
    } catch (err) {
      alert(`Failed to ${status.toLowerCase()} request.`);
    } finally {
      setActionStatus({ loading: false, id: null });
    }
  };

  return (
    <MainLayout>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Leave Approvals</h2>
        <p className="text-sm text-gray-500 mt-1">Review team requests and analyze impact.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Pending Requests List */}
        <div className="flex-1 w-full space-y-4">
          {isLoading ? (
            [1, 2].map(i => <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-gray-200"></div>)
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No pending leave requests at the moment.
            </div>
          ) : (
            requests.map((req) => (
              <div 
                key={req.id} 
                onClick={() => setSelectedRequest(req)}
                className={`cursor-pointer rounded-xl border p-4 transition-all shadow-sm ${selectedRequest?.id === req.id ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">{req.employeeName}</h4>
                    <p className="text-xs text-indigo-600 font-medium">{req.role}</p>
                    <p className="text-sm text-gray-600 mt-2">{req.startDate} to {req.endDate}</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">Pending</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Impact Preview Panel */}
        <div className={`w-full lg:w-96 rounded-xl border border-gray-200 bg-white shadow-sm transition-all ${selectedRequest ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="border-b border-gray-100 p-4 bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-gray-800">Impact Preview</h3>
            <p className="text-xs text-gray-500 mt-1">
              {selectedRequest ? `Simulated impact for ${selectedRequest.employeeName}` : 'Select a request to view impact'}
            </p>
          </div>
          
          <div className="p-4 space-y-6">
            {selectedRequest ? (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Provided Reason</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">{selectedRequest.reason}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-red-50 p-3 border border-red-100">
                    <p className="text-2xl font-bold text-red-700">{selectedRequest.impact.delayedTasks}</p>
                    <p className="text-xs text-red-600 font-medium uppercase mt-1">Tasks Delayed</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3 border border-orange-100">
                    <p className="text-2xl font-bold text-orange-700">{selectedRequest.impact.capacityDrop}%</p>
                    <p className="text-xs text-orange-600 font-medium uppercase mt-1">Capacity Drop</p>
                  </div>
                </div>

                {selectedRequest.impact.criticalOverlaps > 0 && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <span>Warning: Overlaps with {selectedRequest.impact.criticalOverlaps} critical deadline(s).</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => handleAction(selectedRequest.id, 'Approved')}
                    disabled={actionStatus.loading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {actionStatus.loading && actionStatus.id === selectedRequest.id ? 'Processing...' : 'Approve'}
                  </button>
                  <button 
                    onClick={() => handleAction(selectedRequest.id, 'Rejected')}
                    disabled={actionStatus.loading}
                    className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Waiting for selection...
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LeaveManagement;