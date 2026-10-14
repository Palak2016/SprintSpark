import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { DailyUpdate, Task } from '../../types';
import { Send, AlertOctagon, CheckCircle2, Calendar, Info } from 'lucide-react';

export const DailyUpdatesView: React.FC = () => {
  const { user } = useAuth();

  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>();
  const [progressPct, setProgressPct] = useState<number>(50);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [blockerNotes, setBlockerNotes] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadUpdates();
      loadTasks();
    }
  }, [user]);

  const loadUpdates = async () => {
    if (!user) return;
    try {
      const data = await api.getDailyUpdates({ user_id: user.id });
      setUpdates(data);
    } catch (err) {
      console.error("Failed to load daily updates:", err);
    }
  };

  const loadTasks = async () => {
    if (!user) return;
    try {
      const data = await api.getTasks({ assignee_id: user.id });
      setMyTasks(data);
      if (data.length > 0) {
        setSelectedTaskId(data[0].id);
        setProgressPct(data[0].progress_pct);
        setIsBlocked(data[0].is_blocked);
        setBlockerNotes(data[0].blocker_reason || '');
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  const handleTaskSelect = (taskId: number) => {
    setSelectedTaskId(taskId);
    const t = myTasks.find(x => x.id === taskId);
    if (t) {
      setProgressPct(t.progress_pct);
      setIsBlocked(t.is_blocked);
      setBlockerNotes(t.blocker_reason || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await api.submitDailyUpdate({
        task_id: selectedTaskId,
        progress_pct: Number(progressPct),
        is_blocked: isBlocked,
        blocker_notes: isBlocked ? blockerNotes : undefined,
        update_notes: updateNotes
      });
      await loadUpdates();
      await loadTasks();
      setSuccessMsg("Daily update submitted and synchronized with project risk engine.");
      setUpdateNotes('');
    } catch (err: any) {
      alert("Failed to submit update: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Daily Standup Updates</h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Record incremental progress, highlight blockers, and keep project intelligence accurate
        </p>
      </div>

      {/* Respectful AI policy callout */}
      <div className="p-4 rounded-xl bg-forest-50/60 border border-forest-200 text-xs text-forest-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-forest-700 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-semibold">WorkPilot Principle: </span>
          Missing daily updates are handled as unknown information, never as proof that work has not occurred. We respect engineering focus and autonomous workflows.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Submission Card Form */}
      <div className="p-6 bg-white rounded-2xl border border-charcoal-100 shadow-card">
        <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Send className="w-4 h-4 text-forest-700" />
          <span>Submit Today's Status Update</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Select Task *
            </label>
            <select
              required
              value={selectedTaskId || ''}
              onChange={(e) => handleTaskSelect(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 bg-white"
            >
              {myTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} • {t.title} ({t.status})
                </option>
              ))}
            </select>
          </div>

          {/* Progress Slider */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-2">
              <span>Overall Completion ({progressPct}%)</span>
              <span>{progressPct === 100 ? 'Completed' : 'Active'}</span>
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

          {/* Blocker Checkbox */}
          <div className="pt-2 border-t border-charcoal-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-charcoal-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500 accent-rose-600"
              />
              <span className={isBlocked ? 'text-rose-700 font-bold' : ''}>
                This task is currently blocked by an impediment
              </span>
            </label>

            {isBlocked && (
              <div className="mt-2.5">
                <input
                  type="text"
                  required={isBlocked}
                  placeholder="Explain blocker: what or who are you waiting on?"
                  value={blockerNotes}
                  onChange={(e) => setBlockerNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-rose-300 bg-rose-50/40 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Accomplishments & Next Steps
            </label>
            <textarea
              rows={3}
              placeholder="What did you ship today? What are you focusing on next?"
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
            />
          </div>

          <div className="pt-3 border-t border-charcoal-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedTaskId}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-forest-700 text-white text-xs font-bold hover:bg-forest-800 shadow-sm transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Daily Update'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Update History */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider">
          Recent Update History
        </h3>

        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card divide-y divide-charcoal-50 overflow-hidden">
          {updates.length === 0 ? (
            <p className="p-8 text-center text-xs text-charcoal-400">No daily updates recorded yet.</p>
          ) : (
            updates.map((upd) => (
              <div key={upd.id} className="p-4 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-charcoal-800">Task #{upd.task_id}</span>
                    <span className="font-semibold text-forest-700">{upd.progress_pct}% complete</span>
                    {upd.is_blocked && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        BLOCKED
                      </span>
                    )}
                  </div>
                  <span className="text-charcoal-400 text-[11px]">{upd.date}</span>
                </div>
                {upd.is_blocked && upd.blocker_notes && (
                  <p className="text-rose-700 font-medium bg-rose-50 p-2 rounded border border-rose-100 mt-1">
                    Blocker: {upd.blocker_notes}
                  </p>
                )}
                {upd.update_notes && (
                  <p className="text-charcoal-600 mt-1">{upd.update_notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
