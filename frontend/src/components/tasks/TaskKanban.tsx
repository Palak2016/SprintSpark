
import React from 'react';
import { Task, TaskStatus } from '../../types';
import { formatIndianDate } from '../../utils/date';
import {
  AlertOctagon,
  Clock,
  Link2,
  CheckCircle2,
  Circle,
  PlayCircle,
  Ban,
} from 'lucide-react';

interface TaskKanbanProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (task: Task, newStatus: TaskStatus) => void;
  onBlockerClick: (task: Task) => void;
}

export const TaskKanban: React.FC<TaskKanbanProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  onBlockerClick,
}) => {
  const columns: {
    id: TaskStatus;
    title: string;
    dot: string;
    border: string;
    icon: React.ReactNode;
    countStyle: string;
  }[] = [
    {
      id: 'TODO',
      title: 'To Do',
      dot: 'bg-slate-400',
      border: 'border-t-slate-400',
      icon: <Circle className="h-4 w-4" />,
      countStyle: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
    },
    {
      id: 'IN_PROGRESS',
      title: 'In Progress',
      dot: 'bg-violet-400',
      border: 'border-t-violet-400',
      icon: <PlayCircle className="h-4 w-4" />,
      countStyle: 'bg-violet-500/10 text-violet-200 border-violet-400/20',
    },
    {
      id: 'BLOCKED',
      title: 'Blocked',
      dot: 'bg-rose-400',
      border: 'border-t-rose-400',
      icon: <Ban className="h-4 w-4" />,
      countStyle: 'bg-rose-500/10 text-rose-200 border-rose-400/20',
    },
    {
      id: 'COMPLETED',
      title: 'Completed',
      dot: 'bg-emerald-400',
      border: 'border-t-emerald-400',
      icon: <CheckCircle2 className="h-4 w-4" />,
      countStyle: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20',
    },
  ];

  const getPriorityBadge = (priority: string) => {
    const base =
      'inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold tracking-wide';

    switch (priority) {
      case 'CRITICAL':
        return (
          <span
            className={`${base} border-rose-400/25 bg-rose-500/10 text-rose-300`}
          >
            CRITICAL
          </span>
        );

      case 'HIGH':
        return (
          <span
            className={`${base} border-amber-400/25 bg-amber-500/10 text-amber-300`}
          >
            HIGH
          </span>
        );

      case 'MEDIUM':
        return (
          <span
            className={`${base} border-sky-400/25 bg-sky-500/10 text-sky-300`}
          >
            MEDIUM
          </span>
        );

      default:
        return (
          <span
            className={`${base} border-white/10 bg-white/[0.04] text-[#B7ADC9]`}
          >
            LOW
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';

    const formattedDate = formatIndianDate(dateString.slice(0, 10));
    return formattedDate === '—' ? dateString : formattedDate;
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((task) => task.status === col.id);

        return (
          <div
            key={col.id}
            className={`min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] border-t-2 ${col.border} bg-[#19112B] p-3.5`}
          >
            {/* Column Header */}
            <div className="mb-4 flex items-center justify-between px-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${col.dot}`} />

                <h3 className="truncate text-xs font-bold uppercase tracking-wider text-[#FAF8FF]">
                  {col.title}
                </h3>
              </div>

              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-xs font-semibold ${col.countStyle}`}
              >
                {colTasks.length}
              </span>
            </div>

            {/* Task Cards */}
            <div className="min-h-[300px] space-y-3">
              {colTasks.length === 0 ? (
                <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#130D21]/50 px-3 py-8 text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-[#807493]">
                    {col.icon}
                  </div>

                  <p className="text-xs font-medium text-[#B7ADC9]">
                    No tasks here yet
                  </p>

                  <p className="mt-1 text-[11px] text-[#807493]">
                    Tasks will appear in this column
                  </p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onTaskClick(task)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onTaskClick(task);
                      }
                    }}
                    className="group cursor-pointer rounded-xl border border-white/[0.08] bg-[#130D21] p-3.5 transition-all duration-200 hover:border-violet-400/30 hover:bg-[#1D1431] hover:shadow-lg hover:shadow-violet-950/10 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    {/* Priority and Task ID */}
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-medium text-[#807493]">
                        TASK-{task.id}
                      </span>

                      {getPriorityBadge(task.priority)}
                    </div>

                    {/* Task Title */}
                    <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-[#FAF8FF] transition-colors group-hover:text-violet-200">
                      {task.title}
                    </h4>

                    {/* Description */}
                    {task.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#A99DBD]">
                        {task.description}
                      </p>
                    )}

                    {/* Blocker Alert */}
                    {task.is_blocked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlockerClick(task);
                        }}
                        className="mt-3 flex w-full items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.08] p-2.5 text-left transition-colors hover:bg-rose-500/[0.14]"
                      >
                        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />

                        <span className="line-clamp-2 text-xs font-medium leading-4 text-rose-200">
                          {task.blocker_reason || 'This task is blocked'}
                        </span>
                      </button>
                    )}

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#A99DBD]">
                          Progress
                        </span>

                        <span className="text-xs font-semibold tabular-nums text-[#FAF8FF]">
                          {task.progress_pct}%
                        </span>
                      </div>

                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
                        role="progressbar"
                        aria-valuenow={task.progress_pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${task.title} progress`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            task.progress_pct === 100
                              ? 'bg-emerald-400'
                              : task.is_blocked
                                ? 'bg-rose-400'
                                : 'bg-violet-400'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, task.progress_pct)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Assignee and Task Metadata */}
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex shrink-0 items-center gap-1.5 text-[11px] text-[#A99DBD]"
                          title="Estimated effort"
                        >
                          <Clock className="h-3.5 w-3.5 text-[#807493]" />
                          {task.estimated_hours}h
                        </span>

                        {task.dependencies &&
                          task.dependencies.length > 0 && (
                            <span
                              className="flex shrink-0 items-center gap-1 text-[11px] text-[#A99DBD]"
                              title={`${task.dependencies.length} prerequisite task(s)`}
                            >
                              <Link2 className="h-3.5 w-3.5 text-[#807493]" />
                              {task.dependencies.length}
                            </span>
                          )}
                      </div>

                      {/* Assignee */}
                      <div className="flex min-w-0 items-center">
                        {task.assignee ? (
                          <div
                            className="flex min-w-0 items-center gap-1.5"
                            title={task.assignee.full_name}
                          >
                            <img
                              src={
                                task.assignee.avatar_url ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  task.assignee.full_name
                                )}`
                              }
                              alt=""
                              className="h-6 w-6 shrink-0 rounded-full border border-violet-400/20 bg-[#211638] object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />

                            <span className="max-w-[85px] truncate text-[11px] font-medium text-[#D8CDEA]">
                              {task.assignee.full_name.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-[#807493]">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Due Date */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                      <span className="text-[10px] text-[#807493]">
                        Due {formatDate(task.due_date)}
                      </span>

                      {task.status === 'COMPLETED' && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Complete
                        </span>
                      )}
                    </div>

                    {/* Quick Status Actions */}
                    <div
                      className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {col.id !== 'TODO' && (
                        <button
                          type="button"
                          onClick={() => onStatusChange(task, 'TODO')}
                          className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] font-medium text-[#B7ADC9] transition-colors hover:border-slate-400/20 hover:bg-white/[0.06] hover:text-white"
                        >
                          To Do
                        </button>
                      )}

                      {col.id !== 'IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={() =>
                            onStatusChange(task, 'IN_PROGRESS')
                          }
                          className="rounded-lg border border-violet-400/15 px-2 py-1.5 text-[10px] font-medium text-violet-300 transition-colors hover:bg-violet-500/15 hover:text-violet-200"
                        >
                          Start
                        </button>
                      )}

                      {col.id !== 'BLOCKED' && (
                        <button
                          type="button"
                          onClick={() => onStatusChange(task, 'BLOCKED')}
                          className="rounded-lg border border-rose-400/15 px-2 py-1.5 text-[10px] font-medium text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                        >
                          Block
                        </button>
                      )}

                      {col.id !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() =>
                            onStatusChange(task, 'COMPLETED')
                          }
                          className="rounded-lg border border-emerald-400/15 px-2 py-1.5 text-[10px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
