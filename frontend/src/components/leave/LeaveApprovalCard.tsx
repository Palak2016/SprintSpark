import React, { useState } from 'react';
import { LeaveRequest } from '../../types';
import { api } from '../../services/api';
import { Calendar, User, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface LeaveApprovalCardProps {
  request: LeaveRequest;
  onReviewed: () => void;
}

export const LeaveApprovalCard: React.FC<LeaveApprovalCardProps> = ({
  request,
  onReviewed
}) => {
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDecision = async (status: 'APPROVED' | 'REJECTED') => {
    setIsSubmitting(true);
    try {
      await api.reviewLeaveRequest(request.id, status, decisionNotes);
      onReviewed();
    } catch (err: any) {
      alert("Failed to review request: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = request.status === 'PENDING';

  return (
    <div className="p-4 rounded-xl border border-charcoal-100 bg-white shadow-card flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <img
              src={request.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${request.user?.full_name}`}
              alt={request.user?.full_name}
              className="w-7 h-7 rounded-full border border-charcoal-200"
            />
            <div>
              <h4 className="text-sm font-semibold text-charcoal-900">{request.user?.full_name}</h4>
              <p className="text-[11px] text-charcoal-500">{request.user?.role}</p>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            request.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            request.status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
            'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            {request.status}
          </span>
        </div>

        {/* Date Window */}
        <div className="p-2.5 rounded-lg bg-charcoal-50/70 border border-charcoal-100 my-2 text-xs flex items-center justify-between text-charcoal-700">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-forest-700" />
            <span>{request.start_date} to {request.end_date}</span>
          </span>
        </div>

        {/* Reason */}
        {request.reason && (
          <p className="text-xs text-charcoal-600 mb-3 italic">
            "{request.reason}"
          </p>
        )}
      </div>

      {/* Decision Actions */}
      {isPending ? (
        <div className="pt-3 border-t border-charcoal-100 space-y-2">
          <input
            type="text"
            placeholder="Add review notes..."
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-charcoal-200 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDecision('REJECTED')}
              disabled={isSubmitting}
              className="flex-1 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => handleDecision('APPROVED')}
              disabled={isSubmitting}
              className="flex-1 py-1.5 text-xs font-semibold text-white bg-forest-700 hover:bg-forest-800 rounded-lg shadow-sm transition-colors"
            >
              Approve
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-2 border-t border-charcoal-50 text-[11px] text-charcoal-400">
          Reviewed {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : ''}
          {request.decision_notes && ` • Notes: ${request.decision_notes}`}
        </div>
      )}
    </div>
  );
};
