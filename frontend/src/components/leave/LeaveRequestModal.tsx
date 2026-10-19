
import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { CalendarDays, AlertCircle } from 'lucide-react';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      setErrorMessage('Please select both a start date and an end date.');
      return;
    }

    if (endDate < startDate) {
      setErrorMessage('End date cannot be earlier than start date.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await api.submitLeaveRequest(startDate, endDate, reason);
      onSubmitted();
      onClose();

      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to submit leave request. Please try again.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateInputClass =
    'leave-date-input w-full rounded-xl border border-white/10 bg-[#19112B] px-3 py-2.5 text-sm text-[#FAF8FF] outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50';

  const labelClass =
    'mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#B7ADC9]';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Planned Absence / Leave"
      subtitle="Approved leave dynamically updates project capacity and warns of scheduled task collisions"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] p-3 text-xs text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <span className="break-words">{errorMessage}</span>
          </div>
        )}

        {/* Leave date range */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="leave-start-date" className={labelClass}>
              Start Date *
            </label>

            <input
              id="leave-start-date"
              type="date"
              required
              value={startDate}
              min={new Date().toLocaleDateString('en-CA', {
                timeZone: 'Asia/Kolkata',
              })}
              disabled={isSubmitting}
              onChange={(e) => {
                setStartDate(e.target.value);
                setErrorMessage(null);

                if (endDate && e.target.value > endDate) {
                  setEndDate('');
                }
              }}
              className={dateInputClass}
            />
          </div>

          <div>
            <label htmlFor="leave-end-date" className={labelClass}>
              End Date *
            </label>

            <input
              id="leave-end-date"
              type="date"
              required
              value={endDate}
              min={
                startDate ||
                new Date().toLocaleDateString('en-CA', {
                  timeZone: 'Asia/Kolkata',
                })
              }
              disabled={isSubmitting}
              onChange={(e) => {
                setEndDate(e.target.value);
                setErrorMessage(null);
              }}
              className={dateInputClass}
            />
          </div>
        </div>

        <p className="text-[11px] leading-5 text-[#807493]">
          Select the first and last day of your planned leave.
        </p>

        {/* Reason */}
        <div>
          <label htmlFor="leave-reason" className={labelClass}>
            Reason / Operational Context
          </label>

          <textarea
            id="leave-reason"
            rows={3}
            placeholder="Conference attendance, personal time off, medical appointment..."
            value={reason}
            disabled={isSubmitting}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-y rounded-xl border border-white/10 bg-[#19112B] px-3 py-2.5 text-sm text-[#FAF8FF] outline-none transition-colors placeholder:text-[#807493] focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-[#B7ADC9] transition-colors hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarDays className="h-4 w-4" />
            <span>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default LeaveRequestModal;
