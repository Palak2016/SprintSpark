
import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { RecoveryProposal } from '../../types';
import { api } from '../../services/api';
import { formatIndianDateTime } from '../../utils/date';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Users,
  ArrowUpRight,
  Calendar,
  GitCompareArrows,
  Info,
  LoaderCircle,
} from 'lucide-react';

interface RecoveryReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: RecoveryProposal | null;
  onDecided: () => void | Promise<void>;
}

export const RecoveryReviewModal: React.FC<RecoveryReviewModalProps> = ({
  isOpen,
  onClose,
  proposal,
  onDecided,
}) => {
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!proposal) return null;

  const isPending = proposal.status === 'PENDING_APPROVAL';

  const handleClose = () => {
    if (isSubmitting) return;

    setConfirmApprove(false);
    setError(null);
    onClose();
  };

  const handleDecision = async (
    decision: 'APPROVED' | 'REJECTED' | 'DEFERRED'
  ) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.decideRecoveryProposal(
        proposal.id,
        decision,
        decisionNotes
      );

      await onDecided();

      setConfirmApprove(false);
      setDecisionNotes('');
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setError(`Decision execution failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatLabel = (value: string) =>
    value.replace(/_/g, ' ').toLowerCase();

  const decisionDate =
    proposal.decisions?.[0]?.decided_at || proposal.created_at;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={proposal.title}
      subtitle={`Recovery Proposal #${proposal.id} • ${formatLabel(proposal.status)}`}
      maxWidth="4xl"
    >
      <div className="space-y-6 bg-[#130D21] text-[#FAF8FF]">
        {/* Proposal Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
              <GitCompareArrows className="h-4 w-4 text-violet-300" />
            </div>

            <div>
              <p className="text-sm font-semibold text-[#FAF8FF]">
                Recovery Plan Review
              </p>
              <p className="mt-0.5 text-[11px] text-[#A99DBD]">
                Review proposed task and schedule changes before deciding.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
              isPending
                ? 'border-amber-400/20 bg-amber-500/10 text-amber-300'
                : proposal.status === 'APPROVED'
                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                  : proposal.status === 'REJECTED'
                    ? 'border-rose-400/20 bg-rose-500/10 text-rose-300'
                    : 'border-white/10 bg-white/[0.04] text-[#B7ADC9]'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {formatLabel(proposal.status)}
          </span>
        </div>

        {/* Executive Summary */}
        <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.12] to-[#19112B] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
              <Sparkles className="h-5 w-5 text-violet-300" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
                AI-Generated Proposal
              </p>

              <h3 className="mt-1 text-base font-bold text-[#FAF8FF]">
                Plan Rationale & Objectives
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#D5CBE5]">
                {proposal.summary}
              </p>

              {proposal.rationale && (
                <blockquote className="mt-4 rounded-xl border-l-2 border-violet-400/60 bg-[#130D21]/60 px-3 py-2.5 text-xs italic leading-5 text-[#B7ADC9]">
                  “{proposal.rationale}”
                </blockquote>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <GitCompareArrows className="h-4 w-4 text-violet-300" />
              </div>
              <div>
                <p className="text-[10px] text-[#A99DBD]">
                  Proposed Actions
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#FAF8FF]">
                  {proposal.proposed_actions.length} task
                  {proposal.proposed_actions.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-sky-500/10 p-2">
                <ShieldCheck className="h-4 w-4 text-sky-300" />
              </div>
              <div>
                <p className="text-[10px] text-[#A99DBD]">
                  Review Requirement
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#FAF8FF]">
                  Manager approval
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Proposed Actions */}
        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-[#FAF8FF]">
                Proposed Schedule & Allocation
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                Compare current task values with the suggested changes.
              </p>
            </div>

            <span className="w-fit rounded-lg border border-white/[0.08] bg-[#19112B] px-2.5 py-1.5 text-xs font-semibold text-[#B7ADC9]">
              {proposal.proposed_actions.length} action
              {proposal.proposed_actions.length === 1 ? '' : 's'}
            </span>
          </div>

          {proposal.proposed_actions.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-7 text-center">
              <Info className="mx-auto mb-2 h-6 w-6 text-[#A99DBD]" />
              <p className="text-sm font-semibold text-[#FAF8FF]">
                No proposed actions
              </p>
              <p className="mt-1 text-xs text-[#A99DBD]">
                This proposal does not contain any task changes to review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {proposal.proposed_actions.map((action, index) => (
                <article
                  key={action.action_id}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B] transition-colors hover:border-violet-400/20"
                >
                  {/* Action Header */}
                  <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10 text-xs font-bold text-violet-300">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-[#A99DBD]">
                          Task #{action.task_id}
                        </p>
                        <h4 className="mt-1 break-words text-sm font-bold text-[#FAF8FF]">
                          {action.task_title}
                        </h4>
                      </div>
                    </div>

                    <span className="w-fit shrink-0 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                      {formatLabel(action.action_type)}
                    </span>
                  </div>

                  {/* Current vs Proposed */}
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                    {/* Current Values */}
                    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-[#130D21] p-3.5">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="rounded-lg bg-slate-500/10 p-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A99DBD]">
                            Current Values
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#827694]">
                            Existing configuration
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {Object.entries(action.original_values).length > 0 ? (
                          Object.entries(action.original_values).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="flex items-start justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0"
                              >
                                <span className="break-words text-xs text-[#A99DBD]">
                                  {formatLabel(key)}
                                </span>
                                <span className="max-w-[60%] break-words text-right font-mono text-xs font-semibold text-[#D5CBE5]">
                                  {String(value ?? '—')}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <p className="text-xs text-[#827694]">
                            No original values supplied.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Proposed Values */}
                    <div className="min-w-0 rounded-xl border border-violet-400/15 bg-violet-500/[0.05] p-3.5">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="rounded-lg bg-violet-500/10 p-1.5">
                          <ArrowUpRight className="h-3.5 w-3.5 text-violet-300" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                            Proposed Values
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#A99DBD]">
                            Suggested configuration
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {Object.entries(action.proposed_values).length > 0 ? (
                          Object.entries(action.proposed_values).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0"
                              >
                                <span className="break-words text-xs text-[#A99DBD]">
                                  {formatLabel(key)}
                                </span>
                                <span className="max-w-[60%] break-words text-right font-mono text-xs font-bold text-violet-200">
                                  {String(value ?? '—')}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <p className="text-xs text-[#827694]">
                            No proposed values supplied.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rationale and Impact */}
                  <div className="mx-4 mb-4 space-y-3 rounded-xl border border-white/[0.06] bg-[#130D21]/70 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 rounded-lg bg-sky-500/10 p-1.5">
                        <Info className="h-3.5 w-3.5 text-sky-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#FAF8FF]">
                          Why this change?
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#B7ADC9]">
                          {action.reason || 'No rationale provided.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 border-t border-white/[0.06] pt-3">
                      <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-1.5">
                        <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-emerald-300">
                          Expected Impact
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#B7ADC9]">
                          {action.expected_impact || 'No expected impact specified.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Assumptions and Constraints */}
        {proposal.assumptions && proposal.assumptions.length > 0 && (
          <section className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.04] p-4 sm:p-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="rounded-xl bg-sky-500/10 p-2">
                <ShieldCheck className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#FAF8FF]">
                  Assumptions & Operational Constraints
                </h3>
                <p className="mt-1 text-xs text-[#A99DBD]">
                  Conditions to consider before applying this proposal.
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {proposal.assumptions.map((assumption, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-[#130D21]/60 p-3"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                  <span className="text-xs leading-5 text-[#B7ADC9]">
                    {assumption}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Decision Error */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] p-4"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <div>
              <p className="text-sm font-semibold text-rose-200">
                Unable to process decision
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-rose-200/80">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Manager Decision */}
        {isPending ? (
          <section className="space-y-4 border-t border-white/[0.08] pt-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-300" />
                <label
                  htmlFor="recovery-decision-notes"
                  className="text-xs font-bold uppercase tracking-wider text-[#D5CBE5]"
                >
                  Manager Review Notes
                </label>
              </div>

              <textarea
                id="recovery-decision-notes"
                placeholder="Add optional notes for the decision audit trail..."
                value={decisionNotes}
                onChange={(event) => setDecisionNotes(event.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="w-full resize-y rounded-xl border border-white/[0.10] bg-[#19112B] px-3.5 py-3 text-sm text-[#FAF8FF] outline-none transition placeholder:text-[#827694] focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/10 disabled:opacity-50"
              />

              <p className="mt-1.5 text-[10px] text-[#827694]">
                Notes will be submitted with your decision.
              </p>
            </div>

            {/* Approval Confirmation */}
            {confirmApprove ? (
              <div className="space-y-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-500/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-amber-300" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-amber-200">
                      Confirm Schedule Changes
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[#B7ADC9]">
                      You are about to approve a proposal containing{' '}
                      <span className="font-semibold text-[#FAF8FF]">
                        {proposal.proposed_actions.length} proposed action
                        {proposal.proposed_actions.length === 1 ? '' : 's'}
                      </span>
                      . Confirm that you have reviewed the affected tasks,
                      proposed values, rationale, and operational assumptions.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setConfirmApprove(false)}
                    className="rounded-xl border border-white/[0.10] bg-[#19112B] px-4 py-2.5 text-xs font-semibold text-[#B7ADC9] transition hover:bg-white/[0.05] hover:text-[#FAF8FF] disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('APPROVED')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {isSubmitting ? 'Applying Decision...' : 'Confirm Approval'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-[#19112B] p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                  <p className="text-xs leading-5 text-[#A99DBD]">
                    Manager authorization is required before the proposal can
                    be approved. Review the proposed changes before submitting
                    your decision.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('REJECTED')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Reject Proposal
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setError(null);
                      setConfirmApprove(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve & Review Confirmation
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          /* Previously Decided Proposal */
          <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-2 ${
                  proposal.status === 'APPROVED'
                    ? 'bg-emerald-500/10'
                    : proposal.status === 'REJECTED'
                      ? 'bg-rose-500/10'
                      : 'bg-slate-500/10'
                }`}
              >
                {proposal.status === 'APPROVED' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                ) : proposal.status === 'REJECTED' ? (
                  <XCircle className="h-5 w-5 text-rose-300" />
                ) : (
                  <Clock className="h-5 w-5 text-slate-300" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[#FAF8FF]">
                  Proposal Decision Recorded
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                  Decision date:{' '}
                  {formatIndianDateTime(decisionDate)}
                </p>
              </div>

              <span className="rounded-lg border border-white/[0.08] bg-[#130D21] px-2.5 py-1.5 text-[10px] font-bold uppercase text-[#D5CBE5]">
                {formatLabel(proposal.status)}
              </span>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
};
