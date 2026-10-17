import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, CircleDot, Flag } from 'lucide-react';
import type { Task } from '../../types';
import { calendarMonth, formatDayLabel, taskFlag, toDay, todayInIndia } from '../../utils/planning';
import { CHART_COLORS } from '../charts/Charts';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_PER_CELL = 3;

const chipStyle = (task: Task, today: number) => {
  const flag = taskFlag(task, today);
  if (flag === 'COMPLETED') return { border: CHART_COLORS.good, label: 'Completed', status: 'completed' };
  if (flag === 'BLOCKED') return { border: CHART_COLORS.critical, label: 'Blocked', status: 'blocked' };
  if (flag === 'OVERDUE') return { border: CHART_COLORS.serious, label: 'Overdue', status: 'overdue' };
  if (task.status === 'IN_PROGRESS') return { border: CHART_COLORS.progress, label: 'In progress', status: 'in-progress' };
  return { border: CHART_COLORS.neutral, label: 'To do', status: 'todo' };
};

export const TaskCalendar: React.FC<{ tasks: Task[]; onTaskClick: (task: Task) => void }> = ({ tasks, onTaskClick }) => {
  const todayIso = todayInIndia();
  const today = toDay(todayIso) as number;
  const [month, setMonth] = useState(() => ({ year: Number(todayIso.slice(0, 4)), index: Number(todayIso.slice(5, 7)) - 1 }));
  const [expanded, setExpanded] = useState<number | null>(null);

  const cells = useMemo(() => calendarMonth(tasks, month.year, month.index, today), [tasks, month, today]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const monthLabel = formatDayLabel(Math.round(Date.UTC(month.year, month.index, 1) / 86_400_000), { month: 'long', year: 'numeric' });

  const shift = (delta: number) =>
    setMonth(({ year, index }) => {
      const next = index + delta;
      return { year: year + Math.floor(next / 12), index: ((next % 12) + 12) % 12 };
    });

  const inMonth = tasks.filter((t) => {
    const due = t.due_date.slice(0, 7);
    const start = t.start_date.slice(0, 7);
    const key = `${month.year}-${String(month.index + 1).padStart(2, '0')}`;
    return due === key || start === key;
  }).length;

  return (
    <div className="task-calendar rounded-2xl border border-white/[0.08] bg-[#19112B]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="rounded-lg border border-white/10 p-1.5 text-[#B7ADC9] hover:bg-white/5 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="min-w-36 text-center text-sm font-semibold text-white" aria-live="polite">{monthLabel}</h3>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="rounded-lg border border-white/10 p-1.5 text-[#B7ADC9] hover:bg-white/5 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth({ year: Number(todayIso.slice(0, 4)), index: Number(todayIso.slice(5, 7)) - 1 })}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[#D8CFE7] hover:bg-white/5"
          >
            Today
          </button>
        </div>
        <p className="text-[11px] text-[#8f84a3]">
          {inMonth} task(s) start or are due this month. Tasks appear on their due date; <CircleDot className="inline h-3 w-3" /> marks a start date.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className="border-b border-white/[0.06] px-2 py-2 text-[11px] font-medium text-[#A99DBD]">{d}</div>
          ))}
          {cells.map((cell) => {
            const due = cell.due.map((id) => byId.get(id)).filter(Boolean) as Task[];
            const starting = cell.starting.map((id) => byId.get(id)).filter(Boolean) as Task[];
            const open = expanded === cell.day;
            const shown = open ? due : due.slice(0, MAX_PER_CELL);
            return (
              <div
                key={cell.day}
                data-calendar-today={cell.isToday ? 'true' : undefined}
                className={`min-h-28 border-b border-r border-white/[0.04] p-1.5 ${cell.inMonth ? '' : 'bg-black/10'} ${cell.isToday ? 'bg-violet-500/[0.07]' : ''}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    data-calendar-day-number={cell.isToday ? 'today' : undefined}
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] tabular-nums ${
                      cell.isToday ? 'bg-violet-500 font-semibold text-white' : cell.inMonth ? 'text-[#D8CFE7]' : 'text-[#5f5573]'
                    }`}
                    aria-label={cell.isToday ? `Today, ${cell.iso}` : cell.iso}
                  >
                    {Number(cell.iso.slice(8, 10))}
                  </span>
                  {cell.active.length > 0 && (
                    <span className="text-[10px] text-[#8f84a3]" title={`${cell.active.length} task(s) in progress over this day`}>
                      {cell.active.length} ongoing
                    </span>
                  )}
                </div>
                <ul className="space-y-1">
                  {starting.slice(0, 2).map((task) => (
                    <li key={`s-${task.id}`}>
                      <button
                        type="button"
                        onClick={() => onTaskClick(task)}
                        data-task-status="starting"
                        className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] text-[#A99DBD] hover:bg-white/5"
                        title={`Starts: ${task.title}`}
                      >
                        <CircleDot className="h-3 w-3 shrink-0" />
                        <span className="truncate">{task.title}</span>
                      </button>
                    </li>
                  ))}
                  {shown.map((task) => {
                    const style = chipStyle(task, today);
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => onTaskClick(task)}
                          data-task-status={style.status}
                          title={`Due: ${task.title} (${style.label})`}
                          className="flex w-full items-center gap-1 rounded-md border-l-[3px] bg-white/[0.04] px-1.5 py-1 text-left text-[11px] text-white hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-violet-300"
                          style={{ borderLeftColor: style.border }}
                        >
                          {style.label === 'Blocked' && <AlertTriangle className="h-3 w-3 shrink-0 text-[#d03b3b]" />}
                          {style.label === 'Overdue' && <AlertTriangle className="h-3 w-3 shrink-0 text-[#ec835a]" />}
                          {task.priority === 'CRITICAL' && task.status !== 'COMPLETED' && <Flag className="h-3 w-3 shrink-0 text-[#fab219]" />}
                          <span className="truncate">{task.title}</span>
                          <span className="sr-only">, {style.label}</span>
                        </button>
                      </li>
                    );
                  })}
                  {due.length > MAX_PER_CELL && (
                    <li>
                      <button type="button" onClick={() => setExpanded(open ? null : cell.day)} className="px-1 text-[10px] font-medium text-violet-300 hover:underline">
                        {open ? 'Show less' : `+${due.length - MAX_PER_CELL} more`}
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.06] px-4 py-3 text-[11px] text-[#B7ADC9]">
        {[
          ['To do', CHART_COLORS.neutral],
          ['In progress', CHART_COLORS.progress],
          ['Blocked', CHART_COLORS.critical],
          ['Overdue', CHART_COLORS.serious],
          ['Completed', CHART_COLORS.good],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-[3px] rounded" style={{ background: color }} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TaskCalendar;
