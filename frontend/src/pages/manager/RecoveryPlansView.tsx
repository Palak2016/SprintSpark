import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import type { FocusGuardianContext, RecoveryPlannerStatus, RecoveryProposal } from '../../types';
import { ProvenanceBadge } from '../../components/risk/RecoveryInsights';
import { RecoveryReviewModal } from '../../components/risk/RecoveryReviewModal';
import { formatIndianDateTime } from '../../utils/date';

import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  FileText,
  CalendarClock,
  MessageSquare,
  UserRound,
  ClipboardCheck,
  BrainCircuit,
  Info,
  LoaderCircle,
} from 'lucide-react';

const formatDate = (date?: string | null): string => {
  if (!date) return 'Date unavailable';

  const formatted = formatIndianDateTime(date);
  return formatted === '—' ? 'Date unavailable' : formatted;
};

const getStatusStyle = (status: string): string => {
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';

    case 'REJECTED':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-300';

    case 'DEFERRED':
      return 'border-amber-400/20 bg-amber-500/10 text-amber-300';

    default:
      return 'border-violet-400/20 bg-violet-500/10 text-violet-300';
  }
};

const getFocusContexts = (
  proposal: RecoveryProposal,
): FocusGuardianContext[] => {
  return proposal.focus_contexts ?? [];
};

/**
 * Displays technical context only when it is included in the proposal
 * returned by the backend.
 */
const FocusGuardianContextPanel: React.FC<{
  contexts: FocusGuardianContext[];
  emptyMessage?: string;
}> = ({
  contexts,
  emptyMessage = 'No Focus Guardian context was submitted for this project when this proposal was generated.',
}) => {

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-500/[0.05]">
      <div className="flex items-start gap-3 border-b border-violet-400/10 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
          <MessageSquare
            size={20}
            className="text-violet-300"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-[#FAF8FF]">
            Focus Guardian Context
          </h4>

          <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
            Employee-submitted explanations that can help clarify technical
            blockers and delivery risks.
          </p>
        </div>

        <span className="shrink-0 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-300">
          {contexts.length} {contexts.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      <div className="space-y-3 p-4">
        {contexts.length > 0 ? (
          contexts.map((context, index) => (
            <article
              key={context.id ?? `${context.task_id ?? 'context'}-${index}`}
              className="rounded-xl border border-white/[0.07] bg-[#19112B] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-200">
                      <ClipboardCheck size={14} />
                      {context.task_title ||
                        (context.task_id != null
                          ? `Task #${context.task_id}`
                          : 'Related task')}
                    </span>
                  </div>

                  {context.reason && (
                    <span className="mt-2 inline-flex max-w-full rounded-lg border border-violet-400/15 bg-violet-500/[0.07] px-2.5 py-1.5 text-[11px] leading-5 text-violet-200">
                      {context.reason}
                    </span>
                  )}
                </div>

                {context.employee_name && (
                  <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-[#A99DBD]">
                    <UserRound size={13} />
                    {context.employee_name}
                  </div>
                )}
              </div>

              {context.context && (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <p className="whitespace-pre-wrap break-words text-xs leading-6 text-[#D8CDEF]">
                    {context.context}
                  </p>
                </div>
              )}

              {context.created_at && (
                <p className="mt-3 text-[10px] text-[#807493]">
                  Submitted {formatDate(context.created_at)}
                </p>
              )}
            </article>
          ))
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-[#19112B]/70 p-3.5">
            <Info
              size={16}
              className="mt-0.5 shrink-0 text-[#A99DBD]"
            />

            <p className="text-xs leading-5 text-[#A99DBD]">
              {emptyMessage}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export const RecoveryPlansView: React.FC = () => {
  const { activeProject, refreshProjects } = useProject();

  const [proposals, setProposals] = useState<RecoveryProposal[]>([]);
  const [selectedProposal, setSelectedProposal] =
    useState<RecoveryProposal | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [employeeContexts, setEmployeeContexts] = useState<FocusGuardianContext[]>([]);
  const [contextProjectId, setContextProjectId] = useState<number | null>(null);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plannerStatus, setPlannerStatus] = useState<RecoveryPlannerStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getRecoveryPlannerStatus()
      .then((status) => {
        if (!cancelled) setPlannerStatus(status);
      })
      .catch(() => {
        /* status is informational only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleViewEmployeeContexts = async () => {
    if (!activeProject) return;

    if (isContextPanelOpen && contextProjectId === activeProject.id) {
      setIsContextPanelOpen(false);
      return;
    }

    setIsLoadingContexts(true);
    setError(null);

    try {
      const contexts = await api.getProjectFocusContexts(activeProject.id);
      setEmployeeContexts(contexts);
      setContextProjectId(activeProject.id);
      setIsContextPanelOpen(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Unable to load employee context: ${err.message}`
          : 'Unable to load employee context. Please try again.',
      );
    } finally {
      setIsLoadingContexts(false);
    }
  };

  const loadProposals = useCallback(
    async (silent = false): Promise<RecoveryProposal[]> => {
      if (!activeProject) {
        setProposals([]);
        setIsLoading(false);
        return [];
      }

      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const data = await api.getRecoveryProposals(activeProject.id);
        const safeData = Array.isArray(data) ? data : [];

        setProposals(safeData);

        return safeData;
      } catch (err: unknown) {
        console.error('Failed to load proposals:', err);

        if (!silent) {
          setError(
            err instanceof Error
              ? `Unable to load recovery plans: ${err.message}`
              : 'Unable to load recovery plans. Please try again.',
          );
        }

        return [];
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [activeProject],
  );

  useEffect(() => {
    void loadProposals();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadProposals(true);
      }
    }, 10000);

    const handleFocus = () => {
      void loadProposals(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadProposals]);

  const handleGenerateFresh = async () => {
    if (!activeProject || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      // The backend should load saved Focus Guardian notes when generating
      // the plan; the frontend does not send invented or unsaved context.
      const newPlan = await api.generateRecoveryProposal(activeProject.id);

      const refreshedProposals = await loadProposals(true);

      const refreshedPlan = refreshedProposals.find(
        (proposal) => proposal.id === newPlan.id,
      );

      // Prefer the refreshed API version if it contains context details.
      setSelectedProposal(refreshedPlan ?? newPlan);
    } catch (err: unknown) {
      console.error('Failed to generate recovery plan:', err);

      setError(
        err instanceof Error
          ? `Failed to generate plan: ${err.message}`
          : 'Failed to generate a recovery plan. Please try again.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const pendingProposals = proposals.filter(
    (proposal) => proposal.status === 'PENDING_APPROVAL',
  );

  const pastProposals = proposals.filter(
    (proposal) => proposal.status !== 'PENDING_APPROVAL',
  );

  const approvedCount = proposals.filter(
    (proposal) => proposal.status === 'APPROVED',
  ).length;

  const totalContextNotes = proposals.reduce(
    (total, proposal) => total + getFocusContexts(proposal).length,
    0,
  );

  return (
    <div className="space-y-6 text-[#FAF8FF]">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-[#A99DBD]">
            <span>Manager Workspace</span>
            <span>/</span>
            <span className="text-violet-300">Recovery Plans</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
              <Sparkles
                size={25}
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#FAF8FF] sm:text-2xl">
                Recovery Plans
              </h1>

              <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                Review project risks alongside employee-submitted technical
                context.
              </p>
            </div>
          </div>

          {activeProject && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#19112B] px-3 py-1.5 text-xs text-[#B7ADC9]">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Project: {activeProject.name}
            </div>
          )}

          {plannerStatus && (
            <p className="mt-2 text-[11px] leading-5 text-[#A99DBD]">
              {plannerStatus.llm_configured
                ? `AI planner: ${plannerStatus.provider} model ${plannerStatus.model}. Its suggestions are validated against project data and need your approval.`
                : 'AI planner not configured (no OPENAI_API_KEY or GEMINI_API_KEY). New plans use the rule-based planner and are labelled that way.'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleViewEmployeeContexts()}
            disabled={!activeProject || isLoadingContexts}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3.5 py-3 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoadingContexts ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <MessageSquare size={16} />
            )}
            {isLoadingContexts
              ? 'Loading Context...'
              : isContextPanelOpen && contextProjectId === activeProject?.id
                ? 'Hide Context'
                : `Review All Context${contextProjectId === activeProject?.id ? ` (${employeeContexts.length})` : ''}`}
          </button>

          <button
            type="button"
            onClick={() => void loadProposals()}
            disabled={isLoading || !activeProject}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#19112B] px-3.5 py-3 text-xs font-semibold text-[#D5CBE5] transition hover:border-violet-400/30 hover:bg-[#211633] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isLoading ? 'animate-spin' : ''}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void handleGenerateFresh()}
            disabled={isGenerating || isLoading || !activeProject}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <Sparkles size={16} />
            )}

            {isGenerating ? 'Generating Plan...' : 'Generate Recovery Plan'}
          </button>
        </div>
      </header>

      {isContextPanelOpen && contextProjectId === activeProject?.id && (
        <FocusGuardianContextPanel
          contexts={employeeContexts}
          emptyMessage="Employees have not submitted any Focus Guardian context for this project yet."
        />
      )}

      {/* Focus Guardian Integration Explanation */}
      <section className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
            <BrainCircuit
              size={21}
              className="text-violet-300"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#FAF8FF]">
              Recovery Planning with Focus Guardian
            </h2>

            <p className="mt-2 text-xs leading-6 text-[#B7ADC9]">
              Employee-submitted explanations can provide additional evidence
              about engineering challenges, unexpected dependencies, incidents,
              and other blockers. Use this context alongside task progress,
              deadlines, and dependency data when reviewing delivery risks.
            </p>

            <p className="mt-2 text-xs leading-6 text-[#B7ADC9]">
              Context should inform the AI's explanation and recommendations.
              Managers retain control over approval, and no deadline or task
              assignment should be changed automatically based only on a
              submitted note.
            </p>
          </div>
        </div>
      </section>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-4"
        >
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-rose-300"
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-200">
              Something went wrong
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-[#B7ADC9]">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="text-xs text-[#A99DBD] transition hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <section
        aria-label="Recovery plan summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition hover:border-violet-400/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#A99DBD]">
              Total Proposals
            </p>

            <div className="rounded-lg bg-violet-500/10 p-2">
              <FileText size={17} className="text-violet-300" />
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold tabular-nums">
            {proposals.length}
          </p>

          <p className="mt-1 text-[10px] text-[#827694]">
            Recovery plans created
          </p>
        </div>

        <div className="rounded-2xl border border-amber-400/15 bg-[#19112B] p-4 transition hover:border-amber-400/25">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#A99DBD]">
              Awaiting Approval
            </p>

            <div className="rounded-lg bg-amber-500/10 p-2">
              <Clock size={17} className="text-amber-300" />
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold tabular-nums text-amber-300">
            {pendingProposals.length}
          </p>

          <p className="mt-1 text-[10px] text-[#827694]">
            Require manager review
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-400/15 bg-[#19112B] p-4 transition hover:border-emerald-400/25">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#A99DBD]">
              Approved Plans
            </p>

            <div className="rounded-lg bg-emerald-500/10 p-2">
              <ShieldCheck size={17} className="text-emerald-300" />
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-300">
            {approvedCount}
          </p>

          <p className="mt-1 text-[10px] text-[#827694]">
            Approved by a manager
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition hover:border-violet-400/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#A99DBD]">
              Linked Context Notes
            </p>

            <div className="rounded-lg bg-violet-500/10 p-2">
              <MessageSquare size={17} className="text-violet-300" />
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold tabular-nums text-violet-300">
            {totalContextNotes}
          </p>

          <p className="mt-1 text-[10px] text-[#827694]">
            Included in returned proposals
          </p>
        </div>
      </section>

      {/* Pending Approval */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#FAF8FF]">
              <Clock size={17} className="text-amber-300" />
              Awaiting Manager Approval
            </h2>

            <p className="mt-1 text-xs text-[#A99DBD]">
              Review suggested actions and linked engineering context before
              deciding.
            </p>
          </div>

          <span className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300">
            {pendingProposals.length} pending
          </span>
        </div>

        {!activeProject ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] px-5 py-10 text-center">
            <AlertTriangle
              size={27}
              className="mx-auto text-amber-300"
            />

            <p className="mt-3 text-sm font-semibold text-[#FAF8FF]">
              Select a Project
            </p>

            <p className="mt-1 text-xs text-[#A99DBD]">
              Choose an active project to view and generate recovery plans.
            </p>
          </div>
        ) : isLoading && proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#19112B] py-12">
            <LoaderCircle
              size={29}
              className="animate-spin text-violet-300"
            />

            <p className="mt-3 text-sm font-medium text-[#D5CBE5]">
              Loading recovery plans...
            </p>

            <p className="mt-1 text-xs text-[#827694]">
              Retrieving proposals for your project.
            </p>
          </div>
        ) : pendingProposals.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] px-5 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2
                size={25}
                className="text-emerald-300"
              />
            </div>

            <h3 className="mt-3 text-sm font-semibold text-[#FAF8FF]">
              No Pending Recovery Plans
            </h3>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#A99DBD]">
              There are no proposals awaiting a decision. Submit relevant
              Focus Guardian context first, then generate a fresh recovery
              plan to assess the available evidence.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingProposals.map((proposal) => (
              <article
                key={proposal.id}
                className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 transition-all duration-200 hover:border-violet-400/25 hover:bg-[#1D1431] sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
                      <Sparkles
                        size={22}
                        className="text-violet-300"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-[#827694]">
                          #{proposal.id}
                        </span>

                        <span className="rounded-md border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                          Pending approval
                        </span>

                        <ProvenanceBadge trace={proposal.generation_trace} compact />
                      </div>

                      <h3 className="mt-2 break-words text-base font-bold leading-6 text-[#FAF8FF]">
                        {proposal.title}
                      </h3>

                      <p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-xs leading-6 text-[#B7ADC9]">
                        {proposal.summary || 'No summary provided.'}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#A99DBD]">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText
                            size={14}
                            className="text-violet-300"
                          />

                          {proposal.proposed_actions?.length ?? 0}{' '}
                          proposed action(s)
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock
                            size={14}
                            className="text-violet-300"
                          />

                          {formatDate(proposal.created_at)}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <MessageSquare
                            size={14}
                            className="text-violet-300"
                          />

                          {getFocusContexts(proposal).length}{' '}
                          Focus Guardian note(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center lg:pl-4">
                    <button
                      type="button"
                      onClick={() => setSelectedProposal(proposal)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-violet-500 sm:w-auto"
                    >
                      Review &amp; Decide
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                <FocusGuardianContextPanel contexts={getFocusContexts(proposal)} />
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Decision Archive */}
      <section className="space-y-3 border-t border-white/[0.08] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#FAF8FF]">
              <ShieldCheck size={17} className="text-violet-300" />
              Decision Archive
            </h2>

            <p className="mt-1 text-xs text-[#A99DBD]">
              Previously reviewed recovery proposals and their supporting context.
            </p>
          </div>

          <span className="rounded-lg border border-white/[0.08] bg-[#19112B] px-2.5 py-1.5 text-xs font-semibold text-[#B7ADC9]">
            {pastProposals.length} archived
          </span>
        </div>

        {pastProposals.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-6 text-center">
            <Clock
              size={25}
              className="mx-auto text-[#827694]"
            />

            <p className="mt-2 text-sm font-medium text-[#D5CBE5]">
              No decisions recorded yet
            </p>

            <p className="mt-1 text-xs text-[#827694]">
              Reviewed proposals will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastProposals.map((proposal) => {
              const isApproved = proposal.status === 'APPROVED';
              const isRejected = proposal.status === 'REJECTED';

              return (
                <article
                  key={proposal.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 transition-colors hover:border-violet-400/20 sm:p-5"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProposal(proposal)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isApproved
                            ? 'bg-emerald-500/10'
                            : isRejected
                              ? 'bg-rose-500/10'
                              : 'bg-amber-500/10'
                        }`}
                      >
                        {isApproved ? (
                          <CheckCircle2
                            size={18}
                            className="text-emerald-300"
                          />
                        ) : isRejected ? (
                          <XCircle
                            size={18}
                            className="text-rose-300"
                          />
                        ) : (
                          <Clock
                            size={18}
                            className="text-amber-300"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] text-[#827694]">
                            #{proposal.id}
                          </span>

                          <h3 className="break-words text-sm font-semibold text-[#FAF8FF]">
                            {proposal.title}
                          </h3>

                          <span
                            className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusStyle(proposal.status)}`}
                          >
                            {proposal.status.replace(/_/g, ' ')}
                          </span>

                          <ProvenanceBadge trace={proposal.generation_trace} compact />
                        </div>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#A99DBD]">
                          {proposal.summary || 'No summary provided.'}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#827694]">
                          <span>
                            Created {formatDate(proposal.created_at)}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <MessageSquare size={12} />
                            {getFocusContexts(proposal).length} context note(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <ArrowRight
                      size={16}
                      className="shrink-0 text-[#827694]"
                    />
                  </button>

                  <FocusGuardianContextPanel contexts={getFocusContexts(proposal)} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Review Modal */}
      {selectedProposal && (
        <RecoveryReviewModal
          isOpen={!!selectedProposal}
          onClose={() => setSelectedProposal(null)}
          proposal={selectedProposal}
          onDecided={async () => {
            await loadProposals(true);
            await refreshProjects();
            setSelectedProposal(null);
          }}
        />
      )}
    </div>
  );
};

export default RecoveryPlansView;