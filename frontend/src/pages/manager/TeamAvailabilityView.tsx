
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import type { TeamMemberAvailability } from '../../types';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  CalendarDays,
  RefreshCw,
  BriefcaseBusiness,
  AlertCircle,
  LoaderCircle,
  ArrowUpRight,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

export const TeamAvailabilityView: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Find the currently logged-in user's ID.
  const currentUserId = useMemo((): string | null => {
    const userKeys = [
      'workpilot_user',
      'workpilot_current_user',
      'current_user',
      'auth_user',
      'user',
    ];

    for (const key of userKeys) {
      try {
        const storedValue = localStorage.getItem(key);

        if (!storedValue) continue;

        const parsed = JSON.parse(storedValue);
        const id =
          parsed?.id ??
          parsed?.user_id ??
          parsed?.userId ??
          parsed?.sub ??
          parsed?.user?.id ??
          parsed?.user?.user_id;

        if (id !== undefined && id !== null) {
          return String(id);
        }
      } catch {
        // Ignore values that are not valid JSON.
      }
    }

    // Fallback: read the ID from the authentication token.
    try {
      const token = localStorage.getItem('workpilot_token');

      if (token) {
        const parts = token.split('.');

        if (parts.length === 3) {
          const base64Payload = parts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/');

          const payload = JSON.parse(
            atob(base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '='))
          );

          const id =
            payload?.user_id ??
            payload?.userId ??
            payload?.id ??
            payload?.sub;

          if (id !== undefined && id !== null) {
            return String(id);
          }
        }
      }
    } catch {
      // If the token cannot be decoded, use the names without a marker.
    }

    return null;
  }, []);

  const loadAvailability = useCallback(async () => {
    setIsLoading(true);
    setPageError('');

    try {
      const data = await api.getTeamAvailability();
      setTeamMembers(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setPageError(`Unable to load team availability: ${message}`);
      console.error('Failed to load availability:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const overloadedCount = teamMembers.filter(
    (member) => member.capacity_status === 'OVERLOADED'
  ).length;

  const optimalCount = teamMembers.filter(
    (member) => member.capacity_status === 'OPTIMAL'
  ).length;

  const onLeaveCount = teamMembers.filter(
    (member) => member.is_on_leave_today
  ).length;

  const availableCount = teamMembers.filter(
    (member) =>
      !member.is_on_leave_today &&
      member.capacity_status !== 'OVERLOADED'
  ).length;

  const totalRemainingHours = teamMembers.reduce(
    (total, member) => total + Number(member.total_remaining_hours || 0),
    0
  );

  // Show "(Me)" only for the logged-in user.
  const isCurrentUser = (userId: string | number | undefined | null) =>
    currentUserId !== null &&
    userId !== undefined &&
    userId !== null &&
    String(userId) === currentUserId;

  const getCapacityBadge = (status: string) => {
    switch (status) {
      case 'OVERLOADED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Overloaded
          </span>
        );

      case 'OPTIMAL':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Optimal Load
          </span>
        );

      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Capacity Available
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-[#FAF8FF]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#B7ADC9]">
            <BriefcaseBusiness className="h-4 w-4 text-[#A78BFA]" />
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#E5D9FF]">Workforce Operations</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Team Capacity &amp; Availability
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-[#B7ADC9]">
            Monitor team workloads, remaining effort, and approved leave
            schedules to make better resource allocation decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAvailability()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#19112B] px-4 py-2.5 text-sm font-medium text-[#D8CDEF] transition hover:bg-[#211638] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
          />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {pageError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{pageError}</span>
          <button
            type="button"
            onClick={() => void loadAvailability()}
            className="shrink-0 font-semibold text-rose-200 hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-violet-400/20">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Team Members</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <Users className="h-5 w-5 text-violet-300" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold">{teamMembers.length}</p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Members in the workforce
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-emerald-400/20">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Available Today</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <UserCheck className="h-5 w-5 text-emerald-300" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold">{availableCount}</p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Not on leave or overloaded
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-sky-400/20">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Remaining Effort</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
              <Clock className="h-5 w-5 text-sky-300" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold">
            {totalRemainingHours}
            <span className="ml-1 text-sm font-medium text-[#B7ADC9]">
              hrs
            </span>
          </p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Estimated effort across the team
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition hover:border-rose-400/20">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Overloaded</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <AlertTriangle className="h-5 w-5 text-rose-300" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold">{overloadedCount}</p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Members requiring attention
          </p>
        </div>
      </div>

      {/* Capacity Overview */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-white">Capacity Overview</h2>
            <p className="mt-1 text-xs text-[#B7ADC9]">
              Current distribution of team capacity and approved leave
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {optimalCount} optimal
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overloadedCount} overloaded
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
              <CalendarDays className="h-3.5 w-3.5" />
              {onLeaveCount} on leave
            </span>
          </div>
        </div>

        {teamMembers.length > 0 && (
          <div className="mt-5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              {optimalCount > 0 && (
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{
                    width: `${(optimalCount / teamMembers.length) * 100}%`,
                  }}
                />
              )}

              {overloadedCount > 0 && (
                <div
                  className="h-full bg-rose-400 transition-all"
                  style={{
                    width: `${(overloadedCount / teamMembers.length) * 100}%`,
                  }}
                />
              )}

              {teamMembers.length - optimalCount - overloadedCount > 0 && (
                <div
                  className="h-full bg-violet-400 transition-all"
                  style={{
                    width: `${
                      ((teamMembers.length -
                        optimalCount -
                        overloadedCount) /
                        teamMembers.length) *
                      100
                    }%`,
                  }}
                />
              )}
            </div>

            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-[#A99DBD]">
              <span>{teamMembers.length} total members</span>
              <span>
                {Math.round((availableCount / teamMembers.length) * 100)}%
                {' '}available today
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Team Section Heading */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Workforce Details</h2>
          <p className="mt-1 text-xs text-[#B7ADC9]">
            Review individual workloads, availability, and planned absences.
          </p>
        </div>

        {!isLoading && (
          <span className="text-xs text-[#A99DBD]">
            {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Loading / Empty / Team Member Cards */}
      {isLoading && teamMembers.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#19112B] px-6 py-12">
          <LoaderCircle className="h-8 w-8 animate-spin text-violet-300" />
          <p className="mt-4 text-sm font-medium text-white">
            Loading team availability...
          </p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Fetching workload and leave schedules
          </p>
        </div>
      ) : teamMembers.length === 0 && !pageError ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#19112B]/70 px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
            <Users className="h-7 w-7 text-violet-300" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">
            No Team Members Found
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#B7ADC9]">
            Workforce capacity information will appear here when team
            availability data is available.
          </p>
          <button
            type="button"
            onClick={() => void loadAvailability()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {teamMembers.map((member) => {
            const isMe = isCurrentUser(member.user.id);

            return (
              <article
                key={member.user.id}
                className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B] transition duration-200 hover:border-violet-400/25 hover:shadow-lg hover:shadow-black/10"
              >
                <div className="h-1 bg-gradient-to-r from-violet-600 via-violet-400 to-indigo-400" />

                <div className="p-5">
                  {/* Member Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={
                          member.user.avatar_url ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            member.user.full_name
                          )}`
                        }
                        alt={member.user.full_name}
                        className="h-12 w-12 shrink-0 rounded-xl border border-white/10 bg-[#130D21] object-cover"
                      />

                      <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                          <span className="truncate">
                            {member.user.full_name}
                          </span>

                          {isMe && (
                            <span className="inline-flex shrink-0 items-center rounded-md border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
                              Me
                            </span>
                          )}
                        </h3>

                        <p className="mt-1 text-xs text-[#B7ADC9]">
                          {member.user.role}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getCapacityBadge(member.capacity_status)}
                    </div>
                  </div>

                  {/* Workload Metrics */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.06] bg-[#130D21] p-3.5">
                      <div className="flex items-center gap-1.5 text-[#B7ADC9]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-violet-300" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          Active Tasks
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-bold text-white">
                        {member.active_task_count}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#A99DBD]">
                        Assigned workload
                      </p>
                    </div>

                    <div className="rounded-xl border border-violet-400/10 bg-violet-500/[0.07] p-3.5">
                      <div className="flex items-center gap-1.5 text-[#C4B5FD]">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          Remaining
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-bold text-white">
                        {member.total_remaining_hours}
                        <span className="ml-1 text-xs font-medium text-[#B7ADC9]">
                          hrs
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#A99DBD]">
                        Estimated effort
                      </p>
                    </div>
                  </div>

                  {/* Today's Availability */}
                  <div className="mt-4">
                    {member.is_on_leave_today ? (
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/15 bg-amber-500/[0.07] p-3">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <div>
                          <p className="text-xs font-semibold text-amber-200">
                            On Approved Leave Today
                          </p>
                          <p className="mt-0.5 text-[11px] text-amber-100/60">
                            Account for this absence during task planning.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-200">
                            Available Today
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-100/60">
                            Not currently on approved leave.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Upcoming Leaves */}
                  <div className="mt-5 border-t border-white/[0.08] pt-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-violet-300" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#D8CDEF]">
                          Scheduled Leaves
                        </h4>
                      </div>

                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-white/[0.08] bg-[#130D21] px-1.5 text-[11px] font-bold text-[#D8CDEF]">
                        {member.upcoming_leaves.length}
                      </span>
                    </div>

                    {member.upcoming_leaves.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-4 text-center">
                        <p className="text-xs text-[#A99DBD]">
                          No upcoming approved leaves.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {member.upcoming_leaves.map((leave) => (
                          <div
                            key={leave.id}
                            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#130D21] p-3 transition hover:border-violet-400/20"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/10 bg-violet-500/10">
                              <CalendarDays className="h-4 w-4 text-violet-300" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#F0EAFB]">
                                {leave.start_date} to {leave.end_date}
                              </p>
                              <p
                                className="mt-1 truncate text-[11px] text-[#A99DBD]"
                                title={leave.reason || 'Approved absence'}
                              >
                                {leave.reason || 'Approved absence'}
                              </p>
                            </div>

                            <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#807493]" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Footer Note */}
      {!isLoading && teamMembers.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-[#19112B] px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <p className="text-xs leading-relaxed text-[#B7ADC9]">
            Capacity indicators are based on the availability data returned
            by WorkPilot AI. Review overloaded team members and approved leave
            schedules before assigning additional work.
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamAvailabilityView;
