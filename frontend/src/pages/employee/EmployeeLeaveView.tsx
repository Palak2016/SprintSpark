import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { LeaveRequest } from '../../types';
import { LeaveRequestModal } from '../../components/leave/LeaveRequestModal';

import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  RefreshCw,
  AlertCircle,
  CalendarCheck,
  MessageSquareText,
} from 'lucide-react';

export const EmployeeLeaveView: React.FC = () => {
  const { user } = useAuth();

  const userId = user?.id;

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Prevent polling and manual refresh from issuing overlapping requests.
  const requestInFlight = useRef(false);

  const loadLeaves = useCallback(
    async (silent = false): Promise<void> => {
      if (userId == null) {
        setLeaves([]);
        setIsLoading(false);
        return;
      }

      if (requestInFlight.current) {
        return;
      }

      requestInFlight.current = true;

      if (!silent) {
        setIsLoading(true);
        setPageError('');
      }

      try {
        // Always request the authenticated employee's leave records.
        const data = await api.getLeaveRequests({
          user_id: userId,
        });

        setLeaves(Array.isArray(data) ? data : []);
        setPageError('');
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred.';

        if (!silent) {
          setPageError(`Unable to load leave requests: ${message}`);
        } else {
          console.error(
            'Automatic leave status refresh failed:',
            err,
          );
        }
      } finally {
        requestInFlight.current = false;

        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [userId],
  );

  // Initial load and automatic status refresh.
  useEffect(() => {
    void loadLeaves();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadLeaves(true);
      }
    }, 5000);

    const handleFocus = () => {
      void loadLeaves(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadLeaves(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [loadLeaves]);

  const formatDate = (date?: string | null): string => {
    if (!date) return '—';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatus = (status?: string | null): string => {
    return String(status || 'PENDING').toUpperCase();
  };

  const getStatusStyle = (status?: string | null): string => {
    switch (getStatus(status)) {
      case 'APPROVED':
        return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';

      case 'REJECTED':
        return 'border-rose-400/20 bg-rose-500/10 text-rose-300';

      default:
        return 'border-amber-400/20 bg-amber-500/10 text-amber-300';
    }
  };

  const approvedCount = leaves.filter(
    (leave) => getStatus(leave.status) === 'APPROVED',
  ).length;

  const pendingCount = leaves.filter(
    (leave) => getStatus(leave.status) === 'PENDING',
  ).length;

  const rejectedCount = leaves.filter(
    (leave) => getStatus(leave.status) === 'REJECTED',
  ).length;

  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-[#B7ADC9] transition-colors hover:border-violet-400/20 hover:bg-violet-500/10 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50';

  const primaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500';

  return (
    <div className="min-h-full max-w-5xl space-y-6 text-[#FAF8FF]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
              <CalendarDays
                size={18}
                strokeWidth={2}
                className="shrink-0 text-violet-300"
              />
            </div>

            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
              Employee Workspace
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#FAF8FF] sm:text-3xl">
            My Leave &amp; Planned Time Off
          </h1>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#A99DBD] sm:text-sm">
            Submit leave requests, track approval status, and review
            manager feedback in one place.
          </p>

          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#9386A9]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Status automatically refreshes every 5 seconds
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadLeaves()}
            disabled={isLoading}
            className={secondaryButtonClass}
          >
            <RefreshCw
              size={15}
              className={isLoading ? 'animate-spin' : ''}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={primaryButtonClass}
          >
            <Plus size={17} />
            Apply for Leave
          </button>
        </div>
      </div>

      {/* Error message */}
      {pageError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-rose-300"
            />

            <div>
              <p className="text-sm font-semibold text-rose-200">
                Unable to load leave requests
              </p>

              <p className="mt-1 break-words text-xs leading-5 text-rose-200/80">
                {pageError}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadLeaves()}
            className="shrink-0 rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-amber-400/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#A99DBD]">
              Pending Requests
            </span>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock size={17} className="text-amber-300" />
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold text-amber-300">
            {pendingCount}
          </p>

          <p className="mt-1 text-[10px] text-[#807493]">
            Awaiting manager review
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-emerald-400/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#A99DBD]">
              Approved Requests
            </span>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2
                size={17}
                className="text-emerald-300"
              />
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold text-emerald-300">
            {approvedCount}
          </p>

          <p className="mt-1 text-[10px] text-[#807493]">
            Approved time off
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-rose-400/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#A99DBD]">
              Rejected Requests
            </span>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10">
              <XCircle size={17} className="text-rose-300" />
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold text-rose-300">
            {rejectedCount}
          </p>

          <p className="mt-1 text-[10px] text-[#807493]">
            Requests not approved
          </p>
        </div>
      </div>

      {/* Leave requests */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B]">
        <div className="flex flex-col gap-2 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
              <CalendarCheck
                size={21}
                className="text-violet-300"
              />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-[#FAF8FF]">
                My Leave Requests
              </h2>

              <p className="mt-1 text-xs text-[#A99DBD]">
                View request dates, decisions, and manager feedback.
              </p>
            </div>
          </div>

          <span className="w-fit rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-[#B7ADC9]">
            {leaves.length}{' '}
            {leaves.length === 1 ? 'request' : 'requests'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center p-8">
            <LoaderCircle
              size={32}
              className="animate-spin text-violet-300"
            />

            <p className="mt-4 text-sm font-medium text-[#E5D9FF]">
              Loading leave requests...
            </p>

            <p className="mt-1 text-xs text-[#807493]">
              Fetching your leave history
            </p>
          </div>
        ) : leaves.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/10">
              <CalendarDays
                size={32}
                className="text-violet-300"
              />
            </div>

            <h3 className="mt-5 text-base font-semibold text-[#FAF8FF]">
              No Leave Requests
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#A99DBD]">
              You have not submitted any leave requests yet. Apply
              for time off to see your requests and their status here.
            </p>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className={`${primaryButtonClass} mt-5`}
            >
              <Plus size={17} />
              Apply for Leave
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {leaves.map((leave) => {
              const status = getStatus(leave.status);

              const isApproved = status === 'APPROVED';
              const isRejected = status === 'REJECTED';
              const isPending = status === 'PENDING';

              return (
                <article
                  key={leave.id}
                  className="p-4 transition-colors hover:bg-white/[0.015] sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Dates and current status */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#FAF8FF]">
                          {formatDate(leave.start_date)} –{' '}
                          {formatDate(leave.end_date)}
                        </span>

                        <span
                          role="status"
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${getStatusStyle(status)}`}
                        >
                          {isApproved ? (
                            <CheckCircle2 size={12} />
                          ) : isRejected ? (
                            <XCircle size={12} />
                          ) : (
                            <Clock size={12} />
                          )}

                          {status}
                        </span>
                      </div>

                      {/* Explicit decision message */}
                      {!isPending && (
                        <div
                          className={`mt-3 flex items-start gap-2.5 rounded-xl border p-3 ${
                            isApproved
                              ? 'border-emerald-400/20 bg-emerald-500/[0.06]'
                              : 'border-rose-400/20 bg-rose-500/[0.06]'
                          }`}
                        >
                          {isApproved ? (
                            <CheckCircle2
                              size={18}
                              className="mt-0.5 shrink-0 text-emerald-300"
                            />
                          ) : (
                            <XCircle
                              size={18}
                              className="mt-0.5 shrink-0 text-rose-300"
                            />
                          )}

                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold ${
                                isApproved
                                  ? 'text-emerald-200'
                                  : 'text-rose-200'
                              }`}
                            >
                              {isApproved
                                ? 'Your leave request has been approved.'
                                : 'Your leave request has been rejected.'}
                            </p>

                            {leave.reviewed_at && (
                              <p className="mt-1 text-[11px] text-[#A99DBD]">
                                Decision date:{' '}
                                {formatDate(leave.reviewed_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reason for leave */}
                      {leave.reason && (
                        <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#130D21]/70 p-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#807493]">
                            Reason for Leave
                          </p>

                          <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[#B7ADC9]">
                            {leave.reason}
                          </p>
                        </div>
                      )}

                      {/* Manager's decision notes */}
                      {leave.decision_notes && (
                        <div
                          className={`mt-3 rounded-xl border p-3 ${
                            isRejected
                              ? 'border-rose-400/20 bg-rose-500/[0.06]'
                              : isApproved
                                ? 'border-emerald-400/20 bg-emerald-500/[0.05]'
                                : 'border-violet-400/20 bg-violet-500/[0.06]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <MessageSquareText
                              size={16}
                              className={`mt-0.5 shrink-0 ${
                                isRejected
                                  ? 'text-rose-300'
                                  : isApproved
                                    ? 'text-emerald-300'
                                    : 'text-violet-300'
                              }`}
                            />

                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#D8D0E6]">
                                Manager Feedback
                              </p>

                              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#D8D0E6]">
                                {leave.decision_notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pending message */}
                      {isPending && (
                        <p className="mt-3 flex items-center gap-2 text-xs text-amber-300/90">
                          <Clock size={14} className="shrink-0" />
                          Waiting for your manager to review this request.
                        </p>
                      )}
                    </div>

                    {/* Request dates */}
                    <div className="shrink-0 rounded-xl border border-white/[0.06] bg-[#130D21]/60 px-3 py-2.5 sm:min-w-[145px] sm:text-right">
                      <p className="text-[10px] text-[#807493]">
                        Requested
                      </p>

                      <p className="mt-1 text-xs font-medium text-[#B7ADC9]">
                        {formatDate(leave.created_at)}
                      </p>

                      {leave.reviewed_at && (
                        <>
                          <div className="my-2 border-t border-white/[0.06]" />

                          <p className="text-[10px] text-[#807493]">
                            Decision date
                          </p>

                          <p className="mt-1 text-xs font-medium text-[#B7ADC9]">
                            {formatDate(leave.reviewed_at)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Leave request modal */}
      <LeaveRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmitted={async () => {
          setIsModalOpen(false);
          await loadLeaves();
        }}
      />
    </div>
  );
};

export default EmployeeLeaveView;