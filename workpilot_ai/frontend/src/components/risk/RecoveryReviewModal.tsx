import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { RecoveryProposal } from '../../types';
import { api } from '../../services/api';
import {
  Sparkles, CheckCircle2, XCircle, ArrowRight, ShieldCheck,
  AlertTriangle, Clock, Users, ArrowUpRight
} from 'lucide-react';

interface RecoveryReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: RecoveryProposal | null;
  onDecided: () => void;
}

export const RecoveryReviewModal: React.FC<RecoveryReviewModalProps> = ({
  isOpen,
  onClose,
  proposal,
  onDecided
}) => {
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  if (!proposal) return null;

  const isPending = proposal.status === 'PENDING_APPROVAL';

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED' | 'DEFERRED') => {
    setIsSubmitting(true);
    try {
      await api.decideRecoveryProposal(proposal.id, decision, decisionNotes);
      onDecided();
      onClose();
    } catch (err: any) {
      alert("Decision execution failed: " + err.message);
    } finally {
      setIsSubmitting(false);
      setConfirmApprove(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={proposal.title}
      subtitle={`Recovery Proposal #${proposal.id} • ${proposal.status.replace('_', ' ')}`}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Executive Summary Card */}
        <div className="p-4 rounded-xl bg-forest-50/70 border border-forest-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-forest-700 text-white mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-forest-900">AI Plan Rationale & Objectives</h4>
              <p className="text-xs text-forest-800 mt-1 leading-relaxed">{proposal.summary}</p>
              <p className="text-xs text-forest-700/80 mt-2 font-medium italic">"{proposal.rationale}"</p>
            </div>
          </div>
        </div>

        {/* Side-by-Side Proposed Changes Comparison */}
        <div>
          <h3 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-3">
            Proposed Schedule & Allocation Actions ({proposal.proposed_actions.length})
          </h3>

          <div className="space-y-3">
            {proposal.proposed_actions.map((action) => (
              <div
                key={action.action_id}
                className="p-4 rounded-xl border border-charcoal-200 bg-white shadow-sm hover:border-forest-300 transition-colors"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-charcoal-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-charcoal-500">#{action.task_id}</span>
                    <h4 className="text-sm font-bold text-charcoal-900">{action.task_title}</h4>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-forest-100 text-forest-800 border border-forest-200 w-fit">
                    {action.action_type.replace('_', ' ')}
                  </span>
                </div>

                {/* Side-by-side values */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 text-xs">
                  {/* Current State */}
                  <div className="p-3 rounded-lg bg-charcoal-50/80 border border-charcoal-100">
                    <span className="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider block mb-1">
                      Current Value
                    </span>
                    <div className="space-y-1 font-mono text-charcoal-700">
                      {Object.entries(action.original_values).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-charcoal-400">{k}:</span>
                          <span className="font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Proposed Value */}
                  <div className="p-3 rounded-lg bg-forest-50/50 border border-forest-200">
                    <span className="text-[10px] font-bold text-forest-700 uppercase tracking-wider block mb-1">
                      Proposed Reconfiguration
                    </span>
                    <div className="space-y-1 font-mono text-forest-900">
                      {Object.entries(action.proposed_values).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-forest-600">{k}:</span>
                          <span className="font-bold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rationale & Expected Impact */}
                <div className="text-xs space-y-1 bg-offwhite/80 p-2.5 rounded-lg border border-charcoal-100">
                  <p className="text-charcoal-700">
                    <span className="font-semibold text-charcoal-900">Why this change: </span>
                    {action.reason}
                  </p>
                  <p className="text-forest-800 font-medium">
                    <span className="font-semibold">Expected Impact: </span>
                    {action.expected_impact}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assumptions List */}
        {proposal.assumptions && proposal.assumptions.length > 0 && (
          <div className="p-4 rounded-xl bg-charcoal-50 border border-charcoal-200">
            <h4 className="text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-forest-700" />
              <span>Assumptions & Operational Constraints</span>
            </h4>
            <ul className="space-y-1 text-xs text-charcoal-600 list-disc list-inside">
              {proposal.assumptions.map((assump, idx) => (
                <li key={idx}>{assump}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Decision Form & Actions (Only if PENDING_APPROVAL) */}
        {isPending ? (
          <div className="pt-4 border-t border-charcoal-100 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Manager Review Notes & Decision Audit Log
              </label>
              <input
                type="text"
                placeholder="Optional notes to record in audit trail (e.g. approved during sprint sync)..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
              />
            </div>

            {confirmApprove ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Confirm Consequential Schedule Mutation</h5>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      Approving will atomically mutate {proposal.proposed_actions.length} task records, reassign active tickets, update schedule baselines, and notify all affected engineers.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmApprove(false)}
                    className="px-3 py-1.5 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('APPROVED')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'Applying Changes...' : 'Confirm & Apply Schedule Changes'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-charcoal-400 italic">
                  Requires authorized Manager verification before changes are committed.
                </span>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('REJECTED')}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    Reject Proposal
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setConfirmApprove(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-bold bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Approve & Apply</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-charcoal-50 border border-charcoal-200 text-xs text-charcoal-600 flex items-center justify-between">
            <span>This proposal was decided on {new Date(proposal.decisions[0]?.decided_at || proposal.created_at).toLocaleString()}.</span>
            <span className="font-bold text-charcoal-800">{proposal.status}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
