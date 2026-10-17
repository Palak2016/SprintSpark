import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/planning.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const p = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const task = (id, overrides = {}) => ({
  id,
  title: `Task ${id}`,
  status: 'TODO',
  priority: 'MEDIUM',
  start_date: '2026-10-19',
  due_date: '2026-10-23',
  progress_pct: 0,
  is_blocked: false,
  assignee_id: 1,
  dependencies: [],
  ...overrides,
});

test('date-only values become stable day numbers', () => {
  const day = p.toDay('2026-10-19');
  assert.equal(p.fromDay(day), '2026-10-19');
  assert.equal(p.toDay('2026-02-30'), null);
  assert.equal(p.toDay(''), null);
  assert.equal(p.weekdayOf(day), 1); // Monday
  assert.equal(p.todayInIndia(new Date('2026-10-17T20:00:00Z')), '2026-10-18');
});

test('task flags distinguish blocked, overdue and due soon', () => {
  const today = p.toDay('2026-10-20');
  assert.equal(p.taskFlag(task(1, { due_date: '2026-10-19' }), today), 'OVERDUE');
  assert.equal(p.taskFlag(task(1, { is_blocked: true }), today), 'BLOCKED');
  assert.equal(p.taskFlag(task(1, { due_date: '2026-10-22' }), today), 'DUE_SOON');
  assert.equal(p.taskFlag(task(1, { status: 'COMPLETED', due_date: '2026-10-01' }), today), 'COMPLETED');
});

test('shared filters combine search, assignee, effective status and priority', () => {
  const tasks = [
    task(1, { title: 'Payments API', priority: 'HIGH' }),
    task(2, { assignee_id: null, is_blocked: true, status: 'IN_PROGRESS' }),
    task(3, { assignee_id: 2, status: 'COMPLETED' }),
  ];
  const f = (o) => p.filterTasks(tasks, { ...p.DEFAULT_FILTERS, ...o }).map((t) => t.id);
  assert.deepEqual(f({ search: 'payments' }), [1]);
  assert.deepEqual(f({ assignee: 'UNASSIGNED' }), [2]);
  assert.deepEqual(f({ assignee: 2 }), [3]);
  assert.deepEqual(f({ status: 'BLOCKED' }), [2]);
  assert.deepEqual(f({ status: 'IN_PROGRESS' }), []);
  assert.deepEqual(f({ priority: 'HIGH' }), [1]);
  assert.equal(p.activeFilterCount({ ...p.DEFAULT_FILTERS, search: 'x', priority: 'LOW' }), 2);
});

test('schedule order puts prerequisites before dependents', () => {
  const tasks = [
    task(3, { start_date: '2026-10-01', dependencies: [{ prerequisite_task_id: 2 }] }),
    task(2, { start_date: '2026-10-10', dependencies: [{ prerequisite_task_id: 1 }] }),
    task(1, { start_date: '2026-10-15' }),
  ];
  assert.deepEqual(p.scheduleOrder(tasks).map((t) => t.id), [1, 2, 3]);
});

test('timeline bars, progress and dependency links are positioned in days', () => {
  const tasks = [
    task(1, { start_date: '2026-10-19', due_date: '2026-10-20', progress_pct: 50 }),
    task(2, { start_date: '2026-10-21', due_date: '2026-10-23', dependencies: [{ prerequisite_task_id: 1 }] }),
  ];
  const range = p.timelineRange(tasks, p.toDay('2026-10-19'), 0);
  assert.equal(p.fromDay(range.start), '2026-10-19');
  assert.equal(p.fromDay(range.end), '2026-10-23');
  const bars = p.layoutBars(tasks, range, 10);
  assert.deepEqual(bars.map((b) => [b.x, b.width, b.progressWidth]), [[0, 20, 10], [20, 30, 0]]);
  const links = p.dependencyLinks(tasks, bars, 40);
  assert.equal(links.length, 1);
  assert.equal(links[0].conflict, false);
  assert.match(links[0].path, /^M20,20/);

  const late = p.layoutBars([tasks[0], { ...tasks[1], due_date: '2026-10-19', start_date: '2026-10-19' }], range, 10);
  assert.equal(p.dependencyLinks(tasks.map((t, i) => (i ? { ...t, due_date: '2026-10-19' } : t)), late, 40)[0].conflict, true);
});

test('timeline ticks follow the zoom level', () => {
  const range = { start: p.toDay('2026-10-19'), end: p.toDay('2026-11-15') };
  assert.equal(p.timelineTicks(range, 'day', 40).length, 28);
  assert.equal(p.timelineTicks(range, 'week', 18).length, 4); // Mondays
  const month = p.timelineTicks(range, 'month', 6);
  assert.deepEqual(month.map((t) => p.fromDay(t.day)), ['2026-10-19', '2026-11-01']);
});

test('drag shifts keep duration and never invert dates', () => {
  const t = { start_date: '2026-10-19', due_date: '2026-10-23' };
  assert.deepEqual(p.shiftDates(t, 2, 'move'), { start_date: '2026-10-21', due_date: '2026-10-25' });
  assert.deepEqual(p.shiftDates(t, -10, 'resize-end'), { start_date: '2026-10-19', due_date: '2026-10-19' });
  assert.deepEqual(p.shiftDates(t, 10, 'resize-start'), { start_date: '2026-10-23', due_date: '2026-10-23' });
});

test('dependency pre-check matches the backend rule', () => {
  const tasks = [
    task(1, { due_date: '2026-10-20' }),
    task(2, { due_date: '2026-10-25', dependencies: [{ prerequisite_task_id: 1 }] }),
    task(3, { due_date: '2026-10-21', status: 'COMPLETED', dependencies: [{ prerequisite_task_id: 1 }] }),
  ];
  assert.deepEqual(p.dependencyViolations(tasks, 1, '2026-10-24'), []);
  assert.deepEqual(p.dependencyViolations(tasks, 1, '2026-10-26').map((v) => [v.taskId, v.relation]), [[2, 'dependent']]);
  assert.deepEqual(p.dependencyViolations(tasks, 2, '2026-10-19').map((v) => [v.taskId, v.relation]), [[1, 'prerequisite']]);
});

test('calendar grid is Monday-first with due, start and active days', () => {
  const cells = p.calendarMonth(
    [task(1, { start_date: '2026-10-19', due_date: '2026-10-22' })],
    2026, 9, p.toDay('2026-10-17')
  );
  assert.equal(cells.length, 42);
  assert.equal(cells[0].iso, '2026-09-28');
  const byIso = Object.fromEntries(cells.map((c) => [c.iso, c]));
  assert.deepEqual(byIso['2026-10-19'].starting, [1]);
  assert.deepEqual(byIso['2026-10-20'].active, [1]);
  assert.deepEqual(byIso['2026-10-22'].due, [1]);
  assert.equal(byIso['2026-10-17'].isToday, true);
  assert.equal(byIso['2026-09-30'].inMonth, false);
});

test('nice ticks cover the maximum', () => {
  assert.deepEqual(p.niceTicks(37), [0, 10, 20, 30, 40]);
  assert.deepEqual(p.niceTicks(0), [0, 1]);
});

test('recovery comparison joins before and after rows', () => {
  const before = [
    { task_id: 1, title: 'A', assignee_name: 'Ben', start_date: '2026-10-19', due_date: '2026-10-23', projected_finish: '2026-10-27', late: true, status: 'TODO' },
    { task_id: 2, title: 'Done', start_date: '2026-10-01', due_date: '2026-10-02', projected_finish: null, late: false, status: 'COMPLETED' },
  ];
  const after = [
    { task_id: 1, assignee_name: 'Asha', start_date: '2026-10-19', due_date: '2026-10-27', projected_finish: '2026-10-23', late: false },
  ];
  const rows = p.compareScheduleRows(before, after, [1]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].changed, true);
  assert.equal(rows[0].dueShiftDays, 4);
  assert.equal(rows[0].finishShiftDays, -4);
  assert.equal(rows[0].assigneeAfter, 'Asha');
});
