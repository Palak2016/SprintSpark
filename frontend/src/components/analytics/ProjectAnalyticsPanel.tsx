import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import type { PortfolioHealth, ProjectAnalytics } from '../../types';
import { formatIndianDate, formatIndianDateTime } from '../../utils/date';
import {
  CHART_COLORS,
  CapacityBars,
  ChartCard,
  DataTable,
  LineChart,
  StatusBreakdown,
  statusIcon,
  useChartLabels,
} from '../charts/Charts';

const REFRESH_MS = 60_000;

const STATUS_META = [
  { key: 'TODO', label: 'To do', color: CHART_COLORS.neutral, icon: statusIcon.todo },
  { key: 'IN_PROGRESS', label: 'In progress', color: CHART_COLORS.progress, icon: statusIcon.progress },
  { key: 'BLOCKED', label: 'Blocked', color: CHART_COLORS.critical, icon: statusIcon.blocked },
  { key: 'COMPLETED', label: 'Completed', color: CHART_COLORS.good, icon: statusIcon.done },
] as const;

const RISK_META: Record<string, { label: string; color: string }> = {
  HIGH: { label: 'High risk', color: CHART_COLORS.critical },
  MEDIUM: { label: 'Medium risk', color: CHART_COLORS.warning },
  LOW: { label: 'Low risk', color: CHART_COLORS.good },
  INSUFFICIENT_DATA: { label: 'Not enough data', color: CHART_COLORS.neutral },
  NOT_ANALYZED: { label: 'Not analysed yet', color: CHART_COLORS.muted },
};

export const ProjectAnalyticsPanel: React.FC<{ projectId: number }> = ({ projectId }) => {
  const [data, setData] = useState<ProjectAnalytics | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(
    async (initial: boolean) => {
      const requestId = ++requestRef.current;
      if (initial) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const [analytics, health] = await Promise.all([
          api.getProjectAnalytics(projectId),
          api.getPortfolioHealth().catch(() => null),
        ]);
        if (requestId !== requestRef.current) return;
        setData(analytics);
        setPortfolio(health);
        setError(null);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setError(err instanceof Error ? err.message : 'Could not load project analytics.');
      } finally {
        if (requestId === requestRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [projectId]
  );

  useEffect(() => {
    setData(null);
    void load(true);
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, REFRESH_MS);
    return () => {
      window.clearInterval(id);
      requestRef.current += 1;
    };
  }, [load]);

  const trendLabels = useChartLabels(data?.progress_trend.points.map((p) => p.date) ?? []);
  const riskLabels = useChartLabels(data?.risk_history.points.map((p) => p.created_at) ?? []);
  const loading = isLoading && !data;
  const shownError = data ? null : error;

  const projection = data?.projection;
  const summary = data?.summary;
  const daysVsTarget = projection?.business_days_vs_target ?? null;

  return (
    <section aria-labelledby="analytics-heading" className={`space-y-4 transition-opacity ${isRefreshing ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="analytics-heading" className="text-base font-semibold text-white">Delivery analytics</h2>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Calculated from this project's tasks, dependencies, approved leave, daily updates and risk analyses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={isRefreshing || loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#19112B] px-3 py-2 text-xs font-medium text-[#D8CDEF] transition hover:bg-[#211638] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && data && (
        <p role="status" className="text-xs text-rose-200">Last refresh failed ({error}). Showing the previous results.</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Can we finish on time? */}
        <ChartCard
          title="Projected completion"
          description="When the remaining work finishes if the team keeps its current assignments."
          isLoading={loading}
          error={shownError}
          emptyMessage={summary && summary.open_task_count === 0 ? 'All tasks are completed.' : null}
          footnote={
            projection && (
              <details>
                <summary className="cursor-pointer text-[#B7ADC9]">How this is calculated</summary>
                <p className="mt-2">{projection.method}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {projection.assumptions.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </details>
            )
          }
          table={
            projection && summary && (
              <DataTable
                caption="Projected completion"
                columns={['Measure', 'Value']}
                rows={[
                  ['Projected completion', formatIndianDate(projection.projected_completion)],
                  ['Target date', formatIndianDate(projection.target_end_date)],
                  ['Working days vs target', daysVsTarget ?? '—'],
                  ['Remaining effort (h)', summary.remaining_hours],
                  ['Team capacity to target (h)', summary.capacity_hours_until_target],
                  ['Open tasks without estimates', summary.unestimated_open_tasks],
                ]}
              />
            )
          }
        >
          {projection && summary && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-[11px] text-[#A99DBD]">Projected finish</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{formatIndianDate(projection.projected_completion)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#A99DBD]">Target</p>
                  <p className="mt-1 text-base font-medium text-[#D8CFE7]">{formatIndianDate(projection.target_end_date)}</p>
                </div>
                <p
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                    projection.feasible ? 'bg-[#0ca30c]/10 text-[#7ee2a0]' : 'bg-[#d03b3b]/10 text-rose-200'
                  }`}
                >
                  {projection.feasible ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {daysVsTarget === null
                    ? 'No target date'
                    : daysVsTarget > 0
                      ? `${daysVsTarget} working day${daysVsTarget === 1 ? '' : 's'} late`
                      : daysVsTarget === 0
                        ? 'Finishes on the target date'
                        : `${-daysVsTarget} working day${daysVsTarget === -1 ? '' : 's'} early`}
                </p>
              </div>
              <CapacityBars
                unit="h"
                valueLabel="Remaining effort"
                capacityLabel="Team capacity until target"
                rows={[{
                  key: 'total',
                  label: 'Whole team',
                  value: summary.remaining_hours,
                  capacity: summary.capacity_hours_until_target,
                  over: summary.remaining_hours > summary.capacity_hours_until_target,
                }]}
              />
              {summary.unestimated_open_tasks > 0 && (
                <p className="text-[11px] text-amber-200">
                  {summary.unestimated_open_tasks} open task(s) have no estimate, so remaining effort is understated.
                </p>
              )}
            </div>
          )}
        </ChartCard>

        {/* Where is the work? */}
        <ChartCard
          title="Task status"
          description="How the project's tasks are split by status right now."
          isLoading={loading}
          error={shownError}
          emptyMessage={summary && summary.task_count === 0 ? 'This project has no tasks yet.' : null}
          table={
            data && (
              <DataTable
                caption="Task status"
                columns={['Status', 'Tasks']}
                rows={STATUS_META.map((m) => [m.label, data.status_distribution.find((s) => s.status === m.key)?.count ?? 0])}
              />
            )
          }
        >
          {data && (
            <StatusBreakdown
              unit="tasks"
              segments={STATUS_META.map((m) => ({
                ...m,
                value: data.status_distribution.find((s) => s.status === m.key)?.count ?? 0,
              }))}
            />
          )}
        </ChartCard>

        {/* What is due or late? */}
        <ChartCard
          title="Overdue and upcoming deadlines"
          description={`Open tasks past their due date, then those due in the next ${data?.deadlines.window_days ?? 14} days.`}
          isLoading={loading}
          error={shownError}
          emptyMessage={
            data && data.deadlines.overdue.length === 0 && data.deadlines.upcoming.length === 0
              ? `Nothing is overdue or due in the next ${data.deadlines.window_days} days.`
              : null
          }
        >
          {data && (
            <ul className="max-h-72 space-y-2 overflow-auto pr-1">
              {[...data.deadlines.overdue, ...data.deadlines.upcoming].map((row) => {
                const overdue = row.days_from_today < 0;
                return (
                  <li key={row.task_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#130D21] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">{row.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#A99DBD]">
                        {row.assignee_name ?? 'Unassigned'} · {row.priority.toLowerCase()} priority
                        {row.is_blocked && ' · blocked'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium tabular-nums ${
                        overdue ? 'text-[#ec835a]' : 'text-[#D8CFE7]'
                      }`}
                    >
                      {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5 text-[#8f84a3]" />}
                      {overdue
                        ? `${-row.days_from_today}d overdue`
                        : row.days_from_today === 0
                          ? 'Due today'
                          : `Due in ${row.days_from_today}d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        {/* Who is overloaded? */}
        <ChartCard
          title="Workload by team member"
          description={
            data
              ? `Remaining estimated effort against available hours until ${formatIndianDate(data.workload.horizon_end)} (${data.workload.hours_per_day}h per working day, minus approved leave).`
              : undefined
          }
          isLoading={loading}
          error={shownError}
          emptyMessage={data && data.workload.members.length === 0 ? 'No team members are assigned to this project.' : null}
          table={
            data && (
              <DataTable
                caption="Workload by team member"
                columns={['Member', 'Open tasks', 'Remaining (h)', 'Capacity (h)', 'Leave days']}
                rows={data.workload.members.map((m) => [m.name, m.open_task_count, m.remaining_hours, m.user_id === null ? '—' : m.capacity_hours, m.leave_business_days])}
              />
            )
          }
        >
          {data && (
            <CapacityBars
              unit="h"
              valueLabel="Remaining effort"
              capacityLabel="Available hours"
              rows={data.workload.members.map((m) => ({
                key: String(m.user_id ?? 'unassigned'),
                label: m.name,
                value: m.remaining_hours,
                capacity: m.user_id === null ? null : m.capacity_hours,
                over: m.over_capacity,
                note: m.leave_business_days ? `${m.leave_business_days} leave day(s)` : undefined,
              }))}
            />
          )}
        </ChartCard>

        {/* Are we behind plan? */}
        <ChartCard
          title="Planned versus reported progress"
          description={
            data?.progress_trend.available
              ? `Based on ${data.progress_trend.tasks_included} of ${data.progress_trend.tasks_total} tasks that have daily updates, weighted by estimated hours.`
              : 'Progress over time, from employees’ daily updates.'
          }
          isLoading={loading}
          error={shownError}
          emptyMessage={data && !data.progress_trend.available ? data.progress_trend.reason : null}
          footnote={data?.progress_trend.available ? data.progress_trend.method : undefined}
          table={
            data?.progress_trend.available && (
              <DataTable
                caption="Planned versus reported progress"
                columns={['Date', 'Planned %', 'Reported %']}
                rows={data.progress_trend.points.map((p) => [formatIndianDate(p.date), p.planned_pct, p.actual_pct])}
              />
            )
          }
        >
          {data?.progress_trend.available && (
            <LineChart
              ariaLabel="Planned versus reported progress over time"
              labels={trendLabels}
              yMax={100}
              yFormat={(v) => `${v}%`}
              series={[
                { name: 'Planned', color: CHART_COLORS.neutral, dashed: true, values: data.progress_trend.points.map((p) => p.planned_pct) },
                { name: 'Reported', color: CHART_COLORS.progress, values: data.progress_trend.points.map((p) => p.actual_pct) },
              ]}
            />
          )}
        </ChartCard>

        {/* Is risk going up? */}
        <ChartCard
          title="Delay risk score over time"
          description="Score from each deterministic risk analysis run (0 = no triggered rules, 100 = maximum)."
          isLoading={loading}
          error={shownError}
          emptyMessage={data && !data.risk_history.available ? data.risk_history.reason : null}
          table={
            data?.risk_history.available && (
              <DataTable
                caption="Risk score history"
                columns={['Analysed', 'Score', 'Level']}
                rows={data.risk_history.points.map((p) => [formatIndianDateTime(p.created_at), p.score, RISK_META[p.risk_level]?.label ?? p.risk_level])}
              />
            )
          }
        >
          {data?.risk_history.available && (
            <LineChart
              ariaLabel="Delay risk score over time"
              labels={riskLabels}
              yMax={100}
              series={[{ name: 'Risk score', color: CHART_COLORS.progress, values: data.risk_history.points.map((p) => p.score) }]}
              tooltipExtra={(i) => (
                <p className="mt-1 text-[#B7ADC9]">{RISK_META[data.risk_history.points[i].risk_level]?.label ?? data.risk_history.points[i].risk_level}</p>
              )}
            />
          )}
        </ChartCard>
      </div>

      {portfolio && portfolio.projects.length > 1 && (
        <ChartCard
          title="Delay risk across your projects"
          description="Latest risk analysis for each project you manage."
          table={
            <DataTable
              caption="Delay risk across projects"
              columns={['Project', 'Risk', 'Score', 'Analysed']}
              rows={portfolio.projects.map((p) => [
                p.name,
                RISK_META[p.risk_level ?? 'NOT_ANALYZED']?.label ?? p.risk_level ?? '',
                p.risk_score ?? '—',
                p.analyzed_at ? formatIndianDate(p.analyzed_at) : '—',
              ])}
            />
          }
        >
          <StatusBreakdown
            unit="projects"
            segments={portfolio.distribution
              .filter((d) => d.count > 0 || ['HIGH', 'MEDIUM', 'LOW'].includes(d.risk_level))
              .map((d) => ({
                key: d.risk_level,
                label: RISK_META[d.risk_level]?.label ?? d.risk_level,
                value: d.count,
                color: RISK_META[d.risk_level]?.color ?? CHART_COLORS.muted,
                icon: d.risk_level === 'HIGH' ? statusIcon.blocked : d.risk_level === 'LOW' ? statusIcon.done : statusIcon.todo,
              }))}
          />
        </ChartCard>
      )}
    </section>
  );
};

export default ProjectAnalyticsPanel;
