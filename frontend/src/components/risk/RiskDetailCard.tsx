
import React from 'react';
import type { RiskAnalysis } from '../../types';
import { RiskBadge } from '../common/RiskBadge';
import { formatIndianDateTime } from '../../utils/date';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Calendar,
  Users,
  Link2,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Activity,
  Gauge,
} from 'lucide-react';

interface RiskDetailCardProps {
  analysis: RiskAnalysis | null;
  onGenerateRecoveryPlan?: () => void;
  isGenerating?: boolean;
}

export const RiskDetailCard: React.FC<RiskDetailCardProps> = ({
  analysis,
  onGenerateRecoveryPlan,
  isGenerating = false,
}) => {
  if (!analysis) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
          <Activity className="h-6 w-6 text-violet-300" />
        </div>

        <p className="text-sm font-semibold text-[#FAF8FF]">
          No risk evaluation available
        </p>

        <p className="mt-1 text-xs text-[#A99DBD]">
          Run the risk engine to evaluate this project.
        </p>
      </div>
    );
  }

  const isInsufficient = analysis.risk_level === 'INSUFFICIENT_DATA';
  const isHighRisk = analysis.risk_level === 'HIGH';
  const isMediumRisk = analysis.risk_level === 'MEDIUM';

  const riskTheme = isHighRisk
    ? {
        container:
          'border-rose-400/20 bg-gradient-to-br from-rose-500/[0.12] to-[#19112B]',
        iconContainer: 'bg-rose-500/10',
        icon: 'text-rose-300',
        indicator: 'bg-rose-400',
        label: 'High delivery risk',
        Icon: AlertOctagon,
      }
    : isMediumRisk
      ? {
          container:
            'border-amber-400/20 bg-gradient-to-br from-amber-500/[0.10] to-[#19112B]',
          iconContainer: 'bg-amber-500/10',
          icon: 'text-amber-300',
          indicator: 'bg-amber-400',
          label: 'Moderate delivery risk',
          Icon: AlertTriangle,
        }
      : isInsufficient
        ? {
            container: 'border-white/10 bg-[#19112B]',
            iconContainer: 'bg-slate-500/10',
            icon: 'text-slate-300',
            indicator: 'bg-slate-400',
            label: 'More data required',
            Icon: Info,
          }
        : {
            container:
              'border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-[#19112B]',
            iconContainer: 'bg-emerald-500/10',
            icon: 'text-emerald-300',
            indicator: 'bg-emerald-400',
            label: 'Healthy delivery status',
            Icon: ShieldCheck,
          };

  const RiskIcon = riskTheme.Icon;

  const title = isInsufficient
    ? 'Insufficient Project Data for Reliable Forecast'
    : isHighRisk
      ? 'Delivery Risk Detected on Critical Milestones'
      : isMediumRisk
        ? 'Potential Delivery Headwinds Observed'
        : 'Project Velocity Healthy and On Track';

  const description = isInsufficient
    ? 'Complete task estimates and resource assignments to improve the reliability of the project risk assessment.'
    : isHighRisk
      ? 'Multiple risk triggers may threaten delivery dates. Review the affected tasks and contributing factors before deciding on corrective actions.'
      : isMediumRisk
        ? 'Some delivery indicators require attention. Review the triggered rules to identify potential bottlenecks early.'
        : 'The current backend evaluation indicates that delivery parameters are within the configured safe thresholds.';

  const evidence = analysis.evidence_json;
  const missingFlags = analysis.missing_data_flags ?? [];
  const triggeredRules = analysis.triggered_rules ?? [];

  return (
    <div className="space-y-6 text-[#FAF8FF]">
      {/* Risk Summary Banner */}
      <section
        className={`rounded-2xl border p-5 transition-colors sm:p-6 ${riskTheme.container}`}
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${riskTheme.iconContainer}`}
              >
                <RiskIcon className={`h-5 w-5 ${riskTheme.icon}`} />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge
                    level={analysis.risk_level}
                    score={analysis.score}
                    size="lg"
                  />

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#130D21]/70 px-2.5 py-1 text-[10px] font-semibold text-[#B7ADC9]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${riskTheme.indicator}`}
                    />
                    {riskTheme.label}
                  </span>
                </div>

                <p className="text-[11px] text-[#A99DBD]">
                  Evaluated{' '}
                  {analysis.created_at
                    ? formatIndianDateTime(analysis.created_at)
                    : 'Date unavailable'}
                </p>
              </div>
            </div>

            <h2 className="mt-5 text-lg font-bold leading-snug text-[#FAF8FF] sm:text-xl">
              {title}
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B7ADC9]">
              {description}
            </p>
          </div>

          {onGenerateRecoveryPlan && (
            <button
              type="button"
              onClick={onGenerateRecoveryPlan}
              disabled={isGenerating}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-violet-950/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              <Sparkles
                className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`}
              />
              <span>
                {isGenerating
                  ? 'Generating Recovery Plan...'
                  : 'Generate recovery proposal'}
              </span>
            </button>
          )}
        </div>

        {/* Summary Details */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <Gauge className="h-4 w-4 text-violet-300" />
            </div>

            <div>
              <p className="text-[10px] text-[#A99DBD]">Risk Level</p>
              <p className="mt-0.5 text-xs font-semibold text-[#FAF8FF]">
                {analysis.risk_level.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-sky-500/10 p-2">
              <Activity className="h-4 w-4 text-sky-300" />
            </div>

            <div>
              <p className="text-[10px] text-[#A99DBD]">
                Triggered Rules
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#FAF8FF]">
                {triggeredRules.length} rule
                {triggeredRules.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <HelpCircle className="h-4 w-4 text-amber-300" />
            </div>

            <div>
              <p className="text-[10px] text-[#A99DBD]">
                Data Warnings
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#FAF8FF]">
                {missingFlags.length} warning
                {missingFlags.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Missing Data Warnings */}
      {missingFlags.length > 0 && (
        <section className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <HelpCircle className="h-4 w-4 text-amber-300" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#FAF8FF]">
                Missing Information
              </h3>
              <p className="mt-0.5 text-xs text-[#A99DBD]">
                {missingFlags.length} item
                {missingFlags.length === 1 ? '' : 's'} may affect
                assessment reliability.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {missingFlags.map((flag, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-[#130D21]/60 p-3"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                <p className="text-xs leading-5 text-[#B7ADC9]">
                  {flag.message}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Triggered Rule Evaluations */}
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-[#FAF8FF]">
              Triggered Rule Evaluations
            </h3>
            <p className="mt-1 text-xs text-[#A99DBD]">
              Understand which backend rules contributed to this assessment.
            </p>
          </div>

          <span className="w-fit rounded-lg border border-white/[0.08] bg-[#19112B] px-2.5 py-1.5 text-xs font-semibold text-[#B7ADC9]">
            {triggeredRules.length} triggered
          </span>
        </div>

        {triggeredRules.length === 0 ? (
          <div className="rounded-2xl border border-emerald-400/15 bg-[#19112B] p-7 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>

            <h4 className="text-sm font-semibold text-[#FAF8FF]">
              No risk rules triggered
            </h4>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#A99DBD]">
              The current evaluation found no rules exceeding their configured
              risk thresholds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {triggeredRules.map((rule) => {
              const isCritical = rule.severity === 'CRITICAL';
              const isHigh = rule.severity === 'HIGH';

              const severityStyle = isCritical
                ? {
                    border: 'border-rose-400/20',
                    badge:
                      'border-rose-400/20 bg-rose-500/10 text-rose-300',
                    dot: 'bg-rose-400',
                    icon: 'text-rose-300',
                  }
                : isHigh
                  ? {
                      border: 'border-amber-400/20',
                      badge:
                        'border-amber-400/20 bg-amber-500/10 text-amber-300',
                      dot: 'bg-amber-400',
                      icon: 'text-amber-300',
                    }
                  : {
                      border: 'border-white/[0.08]',
                      badge:
                        'border-violet-400/20 bg-violet-500/10 text-violet-300',
                      dot: 'bg-violet-400',
                      icon: 'text-violet-300',
                    };

              return (
                <article
                  key={rule.rule_id}
                  className={`rounded-2xl border bg-[#19112B] p-4 transition-all hover:bg-[#1D1431] ${severityStyle.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${severityStyle.dot}`}
                      />

                      <span
                        className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${severityStyle.badge}`}
                      >
                        {rule.severity}
                      </span>
                    </div>

                    <span className="max-w-[45%] break-all text-right font-mono text-[10px] text-[#A99DBD]">
                      {rule.rule_id}
                    </span>
                  </div>

                  <h4 className="mt-3 text-sm font-semibold leading-5 text-[#FAF8FF]">
                    {rule.rule_name}
                  </h4>

                  <p className="mt-2 text-xs leading-5 text-[#B7ADC9]">
                    {rule.description}
                  </p>

                  {/* Affected Tasks */}
                  {rule.affected_task_ids &&
                    rule.affected_task_ids.length > 0 && (
                      <div className="mt-4 border-t border-white/[0.06] pt-3">
                        <div className="mb-2 flex items-center gap-2 text-xs text-[#A99DBD]">
                          <Link2
                            className={`h-3.5 w-3.5 ${severityStyle.icon}`}
                          />
                          <span className="font-medium">
                            Affected Tasks
                          </span>
                          <span className="rounded-md bg-[#130D21] px-1.5 py-0.5 text-[10px]">
                            {rule.affected_task_ids.length}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {rule.affected_task_ids.map((id) => (
                            <span
                              key={id}
                              className="rounded-md border border-white/[0.06] bg-[#130D21] px-2 py-1 font-mono text-[10px] text-[#D5CBE5]"
                            >
                              #{id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Deterministic Engine Evidence */}
      {evidence && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/10 p-2.5">
              <Activity className="h-5 w-5 text-violet-300" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#FAF8FF]">
                Engine Evidence
              </h3>
              <p className="mt-0.5 text-xs text-[#A99DBD]">
                Metrics used by the deterministic risk evaluation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-[#130D21] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">
                  Total Active Tasks
                </span>
                <Users className="h-4 w-4 text-violet-300" />
              </div>

              <p className="mt-3 text-2xl font-bold tabular-nums text-[#FAF8FF]">
                {evidence.total_tasks ?? 0}
              </p>

              <p className="mt-1 text-[10px] text-[#A99DBD]">
                Tasks included in the analysis
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#130D21] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">
                  Blocked Bottlenecks
                </span>

                <AlertOctagon
                  className={`h-4 w-4 ${
                    (evidence.blocked_tasks ?? 0) > 0
                      ? 'text-rose-300'
                      : 'text-emerald-300'
                  }`}
                />
              </div>

              <p
                className={`mt-3 text-2xl font-bold tabular-nums ${
                  (evidence.blocked_tasks ?? 0) > 0
                    ? 'text-rose-300'
                    : 'text-[#FAF8FF]'
                }`}
              >
                {evidence.blocked_tasks ?? 0}
              </p>

              <p className="mt-1 text-[10px] text-[#A99DBD]">
                Tasks currently blocked
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#130D21] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">
                  Leave Conflicts
                </span>

                <Calendar
                  className={`h-4 w-4 ${
                    (evidence.tasks_with_leave_conflict ?? 0) > 0
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}
                />
              </div>

              <p
                className={`mt-3 text-2xl font-bold tabular-nums ${
                  (evidence.tasks_with_leave_conflict ?? 0) > 0
                    ? 'text-amber-300'
                    : 'text-[#FAF8FF]'
                }`}
              >
                {evidence.tasks_with_leave_conflict ?? 0}
              </p>

              <p className="mt-1 text-[10px] text-[#A99DBD]">
                Tasks overlapping planned leave
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#130D21] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A99DBD]">
                  Dependency Conflicts
                </span>
                <Link2 className="h-4 w-4 text-sky-300" />
              </div>

              <p className="mt-3 text-2xl font-bold tabular-nums text-[#FAF8FF]">
                {evidence.dependency_conflicts ?? 0}
              </p>

              <p className="mt-1 text-[10px] text-[#A99DBD]">
                Conflicting task dependencies
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Explainability Note */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#130D21] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />

        <p className="text-xs leading-5 text-[#A99DBD]">
          <span className="font-semibold text-[#D5CBE5]">
            Explainable assessment:
          </span>{' '}
          Risk levels, triggered rules, and evidence metrics reflect the
          backend analysis. Review the contributing factors before approving
          any recovery proposal.
        </p>
      </div>
    </div>
  );
};
