import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Task } from '../../types';
import { BlockerModal } from '../../components/tasks/BlockerModal';
import { Modal } from '../../components/common/Modal';
import {
  CheckSquare, Clock, AlertOctagon, CheckCircle2,
  Calendar, Link2, Plus, Send, Edit3
} from 'lucide-react';

export const MyTasksView: React.FC = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false);

  // Form states for quick update
  const [progressPct, setProgressPct] = useState(0);
  const [updateNotes, setUpdateNotes] = useState('');
  const [hoursSpent, setHoursSpent] = useState(1);
  const [workLogNotes, setWorkLogNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadMyTasks();
    }
  }, [user]);

  const loadMyTasks = async () => {
    if (!user) return;
    try {
      const data = await api.getTasks({ assignee_id: user.id });
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  const handleOpenProgress = (task: Task) => {
    setSelectedTask(task);
    setProgressPct(task.progress_pct);
    setUpdateNotes('');
    setIsUpdateModalOpen(true);
  };

  const handleOpenBlocker = (task: Task) => {
    setSelectedTask(task);
    setIsBlockerModalOpen(true);
  };

  const handleOpenWorkLog = (task: Task) => {
    setSelectedTask(task);
    setHoursSpent(1);
    setWorkLogNotes('');
    setIsWorkLogModalOpen(true);
  };

  const submitProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      await api.updateTaskProgress(selectedTask.id, progressPct, progressPct === 100 ? 'COMPLETED' : undefined, updateNotes);
      await loadMyTasks();
      setIsUpdateModalOpen(false);
    } catch (err: any) {
      alert("Failed to update progress: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      await api.createWorkLog(selectedTask.id, Number(hoursSpent), workLogNotes);
      await loadMyTasks();
      setIsWorkLogModalOpen(false);
    } catch (err: any) {
      alert("Failed to record work log: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">My Task Queue</h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Tasks assigned to you. Report progress percentage, log focus hours, and flag impediments.
        </p>
      </div>

      {/* Tasks Grid */}
      {tasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-charcoal-100 shadow-card">
          <CheckSquare className="w-8 h-8 text-charcoal-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-charcoal-800">No Tasks Assigned</h3>
          <p className="text-xs text-charcoal-400 mt-1">
            You do not currently have any active assignments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-5 rounded-2xl bg-white border border-charcoal-100 shadow-card flex flex-col justify-between hover:border-forest-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-semibold text-charcoal-400">#{task.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    task.status === 'BLOCKED' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                    task.status === 'IN_PROGRESS' ? 'bg-forest-50 text-forest-800 border border-forest-200' :
                    'bg-charcoal-100 text-charcoal-700'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-base font-bold text-charcoal-900">{task.title}</h3>
                <p className="text-xs text-charcoal-600 mt-1 line-clamp-2 leading-relaxed">
                  {task.description || 'No detailed instructions provided.'}
                </p>

                {/* Blocker alert banner if blocked */}
                {task.is_blocked && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Blocker Active: </span>
                      <span>{task.blocker_reason}</span>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-charcoal-500">Progress</span>
                    <span className="font-bold text-charcoal-800">{task.progress_pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-charcoal-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        task.progress_pct === 100 ? 'bg-emerald-500' : task.is_blocked ? 'bg-rose-500' : 'bg-forest-600'
                      }`}
                      style={{ width: `${task.progress_pct}%` }}
                    />
                  </div>
                </div>

                {/* Dates & Effort */}
                <div className="mt-3 pt-3 border-t border-charcoal-50 flex items-center justify-between text-xs text-charcoal-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-charcoal-400" />
                    <span>{task.actual_hours || 0}h / {task.estimated_hours}h spent</span>
                  </span>
                  <span className="flex items-center gap-1 font-medium text-charcoal-700">
                    <Calendar className="w-3.5 h-3.5 text-charcoal-400" />
                    <span>Due {task.due_date}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="mt-4 pt-3 border-t border-charcoal-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenBlocker(task)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    task.is_blocked 
                      ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                      : 'border-charcoal-200 text-charcoal-600 hover:bg-charcoal-100'
                  }`}
                >
                  {task.is_blocked ? 'Resolve Blocker' : 'Flag Blocker'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenWorkLog(task)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-charcoal-50 transition-colors"
                  >
                    Log Time
                  </button>
                  <button
                    onClick={() => handleOpenProgress(task)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-forest-700 text-white hover:bg-forest-800 transition-colors"
                  >
                    Update Progress
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress Update Modal */}
      {selectedTask && (
        <Modal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          title={`Update Progress on #${selectedTask.id}`}
          subtitle={selectedTask.title}
          maxWidth="md"
        >
          <form onSubmit={submitProgressUpdate} className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-2">
                <span>Completion ({progressPct}%)</span>
                <span>{progressPct === 100 ? 'Mark as Completed' : 'In Progress'}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressPct}
                onChange={(e) => setProgressPct(Number(e.target.value))}
                className="w-full accent-forest-700 h-2 bg-charcoal-100 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Progress Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Brief summary of code implemented, pull requests opened, or milestone reached..."
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
              />
            </div>

            <div className="pt-3 border-t border-charcoal-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsUpdateModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Work Time Modal */}
      {selectedTask && (
        <Modal
          isOpen={isWorkLogModalOpen}
          onClose={() => setIsWorkLogModalOpen(false)}
          title={`Record Work Log on #${selectedTask.id}`}
          subtitle={selectedTask.title}
          maxWidth="md"
        >
          <form onSubmit={submitWorkLog} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Hours Spent Today *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                required
                value={hoursSpent}
                onChange={(e) => setHoursSpent(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Work Session Notes
              </label>
              <textarea
                rows={3}
                placeholder="What did you focus on during this session?"
                value={workLogNotes}
                onChange={(e) => setWorkLogNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
              />
            </div>

            <div className="pt-3 border-t border-charcoal-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsWorkLogModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Record Log'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Blocker Modal */}
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
