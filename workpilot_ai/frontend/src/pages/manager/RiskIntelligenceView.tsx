import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { RiskAnalysis, RecoveryProposal } from '../../types';
import { RiskDetailCard } from '../../components/risk/RiskDetailCard';
import { RecoveryReviewModal } from '../../components/risk/RecoveryReviewModal';
import {
  AlertTriangle, RefreshCw, Sparkles, ShieldCheck,
  CheckCircle2, HelpCircle
} from 'lucide-react';

export const RiskIntelligenceView: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject } = useProject();

  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState<RecoveryProposal | null>(null);

  useEffect(() => {
    if (activeProject) {
      loadRiskData();
    }
  }, [activeProject]);

  const loadRiskData = async () => {
    if (!activeProject) return;
    try {
      const data = await api.getRiskAnalysis(activeProject.id);
      setAnalysis(data);
    } catch (err) {
      console.error("Failed to load risk analysis:", err);
    }
  };

  const handleRunEvaluation = async () => {
    if (!activeProject) return;
    setIsEvaluating(true);
    try {
      const data = await api.runRiskAnalysis(activeProject.id);
      setAnalysis(data);
    } catch (err: any) {
      alert("Evaluation failed: " + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGenerateRecovery = async () => {
    if (!activeProject) return;
    setIsGenerating(true);
    try {
      const proposal = await api.generateRecoveryProposal(activeProject.id);
      setGeneratedProposal(proposal);
    } catch (err: any) {
      alert("Recovery plan generation failed: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Explainable Delivery Risk Intelligence</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Deterministic backend rule evaluation connecting task progress, blockers, and employee availability
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunEvaluation}
            disabled={isEvaluating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-charcoal-200 bg-white text-charcoal-700 hover:text-charcoal-900 hover:bg-charcoal-50 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin text-forest-700' : ''}`} />
            <span>{isEvaluating ? 'Evaluating Rules...' : 'Re-run Risk Engine'}</span>
          </button>
        </div>
      </div>

      {/* Main Risk Analysis Card */}
      <RiskDetailCard
        analysis={analysis}
        onGenerateRecoveryPlan={handleGenerateRecovery}
        isGenerating={isGenerating}
      />

      {/* Recovery Review Modal if opened from generation */}
      {generatedProposal && (
        <RecoveryReviewModal
          isOpen={!!generatedProposal}
          onClose={() => setGeneratedProposal(null)}
          proposal={generatedProposal}
          onDecided={async () => {
            await loadRiskData();
            navigate('/manager/recovery');
          }}
        />
      )}
    </div>
  );
};
