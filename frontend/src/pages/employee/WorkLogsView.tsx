
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { WorkLog, Task } from '../../types';
import {
  Clock,
  Plus,
  CalendarDays,
  FileText,
  CheckCircle2,
  ClipboardList,
  Timer,
  X,
  LoaderCircle,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import {
  formatIndianDate,
  formatIndianTime,
} from '../../utils/date';
import { useVisibleInterval } from '../../hooks/useVisibleInterval';

export const WorkLogsView: React.FC = () => {
  const { user, isManager } = useAuth();

  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>();
  const [hoursSpent, setHoursSpent] = useState<number>(2);
  const [notes, setNotes] = useState('');
  const [logDate, setLogDate] = useState(getTodayInIndia());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function getTodayInIndia(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const getPart = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';

    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  }

  useEffect(() => {
    if (user) {
      loadLogs();
      loadTasks();
    }
  }, [user, isManager]);

  useVisibleInterval(() => {
    void loadTasks();
  }, 3000);

  const loadLogs = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const data = await api.getWorkLogs(
        isManager ? undefined : { user_id: user.id },
      );
      setLogs(data);
    } catch (err) {
      console.error('Failed to load work logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasks = async () => {
    if (!user) return;

    try {
      const data = await api.getTasks({ assignee_id: user.id });
      setMyTasks(data);

      setSelectedTaskId((current) =>
        data.some((task) => task.id === current)
          ? current
          : data[0]?.id,
      );
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTaskId) {
      alert('Please select an assigned task.');
      return;
    }

    if (hoursSpent < 0.5 || hoursSpent > 24) {
      alert('Hours must be between 0.5 and 24.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.createWorkLog(
        selectedTaskId,
        Number(hoursSpent),
        notes,
        logDate
      );

      await loadLogs();
      setIsLogModalOpen(false);
      setNotes('');
      setHoursSpent(2);
      setLogDate(getTodayInIndia());
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';

      alert(`Failed to record work log: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalLoggedHours = logs.reduce(
    (acc, curr) => acc + Number(curr.hours_spent || 0),
    0
  );

  return (
    <div className="space-y-8 text-[#FAF8FF]">
      {/* Header */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
            {isManager ? 'Manager Workspace' : 'Contributor Workspace'}
          </span>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {isManager ? 'Team Work Logs & Timesheet' : 'Work Logs & Timesheet'}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B7ADC9]">
            {isManager
              ? 'Review team work sessions and record time against your assigned tasks.'
              : 'Track your work sessions, record completed activities, and monitor the time spent on your assigned tasks.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsLogModalOpen(true)}
          disabled={myTasks.length === 0}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-200 transition-all hover:border-violet-300/60 hover:bg-violet-500/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Log Work Session
        </button>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#19112B] p-5 transition-colors hover:border-violet-400/25">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#B7ADC9]">
                Total Logged Hours
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                {totalLoggedHours.toFixed(1)}
                <span className="ml-1.5 text-sm font-medium text-[#A99DBD]">
                  hrs
                </span>
              </p>

              <p className="mt-2 text-xs text-[#A99DBD]">
                {isManager ? 'Across team work sessions' : 'Across all your work sessions'}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
              <Timer className="h-5 w-5 text-violet-300" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#19112B] p-5 transition-colors hover:border-violet-400/25">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#B7ADC9]">
                Work Sessions
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                {logs.length}
              </p>

              <p className="mt-2 text-xs text-[#A99DBD]">
                Total sessions recorded
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10">
              <ClipboardList className="h-5 w-5 text-sky-300" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#19112B] p-5 transition-colors hover:border-violet-400/25">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#B7ADC9]">
                {isManager ? 'My Assigned Tasks' : 'Assigned Tasks'}
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                {myTasks.length}
              </p>

              <p className="mt-2 text-xs text-[#A99DBD]">
                {isManager ? 'Your tasks available for logging' : 'Tasks available for logging'}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
          </div>
        </div>
      </section>

      {/* Work Logs Table */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
              Work Session History
            </h2>

            <p className="mt-1 text-xs text-[#A99DBD]">
              {isManager
                ? 'Team work sessions and time entries'
                : 'Your recorded work and time entries'}
            </p>
          </div>

          <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
            {logs.length} record{logs.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#19112B] shadow-[0_10px_35px_rgba(0,0,0,0.15)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12">
              <LoaderCircle className="h-6 w-6 animate-spin text-violet-300" />
              <p className="text-sm text-[#B7ADC9]">
                Loading your work logs...
              </p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center sm:p-14">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
                <FileText className="h-6 w-6 text-violet-300" />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-white">
                No work sessions yet
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#B7ADC9]">
                Start tracking your effort by logging a work session against
                one of your assigned tasks.
              </p>

              {myTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/20 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  Record First Session
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.08] bg-[#211638] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A99DBD]">
                    <tr>
                      <th className="px-5 py-4">Date</th>
                      {isManager && <th className="px-5 py-4">Employee</th>}
                      <th className="px-5 py-4">Task</th>
                      <th className="px-5 py-4">Hours</th>
                      <th className="px-5 py-4">Session Notes</th>
                      <th className="px-5 py-4 text-right">Logged At (IST)</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/[0.06] text-[#FAF8FF]">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="transition-colors hover:bg-violet-500/[0.05]"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                              <CalendarDays className="h-4 w-4 text-violet-300" />
                            </div>

                            <span className="font-medium text-white">
                              {formatIndianDate(log.log_date)}
                            </span>
                          </div>
                        </td>

                        {isManager && (
                          <td className="whitespace-nowrap px-5 py-4 font-medium">
                            {log.user?.full_name || 'Unknown employee'}
                          </td>
                        )}

                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1.5 font-mono font-semibold text-violet-200">
                            Task #{log.task_id}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2.5 py-1.5 font-bold text-sky-200">
                            <Clock className="h-3.5 w-3.5" />
                            {log.hours_spent}h
                          </span>
                        </td>

                        <td className="max-w-sm px-5 py-4">
                          <p className="whitespace-pre-wrap break-words leading-5 text-[#B7ADC9]">
                            {log.notes || (
                              <span className="italic text-[#817592]">
                                No notes recorded
                              </span>
                            )}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <span className="text-[#B7ADC9]">
                            {formatIndianTime(log.created_at)}
                          </span>
                          <span className="ml-1.5 text-[10px] text-[#817592]">
                            IST
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 p-3 md:hidden">
                {logs.map((log) => (
                  <article
                    key={log.id}
                    className="rounded-xl border border-white/[0.08] bg-[#211638] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
                          <FileText className="h-5 w-5 text-violet-300" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white">
                            Task #{log.task_id}
                          </h3>

                          {isManager && (
                            <p className="mt-1 text-xs text-[#B7ADC9]">
                              {log.user?.full_name || 'Unknown employee'}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-[#A99DBD]">
                            {formatIndianDate(log.log_date)}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-200">
                        {log.hours_spent}h
                      </span>
                    </div>

                    <div className="mt-4 border-t border-white/[0.07] pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A99DBD]">
                        Session Notes
                      </p>

                      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-[#B7ADC9]">
                        {log.notes || 'No notes recorded'}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-[#A99DBD]">
                      <Clock className="h-3.5 w-3.5 text-violet-300" />
                      Logged at {formatIndianTime(log.created_at)} IST
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Record Work Session Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => {
          if (!isSubmitting) setIsLogModalOpen(false);
        }}
        title="Record Work Session"
        subtitle="Log your effort against an assigned task"
        maxWidth="md"
      >
        <form
          onSubmit={handleCreateLog}
          className="space-y-5 rounded-xl text-[#FAF8FF]"
        >
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]">
              Select Assigned Task *
            </label>

            <select
              required
              value={selectedTaskId ?? ''}
              onChange={(e) =>
                setSelectedTaskId(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="w-full rounded-xl border border-white/10 bg-[#211638] px-3 py-3 text-sm text-white outline-none transition-colors focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
            >
              <option value="" disabled className="bg-[#19112B] text-white">
                Choose a task
              </option>

              {myTasks.map((task) => (
                <option
                  key={task.id}
                  value={task.id}
                  className="bg-[#19112B] text-white"
                >
                  #{task.id} • {task.title}
                </option>
              ))}
            </select>

            {myTasks.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">
                You don't have any assigned tasks to log yet.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]">
                Session Date *
              </label>

              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />

                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#211638] py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20 [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]">
                Hours Spent *
              </label>

              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />

                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  required
                  value={hoursSpent}
                  onChange={(e) =>
                    setHoursSpent(parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#211638] py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>

              <p className="mt-1.5 text-[11px] text-[#817592]">
                Enter between 0.5 and 24 hours
              </p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]">
              Session Focus & Accomplishments
            </label>

            <textarea
              rows={4}
              placeholder="What did you build, debug, test, or complete?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#211638] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-[#817592] focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsLogModalOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-[#B7ADC9] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || myTasks.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/20 px-4 py-2.5 text-sm font-bold text-violet-100 transition-all hover:border-violet-300/60 hover:bg-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Record Work Log
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WorkLogsView;