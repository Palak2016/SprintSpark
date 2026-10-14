import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LeaveRequest } from '../../types';
import { LeaveApprovalCard } from '../../components/leave/LeaveApprovalCard';
import { CalendarDays, Filter, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

export const LeaveManagementView: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLeaves();
  }, [filter]);

  const loadLeaves = async () => {
    setIsLoading(true);
    try {
      const data = await api.getLeaveRequests(filter !== 'ALL' ? { status_filter: filter } : undefined);
      setLeaves(data);
    } catch (err) {
      console.error("Failed to load leaves:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Leave Requests & Approvals</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Review team planned absences. Approved leave updates availability and flags task delivery overlaps.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-white border border-charcoal-200 rounded-xl p-1 shadow-sm">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === tab ? 'bg-forest-700 text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Leave Approval Cards */}
      {leaves.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-charcoal-100 shadow-card">
          <CalendarDays className="w-8 h-8 text-charcoal-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-charcoal-700">No {filter.toLowerCase()} leave requests found</p>
          <p className="text-xs text-charcoal-400 mt-1">
            When team members request planned time off, they appear here for your review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leaves.map((req) => (
            <LeaveApprovalCard
              key={req.id}
              request={req}
              onReviewed={loadLeaves}
            />
          ))}
        </div>
      )}
    </div>
  );
};
