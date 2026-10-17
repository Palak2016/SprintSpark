
import React, { useState } from 'react';
import { Task } from '../../types';
import { formatIndianDate } from '../../utils/date';
import {
  Search,
  AlertOctagon,
  Link2,
  Edit2,
  ChevronDown,
  SlidersHorizontal,
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onBlockerClick: (task: Task) => void;
  onEditClick: (task: Task) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onTaskClick,
  onBlockerClick,
  onEditClick,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const filteredTasks = tasks.filter((task) => {
    const searchTerm = search.toLowerCase().trim();

    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm) ||
      (task.assignee?.full_name || '').toLowerCase().includes(searchTerm) ||
      String(task.id).includes(searchTerm);

    const matchesStatus =
      statusFilter === 'ALL' || task.status === statusFilter;

    const matchesPriority =
      priorityFilter === 'ALL' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const inputClass =
    'w-full rounded-xl border border-white/[0.08] bg-[#130D21] text-[#FAF8FF] placeholder:text-[#807493] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-colors';

  const selectClass =
    'appearance-none w-full rounded-xl border border-white/[0.08] bg-[#130D21] text-[#FAF8FF] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-colors cursor-pointer [color-scheme:dark]';

  const optionStyle: React.CSSProperties = {
    backgroundColor: '#19112B',
    color: '#FAF8FF',
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
        return 'text-rose-300 bg-rose-500/10 border-rose-400/20';
      case 'HIGH':
        return 'text-amber-300 bg-amber-500/10 border-amber-400/20';
      case 'MEDIUM':
        return 'text-sky-300 bg-sky-500/10 border-sky-400/20';
      default:
        return 'text-[#B7ADC9] bg-white/[0.04] border-white/[0.08]';
    }
  };

  const formatDate = (date?: string | null) => {
    if (!date) return 'No due date';

    const formattedDate = formatIndianDate(date);
    return formattedDate === '—' ? date : formattedDate;
  };

  const isOverdue = (date?: string | null, status?: string) => {
    if (!date || status === 'COMPLETED') return false;

    const due = new Date(date);
    if (Number.isNaN(due.getTime())) return false;

    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B] shadow-xl shadow-black/10">
      {/* Filters toolbar */}
      <div className="flex flex-col gap-4 border-b border-white/[0.08] bg-[#211638]/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
            <SlidersHorizontal className="h-4 w-4 text-violet-300" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#FAF8FF]">
              Task Overview
            </h3>
            <p className="mt-0.5 text-xs text-[#A99DBD]">
              {filteredTasks.length} of {tasks.length} tasks
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:min-w-[240px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#807493]" />

            <input
              type="text"
              placeholder="Search tasks or assignees..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search tasks or assignees"
              className={`${inputClass} py-2.5 pl-9 pr-3 text-xs`}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#807493] transition-colors hover:text-[#FAF8FF]"
              >
                ×
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="relative w-full sm:w-40">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className={`${selectClass} py-2.5 pl-3 pr-9 text-xs`}
            >
              <option value="ALL" style={optionStyle}>
                All Statuses
              </option>
              <option value="TODO" style={optionStyle}>
                To Do
              </option>
              <option value="IN_PROGRESS" style={optionStyle}>
                In Progress
              </option>
              <option value="BLOCKED" style={optionStyle}>
                Blocked
              </option>
              <option value="COMPLETED" style={optionStyle}>
                Completed
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-300" />
          </div>

          {/* Priority filter */}
          <div className="relative w-full sm:w-40">
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
              className={`${selectClass} py-2.5 pl-3 pr-9 text-xs`}
            >
              <option value="ALL" style={optionStyle}>
                All Priorities
              </option>
              <option value="CRITICAL" style={optionStyle}>
                Critical
              </option>
              <option value="HIGH" style={optionStyle}>
                High
              </option>
              <option value="MEDIUM" style={optionStyle}>
                Medium
              </option>
              <option value="LOW" style={optionStyle}>
                Low
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-300" />
          </div>
        </div>
      </div>

      {/* Active filters */}
      {(search || statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="mr-1 text-[11px] text-[#A99DBD]">
            Active filters:
          </span>

          {search && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200">
              Search: {search}
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Remove search filter"
                className="text-violet-300 hover:text-white"
              >
                ×
              </button>
            </span>
          )}

          {statusFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200">
              {statusFilter.replace('_', ' ')}
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                aria-label="Remove status filter"
                className="text-violet-300 hover:text-white"
              >
                ×
              </button>
            </span>
          )}

          {priorityFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200">
              {priorityFilter}
              <button
                type="button"
                onClick={() => setPriorityFilter('ALL')}
                aria-label="Remove priority filter"
                className="text-violet-300 hover:text-white"
              >
                ×
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
            }}
            className="ml-auto text-[11px] font-medium text-violet-300 transition-colors hover:text-violet-200"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Responsive table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="border-b border-white/[0.08] bg-[#130D21]/70 text-[10px] font-semibold uppercase tracking-wider text-[#A99DBD]">
            <tr>
              <th scope="col" className="px-4 py-4">
                Task
              </th>
              <th scope="col" className="px-3 py-4">
                Assignee
              </th>
              <th scope="col" className="px-3 py-4">
                Status
              </th>
              <th scope="col" className="px-3 py-4">
                Priority
              </th>
              <th scope="col" className="px-3 py-4">
                Progress
              </th>
              <th scope="col" className="px-3 py-4">
                Due Date
              </th>
              <th scope="col" className="px-4 py-4 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.05] text-[#FAF8FF]">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="mx-auto flex max-w-xs flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/10">
                      <Search className="h-5 w-5 text-violet-300" />
                    </div>

                    <p className="text-sm font-medium text-[#FAF8FF]">
                      No tasks found
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                      Try changing your search or adjusting the filters.
                    </p>

                    {(search ||
                      statusFilter !== 'ALL' ||
                      priorityFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setStatusFilter('ALL');
                          setPriorityFilter('ALL');
                        }}
                        className="mt-4 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onTaskClick(task);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`View task ${task.title}`}
                  className="group cursor-pointer transition-colors hover:bg-violet-500/[0.045] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-400/50"
                >
                  {/* Task title */}
                  <td className="max-w-xs px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
                        {task.status === 'COMPLETED' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        ) : task.status === 'BLOCKED' ? (
                          <AlertOctagon className="h-4 w-4 text-rose-300" />
                        ) : task.status === 'IN_PROGRESS' ? (
                          <PlayCircle className="h-4 w-4 text-violet-300" />
                        ) : (
                          <Circle className="h-4 w-4 text-[#A99DBD]" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-mono text-[10px] text-[#807493]">
                            #{task.id}
                          </span>
                        </div>

                        <p className="mt-1 break-words font-semibold leading-5 text-[#FAF8FF] transition-colors group-hover:text-violet-200">
                          {task.title}
                        </p>

                        {task.is_blocked && (
                          <span className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-lg border border-rose-400/20 bg-rose-500/[0.08] px-2 py-1 text-[10px] font-medium leading-4 text-rose-300">
                            <AlertOctagon className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="break-words">
                              {task.blocker_reason || 'Blocked'}
                            </span>
                          </span>
                        )}

                        {task.dependencies &&
                          task.dependencies.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#A99DBD]">
                              <Link2 className="h-3 w-3 shrink-0 text-violet-300" />
                              <span>
                                Depends on #
                                {task.dependencies
                                  .map((dependency) => dependency.prerequisite_task_id)
                                  .join(', #')}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="px-3 py-4">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            task.assignee.avatar_url ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              task.assignee.full_name
                            )}`
                          }
                          alt=""
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                          className="h-7 w-7 shrink-0 rounded-full border border-white/10 bg-[#211638] object-cover"
                        />

                        <span className="max-w-[120px] truncate text-[11px] font-medium text-[#E5D9FF]">
                          {task.assignee.full_name}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-[10px] italic text-[#807493]">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-4">
                    <span
                      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusStyle(
                        task.status
                      )}`}
                    >
                      <span
                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                          task.status === 'COMPLETED'
                            ? 'bg-emerald-300'
                            : task.status === 'BLOCKED'
                            ? 'bg-rose-300'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-violet-300'
                            : 'bg-[#A99DBD]'
                        }`}
                      />
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-4">
                    <span
                      className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-semibold ${getPriorityStyle(
                        task.priority
                      )}`}
                    >
                      {task.priority === 'CRITICAL' && (
                        <AlertCircle className="mr-1 h-3 w-3" />
                      )}
                      {task.priority}
                    </span>
                  </td>

                  {/* Progress */}
                  <td className="px-3 py-4">
                    <div className="w-24">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-[#E5D9FF]">
                          {task.progress_pct}%
                        </span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] text-[#807493]">
                          <Clock className="h-3 w-3" />
                          {task.estimated_hours}h
                        </span>
                      </div>

                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]"
                        role="progressbar"
                        aria-valuenow={task.progress_pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progress for ${task.title}`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            task.progress_pct === 100
                              ? 'bg-emerald-400'
                              : task.is_blocked
                              ? 'bg-rose-400'
                              : 'bg-violet-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, task.progress_pct || 0)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Due date */}
                  <td className="whitespace-nowrap px-3 py-4">
                    <div
                      className={`flex items-center gap-2 text-[11px] ${
                        isOverdue(task.due_date, task.status)
                          ? 'text-rose-300'
                          : 'text-[#B7ADC9]'
                      }`}
                    >
                      <CalendarDays
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isOverdue(task.due_date, task.status)
                            ? 'text-rose-300'
                            : 'text-violet-300'
                        }`}
                      />
                      <span>{formatDate(task.due_date)}</span>
                    </div>

                    {isOverdue(task.due_date, task.status) && (
                      <span className="ml-5 mt-1 inline-block text-[9px] font-semibold uppercase tracking-wide text-rose-300">
                        Overdue
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td
                    className="px-4 py-4 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onBlockerClick(task)}
                        title={
                          task.is_blocked ? 'Resolve Blocker' : 'Flag Blocker'
                        }
                        aria-label={
                          task.is_blocked
                            ? `Resolve blocker for ${task.title}`
                            : `Flag blocker for ${task.title}`
                        }
                        className={`rounded-lg border p-2 transition-colors ${
                          task.is_blocked
                            ? 'border-rose-400/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#A99DBD] hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-300'
                        }`}
                      >
                        <AlertOctagon className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditClick(task)}
                        title="Edit Task"
                        aria-label={`Edit ${task.title}`}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-[#A99DBD] transition-colors hover:border-violet-400/20 hover:bg-violet-500/10 hover:text-violet-200"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filteredTasks.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-white/[0.06] bg-[#130D21]/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-[#807493]">
            Showing{' '}
            <span className="font-semibold text-[#B7ADC9]">
              {filteredTasks.length}
            </span>{' '}
            {filteredTasks.length === 1 ? 'task' : 'tasks'}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#A99DBD]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Completed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
              In progress
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
              Blocked
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
