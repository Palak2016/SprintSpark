import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { WorkLog, Task } from '../../types';
import { Clock, Plus, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const WorkLogsView: React.FC = () => {
  const { user } = useAuth();

  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>();
  const [hoursSpent, setHoursSpent] = useState<number>(2);
  const [notes, setNotes] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadLogs();
      loadTasks();
    }
  }, [user]);

  const loadLogs = async () => {
    if (!user) return;
    try {
      const data = await api.getWorkLogs({ user_id: user.id });
      setLogs(data);
    } catch (err) {
      console.error("Failed to load work logs:", err);
    }
  };

  const loadTasks = async () => {
    if (!user) return;
    try {
      const data = await api.getTasks({ assignee_id: user.id });
      setMyTasks(data);
      if (data.length > 0) setSelectedTaskId(data[0].id);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    setIsSubmitting(true);
    try {
      await api.createWorkLog(selectedTaskId, Number(hoursSpent), notes, logDate);
      await loadLogs();
      setIsLogModalOpen(false);
      setNotes('');
    } catch (err: any) {
      alert("Failed to record work log: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalLoggedHours = logs.reduce((acc, curr) => acc + curr.hours_spent, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Work Logs & Timesheet</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Transparent session logging connected directly to task effort baselines
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-forest-50 border border-forest-200 text-forest-800 text-xs font-bold">
            Total Logged: {totalLoggedHours.toFixed(1)} hrs
          </div>
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Log Work Session</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-charcoal-50 text-charcoal-500 uppercase tracking-wider font-semibold border-b border-charcoal-100">
            <tr>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Task ID</th>
              <th className="py-3 px-4">Hours</th>
              <th className="py-3 px-6">Work Session Notes</th>
              <th className="py-3 px-4 text-right">Logged At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-50 text-charcoal-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-charcoal-400">
                  No work logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-charcoal-50/70 transition-colors">
                  <td className="py-3 px-4 font-medium text-charcoal-900 whitespace-nowrap">
                    {log.log_date}
                  </td>
                  <td className="py-3 px-4 font-mono text-forest-800 font-semibold">
                    Task #{log.task_id}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-charcoal-900 bg-charcoal-100 px-2 py-0.5 rounded">
                      {log.hours_spent}h
                    </span>
                  </td>
                  <td className="py-3 px-6 text-charcoal-600 max-w-md">
                    {log.notes || <span className="italic text-charcoal-400">No notes recorded</span>}
                  </td>
                  <td className="py-3 px-4 text-right text-charcoal-400">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Record Work Session"
        subtitle="Log effort hours against your assigned project tickets"
        maxWidth="md"
      >
        <form onSubmit={handleCreateLog} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Select Assigned Task *
            </label>
            <select
              required
              value={selectedTaskId || ''}
              onChange={(e) => setSelectedTaskId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 bg-white"
            >
              {myTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} • {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Hours (e.g. 2.5) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                required
                value={hoursSpent}
                onChange={(e) => setHoursSpent(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Session Focus & Accomplishments
            </label>
            <textarea
              rows={3}
              placeholder="What specifically did you build, debug, or deploy?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
            />
          </div>

          <div className="pt-3 border-t border-charcoal-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsLogModalOpen(false)}
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
    </div>
  );
};
