import React, { useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Circle, LoaderCircle, Table2 } from 'lucide-react';
import { niceTicks } from '../../utils/planning';

/*
 * Lightweight SVG charts for the dark dashboard surface (#19112B).
 * Colors were checked with the data-viz palette validator against that
 * surface; status colors always ship with an icon and a text label.
 */
export const CHART_COLORS = {
  neutral: '#b8aecb', // to do / planned
  progress: '#3987e5', // in progress / actual / series 1
  critical: '#d03b3b', // blocked / high risk
  good: '#0ca30c', // completed / low risk
  warning: '#fab219', // medium risk
  serious: '#ec835a', // overdue / over capacity
  grid: 'rgba(255,255,255,0.07)',
  axis: 'rgba(255,255,255,0.16)',
  muted: '#8f84a3',
  text: '#d8cfe7',
  today: '#c4b5fd',
};

// ---------------------------------------------------------------------------
// Card shell with loading / empty / error states and a table view toggle
// ---------------------------------------------------------------------------

interface ChartCardProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string | null;
  table?: React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  isLoading,
  error,
  emptyMessage,
  table,
  footnote,
  className = '',
  children,
}) => {
  const [showTable, setShowTable] = useState(false);
  const canShowTable = Boolean(table) && !isLoading && !error && !emptyMessage;

  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#FAF8FF]">{title}</h3>
          {description && <p className="mt-1 text-xs leading-5 text-[#A99DBD]">{description}</p>}
        </div>
        {canShowTable && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-[#B7ADC9] transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300"
          >
            <Table2 className="h-3.5 w-3.5" />
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label={`Loading ${title}`}>
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.06]" />
          </div>
        ) : error ? (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.07] p-3 text-xs leading-5 text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : emptyMessage ? (
          <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs leading-5 text-[#A99DBD]">
            {emptyMessage}
          </div>
        ) : showTable ? (
          <div className="max-h-72 overflow-auto">{table}</div>
        ) : (
          children
        )}
      </div>

      {footnote && !isLoading && !error && (
        <div className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-5 text-[#8f84a3]">{footnote}</div>
      )}
    </section>
  );
};

export const DataTable: React.FC<{ columns: string[]; rows: (string | number)[][]; caption: string }> = ({
  columns,
  rows,
  caption,
}) => (
  <table className="w-full text-left text-xs">
    <caption className="sr-only">{caption}</caption>
    <thead>
      <tr className="border-b border-white/10 text-[#A99DBD]">
        {columns.map((c) => (
          <th key={c} scope="col" className="py-1.5 pr-3 font-medium">{c}</th>
        ))}
      </tr>
    </thead>
    <tbody className="tabular-nums">
      {rows.map((row, i) => (
        <tr key={i} className="border-b border-white/[0.05] text-[#D8CFE7]">
          {row.map((cell, j) => (
            <td key={j} className="py-1.5 pr-3">{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const Tooltip: React.FC<{ x: number; y: number; containerWidth: number; children: React.ReactNode }> = ({
  x,
  y,
  containerWidth,
  children,
}) => {
  const flip = x > containerWidth * 0.62;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-white/10 bg-[#0F0A1A]/95 px-3 py-2 text-xs text-[#FAF8FF] shadow-xl"
      style={{ left: flip ? undefined : x + 12, right: flip ? containerWidth - x + 12 : undefined, top: Math.max(0, y - 8) }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Status breakdown: one stacked bar + legend (part-to-whole of a small set)
// ---------------------------------------------------------------------------

export interface StatusSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}

export const StatusBreakdown: React.FC<{ segments: StatusSegment[]; unit: string }> = ({ segments, unit }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const [active, setActive] = useState<string | null>(null);
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {visible.map((s) => (
          <div
            key={s.key}
            className="h-full transition-opacity first:rounded-l last:rounded-r"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
              opacity: active && active !== s.key ? 0.35 : 1,
            }}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            title={`${s.label}: ${s.value} ${unit}`}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {segments.map((s) => (
          <li
            key={s.key}
            className="flex items-center justify-between gap-2 text-xs"
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="flex min-w-0 items-center gap-2 text-[#D8CFE7]">
              <span style={{ color: s.color }} className="shrink-0">{s.icon}</span>
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tabular-nums text-[#FAF8FF]">
              {s.value}
              <span className="ml-1 text-[#8f84a3]">{total ? `${Math.round((s.value / total) * 100)}%` : ''}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const statusIcon = {
  todo: <Circle className="h-3.5 w-3.5" />,
  progress: <LoaderCircle className="h-3.5 w-3.5" />,
  blocked: <AlertTriangle className="h-3.5 w-3.5" />,
  done: <CheckCircle2 className="h-3.5 w-3.5" />,
};

// ---------------------------------------------------------------------------
// Line chart (change over time) with crosshair tooltip
// ---------------------------------------------------------------------------

export interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  yMax?: number;
  yFormat?: (v: number) => string;
  height?: number;
  ariaLabel: string;
  tooltipExtra?: (index: number) => React.ReactNode;
}

export const LineChart: React.FC<LineChartProps> = ({
  labels,
  series,
  yMax,
  yFormat = (v) => String(v),
  height = 180,
  ariaLabel,
  tooltipExtra,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const pad = { top: 10, right: 12, bottom: 24, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = yMax ?? Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1];
  const n = labels.length;
  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;

  const paths = series.map((s) => {
    let d = '';
    s.values.forEach((v, i) => {
      if (v === null) return;
      d += `${d && s.values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return d;
  });

  const labelEvery = Math.max(1, Math.ceil(n / 6));

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - pad.left) / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const containerWidth = ref.current?.clientWidth ?? width;
  const scale = containerWidth / width;

  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART_COLORS.axis : CHART_COLORS.grid} />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill={CHART_COLORS.muted} className="tabular-nums">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {labels.map((label, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="10" fill={CHART_COLORS.muted}>
              {label}
            </text>
          ) : null
        )}
        {series.map((s, si) => (
          <path
            key={s.name}
            d={paths[si]}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) => {
          const last = s.values.map((v, i) => [v, i] as const).filter(([v]) => v !== null).pop();
          if (!last) return null;
          return (
            <circle key={`${s.name}-end`} cx={x(last[1])} cy={y(last[0] as number)} r={3.5} fill={s.color} stroke="#19112B" strokeWidth={2} />
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="rgba(255,255,255,0.25)" />
            {series.map((s) =>
              s.values[hover] !== null ? (
                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] as number)} r={4.5} fill={s.color} stroke="#19112B" strokeWidth={2} />
              ) : null
            )}
          </g>
        )}
      </svg>

      {hover !== null && (
        <Tooltip x={x(hover) * scale} y={pad.top * scale} containerWidth={containerWidth}>
          <p className="mb-1 font-semibold">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-[#D8CFE7]">
                <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="tabular-nums">{s.values[hover] === null ? '—' : yFormat(s.values[hover] as number)}</span>
            </p>
          ))}
          {tooltipExtra?.(hover)}
        </Tooltip>
      )}

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#B7ADC9]">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <svg width="16" height="6" aria-hidden="true">
                <line x1="0" x2="16" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} />
              </svg>
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Horizontal bars with an optional capacity marker (magnitude by entity)
// ---------------------------------------------------------------------------

export interface CapacityRow {
  key: string;
  label: string;
  value: number;
  capacity?: number | null;
  compareValue?: number | null; // optional "before" value shown as a thin ghost bar
  note?: string;
  over?: boolean;
}

export const CapacityBars: React.FC<{
  rows: CapacityRow[];
  unit: string;
  valueLabel: string;
  capacityLabel?: string;
  compareLabel?: string;
}> = ({ rows, unit, valueLabel, capacityLabel, compareLabel }) => {
  const id = useId();
  const max = Math.max(1, ...rows.flatMap((r) => [r.value, r.capacity ?? 0, r.compareValue ?? 0]));
  const top = niceTicks(max, 4).slice(-1)[0];
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <div>
      <ul className="space-y-3.5" aria-describedby={`${id}-legend`}>
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-3 text-xs sm:grid-cols-[minmax(0,9rem)_1fr]">
            <span className="truncate text-[#D8CFE7]" title={row.label}>{row.label}</span>
            <div
              className="group relative"
              title={`${row.label}: ${row.value.toFixed(1)}${unit} ${valueLabel.toLowerCase()}${
                row.capacity != null ? `, ${row.capacity.toFixed(1)}${unit} ${capacityLabel?.toLowerCase() ?? 'capacity'}` : ''
              }${row.compareValue != null ? `, ${compareLabel?.toLowerCase() ?? 'before'} ${row.compareValue.toFixed(1)}${unit}` : ''}`}
            >
              <div className="relative h-5">
                {row.compareValue != null && (
                  <div
                    className="absolute top-0 h-1.5 rounded-r-[4px]"
                    style={{ width: pct(row.compareValue), background: CHART_COLORS.neutral, opacity: 0.55 }}
                  />
                )}
                <div
                  className="absolute rounded-r-[4px]"
                  style={{
                    top: row.compareValue != null ? 8 : 3,
                    height: row.compareValue != null ? 10 : 14,
                    width: pct(row.value),
                    minWidth: row.value > 0 ? 2 : 0,
                    background: row.over ? CHART_COLORS.serious : CHART_COLORS.progress,
                  }}
                />
                {row.capacity != null && (
                  <div
                    className="absolute -top-0.5 h-6 w-[2px] rounded bg-[#FAF8FF]"
                    style={{ left: `calc(${pct(row.capacity)} - 1px)` }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-[#A99DBD]">
                <span className="text-[#FAF8FF]">{row.value.toFixed(1)}{unit}</span>
                {row.capacity != null && <span>of {row.capacity.toFixed(1)}{unit}</span>}
                {row.compareValue != null && <span>(was {row.compareValue.toFixed(1)}{unit})</span>}
                {row.over && (
                  <span className="inline-flex items-center gap-1 text-[#ec835a]">
                    <AlertTriangle className="h-3 w-3" /> Over capacity
                  </span>
                )}
                {row.note && <span className="truncate">{row.note}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div id={`${id}-legend`} className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#B7ADC9]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: CHART_COLORS.progress }} />
          {valueLabel}
        </span>
        {capacityLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-[2px] rounded bg-[#FAF8FF]" />
            {capacityLabel}
          </span>
        )}
        {compareLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-3 rounded-sm" style={{ background: CHART_COLORS.neutral, opacity: 0.55 }} />
            {compareLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export const useChartLabels = (dates: string[]) =>
  useMemo(
    () =>
      dates.map((d) =>
        new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })
      ),
    [dates]
  );
