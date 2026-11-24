import React, { useCallback, useEffect, useState } from 'react';
import {
  MdWarningAmber as AlertTriangle,
  MdArrowOutward as ArrowUpRight,
  MdCheck as Check,
  MdHelp as CircleHelp,
  MdChecklist as ListChecks,
  MdRefresh as LoaderCircle,
  MdMessage as MessageSquare,
  MdRefresh as RefreshCw,
  MdVerifiedUser as ShieldCheck,
  MdGpsFixed as Target,
  MdClose as X
} from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import type { AgendaDrift } from '../types';

const statusStyles: Record<AgendaDrift['alignment_status'], string> = {
  ALIGNED: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  PARTIALLY_ALIGNED: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  OFF_TRACK: 'border-rose-400/25 bg-rose-500/10 text-rose-200',
  NEEDS_CLARIFICATION: 'border-sky-400/25 bg-sky-500/10 text-sky-200',
};

const statusLabels: Record<AgendaDrift['alignment_status'], string> = {
  ALIGNED: 'Aligned',
  PARTIALLY_ALIGNED: 'Partially aligned',
  OFF_TRACK: 'Potential drift',
  NEEDS_CLARIFICATION: 'Needs clarification',
};

export const AgendaDriftView: React.FC = () => {
  const { user, isManager } = useAuth();
  const { activeProject } = useProject();
  const [records, setRecords] = useState<AgendaDrift[]>([]);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [clarifications, setClarifications] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async (showSpinner = false) => {
    if (isManager && !activeProject) {
      return;
    }
    if (!user) return;
    if (showSpinner) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = isManager
        ? await api.getProjectAgendaDrift(activeProject!.id)
        : await api.getMyAgendaDrift();
      setError(null);
      setRecords(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load agenda checks.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProject, isManager, user]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const submitReview = async (record: AgendaDrift, decision: 'ACKNOWLEDGED' | 'DISMISSED') => {
    setBusyId(record.id);
    setError(null);
    try {
      const updated = await api.reviewAgendaDrift(
        record.id,
        decision,
        feedback[record.id]?.trim() || undefined,
      );
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to save manager review.');
    } finally {
      setBusyId(null);
    }
  };

  const submitClarification = async (record: AgendaDrift) => {
    const text = clarifications[record.id]?.trim();
    if (!text) return;
    setBusyId(record.id);
    setError(null);
    try {
      const updated = await api.clarifyAgendaDrift(record.id, text);
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setClarifications((current) => ({ ...current, [record.id]: '' }));
    } catch (clarifyError) {
      setError(clarifyError instanceof Error ? clarifyError.message : 'Unable to submit clarification.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 text-[#F7F2FF] sm:p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-violet-400/15 bg-[#1B132B] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3 text-violet-200">
            <Target size={21} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Agenda alignment</h1>
            <p className="mt-1 text-sm text-[#B8ACC9]">
              {isManager
                ? `Review daily updates for ${activeProject?.name ?? 'your selected project'}.`
                : 'See how your daily updates connect to assigned work and ask for help when you need it.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadRecords(true)}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-[#E4D9F2] hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {isManager && !activeProject ? (
        <div className="rounded-2xl border border-white/10 bg-[#1B132B] p-8 text-center text-sm text-[#B8ACC9]">
          Choose a project to review its agenda checks.
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#B8ACC9]">
          <LoaderCircle size={18} className="animate-spin" /> Loading agenda checks…
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#1B132B] p-8 text-center">
          <ShieldCheck className="mx-auto text-emerald-300" size={26} />
          <p className="mt-3 font-medium">No agenda drift to review</p>
          <p className="mt-1 text-sm text-[#B8ACC9]">
            New daily updates are checked automatically. Updates without an assigned task do not create false alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const isOwnManagerRecord = isManager && record.employee_id === user?.id;
            return (
            <article key={record.id} className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1B132B]">
              <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{record.task_title}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[record.alignment_status]}`}>
                      {statusLabels[record.alignment_status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#A99DBD]">
                    {isManager ? `${isOwnManagerRecord ? 'You' : record.employee_name} · ` : ''}
                    {record.task_priority} priority · due {record.task_due_date} · progress {record.progress_pct}%
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums">{record.alignment_score}</p>
                    <p className="text-[11px] text-[#A99DBD]">alignment / 100</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-medium tabular-nums">{record.confidence_score}%</p>
                    <p className="text-[11px] text-[#A99DBD]">confidence</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  {isManager && (
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#A99DBD]">Daily update</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#E4D9F2]">{record.daily_update_notes}</p>
                    </section>
                  )}
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#A99DBD]">Why this status</h3>
                    <p className="mt-2 text-sm leading-6 text-[#E4D9F2]">{record.drift_explanation}</p>
                  </section>
                  {record.reported_blockers && (
                    <section className="rounded-xl border border-amber-300/15 bg-amber-500/[0.06] p-3">
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                        <AlertTriangle size={14} /> Reported blocker
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-[#E4D9F2]">{record.reported_blockers}</p>
                    </section>
                  )}
                  {record.employee_clarification && (
                    <section className="rounded-xl border border-sky-300/15 bg-sky-500/[0.05] p-3">
                      <h3 className="text-xs font-semibold text-sky-200">Employee context</h3>
                      <p className="mt-1 text-sm leading-5 text-[#E4D9F2]">{record.employee_clarification}</p>
                    </section>
                  )}
                  {record.detected_mismatches.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#A99DBD]">Other signals</h3>
                      <ul className="mt-2 space-y-2">
                        {record.detected_mismatches.map((mismatch, index) => (
                          <li key={`${mismatch.kind}-${index}`} className="rounded-lg bg-white/[0.035] px-3 py-2 text-xs leading-5 text-[#D8CDEF]">
                            <span className="mr-2 font-semibold text-violet-200">{mismatch.kind.replaceAll('_', ' ')}</span>
                            {mismatch.evidence}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>

                <div className="space-y-4">
                  <section className="rounded-xl border border-violet-300/15 bg-violet-500/[0.05] p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-100">
                      <ListChecks size={16} /> {isOwnManagerRecord ? 'Your next steps' : 'Practical next steps'}
                    </h3>
                    {record.recommended_actions.length > 0 ? (
                      <ol className="mt-3 space-y-2">
                        {record.recommended_actions.map((action, index) => (
                          <li key={`${action}-${index}`} className="flex gap-2 text-sm leading-5 text-[#E4D9F2]">
                            <span className="mt-0.5 text-xs font-semibold text-violet-300">{index + 1}.</span>
                            {action}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-[#A99DBD]">
                        No specific next steps were generated. Add task details or provide clarification before acting.
                      </p>
                    )}
                  </section>

                  {isManager && !isOwnManagerRecord ? (
                    <section className="space-y-3">
                      <p className="text-xs text-[#A99DBD]">
                        Review: <span className="font-medium text-[#E4D9F2]">{record.manager_review_status.replaceAll('_', ' ')}</span>
                        {record.manager_feedback ? ` · ${record.manager_feedback}` : ''}
                      </p>
                      <textarea
                        value={feedback[record.id] ?? ''}
                        onChange={(event) => setFeedback((current) => ({ ...current, [record.id]: event.target.value }))}
                        rows={2}
                        maxLength={1500}
                        placeholder="Optional feedback for the employee"
                        className="w-full rounded-xl border border-white/10 bg-[#140E23] px-3 py-2 text-sm text-white outline-none placeholder:text-[#81758F] focus:border-violet-400/50"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === record.id}
                          onClick={() => void submitReview(record, 'ACKNOWLEDGED')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === record.id}
                          onClick={() => void submitReview(record, 'DISMISSED')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-medium text-[#D8CDEF] hover:bg-white/10 disabled:opacity-50"
                        >
                          <X size={14} /> Dismiss
                        </button>
                        {record.recovery_proposal_id && (
                          <a
                            href="/manager/recovery"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300/20 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/10"
                          >
                            Review recovery proposal <ArrowUpRight size={14} />
                          </a>
                        )}
                      </div>
                    </section>
                  ) : isOwnManagerRecord ? (
                    <section className="rounded-xl border border-white/[0.08] p-4">
                      <h3 className="text-sm font-semibold">Self-directed improvement</h3>
                      <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                        These suggestions are for your own task progress. No manager escalation or approval is needed.
                      </p>
                    </section>
                  ) : (
                    <section className="rounded-xl border border-white/[0.08] p-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <MessageSquare size={15} className="text-violet-200" /> Add context or clarify
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
                        Your note will be used to update this check. It will not change your task or assignment.
                      </p>
                      <textarea
                        value={clarifications[record.id] ?? ''}
                        onChange={(event) => setClarifications((current) => ({ ...current, [record.id]: event.target.value }))}
                        rows={2}
                        maxLength={1500}
                        placeholder="What task deliverable did this work support?"
                        className="mt-3 w-full rounded-xl border border-white/10 bg-[#140E23] px-3 py-2 text-sm text-white outline-none placeholder:text-[#81758F] focus:border-violet-400/50"
                      />
                      <button
                        type="button"
                        disabled={busyId === record.id || (clarifications[record.id] ?? '').trim().length < 5}
                        onClick={() => void submitClarification(record)}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
                      >
                        {busyId === record.id ? <LoaderCircle size={14} className="animate-spin" /> : <CircleHelp size={14} />}
                        Send clarification
                      </button>
                    </section>
                  )}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
