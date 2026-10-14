import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Task, UserSimple, TaskPriority, TaskStatus } from '../../types';
import { api } from '../../services/api';
import { AlertCircle, Link2, Check } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  projectId: number;
  availableTasks: Task[];
  availableUsers: UserSimple[];
  onSaved: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  projectId,
  availableTasks,
  availableUsers,
  onSaved
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
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
      setSelectedPrereqIds(task.dependencies ? task.dependencies.map(d => d.prerequisite_task_id) : []);
    } else {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
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
        // Update
        await api.updateTask(task.id, {
          title,
          description,
          assignee_id: assigneeId,
          priority,
          status,
          estimated_hours: Number(estimatedHours),
          progress_pct: Number(progressPct),
          start_date: startDate,
          due_date: dueDate
        });

        // Update dependencies
        const currentPrereqIds = task.dependencies ? task.dependencies.map(d => d.prerequisite_task_id) : [];
        const toAdd = selectedPrereqIds.filter(id => !currentPrereqIds.includes(id));
        const toRemove = currentPrereqIds.filter(id => !selectedPrereqIds.includes(id));

        for (const pId of toAdd) {
          await api.addTaskDependency(task.id, pId);
        }
        for (const pId of toRemove) {
          await api.removeTaskDependency(task.id, pId);
        }
      } else {
        // Create
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
          prerequisite_ids: selectedPrereqIds
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePrereq = (id: number) => {
    setSelectedPrereqIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const candidatePrereqs = availableTasks.filter(t => !task || t.id !== task.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? `Edit Task #${task.id}` : 'Create New Task'}
      subtitle={task ? task.title : 'Configure task attributes, estimates, and prerequisite dependencies'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Scheduling Conflict</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
            Task Title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Implement distributed session cache"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
            Description & Acceptance Criteria
          </label>
          <textarea
            rows={2}
            placeholder="Details, technical requirements, links..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
          />
        </div>

        {/* Assignee, Priority, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Assignee
            </label>
            <select
              value={assigneeId || ''}
              onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 bg-white"
            >
              <option value="">Unassigned</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 bg-white"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 bg-white"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {/* Estimates & Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Estimated Hours
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              required
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Progress ({progressPct}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={progressPct}
              onChange={(e) => setProgressPct(parseInt(e.target.value) || 0)}
              className="w-full accent-forest-700 mt-2"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Start Date
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Due Date
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200"
            />
          </div>
        </div>

        {/* Prerequisite Dependencies */}
        <div className="pt-2 border-t border-charcoal-100">
          <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-forest-700" />
            <span>Prerequisites (Tasks that must finish before this task starts)</span>
          </label>
          <div className="max-h-36 overflow-y-auto border border-charcoal-200 rounded-lg p-2 space-y-1 bg-offwhite/50">
            {candidatePrereqs.length === 0 ? (
              <p className="text-xs text-charcoal-400 p-2 text-center">No other tasks in this project</p>
            ) : (
              candidatePrereqs.map((cp) => {
                const isSelected = selectedPrereqIds.includes(cp.id);
                return (
                  <div
                    key={cp.id}
                    onClick={() => togglePrereq(cp.id)}
                    className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-forest-100/70 text-forest-900 border border-forest-300' : 'hover:bg-white text-charcoal-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-charcoal-400">#{cp.id}</span>
                      <span className="truncate">{cp.title}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-forest-700 flex-shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 border-t border-charcoal-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-charcoal-600 hover:text-charcoal-900 hover:bg-charcoal-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
