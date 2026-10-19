
import React, { useState } from 'react';
import type { LeaveRequest } from '../../types';
import { api } from '../../services/api';
import { formatIndianDate } from '../../utils/date';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  LoaderCircle,
  MessageSquareText,
} from 'lucide-react';

interface LeaveApprovalCardProps {
  request: LeaveRequest;
  onReviewed: () => void;
}

export const LeaveApprovalCard: React.FC<LeaveApprovalCardProps> = ({
  request,
  onReviewed,
}) => {
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isPending = request.status === 'PENDING';

  const handleDecision = async (status: 'APPROVED' | 'REJECTED') => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      await api.reviewLeaveRequest(
        request.id,
        status,
        decisionNotes.trim()
      );

      onReviewed();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusStyles: Record<string, string> = {
    APPROVED:
      'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    REJECTED:
      'bg-rose-400/10 text-rose-300 border-rose-400/20',
    PENDING:
      'bg-amber-400/10 text-amber-300 border-amber-400/20',
  };

  const fullName = request.user?.full_name || 'Unknown employee';

  const avatarUrl =
    request.user?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      fullName
    )}`;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-[#19112B] p-5 shadow-lg shadow-black/10 transition-all duration-200 hover:border-violet-400/30">
      <div>
        {/* Employee and Status */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={avatarUrl}
              alt={fullName}
              className="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-[#19112B] object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    fullName
                  )}`;
              }}
            />

            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-[#FAF8FF]">
                {fullName}
              </h4>
              <p className="mt-0.5 text-xs text-[#A99FBC]">
                {request.user?.role || 'Employee'}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              statusStyles[request.status] ||
              'border-white/10 bg-white/5 text-[#C5BDD5]'
            }`}
          >
            {request.status}
          </span>
        </div>

        {/* Leave Dates */}
        <div className="my-3 rounded-xl border border-violet-400/10 bg-[#19112B]/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#C5BDD5]">
            <CalendarDays className="h-4 w-4 text-violet-300" />
            Leave period
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#FAF8FF]">
            <span>{formatIndianDate(request.start_date)}</span>
            <span className="text-[#817694]">→</span>
            <span>{formatIndianDate(request.end_date)}</span>
          </div>
        </div>

        {/* Leave Reason */}
        {request.reason && (
          <div className="mb-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A99FBC]">
              Reason
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#E1D9EF]">
              {request.reason}
            </p>
          </div>
        )}
      </div>

      {/* Pending Request Actions */}
      {isPending ? (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <label className="flex items-center gap-2 text-xs font-medium text-[#C5BDD5]">
            <MessageSquareText className="h-3.5 w-3.5" />
            Review notes
            <span className="font-normal text-[#817694]">(optional)</span>
          </label>

          <textarea
            placeholder="Add a note for this decision..."
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            className="w-full resize-y rounded-xl border border-white/10 bg-[#19112B] px-3 py-2.5 text-sm text-[#FAF8FF] outline-none transition-colors placeholder:text-[#817694] focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDecision('REJECTED')}
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject
            </button>

            <button
              type="button"
              onClick={() => handleDecision('APPROVED')}
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white shadow-md shadow-violet-950/20 transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve
            </button>
          </div>

          {isSubmitting && (
            <p className="text-center text-[11px] text-[#A99FBC]">
              Processing your decision...
            </p>
          )}
        </div>
      ) : (
        /* Reviewed Request Details */
        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2 text-xs text-[#A99FBC]">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Reviewed
              {request.reviewed_at
                ? ` on ${formatIndianDate(request.reviewed_at)}`
                : ''}
            </span>
          </div>

          {request.decision_notes && (
            <div className="rounded-lg border border-white/5 bg-[#19112B]/70 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#A99FBC]">
                Review notes
              </p>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#E1D9EF]">
                {request.decision_notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
