
import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  AlertOctagon,
  CheckCircle2,
  Calendar,
  Info,
  ClipboardList,
  Clock,
  Target,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  CircleAlert,
  MessageSquare,
  LoaderCircle,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { DailyUpdate, Task } from '../../types';

const C = {
  bg: 'var(--ui-canvas)',
  panel: 'var(--ui-surface)',
  panel2: 'var(--ui-surface-raised)',
  purple: 'var(--ui-accent)',
  lilac: 'var(--ui-text)',
  muted: 'var(--ui-muted)',
  white: 'var(--ui-text)',
  border: 'var(--ui-border)',
};

export const DailyUpdatesView: React.FC = () => {
  const { user } = useAuth();

  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>();
  const [progressPct, setProgressPct] = useState(50);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockerNotes, setBlockerNotes] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadUpdates = useCallback(async () => {
    if (!user) return;

    const data = await api.getDailyUpdates({ user_id: user.id });
    setUpdates(data);
  }, [user]);

  const loadTasks = useCallback(async () => {
    if (!user) return;

    const data = await api.getTasks({ assignee_id: user.id });
    setMyTasks(data);

    setSelectedTaskId((currentId) => {
      const selected = data.find((task) => task.id === currentId);
      return selected?.id ?? data[0]?.id;
    });

    // Keep the form synchronized with the currently selected task.
    const selected = data.find((task) => task.id === selectedTaskId);
    const taskToUse = selected ?? data[0];

    if (taskToUse) {
      setProgressPct(taskToUse.progress_pct);
      setIsBlocked(taskToUse.is_blocked);
      setBlockerNotes(taskToUse.blocker_reason || '');
    } else {
      setProgressPct(0);
      setIsBlocked(false);
      setBlockerNotes('');
    }
  }, [user, selectedTaskId]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadUpdates(), loadTasks()]);
  }, [loadUpdates, loadTasks]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (!user) {
        setUpdates([]);
        setMyTasks([]);
        setSelectedTaskId(undefined);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);

      try {
        const [updateData, taskData] = await Promise.all([
          api.getDailyUpdates({ user_id: user.id }),
          api.getTasks({ assignee_id: user.id }),
        ]);

        if (cancelled) return;

        setUpdates(updateData);
        setMyTasks(taskData);

        const firstTask = taskData[0];

        setSelectedTaskId((currentId) => {
          const selected = taskData.find((task) => task.id === currentId);
          return selected?.id ?? firstTask?.id;
        });

        if (firstTask) {
          setProgressPct(firstTask.progress_pct);
          setIsBlocked(firstTask.is_blocked);
          setBlockerNotes(firstTask.blocker_reason || '');
        } else {
          setProgressPct(0);
          setIsBlocked(false);
          setBlockerNotes('');
        }
      } catch (error) {
        console.error('Failed to load daily update data:', error);

        if (!cancelled) {
          setErrorMsg(
            'Unable to load your tasks and updates. Please try again.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleTaskSelect = (taskId: number) => {
    setSelectedTaskId(taskId);
    setSuccessMsg(null);
    setErrorMsg(null);

    const task = myTasks.find((item) => item.id === taskId);

    if (task) {
      setProgressPct(task.progress_pct);
      setIsBlocked(task.is_blocked);
      setBlockerNotes(task.blocker_reason || '');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTaskId || isSubmitting) return;

    if (isBlocked && !blockerNotes.trim()) {
      setErrorMsg('Please describe the blocker before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // 1. Submit the daily report.
      await api.submitDailyUpdate({
        task_id: selectedTaskId,
        progress_pct: Number(progressPct),
        is_blocked: isBlocked,
        blocker_notes: isBlocked ? blockerNotes.trim() : undefined,
        update_notes: updateNotes.trim(),
      });

      // 2. Refresh update history and task data automatically.
      // If either refresh fails, the report may still have been saved.
      try {
        await refreshData();
      } catch (refreshError) {
        console.error('Report saved, but refreshing data failed:', refreshError);
        setErrorMsg(
          'Your report was submitted, but the latest data could not be refreshed. Please use Refresh data to try again.'
        );
      }

      // 3. Show success and reset the notes field.
      setSuccessMsg(
        'Daily report submitted successfully. Your updates and tasks have been refreshed.'
      );

      setUpdateNotes('');
    } catch (error: unknown) {
      console.error('Failed to submit daily update:', error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Failed to submit your report. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      await refreshData();
      setSuccessMsg('Your tasks and daily update history are up to date.');
    } catch (error) {
      console.error('Failed to refresh daily update data:', error);
      setErrorMsg('Refresh failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTask = myTasks.find((task) => task.id === selectedTaskId);

  const completedTasks = myTasks.filter(
    (task) => task.progress_pct === 100
  ).length;

  const blockedTasks = myTasks.filter((task) => task.is_blocked).length;

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'var(--ui-success)';
    return 'var(--ui-accent)';
  };

  const formatDate = (date: string) => {
    if (!date) return 'Date unavailable';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div
      className="daily-updates min-h-full space-y-7 p-4 sm:p-6 lg:p-8"
      style={{
        background: C.bg,
        color: C.white,
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -right-40 -top-40 h-96 w-96 rounded-full blur-3xl"
          style={{ background: 'rgba(100,116,139,.06)' }}
        />
        <div
          className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full blur-3xl"
          style={{ background: 'rgba(100,116,139,.04)' }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-7">
        {/* Header */}
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em]"
              style={{
                borderColor: C.border,
                background: 'var(--ui-accent-soft)',
                color: C.purple,
              }}
            >
              <Sparkles size={13} />
              Workforce intelligence
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Daily standup{' '}
              <span
                style={{
                  color: 'var(--ui-accent)',
                }}
              >
                updates
              </span>
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm leading-6"
              style={{ color: C.muted }}
            >
              Capture progress, communicate blockers, and keep your project
              intelligence up to date.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border px-4 py-3 text-xs font-semibold transition hover:bg-white/5 disabled:opacity-50 sm:self-auto"
            style={{ borderColor: C.border, color: C.lilac }}
          >
            <RefreshCw
              size={15}
              className={isLoading ? 'animate-spin' : ''}
            />
            Refresh data
          </button>
        </header>

        {/* Respectful AI principle */}
        <section
          className="rounded-2xl border p-4 sm:p-5"
          style={{
            borderColor: C.border,
            background: 'var(--ui-surface-raised)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: 'var(--ui-accent-soft)',
                color: C.purple,
              }}
            >
              <ShieldCheck size={20} />
            </div>

            <div>
              <h2 className="text-sm font-bold" style={{ color: C.lilac }}>
                WorkPilot principle: progress without pressure
              </h2>
              <p
                className="mt-1 text-xs leading-6 sm:text-sm"
                style={{ color: C.muted }}
              >
                Missing daily updates are treated as unknown information,
                never as proof that work has not occurred. Updates support
                project visibility while respecting engineering focus and
                autonomous workflows.
              </p>
            </div>
          </div>
        </section>

        {/* Summary cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Assigned tasks',
              value: myTasks.length,
              description: 'Tasks assigned to you',
              icon: ClipboardList,
              color: 'var(--ui-accent)',
            },
            {
              label: 'Completed tasks',
              value: completedTasks,
              description: 'At 100% completion',
              icon: CheckCircle2,
              color: 'var(--ui-success)',
            },
            {
              label: 'Blocked tasks',
              value: blockedTasks,
              description: 'Need attention',
              icon: AlertOctagon,
              color: 'var(--ui-danger)',
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5"
                style={{
                  borderColor: C.border,
                  background: C.panel,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium" style={{ color: C.muted }}>
                      {stat.label}
                    </p>
                    <p className="mt-3 text-3xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: C.muted }}>
                      {stat.description}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: `color-mix(in srgb, ${stat.color} 12%, transparent)`,
                      color: stat.color,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Feedback */}
        {successMsg && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border p-4 text-sm"
            style={{
              borderColor: 'var(--ui-success-border)',
              background: 'var(--ui-success-bg)',
              color: 'var(--ui-success)',
            }}
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border p-4 text-sm"
            style={{
              borderColor: 'var(--ui-danger-border)',
              background: 'var(--ui-danger-bg)',
              color: 'var(--ui-danger)',
            }}
          >
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="ml-auto text-xs font-bold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
          {/* Submission form */}
          <section
            className="overflow-hidden rounded-2xl border"
            style={{
              borderColor: C.border,
              background: C.panel,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              className="border-b px-5 py-5 sm:px-6"
              style={{
                borderColor: C.border,
                background: 'var(--ui-surface-raised)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--ui-accent)',
                    color: '#FFFFFF',
                  }}
                >
                  <Send size={19} />
                </div>

                <div>
                  <h2 className="text-base font-bold">
                    Submit today's update
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: C.muted }}>
                    Share where things stand.
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div
                className="flex min-h-72 flex-col items-center justify-center gap-3 p-8"
                style={{ color: C.muted }}
              >
                <LoaderCircle
                  size={28}
                  className="animate-spin"
                  style={{ color: C.purple }}
                />
                <p className="text-sm">Loading your tasks...</p>
              </div>
            ) : myTasks.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                <div
                  className="mb-4 rounded-2xl p-4"
                  style={{
                    background: 'var(--ui-accent-soft)',
                    color: C.purple,
                  }}
                >
                  <ClipboardList size={28} />
                </div>
                <h3 className="text-base font-bold">No assigned tasks yet</h3>
                <p
                  className="mt-2 max-w-sm text-sm leading-6"
                  style={{ color: C.muted }}
                >
                  Once a task is assigned to you, you can submit progress and
                  share blockers here.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
                <div>
                  <label
                    htmlFor="daily-task"
                    className="mb-2 block text-xs font-semibold"
                    style={{ color: C.lilac }}
                  >
                    Select task <span style={{ color: C.purple }}>*</span>
                  </label>

                  <select
                    id="daily-task"
                    required
                    value={selectedTaskId ?? ''}
                    onChange={(event) =>
                      handleTaskSelect(Number(event.target.value))
                    }
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                    style={{
                      borderColor: C.border,
                      background: C.panel2,
                      color: C.white,
                    }}
                  >
                    {myTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        #{task.id} · {task.title} ({task.status})
                      </option>
                    ))}
                  </select>

                  {selectedTask && (
                    <div
                      className="mt-3 rounded-xl border p-3"
                      style={{
                        borderColor: C.border,
                        background: 'var(--ui-surface-raised)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs" style={{ color: C.muted }}>
                          Selected task progress
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                          style={{
                            background: 'var(--ui-accent-soft)',
                            color: C.purple,
                          }}
                        >
                          {selectedTask.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold">
                        {selectedTask.title}
                      </p>
                    </div>
                  )}
                </div>

                {/* Progress slider */}
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <label
                      htmlFor="progress-range"
                      className="text-xs font-semibold"
                      style={{ color: C.lilac }}
                    >
                      Overall completion
                    </label>

                    <span
                      className="rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums"
                      style={{
                        color: getProgressColor(progressPct),
                        background: `color-mix(in srgb, ${getProgressColor(progressPct)} 12%, transparent)`,
                      }}
                    >
                      {progressPct}%
                    </span>
                  </div>

                  <input
                    id="progress-range"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progressPct}
                    onChange={(event) =>
                      setProgressPct(Number(event.target.value))
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full accent-forest-600"
                    style={{
                      background: 'var(--ui-border)',
                    }}
                  />

                  <div
                    className="mt-2 flex justify-between text-[10px]"
                    style={{ color: C.muted }}
                  >
                    <span>Not started</span>
                    <span>In progress</span>
                    <span>Completed</span>
                  </div>
                </div>

                {/* Blocker */}
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: isBlocked
                      ? 'var(--ui-danger-border)'
                      : C.border,
                    background: isBlocked
                      ? 'var(--ui-danger-bg)'
                      : 'var(--ui-surface-raised)',
                  }}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isBlocked}
                      onChange={(event) => {
                        setIsBlocked(event.target.checked);
                        setErrorMsg(null);
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-forest-600"
                    />

                    <span className="flex-1">
                      <span
                        className="flex items-center gap-2 text-sm font-semibold"
                        style={{ color: isBlocked ? 'var(--ui-danger)' : C.lilac }}
                      >
                        <AlertOctagon size={16} />
                        This task is blocked
                      </span>
                      <span
                        className="mt-1 block text-xs leading-5"
                        style={{ color: C.muted }}
                      >
                        Let your team know if something is preventing progress.
                      </span>
                    </span>
                  </label>

                  {isBlocked && (
                    <div className="mt-4">
                      <label
                        htmlFor="blocker-notes"
                        className="mb-2 block text-xs font-semibold"
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        Describe the blocker *
                      </label>
                      <textarea
                        id="blocker-notes"
                        required
                        rows={3}
                        placeholder="What are you waiting on? Is there a dependency or decision needed?"
                        value={blockerNotes}
                        onChange={(event) => setBlockerNotes(event.target.value)}
                        className="w-full resize-y rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-forest-500"
                        style={{
                          borderColor: 'var(--ui-danger-border)',
                          background: C.panel2,
                          color: C.white,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Accomplishments */}
                <div>
                  <label
                    htmlFor="update-notes"
                    className="mb-2 flex items-center gap-2 text-xs font-semibold"
                    style={{ color: C.lilac }}
                  >
                    <MessageSquare size={14} />
                    Accomplishments & next steps
                  </label>

                  <textarea
                    id="update-notes"
                    rows={4}
                    placeholder="What did you accomplish today? What will you work on next?"
                    value={updateNotes}
                    onChange={(event) => setUpdateNotes(event.target.value)}
                    className="w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 outline-none transition focus:ring-2 focus:ring-forest-500"
                    style={{
                      borderColor: C.border,
                      background: C.panel2,
                      color: C.white,
                    }}
                  />
                  <p
                    className="mt-2 text-[10px]"
                    style={{ color: C.muted }}
                  >
                    Include key progress, decisions, and next actions.
                  </p>
                </div>

                {/* Submit button */}
                <div
                  className="border-t pt-5"
                  style={{ borderColor: C.border }}
                >
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedTaskId}
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-52"
                    style={{
                      background: 'var(--ui-accent)',
                      boxShadow: 'var(--shadow-subtle)',
                    }}
                  >
                    {isSubmitting ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {isSubmitting
                      ? 'Submitting and refreshing...'
                      : 'Submit daily update'}
                    {!isSubmitting && <ArrowUpRight size={16} />}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Right sidebar */}
          <aside className="space-y-6">
            <section
              className="rounded-2xl border p-5 sm:p-6"
              style={{
                borderColor: C.border,
                background: C.panel,
              }}
            >
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="rounded-xl p-2.5"
                  style={{
                    background: 'var(--ui-accent-soft)',
                    color: C.purple,
                  }}
                >
                  <Target size={19} />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Task snapshot</h2>
                  <p className="mt-1 text-xs" style={{ color: C.muted }}>
                    Your selected task
                  </p>
                </div>
              </div>

              {selectedTask ? (
                <>
                  <p className="text-sm font-semibold leading-6">
                    {selectedTask.title}
                  </p>

                  <div className="mt-5 flex items-end justify-between">
                    <span className="text-xs" style={{ color: C.muted }}>
                      Reported completion
                    </span>
                    <span
                      className="text-xl font-bold"
                      style={{ color: getProgressColor(progressPct) }}
                    >
                      {progressPct}%
                    </span>
                  </div>

                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full"
                    style={{ background: 'var(--ui-border)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPct}%`,
                        background: getProgressColor(progressPct),
                      }}
                    />
                  </div>

                  <div
                    className="mt-5 flex items-center gap-2 rounded-xl border p-3 text-xs"
                    style={{
                      borderColor: isBlocked
                        ? 'var(--ui-danger-border)'
                        : 'var(--ui-success-border)',
                      background: isBlocked
                        ? 'var(--ui-danger-bg)'
                        : 'var(--ui-success-bg)',
                      color: isBlocked ? 'var(--ui-danger)' : 'var(--ui-success)',
                    }}
                  >
                    {isBlocked ? (
                      <AlertOctagon size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {isBlocked
                      ? 'Blocker reported for this update'
                      : 'No blocker reported for this update'}
                  </div>
                </>
              ) : (
                <p className="text-sm leading-6" style={{ color: C.muted }}>
                  Select an assigned task to view its progress snapshot.
                </p>
              )}
            </section>

            {/* Update history */}
            <section
              className="overflow-hidden rounded-2xl border"
              style={{
                borderColor: C.border,
                background: C.panel,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: C.border }}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar size={17} style={{ color: C.purple }} />
                  <h2 className="text-sm font-bold">Recent updates</h2>
                </div>

                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={{
                    background: 'var(--ui-accent-soft)',
                    color: C.purple,
                  }}
                >
                  {updates.length}
                </span>
              </div>

              {isLoading ? (
                <div
                  className="flex justify-center p-8"
                  style={{ color: C.muted }}
                >
                  <LoaderCircle size={22} className="animate-spin" />
                </div>
              ) : updates.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div
                    className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background: 'var(--ui-accent-soft)',
                      color: C.purple,
                    }}
                  >
                    <Calendar size={22} />
                  </div>
                  <p className="text-sm font-semibold">No updates yet</p>
                  <p
                    className="mx-auto mt-2 max-w-xs text-xs leading-5"
                    style={{ color: C.muted }}
                  >
                    Your submitted daily updates will appear here.
                  </p>
                </div>
              ) : (
                <div className="max-h-[520px] divide-y overflow-y-auto">
                  {updates.map((update) => (
                    <article
                      key={update.id}
                      className="p-4 transition hover:bg-white/[0.025]"
                      style={{ borderColor: C.border }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold">
                            Task #{update.task_id}
                          </p>
                          <div
                            className="mt-1.5 flex items-center gap-1.5 text-[10px]"
                            style={{ color: C.muted }}
                          >
                            <Clock size={11} />
                            {formatDate(update.date)}
                          </div>
                        </div>

                        <span
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold"
                          style={{
                            background: 'var(--ui-accent-soft)',
                            color: C.purple,
                          }}
                        >
                          {update.progress_pct}%
                        </span>
                      </div>

                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full"
                        style={{ background: 'var(--ui-border)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, update.progress_pct))}%`,
                            background:
                              'var(--ui-accent)',
                          }}
                        />
                      </div>

                      {update.is_blocked && (
                        <div
                          className="mt-3 rounded-lg border p-2.5"
                          style={{
                            borderColor: 'var(--ui-danger-border)',
                            background: 'var(--ui-danger-bg)',
                          }}
                        >
                          <div
                            className="flex items-center gap-1.5 text-[10px] font-bold"
                            style={{ color: 'var(--ui-danger)' }}
                          >
                            <AlertOctagon size={12} />
                            BLOCKED
                          </div>

                          {update.blocker_notes && (
                            <p
                              className="mt-1.5 text-xs leading-5"
                              style={{ color: 'var(--ui-danger)' }}
                            >
                              {update.blocker_notes}
                            </p>
                          )}
                        </div>
                      )}

                      {update.update_notes && (
                        <p
                          className="mt-3 whitespace-pre-wrap break-words text-xs leading-5"
                          style={{ color: C.muted }}
                        >
                          {update.update_notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Helpful reminder */}
            <section
              className="rounded-2xl border p-4"
              style={{
                borderColor: C.border,
                background: 'var(--ui-surface-raised)',
              }}
            >
              <div className="flex items-start gap-3">
                <Info
                  size={17}
                  className="mt-0.5 shrink-0"
                  style={{ color: C.purple }}
                />
                <div>
                  <p className="text-xs font-bold">A useful daily update</p>
                  <p
                    className="mt-1.5 text-xs leading-5"
                    style={{ color: C.muted }}
                  >
                    Include what changed, what's next, and whether you need
                    help. A clear blocker makes it easier for teammates to
                    support you.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <footer
          className="flex flex-col gap-2 border-t pt-5 text-[10px] sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: C.border, color: C.muted }}
        >
          <span className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--ui-success)' }}
            />
            WorkPilot workforce intelligence
          </span>
          <span>
            Progress visibility · Blocker awareness · Team alignment
          </span>
        </footer>
      </div>
    </div>
  );
};
