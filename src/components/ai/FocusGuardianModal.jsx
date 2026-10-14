import React, { useState, useEffect } from 'react';
import { submitFocusGuardianFeedback } from '../../services/aiService';

const FocusGuardianModal = ({ isOpen, onClose, currentTask = 'Design Landing Page', targetTask = 'Fix Auth Bug' }) => {
  const [reasonCategory, setReasonCategory] = useState('Blocker');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escape key listener add kiya gaya hai
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await submitFocusGuardianFeedback({
        switchedFrom: currentTask,
        switchedTo: targetTask,
        category: reasonCategory,
        details: customReason
      });
      onClose();
    } catch (err) {
      alert('Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Focus Guardian</h3>
        <p className="text-sm text-gray-600 mb-4">
          You're working on <span className="font-semibold text-indigo-600">{targetTask}</span> instead of planned <span className="font-semibold text-gray-800">{currentTask}</span> – was this necessary?
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {[
              { id: 'Blocker', label: 'Blocker' },
              { id: 'Urgent', label: 'Urgent request' },
              { id: 'Priority', label: 'Priority changed' },
              { id: 'Other', label: 'Other' }
            ].map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value={opt.id}
                  checked={reasonCategory === opt.id}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>

          <div>
            <textarea
              rows="2"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Additional details (optional)..."
              className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
          </div>

          {/* Mandatory Privacy Footer Note */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs text-slate-600">
            Tracking uses your explicit updates and logs only. Your input helps adjust project forecasting safely.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Logging...' : 'Submit Context'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FocusGuardianModal;