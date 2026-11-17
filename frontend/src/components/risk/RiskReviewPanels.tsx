import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { RiskHistoryItem, RiskSuggestion } from '../../types';
import { formatIndianDateTime } from '../../utils/date';
import { triggerLabel } from './RiskExplanation';
import { Check, History, Inbox, Quote, X } from 'lucide-react';

const SUGGESTION_TEXT: Record<RiskSuggestion['kind'], (s: RiskSuggestion) => string> = {
  DEPENDENCY: (s) =>
    `'${s.task_title}' may depend on '${s.related_task_title ?? `task #${s.related_task_id}`}'. Accepting adds this dependency.`,
  BLOCKER: (s) => `'${s.task_title}' may be blocked. Accepting marks the task as blocked.`,
  SCOPE_CHANGE: (s) =>
    `New work may have been found on '${s.task_title}'. Accepting records it; update the estimate on the task if needed.`,
};

/**
 * Items the AI extracted from daily updates that would change project data.
 * Nothing is applied until the manager accepts it.
 */
export const RiskSuggestionsPanel: React.FC<{ projectId: number; onChanged?: () => void }> = ({
  projectId,
  onChanged,
}) => {
  const [items, setItems] = useState<RiskSuggestion[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.getRiskSuggestions(projectId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load suggestions.');
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (item: RiskSuggestion, decision: 'ACCEPT' | 'REJECT') => {
    setBusyId(item.id);
    setError(null);
    try {
      await api.reviewRiskSuggestion(item.id, decision);
      setItems((current) => current.filter((s) => s.id !== item.id));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="rounded-lg bg-sky-500/10 p-2">
          <Inbox className="h-4 w-4 text-sky-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#FAF8FF]">Needs your confirmation</h3>
          <p className="mt-0.5 text-xs text-[#A99DBD]">
            Found in daily updates. They do not affect risk until you accept them.
          </p>
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}

      {items.length === 0 ? (
        <p className="text-xs text-[#A99DBD]">Nothing waiting for review.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-white/[0.06] bg-[#130D21]/70 p-3">
              <p className="text-xs leading-5 text-[#D5CBE5]">{SUGGESTION_TEXT[item.kind](item)}</p>
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] italic leading-5 text-[#A99DBD]">
                <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  "{item.evidence}"{item.employee_name ? ` — ${item.employee_name}` : ''}, {item.update_date}
                </span>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void review(item, 'ACCEPT')}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void review(item, 'REJECT')}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-[11px] font-semibold text-[#D5CBE5] transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Recent risk changes, newest first, each with what caused it. */
export const RiskHistoryPanel: React.FC<{ projectId: number; refreshKey?: number }> = ({
  projectId,
  refreshKey = 0,
}) => {
  const [rows, setRows] = useState<RiskHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getRiskHistory(projectId, 10)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="rounded-lg bg-violet-500/10 p-2">
          <History className="h-4 w-4 text-violet-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#FAF8FF]">Risk history</h3>
          <p className="mt-0.5 text-xs text-[#A99DBD]">A new entry is recorded only when the result changes.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[#A99DBD]">No history yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => {
            const delta = row.score_delta;
            const deltaClass =
              delta == null ? 'text-[#A99DBD]' : delta > 0 ? 'text-rose-300' : delta < 0 ? 'text-emerald-300' : 'text-[#A99DBD]';
            return (
              <li key={row.id} className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-[#130D21]/60 p-3">
                <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-[#FAF8FF]">
                  {row.score.toFixed(1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#D5CBE5]">
                    <span className={`font-mono ${deltaClass}`}>
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                    </span>{' '}
                    · {row.risk_level.replace(/_/g, ' ')} · {triggerLabel(row.trigger_type)}
                  </p>
                  {row.change_explanation?.changes?.[0] && (
                    <p className="mt-0.5 truncate text-[11px] text-[#A99DBD]" title={row.change_explanation.changes[0].text}>
                      {row.change_explanation.changes[0].text}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-[#7F7393]">{formatIndianDateTime(row.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
