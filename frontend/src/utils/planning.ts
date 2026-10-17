/**
 * Pure data transforms for the planner views (timeline, calendar, list,
 * kanban) and charts. No React and no imports, so the functions can be
 * unit-tested directly (see tests/planning.test.mjs).
 *
 * Task dates are calendar days ("YYYY-MM-DD"). They are handled as whole
 * day numbers so browser time zones never shift a task onto another day.
 * "Today" is the calendar date in India Standard Time, matching the rest of
 * the app's date formatting.
 */

export const DAY_MS = 86_400_000;

export interface PlannerTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  progress_pct: number;
  is_blocked: boolean;
  assignee_id?: number | null;
  assignee?: { id: number; full_name: string } | null;
  dependencies?: { prerequisite_task_id: number }[];
  estimated_hours?: number;
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export const toDay = (value: string | null | undefined): number | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return Math.round(ms / DAY_MS);
};

export const fromDay = (day: number): string =>
  new Date(day * DAY_MS).toISOString().slice(0, 10);

export const todayInIndia = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const weekdayOf = (day: number): number => new Date(day * DAY_MS).getUTCDay();

export const isWeekend = (day: number): boolean => {
  const w = weekdayOf(day);
  return w === 0 || w === 6;
};

export const formatDayLabel = (
  day: number,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string =>
  new Date(day * DAY_MS).toLocaleDateString('en-IN', { ...options, timeZone: 'UTC' });

// ---------------------------------------------------------------------------
// Task state
// ---------------------------------------------------------------------------

export type TaskFlag = 'COMPLETED' | 'BLOCKED' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK';

export const isTaskBlocked = (task: Pick<PlannerTask, 'status' | 'is_blocked'>): boolean =>
  task.status !== 'COMPLETED' && (task.is_blocked || task.status === 'BLOCKED');

export const taskFlag = (task: PlannerTask, today: number, soonDays = 3): TaskFlag => {
  if (task.status === 'COMPLETED') return 'COMPLETED';
  if (isTaskBlocked(task)) return 'BLOCKED';
  const due = toDay(task.due_date);
  if (due !== null && due < today) return 'OVERDUE';
  if (due !== null && due - today <= soonDays) return 'DUE_SOON';
  return 'ON_TRACK';
};

// ---------------------------------------------------------------------------
// Shared filters and sorting (List, Kanban, Calendar and Timeline)
// ---------------------------------------------------------------------------

export interface TaskFilters {
  search: string;
  assignee: 'ALL' | 'UNASSIGNED' | number;
  status: 'ALL' | 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
  priority: 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  assignee: 'ALL',
  status: 'ALL',
  priority: 'ALL',
};

export const filterTasks = <T extends PlannerTask & { description?: string | null }>(
  tasks: T[],
  filters: TaskFilters
): T[] => {
  const query = filters.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (query) {
      const haystack = `${task.title} ${task.description ?? ''} ${task.id}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.assignee === 'UNASSIGNED' && task.assignee_id != null) return false;
    if (typeof filters.assignee === 'number' && task.assignee_id !== filters.assignee) return false;
    if (filters.status !== 'ALL') {
      const effective = isTaskBlocked(task) ? 'BLOCKED' : task.status;
      if (effective !== filters.status) return false;
    }
    if (filters.priority !== 'ALL' && task.priority !== filters.priority) return false;
    return true;
  });
};

export const activeFilterCount = (filters: TaskFilters): number =>
  (filters.search.trim() ? 1 : 0) +
  (filters.assignee !== 'ALL' ? 1 : 0) +
  (filters.status !== 'ALL' ? 1 : 0) +
  (filters.priority !== 'ALL' ? 1 : 0);

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Timeline order: dependencies first (topological), then start date. */
export const scheduleOrder = <T extends PlannerTask>(tasks: T[]): T[] => {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<number>();
  const visiting = new Set<number>();
  const out: T[] = [];
  const sorted = [...tasks].sort(
    (a, b) =>
      (toDay(a.start_date) ?? 0) - (toDay(b.start_date) ?? 0) ||
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
      a.id - b.id
  );
  const visit = (task: T) => {
    if (visited.has(task.id) || visiting.has(task.id)) return;
    visiting.add(task.id);
    for (const dep of task.dependencies ?? []) {
      const parent = byId.get(dep.prerequisite_task_id);
      if (parent) visit(parent);
    }
    visiting.delete(task.id);
    visited.add(task.id);
    out.push(task);
  };
  sorted.forEach(visit);
  return out;
};

// ---------------------------------------------------------------------------
// Timeline layout
// ---------------------------------------------------------------------------

export type TimelineZoom = 'day' | 'week' | 'month';

export const ZOOM_DAY_WIDTH: Record<TimelineZoom, number> = {
  day: 40,
  week: 18,
  month: 6,
};

export interface TimelineRange {
  start: number;
  end: number; // inclusive
}

export const timelineRange = (
  tasks: Pick<PlannerTask, 'start_date' | 'due_date'>[],
  today: number,
  padDays = 3
): TimelineRange => {
  let start = today;
  let end = today;
  for (const task of tasks) {
    const s = toDay(task.start_date);
    const e = toDay(task.due_date);
    if (s !== null) start = Math.min(start, s);
    if (e !== null) end = Math.max(end, e);
    if (s !== null) end = Math.max(end, s);
  }
  return { start: start - padDays, end: end + padDays };
};

export interface TimelineBar {
  taskId: number;
  row: number;
  x: number;
  width: number;
  progressWidth: number;
  startDay: number;
  endDay: number;
}

export const layoutBars = (
  tasks: PlannerTask[],
  range: TimelineRange,
  dayWidth: number
): TimelineBar[] =>
  tasks.map((task, row) => {
    const s = toDay(task.start_date) ?? range.start;
    const e = Math.max(s, toDay(task.due_date) ?? s);
    const width = (e - s + 1) * dayWidth;
    return {
      taskId: task.id,
      row,
      x: (s - range.start) * dayWidth,
      width,
      progressWidth: (width * Math.min(100, Math.max(0, task.progress_pct))) / 100,
      startDay: s,
      endDay: e,
    };
  });

export interface DependencyLink {
  fromId: number;
  toId: number;
  path: string;
  /** Prerequisite is due after its dependent (same rule as the backend). */
  conflict: boolean;
}

/** Elbow connectors from a prerequisite's end to its dependent's start. */
export const dependencyLinks = (
  tasks: PlannerTask[],
  bars: TimelineBar[],
  rowHeight: number
): DependencyLink[] => {
  const barById = new Map(bars.map((b) => [b.taskId, b]));
  const links: DependencyLink[] = [];
  for (const task of tasks) {
    const to = barById.get(task.id);
    if (!to) continue;
    for (const dep of task.dependencies ?? []) {
      const from = barById.get(dep.prerequisite_task_id);
      if (!from) continue;
      const x1 = from.x + from.width;
      const y1 = from.row * rowHeight + rowHeight / 2;
      const x2 = to.x;
      const y2 = to.row * rowHeight + rowHeight / 2;
      const elbow = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 12));
      const path =
        x2 - 8 >= x1 + 8
          ? `M${x1},${y1} H${elbow} V${y2} H${x2}`
          : `M${x1},${y1} h8 V${(y1 + y2) / 2} H${x2 - 8} V${y2} H${x2}`;
      links.push({
        fromId: from.taskId,
        toId: to.taskId,
        path,
        conflict: from.endDay > to.endDay,
      });
    }
  }
  return links;
};

export interface TimelineTick {
  day: number;
  x: number;
  label: string;
  major: boolean;
}

export const timelineTicks = (
  range: TimelineRange,
  zoom: TimelineZoom,
  dayWidth: number
): TimelineTick[] => {
  const ticks: TimelineTick[] = [];
  for (let day = range.start; day <= range.end; day++) {
    const date = new Date(day * DAY_MS);
    const dom = date.getUTCDate();
    const weekday = date.getUTCDay();
    let include = false;
    let label = '';
    if (zoom === 'day') {
      include = true;
      label = String(dom);
    } else if (zoom === 'week') {
      include = weekday === 1;
      label = formatDayLabel(day);
    } else {
      include = dom === 1 || day === range.start;
      label = formatDayLabel(day, { month: 'short', year: '2-digit' });
    }
    if (include) {
      ticks.push({ day, x: (day - range.start) * dayWidth, label, major: dom === 1 || weekday === 1 });
    }
  }
  return ticks;
};

/** Shift a task's dates after a drag. Mode 'move' keeps the duration. */
export const shiftDates = (
  task: Pick<PlannerTask, 'start_date' | 'due_date'>,
  deltaDays: number,
  mode: 'move' | 'resize-end' | 'resize-start'
): { start_date: string; due_date: string } => {
  const s = toDay(task.start_date) ?? 0;
  const e = toDay(task.due_date) ?? s;
  if (mode === 'move') return { start_date: fromDay(s + deltaDays), due_date: fromDay(e + deltaDays) };
  if (mode === 'resize-end') return { start_date: fromDay(s), due_date: fromDay(Math.max(s, e + deltaDays)) };
  return { start_date: fromDay(Math.min(e, s + deltaDays)), due_date: fromDay(e) };
};

/** Client-side pre-check mirroring the backend rule: a prerequisite must be
 * due on or before the tasks that depend on it. */
export const dependencyViolations = (
  tasks: PlannerTask[],
  taskId: number,
  newDue: string
): { taskId: number; title: string; relation: 'prerequisite' | 'dependent' }[] => {
  const due = toDay(newDue);
  if (due === null) return [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const self = byId.get(taskId);
  const issues: { taskId: number; title: string; relation: 'prerequisite' | 'dependent' }[] = [];
  for (const dep of self?.dependencies ?? []) {
    const parent = byId.get(dep.prerequisite_task_id);
    const parentDue = parent ? toDay(parent.due_date) : null;
    if (parent && parentDue !== null && parentDue > due) {
      issues.push({ taskId: parent.id, title: parent.title, relation: 'prerequisite' });
    }
  }
  for (const other of tasks) {
    if (other.status === 'COMPLETED') continue;
    if (!(other.dependencies ?? []).some((d) => d.prerequisite_task_id === taskId)) continue;
    const otherDue = toDay(other.due_date);
    if (otherDue !== null && otherDue < due) {
      issues.push({ taskId: other.id, title: other.title, relation: 'dependent' });
    }
  }
  return issues;
};

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export interface CalendarCell {
  day: number;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  due: number[];
  starting: number[];
  active: number[];
}

/** Six-week Monday-first grid for the month containing `monthDay`. */
export const calendarMonth = (
  tasks: PlannerTask[],
  year: number,
  monthIndex: number,
  today: number
): CalendarCell[] => {
  const first = Math.round(Date.UTC(year, monthIndex, 1) / DAY_MS);
  const offset = (weekdayOf(first) + 6) % 7;
  const gridStart = first - offset;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const day = gridStart + i;
    const date = new Date(day * DAY_MS);
    cells.push({
      day,
      iso: fromDay(day),
      inMonth: date.getUTCMonth() === monthIndex,
      isToday: day === today,
      due: [],
      starting: [],
      active: [],
    });
  }
  const byDay = new Map(cells.map((c) => [c.day, c]));
  for (const task of tasks) {
    const s = toDay(task.start_date);
    const e = toDay(task.due_date);
    if (e !== null) byDay.get(e)?.due.push(task.id);
    if (s !== null && s !== e) byDay.get(s)?.starting.push(task.id);
    if (s !== null && e !== null) {
      for (let d = Math.max(s + 1, gridStart); d < Math.min(e, gridStart + 42); d++) {
        byDay.get(d)?.active.push(task.id);
      }
    }
  }
  return cells;
};

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

/** "Nice" axis maximum and ticks for a 0-based value axis. */
export const niceTicks = (max: number, count = 4): number[] => {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
};

export interface ComparisonRow {
  taskId: number;
  title: string;
  assigneeBefore?: string | null;
  assigneeAfter?: string | null;
  before: { start: number | null; due: number | null; finish: number | null; late: boolean };
  after: { start: number | null; due: number | null; finish: number | null; late: boolean };
  changed: boolean;
  dueShiftDays: number;
  finishShiftDays: number | null;
}

/** Joins before/after schedule rows from a recovery proposal's trace. */
export const compareScheduleRows = (
  before: { task_id: number; title: string; assignee_name?: string | null; start_date: string; due_date: string; projected_finish?: string | null; late: boolean; status: string }[],
  after: { task_id: number; assignee_name?: string | null; start_date: string; due_date: string; projected_finish?: string | null; late: boolean }[],
  changedIds: number[]
): ComparisonRow[] => {
  const afterById = new Map(after.map((r) => [r.task_id, r]));
  const changed = new Set(changedIds);
  return before
    .filter((row) => row.status !== 'COMPLETED' || changed.has(row.task_id))
    .map((row) => {
      const next = afterById.get(row.task_id) ?? row;
      const b = {
        start: toDay(row.start_date),
        due: toDay(row.due_date),
        finish: toDay(row.projected_finish ?? null),
        late: row.late,
      };
      const a = {
        start: toDay(next.start_date),
        due: toDay(next.due_date),
        finish: toDay(next.projected_finish ?? null),
        late: next.late,
      };
      return {
        taskId: row.task_id,
        title: row.title,
        assigneeBefore: row.assignee_name,
        assigneeAfter: next.assignee_name,
        before: b,
        after: a,
        changed: changed.has(row.task_id),
        dueShiftDays: (a.due ?? 0) - (b.due ?? 0),
        finishShiftDays: a.finish !== null && b.finish !== null ? a.finish - b.finish : null,
      };
    });
};
