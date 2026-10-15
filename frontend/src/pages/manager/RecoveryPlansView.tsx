import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { RecoveryProposal } from '../../types';
import { RecoveryReviewModal } from '../../components/risk/RecoveryReviewModal';
import {
  Sparkles, CheckCircle2, XCircle, Clock, ShieldCheck,
  ArrowRight, RefreshCw, AlertTriangle
} from 'lucide-react';

export const RecoveryPlansView: React.FC = () => {
  const { activeProject, refreshProjects } = useProject();

  const [proposals, setProposals] = useState<RecoveryProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<RecoveryProposal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (activeProject) {
      loadProposals();
    }
  }, [activeProject]);

  const loadProposals = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const data = await api.getRecoveryProposals(activeProject.id);
      setProposals(data);
    } catch (err) {
      console.error("Failed to load proposals:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateFresh = async () => {
    if (!activeProject) return;
    setIsGenerating(true);
    try {
      const newPlan = await api.generateRecoveryProposal(activeProject.id);
      await loadProposals();
      setSelectedProposal(newPlan);
    } catch (err: any) {
      alert("Failed to generate plan: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const pendingProposals = proposals.filter(p => p.status === 'PENDING_APPROVAL');
  const pastProposals = proposals.filter(p => p.status !== 'PENDING_APPROVAL');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">AI-Assisted Recovery Plans</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Orchestrated by LangGraph to interpret delivery bottlenecks and formulate authorized interventions
          </p>
        </div>

        <button
          onClick={handleGenerateFresh}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{isGenerating ? 'Generating Plan...' : 'Generate New Recovery Plan'}</span>
        </button>
      </div>

      {/* Pending Approval Section */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Awaiting Manager Approval ({pendingProposals.length})</span>
        </h2>

        {pendingProposals.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-charcoal-100 shadow-card">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-charcoal-800">No Pending Recovery Plans</h3>
            <p className="text-xs text-charcoal-400 mt-1 max-w-md mx-auto">
              All formulated recovery proposals have been reviewed and decided. You can generate a new plan any time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="p-5 rounded-2xl bg-white border border-forest-200 shadow-card hover:border-forest-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-forest-100 text-forest-800 flex-shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-charcoal-400">#{proposal.id}</span>
                      <h3 className="text-base font-bold text-charcoal-900">{proposal.title}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                        PENDING APPROVAL
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-600 mt-1 leading-relaxed max-w-2xl">
                      {proposal.summary}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-charcoal-500 mt-2">
                      <span>{proposal.proposed_actions.length} action(s) proposed</span>
                      <span>•</span>
                      <span>Formulated {new Date(proposal.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProposal(proposal)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-700 text-white text-xs font-bold hover:bg-forest-800 shadow-sm transition-all"
                  >
                    <span>Review & Decide</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decided History Section */}
      {pastProposals.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-charcoal-100">
          <h2 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider">
            Decision Archive ({pastProposals.length})
          </h2>

          <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card divide-y divide-charcoal-50 overflow-hidden">
            {pastProposals.map((proposal) => {
              const isApproved = proposal.status === 'APPROVED';
              return (
                <div
                  key={proposal.id}
                  onClick={() => setSelectedProposal(proposal)}
                  className="p-4 hover:bg-charcoal-50/60 transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-charcoal-400">#{proposal.id}</span>
                      <h4 className="text-sm font-semibold text-charcoal-900 truncate">{proposal.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isApproved ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {proposal.status}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-500 truncate mt-0.5">{proposal.summary}</p>
                  </div>
                  <span className="text-xs text-charcoal-400 flex-shrink-0">
                    View Details →
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedProposal && (
        <RecoveryReviewModal
          isOpen={!!selectedProposal}
          onClose={() => setSelectedProposal(null)}
          proposal={selectedProposal}
          onDecided={async () => {
            await loadProposals();
            await refreshProjects();
          }}
        />
      )}
    </div>
  );
};
