
import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Task } from '../../types';
import { api } from '../../services/api';
import {
  AlertOctagon,
  CheckCircle2,
  ShieldAlert,
  LoaderCircle,
  Info,
} from 'lucide-react';

interface BlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onResolvedOrReported: () => void | Promise<void>;
}

export const BlockerModal: React.FC<BlockerModalProps> = ({
  isOpen,
  onClose,
  task,
  onResolvedOrReported,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, task?.id]);

  if (!task) return null;

  const handleReport = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setError('Please describe the blocker before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.reportBlocker(task.id, true, trimmedReason);

      // Refresh the task list before closing the modal.
      await onResolvedOrReported();

      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setError(`Failed to report blocker: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await api.reportBlocker(task.id, false);

      // Wait for the latest task state from the backend.
      await onResolvedOrReported();

      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setError(`Failed to resolve blocker: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonClass =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50';

  const cancelButtonClass =
    'rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-[#B7ADC9] transition-colors hover:bg-white/[0.07] hover:text-[#FAF8FF] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        task.is_blocked
          ? `Resolve Blocker · Task #${task.id}`
          : `Report Blocker · Task #${task.id}`
      }
      subtitle={task.title}
      maxWidth="md"
    >
      <div className="space-y-5 text-[#FAF8FF]">
        {/* Modal introduction */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
              task.is_blocked
                ? 'border-emerald-400/20 bg-emerald-500/10'
                : 'border-rose-400/20 bg-rose-500/10'
            }`}
          >
            {task.is_blocked ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-rose-300" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[#FAF8FF]">
              {task.is_blocked
                ? 'Resolve the current impediment'
                : 'Report a work impediment'}
            </h3>

            <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
              {task.is_blocked
                ? 'Confirm that the obstacle has been cleared so work can continue.'
                : 'Record what is preventing this task from moving forward.'}
            </p>
          </div>
        </div>

        {/* Resolve blocker */}
        {task.is_blocked ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.07] p-4">
              <div className="flex items-start gap-3">
                <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />

                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                    Current blocker description
                  </p>

                  <p className="mt-2 break-words text-sm leading-6 text-[#F5E9F0]">
                    {task.blocker_reason ||
                      'Work is currently blocked.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />

              <p className="text-xs leading-5 text-[#B7ADC9]">
                Marking this blocker as resolved will call the
                existing API to clear the blocker. The latest task
                information will be fetched before this modal closes.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3"
              >
                <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />

                <p className="break-words text-xs leading-5 text-rose-200">
                  {error}
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={cancelButtonClass}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleResolve}
                className={`${buttonClass} border border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25`}
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                <span>
                  {isSubmitting
                    ? 'Resolving...'
                    : 'Mark as Resolved'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* Report blocker */
          <form onSubmit={handleReport} className="space-y-4">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.07] p-4">
              <div className="flex items-start gap-3">
                <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />

                <div>
                  <p className="text-xs font-semibold text-amber-200">
                    Blocker impact
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#C8BCA9]">
                    Reporting a blocker notifies the project manager
                    and triggers your existing risk evaluation
                    workflow for dependent milestones.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="blocker-reason"
                  className="text-[11px] font-semibold uppercase tracking-wider text-[#E5D9FF]"
                >
                  Blocker description
                  <span className="ml-1 text-rose-300">*</span>
                </label>

                <span className="text-[10px] text-[#807493]">
                  {reason.length}/1000
                </span>
              </div>

              <textarea
                id="blocker-reason"
                rows={5}
                required
                maxLength={1000}
                minLength={3}
                placeholder="Explain the obstacle and its root cause. For example: API credentials are pending approval, a pull request is not merged, or a third-party service is unavailable."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);

                  if (error) {
                    setError('');
                  }
                }}
                disabled={isSubmitting}
                aria-invalid={Boolean(error)}
                aria-describedby="blocker-reason-help"
                className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#130D21] px-3.5 py-3 text-sm leading-6 text-[#FAF8FF] placeholder:text-[#807493] transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p
                id="blocker-reason-help"
                className="mt-2 text-[11px] leading-5 text-[#807493]"
              >
                Include what is blocked, why it is blocked, and
                what is needed to move forward.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3"
              >
                <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />

                <p className="break-words text-xs leading-5 text-rose-200">
                  {error}
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={cancelButtonClass}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !reason.trim()}
                className={`${buttonClass} border border-rose-400/20 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25`}
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertOctagon className="h-4 w-4" />
                )}

                <span>
                  {isSubmitting
                    ? 'Reporting...'
                    : 'Flag as Blocked'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
