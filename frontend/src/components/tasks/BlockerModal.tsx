import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Task } from '../../types';
import { api } from '../../services/api';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';

interface BlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onResolvedOrReported: () => void;
}

export const BlockerModal: React.FC<BlockerModalProps> = ({
  isOpen,
  onClose,
  task,
  onResolvedOrReported
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await api.reportBlocker(task.id, true, reason.trim());
      onResolvedOrReported();
      onClose();
    } catch (err: any) {
      alert("Failed to report blocker: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setIsSubmitting(true);
    try {
      await api.reportBlocker(task.id, false);
      onResolvedOrReported();
      onClose();
    } catch (err: any) {
      alert("Failed to resolve blocker: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.is_blocked ? `Resolve Blocker on Task #${task.id}` : `Report Work Blocker on Task #${task.id}`}
      subtitle={task.title}
      maxWidth="md"
    >
      {task.is_blocked ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-rose-900 uppercase tracking-wider">Current Blocker Description</p>
                <p className="text-sm text-rose-800 mt-1 leading-relaxed">
                  {task.blocker_reason || 'Work is currently blocked.'}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-charcoal-600">
            Has the impediment been cleared? Clicking "Mark as Resolved" will transition the task back to In Progress and update downstream dependency alerts.
          </p>

          <div className="pt-3 border-t border-charcoal-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleResolve}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-800 rounded-lg shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Resolving...' : 'Mark as Resolved'}</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleReport} className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            Flagging a blocker notifies the project manager and triggers the deterministic risk engine to evaluate impact on dependent milestones.
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Blocker Description & Root Cause *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Explain the specific obstacle (e.g. missing API credentials, unmerged pull request, third-party outage)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="pt-3 border-t border-charcoal-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-700 text-white hover:bg-rose-800 rounded-lg shadow-sm transition-colors"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>{isSubmitting ? 'Reporting...' : 'Flag as Blocked'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
