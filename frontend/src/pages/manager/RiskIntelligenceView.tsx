
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { RiskAnalysis, RecoveryProposal } from '../../types';
import { RiskDetailCard } from '../../components/risk/RiskDetailCard';
import { RecoveryReviewModal } from '../../components/risk/RecoveryReviewModal';
import {
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Activity,
  FolderKanban,
  ArrowUpRight,
} from 'lucide-react';

export const RiskIntelligenceView: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject } = useProject();

  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedProposal, setGeneratedProposal] =
    useState<RecoveryProposal | null>(null);

  const loadRiskData = useCallback(async () => {
    if (!activeProject) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.getRiskAnalysis(activeProject.id);
      setAnalysis(data);
    } catch (err) {
      console.error('Failed to load risk analysis:', err);
      setError('Unable to load risk analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    void loadRiskData();
  }, [loadRiskData]);

  const handleRunEvaluation = async () => {
    if (!activeProject || isEvaluating) return;

    setIsEvaluating(true);
    setError(null);

    try {
      const data = await api.runRiskAnalysis(activeProject.id);
      setAnalysis(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Risk evaluation failed: ${message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGenerateRecovery = async () => {
    if (!activeProject || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const proposal = await api.generateRecoveryProposal(activeProject.id);
      setGeneratedProposal(proposal);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Recovery plan generation failed: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-full space-y-6 text-[#FAF8FF]">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
              <ShieldCheck className="h-5 w-5 text-violet-300" />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#FAF8FF] sm:text-2xl">
                Risk Intelligence
              </h1>
              <p className="mt-0.5 text-xs text-[#A99DBD]">
                Explainable Delivery Risk Analysis
              </p>
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-[#B7ADC9]">
            Identify delivery risks using task progress, blockers, and team
            availability. Review the reasons behind each risk and generate
            actionable recovery plans.
          </p>

          {activeProject && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#19112B] px-3 py-1.5 text-xs text-[#B7ADC9]">
              <FolderKanban className="h-3.5 w-3.5 text-violet-300" />
              <span>Active project:</span>
              <span className="font-semibold text-[#FAF8FF]">
                {activeProject.name}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRunEvaluation}
          disabled={!activeProject || isEvaluating}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isEvaluating ? 'animate-spin' : ''}`}
          />
          {isEvaluating ? 'Evaluating Rules...' : 'Re-run Risk Engine'}
        </button>
      </div>

      {/* No Active Project */}
      {!activeProject && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-8 text-center">
          <FolderKanban className="mx-auto mb-3 h-9 w-9 text-violet-300" />
          <h2 className="text-base font-semibold text-[#FAF8FF]">
            No project selected
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#A99DBD]">
            Select an active project to evaluate delivery risks and generate
            recovery plans.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-200">
              Something went wrong
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-rose-200/80">
              {error}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-medium text-rose-200 transition hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Risk Engine Information */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-violet-400/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#A99DBD]">
                Risk Evaluation
              </p>
              <h3 className="mt-2 text-sm font-semibold text-[#FAF8FF]">
                Rule-Based Analysis
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                Evaluates project delivery signals and task conditions.
              </p>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-2.5">
              <Activity className="h-5 w-5 text-violet-300" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-xs text-[#B7ADC9]">
              Explainable evaluation logic
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-amber-400/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#A99DBD]">
                Risk Signals
              </p>
              <h3 className="mt-2 text-sm font-semibold text-[#FAF8FF]">
                Delivery Monitoring
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                Connects blockers, progress, and team availability.
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-xs text-[#B7ADC9]">
              Multiple delivery indicators
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-sky-400/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#A99DBD]">
                Recovery Planning
              </p>
              <h3 className="mt-2 text-sm font-semibold text-[#FAF8FF]">
                Actionable Recommendations
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                Generate a proposal to help address delivery risks.
              </p>
            </div>
            <div className="rounded-xl bg-sky-500/10 p-2.5">
              <Sparkles className="h-5 w-5 text-sky-300" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <ArrowUpRight className="h-3.5 w-3.5 text-sky-300" />
            <span className="text-xs text-[#B7ADC9]">
              Risk-informed recovery workflow
            </span>
          </div>
        </div>
      </div>

      {/* Analysis Loading State */}
      {isLoading && !analysis && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-12 text-center">
          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-violet-300" />
          <p className="text-sm font-semibold text-[#FAF8FF]">
            Loading risk analysis...
          </p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Retrieving the latest project risk information.
          </p>
        </div>
      )}

      {/* Main Risk Analysis */}
      {activeProject && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#FAF8FF]">
                Project Risk Assessment
              </h2>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Review the current analysis and its underlying risk factors.
              </p>
            </div>

            {analysis && (
              <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/[0.08] bg-[#19112B] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-[#B7ADC9]">
                  Analysis available
                </span>
              </div>
            )}
          </div>

          {analysis ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
              <RiskDetailCard
                analysis={analysis}
                onGenerateRecoveryPlan={handleGenerateRecovery}
                isGenerating={isGenerating}
              />
            </div>
          ) : (
            !isLoading && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#19112B]/70 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10">
                  <AlertTriangle className="h-6 w-6 text-violet-300" />
                </div>
                <h3 className="text-base font-semibold text-[#FAF8FF]">
                  No risk analysis available
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#A99DBD]">
                  Run the risk engine to evaluate this project and identify
                  potential delivery issues.
                </p>
                <button
                  type="button"
                  onClick={handleRunEvaluation}
                  disabled={isEvaluating}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  <Activity className="h-4 w-4" />
                  {isEvaluating ? 'Evaluating...' : 'Run Risk Analysis'}
                </button>
              </div>
            )
          )}
        </section>
      )}

      {/* Explainability Footer */}
      <div className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#130D21] p-4">
        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
        <div>
          <h3 className="text-sm font-semibold text-[#FAF8FF]">
            About risk intelligence
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
            Risk results are based on the analysis returned by your backend.
            Review the contributing factors before deciding on a recovery plan.
            Re-running the engine refreshes the analysis for the selected
            project.
          </p>
        </div>
      </div>

      {/* Recovery Review Modal */}
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
