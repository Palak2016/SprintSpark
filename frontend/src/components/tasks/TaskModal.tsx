
import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  Task,
  UserSimple,
  TaskPriority,
  TaskStatus,
} from '../../types';
import { api } from '../../services/api';
import {
  AlertCircle,
  Link2,
  Check,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  projectId: number;
  availableTasks: Task[];
  availableUsers: UserSimple[];
  onSaved: () => void;
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#130D21] px-3 py-2.5 text-sm text-[#FAF8FF] placeholder:text-[#807493] outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20';

const labelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]';

const selectClass =
  'w-full min-w-0 appearance-none rounded-xl border border-white/10 bg-[#130D21] px-3 py-2.5 pr-9 text-sm text-[#FAF8FF] outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 [color-scheme:dark]';

const optionStyle: React.CSSProperties = {
  color: '#FAF8FF',
  backgroundColor: '#19112B',
};

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  projectId,
  availableTasks,
  availableUsers,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | undefined>();
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [estimatedHours, setEstimatedHours] = useState<number>(8);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedPrereqIds, setSelectedPrereqIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setAssigneeId(task.assignee_id || undefined);
      setPriority(task.priority);
      setStatus(task.status);
      setEstimatedHours(task.estimated_hours);
      setProgressPct(task.progress_pct);
      setStartDate(task.start_date);
      setDueDate(task.due_date);
      setSelectedPrereqIds(
        task.dependencies
          ? task.dependencies.map((d) => d.prerequisite_task_id)
          : []
      );
    } else {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(
        Date.now() + 7 * 86400000
      ).toISOString().split('T')[0];

      setTitle('');
      setDescription('');
      setAssigneeId(undefined);
      setPriority('MEDIUM');
      setStatus('TODO');
      setEstimatedHours(8);
      setProgressPct(0);
      setStartDate(today);
      setDueDate(nextWeek);
      setSelectedPrereqIds([]);
    }

    setErrorMessage(null);
  }, [task, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (task) {
        await api.updateTask(task.id, {
          title,
          description,
          assignee_id: assigneeId,
          priority,
          status,
          estimated_hours: Number(estimatedHours),
          progress_pct: Number(progressPct),
          start_date: startDate,
          due_date: dueDate,
        });

        const currentPrereqIds = task.dependencies
          ? task.dependencies.map((d) => d.prerequisite_task_id)
          : [];

        const toAdd = selectedPrereqIds.filter(
          (id) => !currentPrereqIds.includes(id)
        );

        const toRemove = currentPrereqIds.filter(
          (id) => !selectedPrereqIds.includes(id)
        );

        for (const prerequisiteId of toAdd) {
          await api.addTaskDependency(task.id, prerequisiteId);
        }

        for (const prerequisiteId of toRemove) {
          await api.removeTaskDependency(task.id, prerequisiteId);
        }
      } else {
        await api.createTask({
          project_id: projectId,
          title,
          description,
          assignee_id: assigneeId,
          priority,
          status,
          estimated_hours: Number(estimatedHours),
          start_date: startDate,
          due_date: dueDate,
          prerequisite_ids: selectedPrereqIds,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save task.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePrereq = (id: number) => {
    setSelectedPrereqIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const candidatePrereqs = availableTasks.filter(
    (item) => !task || item.id !== task.id
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? `Edit Task #${task.id}` : 'Create New Task'}
      subtitle={
        task
          ? task.title
          : 'Configure task attributes, estimates, and prerequisite dependencies'
      }
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold">Unable to save task</p>
              <p className="mt-0.5 text-xs">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Task Title */}
        <div>
          <label className={labelClass}>Task Title *</label>
          <input
            type="text"
            required
            placeholder="e.g. Implement distributed session cache"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>
            Description & Acceptance Criteria
          </label>
          <textarea
            rows={3}
            placeholder="Details, technical requirements, links..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Assignee, Priority and Status */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Assignee */}
          <div className="min-w-0">
            <label className={labelClass}>Assignee</label>

            <div className="relative">
              <select
                value={assigneeId ?? ''}
                onChange={(e) =>
                  setAssigneeId(
                    e.target.value
                      ? Number(e.target.value)
                      : undefined
                  )
                }
                className={selectClass}
                style={{
                  color: '#FAF8FF',
                  backgroundColor: '#130D21',
                  colorScheme: 'dark',
                }}
              >
                <option value="" style={optionStyle}>
                  Unassigned
                </option>

                {availableUsers.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                    style={optionStyle}
                  >
                    {user.full_name} ({user.role})
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />
            </div>

            {availableUsers.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-300">
                No team members available.
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="min-w-0">
            <label className={labelClass}>Priority</label>

            <div className="relative">
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as TaskPriority)
                }
                className={selectClass}
              >
                <option value="LOW" style={optionStyle}>Low</option>
                <option value="MEDIUM" style={optionStyle}>Medium</option>
                <option value="HIGH" style={optionStyle}>High</option>
                <option value="CRITICAL" style={optionStyle}>Critical</option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />
            </div>
          </div>

          {/* Status */}
          <div className="min-w-0">
            <label className={labelClass}>Status</label>

            <div className="relative">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as TaskStatus)
                }
                className={selectClass}
              >
                <option value="TODO" style={optionStyle}>To Do</option>
                <option value="IN_PROGRESS" style={optionStyle}>
                  In Progress
                </option>
                <option value="BLOCKED" style={optionStyle}>Blocked</option>
                <option value="COMPLETED" style={optionStyle}>
                  Completed
                </option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />
            </div>
          </div>
        </div>

        {/* Estimated Hours and Progress */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Estimated Hours</label>
            <input
              type="number"
              step="0.5"
              min="0"
              required
              value={estimatedHours}
              onChange={(e) =>
                setEstimatedHours(parseFloat(e.target.value) || 0)
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Progress ({progressPct}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={progressPct}
              onChange={(e) =>
                setProgressPct(parseInt(e.target.value, 10) || 0)
              }
              className="mt-3 w-full accent-violet-500"
            />

            <div className="mt-1 flex justify-between text-xs text-[#807493]">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Dates with Visible Calendar Icons */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Start Date */}
          <div>
            <label className={labelClass}>Start Date</label>

            <div className="relative">
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`${inputClass} pr-11 [color-scheme:dark]`}
                style={{ colorScheme: 'dark' }}
              />

              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className={labelClass}>Due Date</label>

            <div className="relative">
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputClass} pr-11 [color-scheme:dark]`}
                style={{ colorScheme: 'dark' }}
              />

              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />
            </div>
          </div>
        </div>

        {/* Prerequisite Dependencies */}
        <div className="border-t border-white/[0.08] pt-4">
          <label className="mb-2 flex items-start gap-2 text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />

            <span>
              Prerequisites
              <span className="mt-1 block normal-case tracking-normal text-[#807493]">
                Tasks that must finish before this task starts
              </span>
            </span>
          </label>

          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#130D21] p-2">
            {candidatePrereqs.length === 0 ? (
              <p className="p-3 text-center text-xs text-[#807493]">
                No other tasks in this project
              </p>
            ) : (
              candidatePrereqs.map((item) => {
                const isSelected = selectedPrereqIds.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePrereq(item.id)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? 'border-violet-400/30 bg-violet-500/15 text-[#E5D9FF]'
                        : 'border-transparent text-[#B7ADC9] hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[#FAF8FF]'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-xs text-[#807493]">
                        #{item.id}
                      </span>
                      <span className="truncate">{item.title}</span>
                    </span>

                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-violet-300" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#B7ADC9] transition hover:bg-white/[0.05] hover:text-white"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving...'
              : task
                ? 'Update Task'
                : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
