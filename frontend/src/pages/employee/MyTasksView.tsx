
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { BlockerModal } from '../../components/tasks/BlockerModal';
import { Modal } from '../../components/common/Modal';
import { formatIndianDate } from '../../utils/date';
import {
  CheckSquare,
  Clock,
  AlertOctagon,
  CheckCircle2,
  CalendarDays,
  Link2,
  Send,
  Edit3,
  PlayCircle,
  LoaderCircle,
  AlertCircle,
  RefreshCw,
  Timer,
  Target,
  ShieldCheck,
  FileText,
} from 'lucide-react';

type TaskWithBlockerStatus = Task & {
  blocker_status?: 'OPEN' | 'RESOLVED' | null;
};

type SubmittedProgressNote = {
  taskId: string | number;
  notes: string;
};

const isBlockerResolved = (task: TaskWithBlockerStatus): boolean =>
  task.blocker_status === 'RESOLVED';

const hasActiveBlocker = (task: TaskWithBlockerStatus): boolean =>
  !isBlockerResolved(task) &&
  (Boolean(task.is_blocked) || task.status === 'BLOCKED');

export const MyTasksView: React.FC = () => {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const activeProjectId = activeProject?.id;

  const [tasks, setTasks] = useState<TaskWithBlockerStatus[]>([]);
  const [selectedTask, setSelectedTask] =
    useState<TaskWithBlockerStatus | null>(null);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false);

  const [progressPct, setProgressPct] = useState(0);
  const [updateNotes, setUpdateNotes] = useState('');
  const [hoursSpent, setHoursSpent] = useState(1);
  const [workLogNotes, setWorkLogNotes] = useState('');

  // Stores the most recently submitted progress note for each task.
  const [submittedNotes, setSubmittedNotes] = useState<
    SubmittedProgressNote[]
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');

  const isMountedRef = useRef(false);
  const isFetchingRef = useRef(false);
  // Incremented whenever the selected project changes so that responses
  // for a previously selected project are ignored.
  const requestIdRef = useRef(0);

  // Only load tasks assigned to the user within the selected project.
  const loadMyTasks = useCallback(async () => {
    if (!user || !activeProjectId) {
      if (isMountedRef.current) {
        setTasks([]);
        setIsLoading(false);
      }
      return;
    }

    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    const requestId = requestIdRef.current;

    try {
      const data = await api.getTasks({
        assignee_id: user.id,
        project_id: activeProjectId,
      });

      if (!isMountedRef.current) return;
      if (requestId !== requestIdRef.current) return;

      const latestTasks = data as TaskWithBlockerStatus[];

      setTasks(latestTasks);
      setPageError('');

      setSelectedTask((current) => {
        if (!current) return current;

        return (
          latestTasks.find((task) => task.id === current.id) ?? current
        );
      });
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      if (requestId !== requestIdRef.current) return;

      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setPageError(`Unable to load your tasks: ${message}`);
      console.error('Failed to load tasks:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        isFetchingRef.current = false;

        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }
  }, [user, activeProjectId]);

  // Initial load and automatic refresh every 3 seconds.
  // Re-runs whenever the selected project changes.
  useEffect(() => {
    isMountedRef.current = true;

    // Drop tasks from the previously selected project and invalidate
    // any request that is still in flight for it.
    requestIdRef.current += 1;
    isFetchingRef.current = false;
    setTasks([]);
    setSelectedTask(null);
    setPageError('');
    setIsLoading(true);

    void loadMyTasks();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadMyTasks();
      }
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadMyTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [loadMyTasks]);

  const handleOpenProgress = (task: TaskWithBlockerStatus) => {
    setSelectedTask(task);
    setProgressPct(task.progress_pct ?? 0);
    setUpdateNotes('');
    setFormError('');
    setIsUpdateModalOpen(true);
  };

  const handleOpenBlocker = (task: TaskWithBlockerStatus) => {
    if (isBlockerResolved(task)) return;

    setSelectedTask(task);
    setFormError('');
    setIsBlockerModalOpen(true);
  };

  const handleOpenWorkLog = (task: TaskWithBlockerStatus) => {
    setSelectedTask(task);
    setHoursSpent(1);
    setWorkLogNotes('');
    setFormError('');
    setIsWorkLogModalOpen(true);
  };

  const closeProgressModal = () => {
    if (isSubmitting) return;
    setIsUpdateModalOpen(false);
    setFormError('');
  };

  const closeWorkLogModal = () => {
    if (isSubmitting) return;
    setIsWorkLogModalOpen(false);
    setFormError('');
  };

  // Save progress and display the submitted note on the matching task card.
  const submitProgressUpdate = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    if (!selectedTask) return;

    if (progressPct < 0 || progressPct > 100) {
      setFormError('Progress must be between 0 and 100.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const taskId = selectedTask.id;
      const notes = updateNotes.trim();

      await api.updateTaskProgress(
        taskId,
        progressPct,
        progressPct === 100 ? 'COMPLETED' : undefined,
        notes,
      );

      // Update the frontend only after the API call succeeds.
      // Keep the latest non-empty note for this task.
      if (notes) {
        setSubmittedNotes((previous) => [
          { taskId, notes },
          ...previous.filter((item) => item.taskId !== taskId),
        ]);
      }

      await loadMyTasks();

      setIsUpdateModalOpen(false);
      setUpdateNotes('');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setFormError(`Failed to update progress: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitWorkLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedTask) return;

    if (
      !Number.isFinite(hoursSpent) ||
      hoursSpent < 0.5 ||
      hoursSpent > 24 ||
      Math.round(hoursSpent * 2) !== hoursSpent * 2
    ) {
      setFormError(
        'Enter a value between 0.5 and 24 hours in half-hour increments.',
      );
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await api.createWorkLog(
        selectedTask.id,
        Number(hoursSpent),
        workLogNotes.trim(),
      );

      await loadMyTasks();
      setIsWorkLogModalOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setFormError(`Failed to record work log: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date?: string | null) => {
    if (!date) return 'No due date';

    const formattedDate = formatIndianDate(date);
    return formattedDate === '—' ? date : formattedDate;
  };

  const isOverdue = (task: TaskWithBlockerStatus) => {
    if (!task.due_date || task.status === 'COMPLETED') return false;

    const dueDate = new Date(task.due_date);

    if (Number.isNaN(dueDate.getTime())) return false;

    dueDate.setHours(23, 59, 59, 999);
    return dueDate.getTime() < Date.now();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-300 border-rose-400/20';
      case 'IN_PROGRESS':
        return 'bg-violet-500/10 text-violet-300 border-violet-400/20';
      default:
        return 'bg-white/[0.05] text-[#B7ADC9] border-white/[0.08]';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'border-rose-400/20 bg-rose-500/10 text-rose-300';
      case 'HIGH':
        return 'border-amber-400/20 bg-amber-500/10 text-amber-300';
      case 'MEDIUM':
        return 'border-sky-400/20 bg-sky-500/10 text-sky-300';
      default:
        return 'border-white/[0.08] bg-white/[0.04] text-[#B7ADC9]';
    }
  };

  const inputClass =
    'w-full rounded-xl border border-white/[0.08] bg-[#130D21] px-3 py-2.5 text-sm text-[#FAF8FF] placeholder:text-[#807493] outline-none transition-colors focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60';

  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-[#B7ADC9] transition-colors hover:border-violet-400/20 hover:bg-violet-500/10 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50';

  const primaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50';

  const completedCount = tasks.filter(
    (task) => task.status === 'COMPLETED',
  ).length;

  const inProgressCount = tasks.filter(
    (task) => task.status === 'IN_PROGRESS',
  ).length;

  const blockedCount = tasks.filter(hasActiveBlocker).length;
  const resolvedCount = tasks.filter(isBlockerResolved).length;

  const averageProgress =
    tasks.length > 0
      ? Math.round(
          tasks.reduce(
            (total, task) => total + (task.progress_pct || 0),
            0,
          ) / tasks.length,
        )
      : 0;

  return (
    <div className="min-h-full space-y-6 text-[#FAF8FF]">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
              <CheckSquare className="h-4 w-4 text-violet-300" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
              Personal Workspace
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#FAF8FF] sm:text-3xl">
            My Task Queue
          </h1>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#A99DBD] sm:text-sm">
            {activeProject
              ? `Your assignments in ${activeProject.name}. Track progress, log focus hours, and resolve work impediments.`
              : 'Select a project from the top bar to see your assignments in it.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadMyTasks()}
          disabled={isLoading}
          className={`${secondaryButtonClass} task-queue-refresh-button`}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh Tasks
        </button>
      </div>

      {/* Error state */}
      {pageError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <div>
              <p className="text-sm font-semibold text-rose-200">
                Unable to load tasks
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-rose-200/80">
                {pageError}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadMyTasks()}
            className="shrink-0 rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/10"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#19112B]">
          <LoaderCircle className="h-8 w-8 animate-spin text-violet-300" />
          <p className="mt-4 text-sm font-medium text-[#E5D9FF]">
            Loading your tasks...
          </p>
          <p className="mt-1 text-xs text-[#807493]">
            Fetching your assigned work
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-violet-400/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">Total Tasks</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10">
                  <CheckSquare className="h-4 w-4 text-violet-300" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-[#FAF8FF]">
                {tasks.length}
              </p>
              <p className="mt-1 text-[10px] text-[#807493]">
                Assigned to you
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-emerald-400/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">Completed</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-300">
                {completedCount}
              </p>
              <p className="mt-1 text-[10px] text-[#807493]">
                Finished tasks
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-sky-400/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">In Progress</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10">
                  <PlayCircle className="h-4 w-4 text-sky-300" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-sky-300">
                {inProgressCount}
              </p>
              <p className="mt-1 text-[10px] text-[#807493]">
                Currently active
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-rose-400/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">Active Blockers</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10">
                  <AlertOctagon className="h-4 w-4 text-rose-300" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-rose-300">
                {blockedCount}
              </p>
              <p className="mt-1 text-[10px] text-[#807493]">
                Issues needing attention
              </p>
            </div>
          </div>

          {/* Overall progress */}
          {tasks.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
                    <Target className="h-5 w-5 text-violet-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#FAF8FF]">
                      Overall Progress
                    </h2>
                    <p className="mt-0.5 text-xs text-[#A99DBD]">
                      Average completion across your assigned tasks
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-violet-200">
                  {averageProgress}%
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="task-queue-progress-fill h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, averageProgress))}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[#807493]">
                <span>{resolvedCount} resolved issue(s)</span>
                <span>{blockedCount} active blocker(s)</span>
              </div>
            </div>
          )}

          {/* Assignments */}
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] px-5 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/10">
                <CheckSquare className="h-7 w-7 text-violet-300" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-[#FAF8FF]">
                {activeProject ? 'No Tasks Assigned' : 'No Project Selected'}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#A99DBD]">
                {activeProject
                  ? `You do not have any assignments in ${activeProject.name}. Tasks assigned to you in this project will appear here.`
                  : 'Choose a project from the selector in the top bar to see the tasks assigned to you in it.'}
              </p>
              <button
                type="button"
                onClick={() => void loadMyTasks()}
                className={`${secondaryButtonClass} mt-5`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Check Again
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#FAF8FF]">
                    Your Assignments
                  </h2>
                  <p className="mt-1 text-xs text-[#807493]">
                    Open a task action to update progress or log work.
                  </p>
                </div>
                <span className="rounded-lg border border-white/[0.08] bg-[#19112B] px-3 py-1.5 text-[10px] font-medium text-[#B7ADC9]">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {tasks.map((task) => {
                  const activeBlocker = hasActiveBlocker(task);
                  const resolvedBlocker = isBlockerResolved(task);
                  const progress = Math.min(
                    100,
                    Math.max(0, task.progress_pct || 0),
                  );

                  // Find the latest progress note for this task.
                  const progressNote = submittedNotes.find(
                    (item) => item.taskId === task.id,
                  );

                  return (
                    <div
                      key={task.id}
                      className="group flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B] transition-all duration-200 hover:border-violet-400/25 hover:shadow-lg hover:shadow-black/10"
                    >
                      <div className="p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <span className="font-mono text-[11px] font-medium text-[#807493]">
                            TASK #{task.id}
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusStyle(
                                task.status,
                              )}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  task.status === 'COMPLETED'
                                    ? 'bg-emerald-300'
                                    : task.status === 'BLOCKED'
                                      ? 'bg-rose-300'
                                      : task.status === 'IN_PROGRESS'
                                        ? 'bg-violet-300'
                                        : 'bg-[#A99DBD]'
                                }`}
                              />
                              {task.status.replaceAll('_', ' ')}
                            </span>

                            {resolvedBlocker && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                                <ShieldCheck className="h-3 w-3" />
                                ISSUE RESOLVED
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="break-words text-base font-semibold leading-6 text-[#FAF8FF] transition-colors group-hover:text-violet-200">
                          {task.title}
                        </h3>

                        <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-[#A99DBD]">
                          {task.description ||
                            'No detailed instructions provided.'}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${getPriorityStyle(
                              task.priority,
                            )}`}
                          >
                            {task.priority}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] ${
                              isOverdue(task)
                                ? 'border-rose-400/20 bg-rose-500/10 text-rose-300'
                                : 'border-white/[0.07] bg-white/[0.03] text-[#B7ADC9]'
                            }`}
                          >
                            <CalendarDays className="h-3 w-3" />
                            {isOverdue(task) ? 'Overdue · ' : 'Due '}
                            {formatDate(task.due_date)}
                          </span>
                        </div>

                        {activeBlocker && (
                          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.07] p-3">
                            <div className="flex items-start gap-2.5">
                              <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                                  Active Blocker
                                </p>
                                <p className="mt-1 break-words text-xs leading-5 text-rose-200/90">
                                  {task.blocker_reason ||
                                    'This task is currently blocked.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {resolvedBlocker && (
                          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-3">
                            <div className="flex items-start gap-2.5">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                  Issue Resolved
                                </p>
                                <p className="mt-1 text-xs leading-5 text-emerald-200/90">
                                  The reported blocker has been resolved. You
                                  can continue working on this task.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {task.dependencies &&
                          task.dependencies.length > 0 && (
                            <div className="mt-3 flex items-start gap-2 text-[11px] text-[#A99DBD]">
                              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
                              <span>
                                {task.dependencies.length}{' '}
                                {task.dependencies.length === 1
                                  ? 'dependency'
                                  : 'dependencies'}
                              </span>
                            </div>
                          )}

                        {/* Task progress bar */}
                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-[#B7ADC9]">
                              Task Progress
                            </span>
                            <span className="text-xs font-bold text-[#E5D9FF]">
                              {progress}%
                            </span>
                          </div>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-white/[0.06]"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Progress for ${task.title}`}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                progress === 100
                                  ? 'bg-emerald-400'
                                  : activeBlocker
                                    ? 'bg-rose-400'
                                    : 'bg-violet-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        {/* NEW: Display submitted progress notes */}
                        {progressNote && (
                          <div className="mt-4 rounded-xl border border-violet-400/20 bg-[#211833] p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/10">
                                <FileText className="h-4 w-4 text-violet-300" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="text-xs font-semibold text-[#E5D9FF]">
                                    Progress Notes
                                  </h4>
                                  <span className="rounded-full border border-violet-400/15 bg-violet-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-violet-300">
                                    Submitted
                                  </span>
                                </div>

                                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-[#B7ADC9]">
                                  {progressNote.notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-white/[0.06] bg-[#130D21]/70 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-[#807493]">
                              <Timer className="h-3.5 w-3.5 text-violet-300" />
                              Time Logged
                            </div>
                            <p className="mt-1.5 text-sm font-semibold text-[#E5D9FF]">
                              {task.actual_hours || 0}
                              <span className="ml-1 text-[10px] font-normal text-[#807493]">
                                hours
                              </span>
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/[0.06] bg-[#130D21]/70 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-[#807493]">
                              <Clock className="h-3.5 w-3.5 text-violet-300" />
                              Estimated
                            </div>
                            <p className="mt-1.5 text-sm font-semibold text-[#E5D9FF]">
                              {task.estimated_hours}
                              <span className="ml-1 text-[10px] font-normal text-[#807493]">
                                hours
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 border-t border-white/[0.07] bg-[#130D21]/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => handleOpenBlocker(task)}
                          disabled={resolvedBlocker}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors disabled:cursor-default ${
                            resolvedBlocker
                              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                              : activeBlocker
                                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                                : 'border-white/[0.08] bg-white/[0.03] text-[#B7ADC9] hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-200'
                          }`}
                        >
                          {resolvedBlocker ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <AlertOctagon className="h-3.5 w-3.5" />
                          )}
                          {resolvedBlocker
                            ? 'Issue Resolved'
                            : activeBlocker
                              ? 'View Blocker'
                              : 'Flag Blocker'}
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenWorkLog(task)}
                            className={secondaryButtonClass}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Log Time
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenProgress(task)}
                            className={primaryButtonClass}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Update
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolved issues summary */}
          {resolvedCount > 0 && (
            <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <div>
                  <h2 className="text-sm font-semibold text-emerald-200">
                    Resolved Issues
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                    {resolvedCount}{' '}
                    {resolvedCount === 1
                      ? 'blocker has'
                      : 'blockers have'}{' '}
                    been marked as resolved.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {tasks
                  .filter(isBlockerResolved)
                  .slice(0, 3)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#19112B] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="break-words text-xs font-medium text-[#E5D9FF]">
                        {task.title}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-emerald-300">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        ISSUE RESOLVED
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Progress update modal */}
      {selectedTask && (
        <Modal
          isOpen={isUpdateModalOpen}
          onClose={closeProgressModal}
          title={`Update Progress · Task #${selectedTask.id}`}
          subtitle={selectedTask.title}
          maxWidth="md"
        >
          <form onSubmit={submitProgressUpdate} className="space-y-5">
            <div className="rounded-2xl border border-white/[0.08] bg-[#130D21] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#B7ADC9]">
                    Task completion
                  </p>
                  <p className="mt-1 text-[10px] text-[#807493]">
                    Move the slider to update progress
                  </p>
                </div>
                <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2">
                  <span className="text-lg font-bold text-violet-200">
                    {progressPct}%
                  </span>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressPct}
                onChange={(e) => setProgressPct(Number(e.target.value))}
                disabled={isSubmitting}
                aria-label="Task completion percentage"
                className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-violet-500 disabled:cursor-not-allowed"
              />

              <div className="mt-2 flex justify-between text-[10px] text-[#807493]">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                {progressPct === 100 ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                ) : (
                  <PlayCircle className="h-4 w-4 shrink-0 text-violet-300" />
                )}
                <p className="text-xs text-[#B7ADC9]">
                  {progressPct === 100
                    ? 'Saving 100% will mark the task as completed.'
                    : progressPct === 0
                      ? 'The task has not been marked as completed.'
                      : 'The task will be saved with your selected progress.'}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="progress-notes"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#E5D9FF]"
              >
                Progress Notes
                <span className="ml-1 font-normal normal-case tracking-normal text-[#807493]">
                  (Optional)
                </span>
              </label>
              <textarea
                id="progress-notes"
                rows={4}
                maxLength={2000}
                placeholder="Summarize work completed, pull requests opened, or milestones reached..."
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                disabled={isSubmitting}
                className={inputClass}
              />
              <p className="mt-1 text-right text-[10px] text-[#807493]">
                {updateNotes.length}/2000 characters
              </p>
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeProgressModal}
                disabled={isSubmitting}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={primaryButtonClass}
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSubmitting ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Work log modal */}
      {selectedTask && (
        <Modal
          isOpen={isWorkLogModalOpen}
          onClose={closeWorkLogModal}
          title={`Record Work Log · Task #${selectedTask.id}`}
          subtitle={selectedTask.title}
          maxWidth="md"
        >
          <form onSubmit={submitWorkLog} className="space-y-5">
            <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
                  <Timer className="h-5 w-5 text-violet-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#FAF8FF]">
                    Track your work session
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                    Record the time spent and add a short summary of your work.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="hours-spent"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#E5D9FF]"
              >
                Hours Spent
                <span className="ml-1 text-rose-300">*</span>
              </label>
              <input
                id="hours-spent"
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                required
                value={hoursSpent}
                onChange={(e) =>
                  setHoursSpent(
                    e.target.value === '' ? 0 : Number(e.target.value),
                  )
                }
                disabled={isSubmitting}
                className={inputClass}
              />
              <p className="mt-2 text-[10px] leading-5 text-[#807493]">
                Enter a duration from 0.5 to 24 hours, using half-hour
                increments.
              </p>
            </div>

            <div>
              <label
                htmlFor="work-log-notes"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#E5D9FF]"
              >
                Work Session Notes
                <span className="ml-1 font-normal normal-case tracking-normal text-[#807493]">
                  (Optional)
                </span>
              </label>
              <textarea
                id="work-log-notes"
                rows={4}
                maxLength={2000}
                placeholder="What did you focus on during this session?"
                value={workLogNotes}
                onChange={(e) => setWorkLogNotes(e.target.value)}
                disabled={isSubmitting}
                className={inputClass}
              />
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeWorkLogModal}
                disabled={isSubmitting}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  hoursSpent < 0.5 ||
                  hoursSpent > 24 ||
                  !Number.isFinite(hoursSpent) ||
                  Math.round(hoursSpent * 2) !== hoursSpent * 2
                }
                className={primaryButtonClass}
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmitting ? 'Recording...' : 'Record Work Log'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Blocker modal */}
      {selectedTask && (
        <BlockerModal
          isOpen={isBlockerModalOpen}
          onClose={() => setIsBlockerModalOpen(false)}
          task={selectedTask}
          onResolvedOrReported={loadMyTasks}
        />
      )}
    </div>
  );
};

export default MyTasksView;
