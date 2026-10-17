import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Flag, Info, LoaderCircle, Lock } from 'lucide-react';
import type { Task } from '../../types';
import {
  ZOOM_DAY_WIDTH,
  dependencyLinks,
  dependencyViolations,
  formatDayLabel,
  fromDay,
  isTaskBlocked,
  isWeekend,
  layoutBars,
  scheduleOrder,
  shiftDates,
  taskFlag,
  timelineRange,
  timelineTicks,
  toDay,
  todayInIndia,
  type TimelineZoom,
} from '../../utils/planning';
import { CHART_COLORS } from '../charts/Charts';

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 232;

type DragMode = 'move' | 'resize-start' | 'resize-end';

interface TaskTimelineProps {
  tasks: Task[];
  /** Every task in the project, used for dependency checks when filters hide some. */
  allTasks: Task[];
  onTaskClick: (task: Task) => void;
  canEdit: boolean;
  onDatesChange: (task: Task, dates: { start_date: string; due_date: string }) => Promise<void>;
  targetDate?: string | null;
}

const barColor = (task: Task) => {
  if (task.status === 'COMPLETED') return CHART_COLORS.good;
  if (isTaskBlocked(task)) return CHART_COLORS.critical;
  if (task.status === 'IN_PROGRESS') return CHART_COLORS.progress;
  return CHART_COLORS.neutral;
};

export const TaskTimeline: React.FC<TaskTimelineProps> = ({
  tasks,
  allTasks,
  onTaskClick,
  canEdit,
  onDatesChange,
  targetDate,
}) => {
  const [zoom, setZoom] = useState<TimelineZoom>(() => {
    try {
      const saved = localStorage.getItem('workpilot_timeline_zoom');
      return saved === 'day' || saved === 'week' || saved === 'month' ? saved : 'week';
    } catch {
      return 'week';
    }
  });
  const [drag, setDrag] = useState<{ taskId: number; mode: DragMode; originX: number; delta: number } | null>(null);
  const [pending, setPending] = useState<{ taskId: number; start_date: string; due_date: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('workpilot_timeline_zoom', zoom);
    } catch {
      /* storage unavailable */
    }
  }, [zoom]);

  const today = toDay(todayInIndia()) as number;
  const dayWidth = ZOOM_DAY_WIDTH[zoom];
  const ordered = useMemo(() => scheduleOrder(tasks), [tasks]);

  // Apply the drag preview or an in-flight save to the task being edited.
  const displayed = useMemo(
    () =>
      ordered.map((task) => {
        if (pending && pending.taskId === task.id) return { ...task, ...pending };
        if (drag && drag.taskId === task.id && drag.delta !== 0) return { ...task, ...shiftDates(task, drag.delta, drag.mode) };
        return task;
      }),
    [ordered, drag, pending]
  );

  const range = useMemo(() => {
    const base = timelineRange(ordered, today, zoom === 'day' ? 3 : 7);
    const target = toDay(targetDate ?? null);
    return target !== null ? { start: base.start, end: Math.max(base.end, target + 3) } : base;
  }, [ordered, today, zoom, targetDate]);

  const bars = useMemo(() => layoutBars(displayed, range, dayWidth), [displayed, range, dayWidth]);
  const links = useMemo(() => dependencyLinks(displayed, bars, ROW_HEIGHT), [displayed, bars]);
  const ticks = useMemo(() => timelineTicks(range, zoom, dayWidth), [range, zoom, dayWidth]);
  // Month labels; drop the range-start label when a new month begins right after it.
  const monthTicks = useMemo(() => {
    const all = timelineTicks(range, 'month', dayWidth);
    return all.filter((tick, i) => !(i === 0 && all[1] && all[1].x - tick.x < 120));
  }, [range, dayWidth]);
  const width = (range.end - range.start + 1) * dayWidth;
  const height = displayed.length * ROW_HEIGHT;
  const todayX = (today - range.start) * dayWidth;
  const target = toDay(targetDate ?? null);

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: Math.max(0, todayX - el.clientWidth / 3), behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToToday();
    // Only when the zoom level or project range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, range.start]);

  const page = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const commit = async (task: Task, dates: { start_date: string; due_date: string }) => {
    if (dates.start_date === task.start_date && dates.due_date === task.due_date) return;
    const issues = dependencyViolations(allTasks, task.id, dates.due_date);
    if (issues.length) {
      setMessage({
        tone: 'error',
        text: `Not saved: moving "${task.title}" to ${formatDayLabel(toDay(dates.due_date) as number, { day: 'numeric', month: 'short' })} breaks dependency order with ${issues
          .map((i) => `"${i.title}" (${i.relation})`)
          .join(', ')}.`,
      });
      return;
    }
    setPending({ taskId: task.id, ...dates });
    setMessage(null);
    try {
      await onDatesChange(task, dates);
      setMessage({ tone: 'info', text: `Saved new dates for "${task.title}".` });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: `Not saved: ${err instanceof Error ? err.message : 'the server rejected the change.'} The bar was moved back.`,
      });
    } finally {
      setPending(null);
    }
  };

  const onPointerDown = (event: React.PointerEvent, task: Task, mode: DragMode) => {
    if (!canEdit || pending || task.status === 'COMPLETED') return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    movedRef.current = false;
    setDrag({ taskId: task.id, mode, originX: event.clientX, delta: 0 });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const delta = Math.round((event.clientX - drag.originX) / dayWidth);
    if (Math.abs(event.clientX - drag.originX) > 3) movedRef.current = true;
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  };

  const onPointerUp = (task: Task) => {
    if (!drag) {
      // Read-only users (no drag started): a press is a click.
      onTaskClick(task);
      return;
    }
    const { delta, mode } = drag;
    setDrag(null);
    if (!movedRef.current) {
      onTaskClick(task);
      return;
    }
    if (delta !== 0) void commit(task, shiftDates(task, delta, mode));
  };

  const onKeyDown = (event: React.KeyboardEvent, task: Task) => {
    if (!canEdit || !event.altKey || task.status === 'COMPLETED') return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      void commit(task, shiftDates(task, delta, event.shiftKey ? 'resize-end' : 'move'));
    }
  };

  const zoomButton = (value: TimelineZoom, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setZoom(value)}
      aria-pressed={zoom === value}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        zoom === value ? 'bg-violet-600 text-white' : 'text-[#B7ADC9] hover:bg-white/5 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-[#19112B]/70 px-6 py-12 text-center text-sm text-[#B7ADC9]">
        No tasks match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#19112B]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#130D21] p-1" role="group" aria-label="Zoom level">
          {zoomButton('day', 'Day')}
          {zoomButton('week', 'Week')}
          {zoomButton('month', 'Month')}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => page(-1)} aria-label="Earlier dates" className="rounded-lg border border-white/10 p-1.5 text-[#B7ADC9] hover:bg-white/5 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={scrollToToday} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[#D8CFE7] hover:bg-white/5">
            <CalendarDays className="h-3.5 w-3.5" /> Today
          </button>
          <button type="button" onClick={() => page(1)} aria-label="Later dates" className="rounded-lg border border-white/10 p-1.5 text-[#B7ADC9] hover:bg-white/5 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="w-full text-[11px] text-[#8f84a3] sm:w-auto">
          {canEdit ? (
            <>Drag a bar to move it, drag its edges to change dates. Keyboard: Alt+Arrow moves a focused task by a day.</>
          ) : (
            <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Read-only: only managers can change dates.</span>
          )}
        </p>
      </div>

      {message && (
        <div
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`mx-3 mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 ${
            message.tone === 'error' ? 'border-rose-400/20 bg-rose-500/[0.08] text-rose-200' : 'border-white/10 bg-white/[0.03] text-[#D8CFE7]'
          }`}
        >
          {message.tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-[11px] underline">Dismiss</button>
        </div>
      )}

      <div className="flex">
        {/* Task labels */}
        <div className="shrink-0 border-r border-white/[0.06]" style={{ width: LABEL_WIDTH }}>
          <div className="flex items-end border-b border-white/[0.06] px-3 pb-2 text-[11px] font-medium text-[#A99DBD]" style={{ height: HEADER_HEIGHT }}>
            Task
          </div>
          {displayed.map((task) => {
            const flag = taskFlag(task, today);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onTaskClick(task)}
                className="flex w-full items-center gap-2 border-b border-white/[0.04] px-3 text-left hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-violet-300"
                style={{ height: ROW_HEIGHT }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white">{task.title}</span>
                  <span className="block truncate text-[10px] text-[#8f84a3]">
                    {task.assignee?.full_name ?? 'Unassigned'}
                  </span>
                </span>
                {flag === 'BLOCKED' && <span title="Blocked"><AlertTriangle className="h-3.5 w-3.5 text-[#d03b3b]" aria-label="Blocked" /></span>}
                {flag === 'OVERDUE' && <span className="text-[10px] font-semibold text-[#ec835a]">Overdue</span>}
                {task.priority === 'CRITICAL' && task.status !== 'COMPLETED' && (
                  <span title="Critical priority"><Flag className="h-3.5 w-3.5 text-[#fab219]" aria-label="Critical priority" /></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable chart */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto" onPointerMove={onPointerMove}>
          <div className="relative" style={{ width, minWidth: '100%' }}>
            {/* Date header */}
            <div className="sticky top-0 border-b border-white/[0.06] bg-[#19112B]" style={{ height: HEADER_HEIGHT }}>
              {zoom !== 'month' &&
                monthTicks.map((t) => (
                  <span key={`m-${t.day}`} className="absolute top-1.5 whitespace-nowrap pl-1 text-[10px] font-semibold text-[#D8CFE7]" style={{ left: t.x }}>
                    {formatDayLabel(t.day, { month: 'long', year: 'numeric' })}
                  </span>
                ))}
              {ticks.map((t) => (
                <span
                  key={t.day}
                  className={`absolute bottom-1.5 whitespace-nowrap pl-1 text-[10px] tabular-nums ${t.day === today ? 'font-semibold text-[#c4b5fd]' : 'text-[#8f84a3]'}`}
                  style={{ left: t.x }}
                >
                  {t.label}
                </span>
              ))}
            </div>

            <svg width={width} height={height} className="block" role="img" aria-label="Task timeline">
              <defs>
                <marker id="wp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#8f84a3" />
                </marker>
                <marker id="wp-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={CHART_COLORS.critical} />
                </marker>
              </defs>

              {/* Weekend shading and grid */}
              {zoom === 'day' &&
                Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i)
                  .filter(isWeekend)
                  .map((d) => <rect key={d} x={(d - range.start) * dayWidth} y={0} width={dayWidth} height={height} fill="rgba(255,255,255,0.025)" />)}
              {ticks.map((t) => (
                <line key={t.day} x1={t.x} x2={t.x} y1={0} y2={height} stroke={t.major ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.035)'} />
              ))}
              {displayed.map((_, row) => (
                <line key={row} x1={0} x2={width} y1={(row + 1) * ROW_HEIGHT} y2={(row + 1) * ROW_HEIGHT} stroke="rgba(255,255,255,0.04)" />
              ))}

              {/* Dependencies */}
              {links.map((link) => (
                <path
                  key={`${link.fromId}-${link.toId}`}
                  d={link.path}
                  fill="none"
                  stroke={link.conflict ? CHART_COLORS.critical : '#8f84a3'}
                  strokeWidth={1.5}
                  opacity={0.85}
                  markerEnd={`url(#${link.conflict ? 'wp-arrow-bad' : 'wp-arrow'})`}
                >
                  <title>{link.conflict ? 'Dependency conflict: prerequisite is due after this task' : 'Dependency'}</title>
                </path>
              ))}

              {/* Project target milestone */}
              {target !== null && target >= range.start && target <= range.end && (
                <g>
                  <line x1={(target - range.start + 1) * dayWidth} x2={(target - range.start + 1) * dayWidth} y1={0} y2={height} stroke={CHART_COLORS.warning} strokeWidth={1.5} strokeDasharray="4 4" />
                  <title>Project target date {targetDate}</title>
                </g>
              )}

              {/* Today */}
              <line x1={todayX + dayWidth / 2} x2={todayX + dayWidth / 2} y1={0} y2={height} stroke={CHART_COLORS.today} strokeWidth={2} />
            </svg>

            {/* Bars (HTML for pointer and keyboard interaction) */}
            <div className="absolute left-0" style={{ top: HEADER_HEIGHT, width, height }}>
              {bars.map((bar) => {
                const task = displayed[bar.row];
                const original = ordered[bar.row];
                const flag = taskFlag(task, today);
                const isPending = pending?.taskId === task.id;
                const isDragging = drag?.taskId === task.id;
                const editable = canEdit && task.status !== 'COMPLETED';
                const color = barColor(task);
                const label = `${task.title}: ${formatDayLabel(bar.startDay, { day: 'numeric', month: 'short' })} to ${formatDayLabel(bar.endDay, {
                  day: 'numeric',
                  month: 'short',
                })}, ${bar.endDay - bar.startDay + 1} day(s), ${task.progress_pct}% done${flag === 'BLOCKED' ? ', blocked' : ''}${flag === 'OVERDUE' ? ', overdue' : ''}`;
                return (
                  <div
                    key={task.id}
                    className="absolute"
                    style={{ left: bar.x, top: bar.row * ROW_HEIGHT + 10, width: Math.max(bar.width, 6), height: ROW_HEIGHT - 20 }}
                  >
                    <button
                      type="button"
                      aria-label={label}
                      title={label}
                      onPointerDown={(e) => onPointerDown(e, original, 'move')}
                      onPointerUp={() => onPointerUp(original)}
                      onClick={(e) => {
                        // Pointer interactions are handled above; keyboard Enter/Space lands here.
                        if (e.detail === 0) onTaskClick(original);
                      }}
                      onKeyDown={(e) => onKeyDown(e, original)}
                      className={`group relative h-full w-full overflow-hidden rounded-[5px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
                        editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      } ${isDragging ? 'ring-2 ring-white/60' : ''} ${flag === 'OVERDUE' ? 'ring-2 ring-[#ec835a]' : ''}`}
                      style={{ background: `${color}40`, touchAction: 'none' }}
                    >
                      <span className="absolute inset-y-0 left-0" style={{ width: bar.progressWidth, background: color }} />
                      {bar.width > 70 && (
                        <span className="relative flex h-full items-center gap-1 px-2 text-[10px] font-semibold text-white">
                          {flag === 'BLOCKED' && <AlertTriangle className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{task.progress_pct}%</span>
                        </span>
                      )}
                      {isPending && <LoaderCircle className="absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-white" />}
                    </button>
                    {editable && (
                      <>
                        <span
                          aria-hidden="true"
                          onPointerDown={(e) => onPointerDown(e, original, 'resize-start')}
                          onPointerUp={() => onPointerUp(original)}
                          className="absolute inset-y-0 -left-1 w-2.5 cursor-ew-resize"
                          style={{ touchAction: 'none' }}
                        />
                        <span
                          aria-hidden="true"
                          onPointerDown={(e) => onPointerDown(e, original, 'resize-end')}
                          onPointerUp={() => onPointerUp(original)}
                          className="absolute inset-y-0 -right-1 w-2.5 cursor-ew-resize"
                          style={{ touchAction: 'none' }}
                        />
                      </>
                    )}
                    {isDragging && drag && drag.delta !== 0 && (
                      <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-[#0F0A1A] px-1.5 py-0.5 text-[10px] text-white">
                        {fromDay(bar.startDay)} to {fromDay(bar.endDay)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.06] px-4 py-3 text-[11px] text-[#B7ADC9]">
        {[
          ['To do', CHART_COLORS.neutral],
          ['In progress', CHART_COLORS.progress],
          ['Blocked', CHART_COLORS.critical],
          ['Completed', CHART_COLORS.good],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: color }} /> {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm ring-2 ring-[#ec835a]" /> Overdue</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-[2px] bg-[#c4b5fd]" /> Today</span>
        {target !== null && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-0 border-l-2 border-dashed border-[#fab219]" /> Project target</span>}
        <span className="inline-flex items-center gap-1.5"><Flag className="h-3 w-3 text-[#fab219]" /> Critical priority</span>
        <span>Filled part of a bar = reported progress.</span>
      </div>
    </div>
  );
};

export default TaskTimeline;
