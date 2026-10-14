import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { getLeaveRequests, submitLeaveRequest } from '../services/leaveService';

const LeaveRequestForm = () => {
  const [formData, setFormData] = useState({ startDate: '', endDate: '', reason: '' });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);
  
  const [pastRequests, setPastRequests] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await getLeaveRequests();
      setPastRequests(response.data);
    } catch (err) {
      console.error('Failed to load history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    const today = new Date().toISOString().split('T')[0];

    if (!formData.startDate) errors.startDate = 'Start date is required';
    else if (formData.startDate < today) errors.startDate = 'Start date cannot be in the past';

    if (!formData.endDate) errors.endDate = 'End date is required';
    else if (formData.startDate && formData.endDate < formData.startDate) {
      errors.endDate = 'End date cannot be before start date';
    }

    if (!formData.reason.trim()) errors.reason = 'Reason is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMessage(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await submitLeaveRequest(formData);
      setSubmitMessage({ type: 'success', text: 'Leave request submitted successfully!' });
      setFormData({ startDate: '', endDate: '', reason: '' });
      fetchHistory(); // Refresh history table
    } catch (err) {
      setSubmitMessage({ type: 'error', text: 'Failed to submit request. Try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
        <p className="text-sm text-gray-500 mt-1">Request time off and view your balances.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2 items-start">
        {/* Request Form */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">New Request</h3>
          
          {submitMessage && (
            <div className={`mb-4 rounded-lg p-4 text-sm ${submitMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {submitMessage.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className={`w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.startDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.startDate && <p className="mt-1 text-xs text-red-600">{formErrors.startDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className={`w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.endDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.endDate && <p className="mt-1 text-xs text-red-600">{formErrors.endDate}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea 
                rows="3"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Briefly explain your leave request..."
                className={`w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.reason ? 'border-red-500' : 'border-gray-300'}`}
              ></textarea>
              {formErrors.reason && <p className="mt-1 text-xs text-red-600">{formErrors.reason}</p>}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </section>

        {/* History Table */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">Request History</h3>
          
          {isLoadingHistory ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-gray-100"></div>)}
            </div>
          ) : (
            <div className="space-y-3">
              {pastRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{req.startDate} to {req.endDate}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{req.reason}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                    req.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
              {pastRequests.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No past requests found.</p>}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};

export default LeaveRequestForm;