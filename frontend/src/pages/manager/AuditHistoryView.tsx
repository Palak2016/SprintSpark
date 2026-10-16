
import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import type { AuditEvent, DailyUpdate } from '../../types';
import {
  History, Search, ShieldCheck, AlertOctagon, Calendar, Clock,
  User, RefreshCw, FileText, ChevronDown, ChevronUp,
  MessageSquareText, CircleAlert, CheckCircle2, Activity,
} from 'lucide-react';
import {
  formatIndianDate,
  formatIndianTime,
  formatIndianDateTime,
  parseIndianDateTime,
} from '../../utils/date';

export const AuditHistoryView: React.FC = () => {
  const { activeProject } = useProject();

  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [dailyUpdates, setDailyUpdates] = useState<DailyUpdate[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);

  const loadAudits = useCallback(async () => {
    if (!activeProject) {
      setAudits([]);
      setDailyUpdates([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [auditData, updateData] = await Promise.all([
        api.getAuditTrail(activeProject.id),
        api.getDailyUpdates({}),
      ]);

      setAudits(Array.isArray(auditData) ? auditData : []);
      setDailyUpdates(Array.isArray(updateData) ? updateData : []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('Unable to load history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    void loadAudits();
  }, [loadAudits]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredAudits = audits.filter((event) => {
    const description = event.description ?? '';
    const eventType = event.event_type ?? '';
    const actor = event.actor?.full_name ?? '';

    return (
      description.toLowerCase().includes(normalizedSearch) ||
      eventType.toLowerCase().includes(normalizedSearch) ||
      actor.toLowerCase().includes(normalizedSearch)
    );
  });

  const filteredUpdates = dailyUpdates
    .filter((update) => {
      const employee = update.user?.full_name ?? '';
      const notes = update.update_notes ?? '';
      const blocker = update.blocker_notes ?? '';
      const taskId = String(update.task_id);

      return (
        !normalizedSearch ||
        employee.toLowerCase().includes(normalizedSearch) ||
        notes.toLowerCase().includes(normalizedSearch) ||
        blocker.toLowerCase().includes(normalizedSearch) ||
        taskId.includes(normalizedSearch) ||
        String(update.progress_pct).includes(normalizedSearch)
      );
    })
    .sort(
      (a, b) =>
        (parseIndianDateTime(b.created_at || b.date)?.getTime() ?? 0) -
        (parseIndianDateTime(a.created_at || a.date)?.getTime() ?? 0)
    );

  const toggleEvent = (id: string | number) => {
    const key = String(id);
    setExpandedEvents((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    );
  };

  const getEventStyle = (eventType: string) => {
    const type = eventType.toUpperCase();

    if (
      type.includes('REJECT') ||
      type.includes('FAIL') ||
      type.includes('ERROR')
    ) {
      return {
        dot: 'bg-rose-400',
        iconBg: 'bg-rose-500/10',
        iconColor: 'text-rose-300',
        badge: 'border-rose-400/20 bg-rose-500/10 text-rose-300',
        Icon: AlertOctagon,
      };
    }

    if (
      type.includes('APPROV') ||
      type.includes('RESOLV') ||
      type.includes('COMPLETE')
    ) {
      return {
        dot: 'bg-emerald-400',
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-300',
        badge: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
        Icon: ShieldCheck,
      };
    }

    return {
      dot: 'bg-violet-400',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-300',
      badge: 'border-violet-400/20 bg-violet-500/10 text-violet-300',
      Icon: FileText,
    };
  };

  return (
    <div className="space-y-5 text-[#FAF8FF]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
            <History className="h-5 w-5 text-violet-300" />
          </div>

          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Project History
            </h1>
            <p className="mt-1 text-xs text-[#A99DBD]">
              Employee updates, blockers and project decisions.
            </p>
            {activeProject && (
              <p className="mt-1 text-xs text-violet-300">
                Project: {activeProject.name}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadAudits()}
          disabled={isLoading || !activeProject}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/[0.08] bg-[#19112B] px-4 py-2.5 text-xs font-semibold text-[#D5CBE5] hover:border-violet-400/30 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Stats and Search */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#19112B] p-3.5">
          <p className="text-xs text-[#A99DBD]">Audit Events</p>
          <p className="mt-1 text-2xl font-bold">{audits.length}</p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#19112B] p-3.5">
          <p className="text-xs text-[#A99DBD]">Employee Updates</p>
          <p className="mt-1 text-2xl font-bold">{filteredUpdates.length}</p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#19112B] p-3.5">
          <label className="mb-2 block text-xs text-[#A99DBD]">
            Search history
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#827694]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee, notes, task..."
              className="w-full rounded-lg border border-white/[0.08] bg-[#130D21] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#827694] focus:border-violet-400/40"
            />
          </div>
        </div>
      </div>

      {/* Daily Employee Updates */}
      <section className="overflow-hidden rounded-2xl border border-violet-400/15 bg-[#19112B]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <MessageSquareText className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Daily Employee Updates</h2>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Actual employee progress reports.
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-lg bg-violet-500/10 px-2.5 py-1.5 text-xs text-violet-200">
            {filteredUpdates.length}
          </span>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {!activeProject ? (
            <p className="py-6 text-center text-sm text-[#A99DBD]">
              Select a project to view employee updates.
            </p>
          ) : isLoading && dailyUpdates.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#A99DBD]">
              <RefreshCw className="h-4 w-4 animate-spin text-violet-300" />
              Loading employee updates...
            </div>
          ) : error && dailyUpdates.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-rose-300">{error}</p>
              <button
                type="button"
                onClick={() => void loadAudits()}
                className="mt-3 text-xs text-violet-300 hover:text-violet-200"
              >
                Try again
              </button>
            </div>
          ) : filteredUpdates.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquareText className="mx-auto h-7 w-7 text-[#827694]" />
              <p className="mt-2 text-sm font-semibold">
                {normalizedSearch ? 'No matching updates' : 'No employee updates yet'}
              </p>
              <p className="mt-1 text-xs text-[#A99DBD]">
                {normalizedSearch
                  ? 'Try another search term.'
                  : 'Submitted progress reports will appear here.'}
              </p>
            </div>
          ) : (
            filteredUpdates.map((update) => {
              const progress = Math.max(0, Math.min(100, update.progress_pct));
              const completed = progress === 100;

              return (
                <article
                  key={update.id}
                  className="rounded-xl border border-white/[0.07] bg-[#130D21]/75 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                        <User className="h-5 w-5 text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold">
                          {update.user?.full_name || `Employee #${update.user_id}`}
                        </h3>
                        <p className="mt-1 text-xs text-[#A99DBD]">
                          Task #{update.task_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#19112B] px-2.5 py-1.5 text-xs text-[#B7ADC9]">
                        <Calendar className="h-3.5 w-3.5 text-violet-300" />
                        {formatIndianDate(update.date)}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs ${
                          update.is_blocked
                            ? 'bg-rose-500/10 text-rose-300'
                            : completed
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-violet-500/10 text-violet-300'
                        }`}
                      >
                        {update.is_blocked ? (
                          <CircleAlert className="h-3.5 w-3.5" />
                        ) : completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Activity className="h-3.5 w-3.5" />
                        )}
                        {update.is_blocked ? 'Blocked' : completed ? 'Completed' : 'In progress'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-[#B7ADC9]">Progress</span>
                      <span className="font-bold text-violet-200">{progress}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-white/[0.07]"
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Task ${update.task_id} progress`}
                    >
                      <div
                        className={`h-full rounded-full ${
                          update.is_blocked
                            ? 'bg-rose-400'
                            : completed
                              ? 'bg-emerald-400'
                              : 'manager-progress-fill bg-gradient-to-r from-violet-600 to-purple-300'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#19112B]/80 p-3.5">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-violet-300" />
                      <h4 className="text-xs font-semibold text-[#E8E0F3]">
                        Employee's Daily Update
                      </h4>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#D5CBE5]">
                      {update.update_notes?.trim() || 'No progress notes were provided.'}
                    </p>
                  </div>

                  {update.is_blocked && (
                    <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-3.5">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="h-4 w-4 text-rose-300" />
                        <h4 className="text-xs font-semibold text-rose-200">
                          Blocker / Help Needed
                        </h4>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-rose-100/90">
                        {update.blocker_notes?.trim() || 'No blocker details were provided.'}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#827694]">
                    <Clock className="h-3 w-3" />
                    Submitted{' '}
                    {update.created_at
                      ? formatIndianDateTime(update.created_at)
                      : 'time unavailable'}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Activity Timeline — Collapsed by Default */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B]">
        <button
          type="button"
          onClick={() => setShowTimeline((previous) => !previous)}
          aria-expanded={showTimeline}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.02] sm:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <History className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Activity Timeline</h2>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Project decisions and recorded changes.
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-[#130D21] px-2.5 py-1.5 text-xs text-[#B7ADC9]">
              {filteredAudits.length}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-violet-300">
            {showTimeline ? 'Hide' : 'View'}
            {showTimeline ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {showTimeline && (
          <div className="border-t border-white/[0.06] p-4 sm:p-5">
            {error && audits.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-rose-300">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadAudits()}
                  className="mt-3 text-xs text-violet-300"
                >
                  Try again
                </button>
              </div>
            ) : isLoading && audits.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#A99DBD]">
                <RefreshCw className="h-4 w-4 animate-spin text-violet-300" />
                Loading activity...
              </div>
            ) : filteredAudits.length === 0 ? (
              <div className="py-8 text-center">
                <History className="mx-auto h-7 w-7 text-[#827694]" />
                <p className="mt-2 text-sm font-semibold">
                  {normalizedSearch ? 'No matching events' : 'No audit events yet'}
                </p>
                <p className="mt-1 text-xs text-[#A99DBD]">
                  Recorded project actions will appear here.
                </p>
              </div>
            ) : (
              <div className="relative ml-2 space-y-4 border-l border-white/[0.10] pl-5 sm:pl-6">
                {filteredAudits.map((event) => {
                  const style = getEventStyle(event.event_type ?? '');
                  const EventIcon = style.Icon;
                  const eventId = String(event.id);
                  const isExpanded = expandedEvents.includes(eventId);
                  const changes = event.metadata_json?.applied_changes;
                  const hasChanges = changes !== undefined && changes !== null;

                  return (
                    <article key={event.id} className="relative">
                      <div
                        className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-[#19112B] ${style.dot} sm:-left-[32px]`}
                      />

                      <div className="rounded-xl border border-white/[0.06] bg-[#130D21]/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBg}`}>
                                <EventIcon className={`h-4 w-4 ${style.iconColor}`} />
                              </div>
                              <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${style.badge}`}>
                                {(event.event_type ?? 'EVENT').replace(/_/g, ' ')}
                              </span>
                            </div>

                            <p className="mt-3 break-words text-sm leading-6 text-[#E8E0F3]">
                              {event.description || 'No description provided.'}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[#A99DBD]">
                              {event.actor?.full_name && (
                                <span className="inline-flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5" />
                                  {event.actor.full_name}
                                </span>
                              )}

                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {event.created_at
                                  ? formatIndianDate(event.created_at)
                                  : 'Date unavailable'}
                              </span>

                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {event.created_at
                                  ? formatIndianTime(event.created_at)
                                  : 'Time unavailable'}
                              </span>
                            </div>
                          </div>

                          {hasChanges && (
                            <button
                              type="button"
                              onClick={() => toggleEvent(event.id)}
                              aria-expanded={isExpanded}
                              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#19112B] px-3 py-2 text-[11px] text-[#B7ADC9] hover:text-violet-300"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {isExpanded ? 'Hide changes' : 'View changes'}
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {hasChanges && isExpanded && (
                          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] bg-[#0F0A1A] p-3 font-mono text-[11px] leading-5 text-[#B7ADC9]">
                            {JSON.stringify(changes, null, 2)}
                          </pre>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {error && audits.length > 0 && (
              <p className="mt-3 text-xs text-amber-200">{error}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
