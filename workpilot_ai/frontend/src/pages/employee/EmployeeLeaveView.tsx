import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LeaveRequest } from '../../types';
import { LeaveRequestModal } from '../../components/leave/LeaveRequestModal';
import { CalendarDays, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';

export const EmployeeLeaveView: React.FC = () => {
  const { user } = useAuth();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadLeaves();
    }
  }, [user]);

  const loadLeaves = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await api.getLeaveRequests({ user_id: user.id });
      setLeaves(data);
    } catch (err) {
      console.error("Failed to load leaves:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">My Leave & Planned Time Off</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Submit vacation and planned absence requests. Approved time off updates project delivery models.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Leave Requests List */}
      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card divide-y divide-charcoal-50 overflow-hidden">
        {leaves.length === 0 ? (
          <div className="p-12 text-center text-xs text-charcoal-400">
            <CalendarDays className="w-8 h-8 text-charcoal-300 mx-auto mb-2" />
            <p className="font-semibold text-charcoal-700">No Leave Requests</p>
            <p className="mt-1">Click "Apply for Leave" to submit planned time off.</p>
          </div>
        ) : (
          leaves.map((leave) => {
            const isApproved = leave.status === 'APPROVED';
            const isRejected = leave.status === 'REJECTED';
            const isPending = leave.status === 'PENDING';

            return (
              <div key={leave.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-charcoal-900">
                      {leave.start_date} to {leave.end_date}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isApproved ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                      isRejected ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                      'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {leave.status}
                    </span>
                  </div>

                  {leave.reason && (
                    <p className="text-xs text-charcoal-600 italic">
                      "{leave.reason}"
                    </p>
                  )}

                  {leave.decision_notes && (
                    <div className="text-xs text-forest-800 bg-forest-50/70 p-2 rounded-lg border border-forest-100 max-w-lg mt-1">
                      <span className="font-semibold">Manager Feedback: </span>
                      {leave.decision_notes}
                    </div>
                  )}
                </div>

                <div className="text-right text-xs text-charcoal-400 flex-shrink-0">
                  <p>Requested {new Date(leave.created_at).toLocaleDateString()}</p>
                  {leave.reviewed_at && (
                    <p className="text-[11px] text-charcoal-500">
                      Decided {new Date(leave.reviewed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <LeaveRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmitted={loadLeaves}
      />
    </div>
  );
};
