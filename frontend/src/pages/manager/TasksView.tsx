
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Task, TaskStatus, UserSimple } from '../../types';

import { TaskKanban } from '../../components/tasks/TaskKanban';
import { TaskList } from '../../components/tasks/TaskList';
import { TaskModal } from '../../components/tasks/TaskModal';
import { BlockerModal } from '../../components/tasks/BlockerModal';
import { TaskTimeline } from '../../components/tasks/TaskTimeline';
import { TaskCalendar } from '../../components/tasks/TaskCalendar';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filterTasks,
  type TaskFilters,
} from '../../utils/planning';

import {
  Kanban,
  List,
  Plus,
  Search,
  CheckSquare,
  AlertCircle,
  RefreshCw,
  FolderKanban,
  X,
  ClipboardList,
  LayoutDashboard,
  CheckCircle2,
  CalendarDays,
  GanttChartSquare,
} from 'lucide-react';

type ViewMode = 'list' | 'kanban' | 'calendar' | 'timeline';
const VIEW_STORAGE_KEY = 'workpilot_task_view';

const readStoredView = (): ViewMode => {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === 'list' || saved === 'kanban' || saved === 'calendar' || saved === 'timeline'
      ? saved
      : 'kanban';
  } catch {
    return 'kanban';
  }
};

export const TasksView: React.FC = () => {
  const { activeProject } = useProject();
  const { isManager } = useAuth();

  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredView);
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* storage unavailable */
    }
  };
  // Filters are shared by every view, so switching views keeps them.
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<UserSimple[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const search = filters.search;
  const setSearch = (value: string) => setFilters((f) => ({ ...f, search: value }));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvingTaskId, setResolvingTaskId] = useState<number | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [taskForBlocker, setTaskForBlocker] = useState<Task | null>(null);

  const activeProjectId = activeProject?.id;
  const requestIdRef = useRef(0);
  const isRefreshingRef = useRef(false);

  // Load tasks belonging to the active project.
  const loadTasks = useCallback(
    async (showLoader = false) => {
      if (!activeProjectId) {
        setTasks([]);
        setIsLoading(false);
        return;
      }

      if (!showLoader && isRefreshingRef.current) {
        return;
      }

      const requestId = ++requestIdRef.current;
      isRefreshingRef.current = true;

      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const data = await api.getTasks({
          project_id: activeProjectId,
        });

        if (requestId === requestIdRef.current) {
          setTasks(data);
          setErrorMsg(null);
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          console.error('Failed to load tasks:', error);

          setErrorMsg(
            error instanceof Error
              ? error.message
              : 'Unable to load project tasks.'
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          isRefreshingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [activeProjectId]
  );

  // Initial load and automatic refresh.
  useEffect(() => {
    if (!activeProjectId) {
      requestIdRef.current += 1;
      isRefreshingRef.current = false;
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setFilters(DEFAULT_FILTERS);
    void loadTasks(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadTasks(false);
      }
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadTasks(false);
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(intervalId);

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );

      requestIdRef.current += 1;
      isRefreshingRef.current = false;
    };
  }, [activeProjectId, loadTasks]);

  // Load available team members.
  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setIsLoadingUsers(true);

      try {
        const users = await api.getAllUsers();

        if (!cancelled) {
          setAllUsers(users);
        }
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingUsers(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  // Update task status.
  const handleStatusChange = async (
    task: Task,
    newStatus: TaskStatus
  ) => {
    setErrorMsg(null);

    try {
      const updated = await api.updateTask(task.id, {
        status: newStatus,
        progress_pct:
          newStatus === 'COMPLETED'
            ? 100
            : task.progress_pct,
      });

      setTasks((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      await loadTasks(true);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to update task status.'
      );
    }
  };

  /**
   * Manager resolves an employee-reported blocker.
   *
   * First clear the blocker using the blocker endpoint.
   * If the task status is BLOCKED, move it back to IN_PROGRESS.
   * Finally refresh the list from the backend.
   */
  const handleResolveBlocker = async (task: Task) => {
    if (resolvingTaskId !== null) {
      return;
    }

    setResolvingTaskId(task.id);
    setErrorMsg(null);

    try {
      await api.resolveBlocker(task.id);

      if (task.status === 'BLOCKED') {
        await api.updateTask(task.id, {
          status: 'IN_PROGRESS',
        });
      }

      await loadTasks(true);
    } catch (error) {
      console.error('Failed to resolve blocker:', error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to resolve this blocker. Check the backend API.'
      );
    } finally {
      setResolvingTaskId(null);
    }
  };

  const handleOpenCreate = () => {
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenBlocker = (task: Task) => {
    setTaskForBlocker(task);
    setIsBlockerModalOpen(true);
  };

  const filteredTasks = filterTasks(tasks, filters);
  const filterCount = activeFilterCount(filters);

  // Assignee options come from the loaded tasks so the list matches the project.
  const assigneeOptions = Array.from(
    new Map(
      tasks
        .filter((task) => task.assignee)
        .map((task) => [task.assignee!.id, task.assignee!.full_name])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Timeline date edits go through the real task API (validated server-side).
  const handleTimelineDates = async (
    task: Task,
    dates: { start_date: string; due_date: string }
  ) => {
    const updated = await api.updateTask(task.id, dates);
    setTasks((previous) =>
      previous.map((item) => (item.id === updated.id ? updated : item))
    );
    void loadTasks(false);
  };

  const completedTasks = tasks.filter(
    (task) => task.status === 'COMPLETED'
  ).length;

  const blockedTasks = tasks.filter(
    (task) => task.is_blocked || task.status === 'BLOCKED'
  );

  const progress =
    tasks.length > 0
      ? Math.round(
          tasks.reduce(
            (total, task) => total + (task.progress_pct || 0),
            0,
          ) / tasks.length,
        )
      : 0;

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-[#130D21] px-3 py-3 text-sm text-white outline-none placeholder:text-[#807493] transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20';

  return (
    <div className="space-y-6 text-[#FAF8FF]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#B7ADC9]">
            <FolderKanban className="h-4 w-4 text-[#A78BFA]" />
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#E5D9FF]">Task Management</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Task Management
          </h1>

          <p className="mt-1 text-sm text-[#B7ADC9]">
            {activeProject
              ? `Manage tasks, track progress, and resolve blockers for ${activeProject.name}.`
              : 'Select a project workspace to manage its tasks and track progress.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadTasks(true)}
            disabled={!activeProject || isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#19112B] px-3 py-2.5 text-sm font-medium text-[#D8CDEF] transition hover:bg-[#211638] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={!activeProject}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <span className="flex-1">{errorMsg}</span>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorMsg(null)}
            className="text-rose-200 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!activeProject ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#19112B]/70 px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
            <FolderKanban className="h-7 w-7 text-violet-300" />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-white">
            No Workspace Selected
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#B7ADC9]">
            Choose a project from the Projects page to view, create,
            and manage its tasks.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#B7ADC9]">Total Tasks</p>
                <ClipboardList className="h-5 w-5 text-violet-300" />
              </div>
              <p className="mt-3 text-2xl font-bold">{tasks.length}</p>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Tasks in this workspace
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#B7ADC9]">Completed</p>
                <CheckSquare className="h-5 w-5 text-emerald-300" />
              </div>
              <p className="mt-3 text-2xl font-bold">{completedTasks}</p>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Average progress from daily updates
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#B7ADC9]">Remaining Tasks</p>
                <LayoutDashboard className="h-5 w-5 text-sky-300" />
              </div>
              <p className="mt-3 text-2xl font-bold">
                {tasks.length - completedTasks}
              </p>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Not yet completed
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#B7ADC9]">Reported Progress</p>
                <CheckSquare className="h-5 w-5 text-violet-300" />
              </div>
              <p className="mt-3 text-2xl font-bold">{progress}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="manager-progress-fill h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Manager blocker resolution panel */}
          {blockedTasks.length > 0 && (
            <section className="rounded-2xl border border-amber-400/20 bg-[#19112B] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
                  <AlertCircle className="h-5 w-5 text-amber-300" />
                </div>

                <div>
                  <h2 className="font-semibold text-white">
                    Blocked Tasks
                  </h2>
                  <p className="text-sm text-[#B7ADC9]">
                    Review and resolve blockers reported by employees.
                  </p>
                </div>

                <span className="ml-auto rounded-full bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-200">
                  {blockedTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {blockedTasks.map((task) => {
                  const taskDetails = task as Task & {
                    title?: string;
                    name?: string;
                    blocker_reason?: string | null;
                  };

                  const isResolving = resolvingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#130D21] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="font-medium text-white">
                          {taskDetails.title ??
                            taskDetails.name ??
                            `Task #${task.id}`}
                        </h3>

                        <p className="mt-1 text-sm text-amber-200/90">
                          {taskDetails.blocker_reason ||
                            'No blocker reason provided.'}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBlocker(task)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-[#D8CDEF] transition hover:bg-white/5"
                        >
                          View blocker
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleResolveBlocker(task)}
                          disabled={resolvingTaskId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isResolving ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}

                          {isResolving
                            ? 'Resolving...'
                            : 'Resolve blocker'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Workspace information and view controls */}
          <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                <FolderKanban className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-[#A99DBD]">
                  Current Workspace
                </p>

                <h2 className="truncate text-sm font-semibold text-white">
                  {activeProject.name}
                </h2>

                <p className="mt-0.5 text-xs text-[#A99DBD]">
                  {filteredTasks.length} of {tasks.length} tasks shown
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A99DBD]" />

                <input
                  type="search"
                  aria-label="Search tasks"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`${inputClass} py-2.5 pl-9 pr-9`}
                />

                {search && (
                  <button
                    type="button"
                    aria-label="Clear task search"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A99DBD] transition hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center rounded-xl border border-white/10 bg-[#130D21] p-1" role="group" aria-label="Task view">
                {([
                  ['list', 'List', List],
                  ['kanban', 'Kanban', Kanban],
                  ['calendar', 'Calendar', CalendarDays],
                  ['timeline', 'Timeline', GanttChartSquare],
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      viewMode === mode
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-[#B7ADC9] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Shared filters (apply to every view) */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Task filters">
            <select
              aria-label="Filter by assignee"
              value={String(filters.assignee)}
              onChange={(event) => {
                const value = event.target.value;
                setFilters((f) => ({
                  ...f,
                  assignee: value === 'ALL' || value === 'UNASSIGNED' ? value : Number(value),
                }));
              }}
              className="rounded-xl border border-white/10 bg-[#130D21] px-3 py-2 text-xs text-[#E5D9FF] outline-none focus:border-violet-400/60"
            >
              <option value="ALL">All assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {assigneeOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value as TaskFilters['status'] }))}
              className="rounded-xl border border-white/10 bg-[#130D21] px-3 py-2 text-xs text-[#E5D9FF] outline-none focus:border-violet-400/60"
            >
              <option value="ALL">All statuses</option>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              aria-label="Filter by priority"
              value={filters.priority}
              onChange={(event) => setFilters((f) => ({ ...f, priority: event.target.value as TaskFilters['priority'] }))}
              className="rounded-xl border border-white/10 bg-[#130D21] px-3 py-2 text-xs text-[#E5D9FF] outline-none focus:border-violet-400/60"
            >
              <option value="ALL">All priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            {filterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-medium text-violet-300 hover:text-violet-200"
              >
                <X className="h-3.5 w-3.5" />
                Clear {filterCount} filter{filterCount === 1 ? '' : 's'}
              </button>
            )}
          </div>

          {/* Task board */}
          {isLoading ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#19112B] px-6 py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-violet-300" />
              <p className="mt-4 text-sm font-medium text-white">
                Loading tasks...
              </p>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Fetching tasks for {activeProject.name}
              </p>
            </div>
          ) : filteredTasks.length === 0 && viewMode !== 'timeline' && viewMode !== 'calendar' ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#19112B]/70 px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
                {search ? (
                  <Search className="h-7 w-7 text-violet-300" />
                ) : (
                  <ClipboardList className="h-7 w-7 text-violet-300" />
                )}
              </div>

              <h2 className="mt-4 text-lg font-semibold text-white">
                {filterCount ? 'No Matching Tasks' : 'No Tasks Yet'}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#B7ADC9]">
                {filterCount
                  ? 'Try other filters or clear them to see all tasks.'
                  : 'Create your first task to start organizing work in this project.'}
              </p>

              {filterCount ? (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-5 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#E5D9FF] transition hover:bg-white/5"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  <Plus className="h-4 w-4" />
                  Create First Task
                </button>
              )}
            </div>
          ) : (
            <div className="min-w-0">
              {viewMode === 'timeline' ? (
                <TaskTimeline
                  tasks={filteredTasks}
                  allTasks={tasks}
                  onTaskClick={handleOpenEdit}
                  canEdit={isManager}
                  onDatesChange={handleTimelineDates}
                  targetDate={activeProject.target_end_date}
                />
              ) : viewMode === 'calendar' ? (
                <TaskCalendar tasks={filteredTasks} onTaskClick={handleOpenEdit} />
              ) : viewMode === 'kanban' ? (
                <TaskKanban
                  tasks={filteredTasks}
                  onTaskClick={handleOpenEdit}
                  onStatusChange={handleStatusChange}
                  onBlockerClick={handleOpenBlocker}
                />
              ) : (
                <TaskList
                  tasks={filteredTasks}
                  onTaskClick={handleOpenEdit}
                  onBlockerClick={handleOpenBlocker}
                  onEditClick={handleOpenEdit}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Task Modal */}
      {isTaskModalOpen && activeProject && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          task={selectedTask}
          projectId={activeProject.id}
          availableTasks={tasks}
          availableUsers={allUsers}
          onSaved={async () => {
            await loadTasks(true);
            setIsTaskModalOpen(false);
          }}
        />
      )}

      {/* Blocker Details Modal */}
      {isBlockerModalOpen && (
        <BlockerModal
          isOpen={isBlockerModalOpen}
          onClose={() => setIsBlockerModalOpen(false)}
          task={taskForBlocker}
          onResolvedOrReported={() => loadTasks(true)}
        />
      )}

      {isLoadingUsers && (
        <span className="sr-only">
          Loading available team members...
        </span>
      )}
    </div>
  );
};

export default TasksView;
