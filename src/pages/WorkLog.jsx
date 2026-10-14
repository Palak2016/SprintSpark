import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { getWorkLogs, submitWorkLog } from '../services/workLogService';

const WorkLog = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({ task: '', hours: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await getWorkLogs();
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load work logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.task || !formData.hours) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      await submitWorkLog(formData);
      setMessage({ type: 'success', text: 'Work effort logged successfully!' });
      setFormData({ task: '', hours: '', notes: '' });
      fetchLogs();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to log effort.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Work Effort Logging</h2>
        <p className="text-sm text-gray-500 mt-1">Track daily time spent on assigned project milestones.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2 items-start">
        {/* Logging Form */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">Log Daily Effort</h3>

          {message && (
            <div className={`mb-4 rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Task</label>
              <select
                value={formData.task}
                onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a task...</option>
                <option value="Design Landing Page">Design Landing Page</option>
                <option value="Fix Auth Bug">Fix Auth Bug</option>
                <option value="Database Migration">Database Migration</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours Spent</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                required
                placeholder="e.g. 4.0"
                className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Summary</label>
              <textarea
                rows="3"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Brief summary of work completed..."
                className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors"
            >
              {isSubmitting ? 'Recording...' : 'Submit Log'}
            </button>
          </form>
        </section>

        {/* Work Logs History */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">Recent Effort Logs</h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-gray-100"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.task}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{log.notes || 'No notes provided'} • {log.date}</p>
                  </div>
                  <span className="rounded bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {log.hours} hrs
                  </span>
                </div>
              ))}
              {logs.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No logs recorded yet.</p>}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};

export default WorkLog;