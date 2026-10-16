
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import { api } from '../../services/api';
import type { LeaveRequest } from '../../types';
import { LeaveApprovalCard } from '../../components/leave/LeaveApprovalCard';

import {
  CalendarDays,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  AlertCircle,
  LoaderCircle,
  ClipboardCheck,
} from 'lucide-react';

type LeaveFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

export const LeaveManagementView: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<LeaveFilter>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Ensures an older response cannot overwrite newer data.
  const latestRequestId = useRef(0);

  const loadLeaves = useCallback(
    async (silent = false): Promise<void> => {
      const requestId = ++latestRequestId.current;

      if (!silent) {
        setIsLoading(true);
        setPageError('');
      }

      try {
        // Fetch ALL leave requests.
        // Status filtering happens locally so summary counts stay accurate.
        const data = await api.getLeaveRequests();

        if (requestId !== latestRequestId.current) {
          return;
        }

        setLeaves(Array.isArray(data) ? data : []);
        setPageError('');
      } catch (err: unknown) {
        if (requestId !== latestRequestId.current) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred.';

        if (!silent) {
          setPageError(`Unable to load leave requests: ${message}`);
        } else {
          console.error('Automatic leave refresh failed:', err);
        }
      } finally {
        if (requestId === latestRequestId.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  // Initial load, automatic refresh, and refresh when the tab regains focus.
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
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      // Ignore responses from requests started by the previous effect.
      latestRequestId.current += 1;
    };
  }, [loadLeaves]);

  const getStatus = (status?: string | null): LeaveFilter => {
    const normalized = String(status || 'PENDING').toUpperCase();

    if (
      normalized === 'APPROVED' ||
      normalized === 'REJECTED' ||
      normalized === 'PENDING'
    ) {
      return normalized;
    }

    return 'PENDING';
  };

  // All summary counts are calculated from the full dataset.
  const pendingCount = leaves.filter(
    (leave) => getStatus(leave.status) === 'PENDING',
  ).length;

  const approvedCount = leaves.filter(
    (leave) => getStatus(leave.status) === 'APPROVED',
  ).length;

  const rejectedCount = leaves.filter(
    (leave) => getStatus(leave.status) === 'REJECTED',
  ).length;

  // Filtering happens in the frontend.
  const visibleLeaves =
    filter === 'ALL'
      ? leaves
      : leaves.filter(
          (leave) => getStatus(leave.status) === filter,
        );

  const tabs: { value: LeaveFilter; label: string }[] = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'ALL', label: 'All Requests' },
  ];

  return (
    <div className="space-y-6 text-[#FAF8FF]">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#B7ADC9]">
            <CalendarDays className="h-4 w-4 text-violet-400" />
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#E5D9FF]">Leave Management</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Leave Requests &amp; Approvals
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#B7ADC9]">
            Review planned absences, manage approval decisions, and keep
            workforce availability aligned with project delivery.
          </p>

          <p className="mt-2 flex items-center gap-2 text-[11px] text-[#9386A9]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Automatically refreshes every 5 seconds
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLeaves()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#19112B] px-4 py-2.5 text-sm font-medium text-[#D8CDEF] transition hover:bg-[#211638] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
          />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Error State */}
      {pageError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200 sm:flex-row sm:items-start"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <p className="min-w-0 flex-1 break-words">{pageError}</p>

          <button
            type="button"
            onClick={() => void loadLeaves()}
            disabled={isLoading}
            className="shrink-0 font-semibold hover:text-white disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <section
        aria-label="Leave request summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-violet-400/20">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#B7ADC9]">Total Requests</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <Users className="h-5 w-5 text-violet-300" />
            </div>
          </div>

          <p className="mt-4 text-2xl font-bold">{leaves.length}</p>

          <p className="mt-1 text-xs text-[#A99DBD]">
            Across all statuses
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-amber-400/20">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#B7ADC9]">Pending Review</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-300" />
            </div>
          </div>

          <p className="mt-4 text-2xl font-bold">{pendingCount}</p>

          <p className="mt-1 text-xs text-[#A99DBD]">
            Awaiting a decision
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-emerald-400/20">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#B7ADC9]">Approved</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
          </div>

          <p className="mt-4 text-2xl font-bold">{approvedCount}</p>

          <p className="mt-1 text-xs text-[#A99DBD]">
            Approved time-off requests
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-rose-400/20">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#B7ADC9]">Rejected</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <XCircle className="h-5 w-5 text-rose-300" />
            </div>
          </div>

          <p className="mt-4 text-2xl font-bold">{rejectedCount}</p>

          <p className="mt-1 text-xs text-[#A99DBD]">
            Requests not approved
          </p>
        </div>
      </section>

      {/* Approval Overview */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <ClipboardCheck className="h-5 w-5 text-violet-300" />
            </div>

            <div>
              <h2 className="font-semibold text-white">
                Approval Overview
              </h2>

              <p className="mt-1 text-xs leading-5 text-[#B7ADC9]">
                Review requests and keep team availability up to date.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
              pendingCount > 0
                ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                pendingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />

            {pendingCount > 0
              ? `${pendingCount} request${pendingCount === 1 ? '' : 's'} need review`
              : 'No pending requests'}
          </span>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
              <Filter className="h-4 w-4 text-violet-300" />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-white">
                Leave Requests
              </h2>

              <p className="mt-0.5 text-xs text-[#A99DBD]">
                Filter by approval status
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Filter leave requests"
            className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#130D21] p-1"
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                aria-pressed={filter === tab.value}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  filter === tab.value
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-[#B7ADC9] hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab.label}

                {tab.value === 'PENDING' && pendingCount > 0 && (
                  <span
                    className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] ${
                      filter === 'PENDING'
                        ? 'bg-white/15 text-white'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}

                {tab.value === 'APPROVED' && approvedCount > 0 && (
                  <span className="ml-1.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    {approvedCount}
                  </span>
                )}

                {tab.value === 'REJECTED' && rejectedCount > 0 && (
                  <span className="ml-1.5 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                    {rejectedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Loading State */}
      {isLoading && leaves.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#19112B] px-6 py-12">
          <LoaderCircle className="h-8 w-8 animate-spin text-violet-300" />

          <p className="mt-4 text-sm font-medium text-white">
            Loading leave requests...
          </p>

          <p className="mt-1 text-xs text-[#A99DBD]">
            Retrieving approval records
          </p>
        </div>
      ) : pageError && leaves.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] px-6 py-10 text-center">
          <p className="text-sm text-[#B7ADC9]">
            Your leave requests could not be displayed.
          </p>

          <button
            type="button"
            onClick={() => void loadLeaves()}
            className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
          >
            Try again
          </button>
        </div>
      ) : visibleLeaves.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#19112B]/70 px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
            <CalendarDays className="h-7 w-7 text-violet-300" />
          </div>

          <h3 className="mt-4 text-lg font-semibold text-white">
            {filter === 'ALL'
              ? 'No leave requests found'
              : `No ${filter.toLowerCase()} leave requests found`}
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#B7ADC9]">
            {filter === 'PENDING'
              ? 'There are no requests waiting for approval. New team leave requests will appear here.'
              : filter === 'APPROVED'
                ? 'No approved leave requests were found.'
                : filter === 'REJECTED'
                  ? 'No rejected leave requests were found.'
                  : 'Leave requests will appear here when team members submit time-off requests.'}
          </p>

          {filter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className="mt-5 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-[#E5D9FF] transition hover:bg-white/5"
            >
              View All Requests
            </button>
          )}
        </div>
      ) : (
        /* Leave Approval Cards */
        <section
          aria-label="Leave approval requests"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {visibleLeaves.map((request) => (
            <LeaveApprovalCard
              key={request.id}
              request={request}
              onReviewed={() => loadLeaves(true)}
            />
          ))}
        </section>
      )}

      {/* Footer */}
      {!isLoading && visibleLeaves.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-[#19112B] px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />

          <p className="text-xs leading-relaxed text-[#B7ADC9]">
            Approved leave may affect team availability and task delivery
            schedules. Review overlapping assignments when approving requests.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeaveManagementView;
