import React from 'react';
import type { RiskAnalysis, RiskFactor } from '../../types';
import { IconArrowDownRight, IconArrowUpRight, IconLayers, IconListChecks, IconMinus } from '../../icons';

const TRIGGER_LABELS: Record<string, string> = {
  INITIAL: 'First evaluation',
  MANUAL: 'Manual run',
  DAILY_UPDATE: 'Daily update',
  TASK_CHANGE: 'Task change',
  DEPENDENCY_CHANGE: 'Dependency change',
  BLOCKER_CHANGE: 'Blocker change',
  LEAVE_CHANGE: 'Leave decision',
  SUGGESTION_REVIEWED: 'Suggestion reviewed',
  RECOVERY_APPLIED: 'Recovery plan applied',
  RECOVERY_WORKFLOW: 'Recovery planning',
  CONFIG_CHANGE: 'Scoring config change',
  DAILY_JOB: 'Daily recalculation',
};

export const triggerLabel = (trigger?: string | null): string =>
  (trigger && TRIGGER_LABELS[trigger]) || 'Evaluation';

const deltaStyle = (delta: number) =>
  delta > 0
    ? { text: 'text-rose-300', Icon: IconArrowUpRight }
    : delta < 0
      ? { text: 'text-emerald-300', Icon: IconArrowDownRight }
      : { text: 'text-[#A99DBD]', Icon: IconMinus };

/** "Risk 34 → 41 (+7.0)" plus the factor changes that caused it. */
export const RiskChangePanel: React.FC<{ analysis: RiskAnalysis }> = ({ analysis }) => {
  const change = analysis.change_explanation;
  if (!change?.headline) return null;
  const changes = change.changes ?? [];
  const delta = analysis.score_delta ?? 0;
  const { text, Icon } = deltaStyle(delta);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-violet-500/10 p-2">
            <Icon className={`h-4 w-4 ${text}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#FAF8FF]">What changed</h3>
            <p className="mt-0.5 text-xs text-[#A99DBD]">{change.headline}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg border border-white/[0.08] bg-[#130D21] px-2.5 py-1 text-[10px] font-semibold text-[#B7ADC9]">
          {triggerLabel(analysis.trigger_type)}
        </span>
      </div>

      {changes.length === 0 ? (
        <p className="text-xs text-[#A99DBD]">No factor moved by 0.1 points or more.</p>
      ) : (
        <ul className="space-y-2">
          {changes.map((item) => {
            const style = deltaStyle(item.delta);
            return (
              <li
                key={item.key}
                className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-[#130D21]/60 p-3"
              >
                <span className={`mt-0.5 w-12 shrink-0 text-right font-mono text-xs font-semibold tabular-nums ${style.text}`}>
                  {item.delta > 0 ? '+' : ''}
                  {item.delta.toFixed(1)}
                </span>
                <p className="text-xs leading-5 text-[#B7ADC9]">
                  <span className="font-semibold text-[#D5CBE5]">{item.label}:</span>{' '}
                  {item.text.replace(/^[^:]+:\s*/, '')}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const FactorRow: React.FC<{ factor: RiskFactor }> = ({ factor }) => {
  const share = factor.weight > 0 ? Math.min(100, (factor.contribution / factor.weight) * 100) : 0;
  const bar =
    share >= 66 ? 'bg-rose-400' : share >= 33 ? 'bg-amber-400' : share > 0 ? 'bg-violet-400' : 'bg-white/10';

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#130D21] p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-[#FAF8FF]">{factor.label}</span>
        <span className="font-mono text-xs tabular-nums text-[#D5CBE5]">
          {factor.contribution.toFixed(1)}
          <span className="text-[#A99DBD]"> / {factor.weight.toFixed(0)}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${share}%` }} />
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[#B7ADC9]">{factor.summary}</p>
      {factor.contributors.length > 1 && (
        <ul className="mt-1.5 space-y-0.5">
          {factor.contributors.slice(1, 4).map((c) => (
            <li key={c.task_id} className="text-[10px] leading-4 text-[#A99DBD]">
              #{c.task_id} {c.task_title}: {c.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Five bounded factors that add up to the score; each is counted once. */
export const RiskFactorBreakdown: React.FC<{ analysis: RiskAnalysis }> = ({ analysis }) => {
  const factors = analysis.factor_breakdown ?? [];
  if (factors.length === 0) return null;
  const confidence = analysis.confidence?.label;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2.5">
            <IconLayers className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#FAF8FF]">Score breakdown</h3>
            <p className="mt-0.5 text-xs text-[#A99DBD]">
              Each cause is counted once. Contributions add up to {analysis.score.toFixed(1)}/100.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-[#A99DBD]">
          {confidence && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-[#130D21] px-2 py-1">
              <IconListChecks className="h-3 w-3" /> Data confidence: {confidence.toLowerCase()}
            </span>
          )}
          {analysis.config_version && (
            <span className="rounded-md border border-white/[0.08] bg-[#130D21] px-2 py-1 font-mono">
              config {analysis.config_version}
            </span>
          )}
          {analysis.as_of_date && (
            <span className="rounded-md border border-white/[0.08] bg-[#130D21] px-2 py-1 font-mono">
              as of {analysis.as_of_date}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {factors.map((factor) => (
          <FactorRow key={factor.key} factor={factor} />
        ))}
      </div>
    </section>
  );
};
