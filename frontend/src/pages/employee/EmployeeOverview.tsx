
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { Task, LeaveRequest, DailyUpdate } from '../../types';
import { StatCard } from '../../components/dashboard/StatCard';
import { useVisibleInterval } from '../../hooks/useVisibleInterval';
import { IconAlertOctagon, IconArrowRight, IconCalendarDays, IconCheckSquare, IconClock, IconFolderKanban, IconSend } from '../../icons';

export const EmployeeOverview: React.FC = () => {
  const { user } = useAuth();
  const { projects: myProjects, isLoading: projectsLoading } = useProject();
  const navigate = useNavigate();

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<DailyUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshMyTasks = useCallback(async () => {
    if (!user) return;

    try {
      const tasks = await api.getTasks({ assignee_id: user.id });
      setMyTasks(tasks);
    } catch (error) {
      console.error('Failed to refresh assigned tasks:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadEmployeeData();
    }
  }, [user]);

  useVisibleInterval(() => {
    void refreshMyTasks();
  }, 3000);

  const loadEmployeeData = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const [tasksData, leavesData, updatesData] =
        await Promise.all([
          api.getTasks({ assignee_id: user.id }),
          api.getLeaveRequests({ user_id: user.id }),
          api.getDailyUpdates({ user_id: user.id }),
        ]);

      setMyTasks(tasksData);
      setMyLeaves(leavesData);
      setRecentUpdates(updatesData.slice(0, 5));
    } catch (err) {
      console.error('Failed to load employee data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTasks = myTasks.filter(
    (task) => task.status !== 'COMPLETED'
  );

  const completedTasks = myTasks.filter(
    (task) => task.status === 'COMPLETED'
  );

  const blockedTasks = myTasks.filter(
    (task) => task.is_blocked || task.status === 'BLOCKED'
  );

  const upcomingDeadlines = [...activeTasks]
    .sort(
      (a, b) =>
        new Date(a.due_date).getTime() -
        new Date(b.due_date).getTime()
    )
    .slice(0, 3);

  const pendingLeaves = myLeaves.filter(
    (leave) => leave.status === 'PENDING'
  );

  const completionPct = myTasks.length
    ? Math.round((completedTasks.length / myTasks.length) * 100)
    : 0;
  const progressCircumference = 2 * Math.PI * 44;

  return (
    <div className="space-y-6 text-[#FAF8FF]">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-500/12 blur-3xl" />
        <div className="relative grid gap-6 p-5 text-slate-900 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <div>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-800">
              Contributor workbench
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Welcome back{user?.full_name ? `, ${user.full_name}` : ''}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Your workday, organized around the tasks and milestones that need your attention.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/employee/tasks"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                Open my tasks
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/employee/daily-updates"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                Post an update
                <IconSend className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 lg:justify-self-end lg:min-w-70">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 110 110" role="img" aria-label={`${completionPct}% of assigned tasks completed`}>
                <circle cx="55" cy="55" r="44" fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-200" />
                <circle
                  cx="55"
                  cy="55"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${(completionPct / 100) * progressCircumference} ${progressCircumference}`}
                  transform="rotate(-90 55 55)"
                  className="text-violet-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums text-slate-950">{completionPct}%</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Complete</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Work pulse</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {activeTasks.length} active task{activeTasks.length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {blockedTasks.length
                  ? `${blockedTasks.length} blocked item${blockedTasks.length === 1 ? '' : 's'} need attention`
                  : 'No blockers reported'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Tasks"
          value={activeTasks.length}
          subtitle={`${completedTasks.length} of ${myTasks.length} completed`}
          icon={IconCheckSquare}
          variant="forest"
          action={{
            label: 'Open Queue',
            onClick: () => navigate('/employee/tasks'),
          }}
        />

        <StatCard
          title="Active Blockers"
          value={blockedTasks.length}
          subtitle={
            blockedTasks.length > 0
              ? 'Impediment flagged'
              : 'Clear of blockers'
          }
          icon={IconAlertOctagon}
          variant={blockedTasks.length > 0 ? 'danger' : 'success'}
          action={{
            label: 'Details',
            onClick: () => navigate('/employee/tasks'),
          }}
        />

        <StatCard
          title="Daily Updates"
          value={recentUpdates.length}
          subtitle="Standup records logged"
          icon={IconSend}
          variant="default"
          action={{
            label: 'Submit',
            onClick: () => navigate('/employee/daily-updates'),
          }}
        />

        <StatCard
          title="Leave Requests"
          value={myLeaves.length}
          subtitle={
            pendingLeaves.length > 0
              ? `${pendingLeaves.length} request(s) pending`
              : 'All decided'
          }
          icon={IconCalendarDays}
          variant={pendingLeaves.length > 0 ? 'warning' : 'default'}
          action={{
            label: 'Apply',
            onClick: () => navigate('/employee/leave'),
          }}
        />
      </section>

      {/* My Projects */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
              My Projects
            </h2>
            <p className="mt-1 text-xs text-[#A99DBD]">
              Projects assigned to you by your manager
            </p>
          </div>

          <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
            {myProjects.length} project{myProjects.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading || projectsLoading ? (
          <div className="rounded-2xl border border-white/10 bg-[#19112B] p-8 text-center text-sm text-[#B7ADC9]">
            Loading your projects...
          </div>
        ) : myProjects.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#19112B] p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
              <IconFolderKanban className="h-5 w-5 text-violet-300" />
            </div>

            <p className="mt-3 text-sm font-semibold text-white">
              No projects assigned yet
            </p>

            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#B7ADC9]">
              When your manager adds you to a project, it will appear here.
              You can view the project even before tasks are assigned.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myProjects.map((project) => {
              const progress = Math.min(
                100,
                Math.max(0, project.completion_percentage ?? 0)
              );

              return (
                <article
                  key={project.id}
                  className="rounded-2xl border border-white/10 bg-[#19112B] p-5 transition-all hover:border-violet-400/30 hover:bg-[#1D1431]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
                        <IconFolderKanban className="h-5 w-5 text-violet-300" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="wrap-break-word text-sm font-bold text-white">
                          {project.name}
                        </h3>

                        <p className="mt-1 text-xs text-[#A99DBD]">
                          Project #{project.id}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-200">
                      {project.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="mt-4 min-h-10 text-xs leading-5 text-[#B7ADC9]">
                    {project.description || 'No project description provided.'}
                  </p>

                  {/* Project Statistics */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/6 bg-[#211638] p-3">
                      <p className="text-xs text-[#A99DBD]">
                        Total Tasks
                      </p>

                      <p className="mt-1 text-xl font-bold text-white">
                        {project.task_count ?? 0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/6 bg-[#211638] p-3">
                      <p className="text-xs text-[#A99DBD]">
                        Completed
                      </p>

                      <p className="mt-1 text-xl font-bold text-white">
                        {project.completed_task_count ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Project Progress */}
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-[#B7ADC9]">
                        Project Progress
                      </span>

                      <span className="text-xs font-bold text-violet-200">
                        {progress}%
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-violet-400 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Project Dates */}
                  <div className="mt-4 space-y-2 border-t border-white/7 pt-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#A99DBD]">
                        Start Date
                      </span>

                      <span className="text-right text-white">
                        {project.start_date || 'Not set'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#A99DBD]">
                        Target Deadline
                      </span>

                      <span className="text-right text-white">
                        {project.target_end_date || 'Not set'}
                      </span>
                    </div>
                  </div>

                  {/* Task Navigation */}
                  <button
                    type="button"
                    onClick={() => navigate('/employee/tasks')}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition-colors hover:border-violet-300/50 hover:bg-violet-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    View My Tasks
                    <IconArrowRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Tasks and Leave Requests */}
      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Active Tasks */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
                My Active Tasks
              </h2>

              <p className="mt-1 text-xs text-[#A99DBD]">
                {activeTasks.length} task(s) remaining
              </p>
            </div>

            <Link
              to="/employee/tasks"
              className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 transition-all hover:border-violet-300/60 hover:bg-violet-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              View All Tasks
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#19112B] shadow-[0_10px_35px_rgba(0,0,0,0.15)]">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-[#B7ADC9]">
                Loading your tasks...
              </div>
            ) : activeTasks.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10">
                  <IconCheckSquare className="h-5 w-5 text-emerald-300" />
                </div>

                <p className="mt-3 text-sm font-semibold text-white">
                  You're all caught up!
                </p>

                <p className="mt-1 text-xs leading-5 text-[#B7ADC9]">
                  You have no active tasks currently assigned.
                </p>
              </div>
            ) : (
              activeTasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => navigate('/employee/tasks')}
                  className="flex w-full items-center justify-between gap-4 border-b border-white/7 p-4 text-left transition-colors last:border-b-0 hover:bg-violet-500/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[#A99DBD]">
                        #{task.id}
                      </span>

                      <h3 className="truncate text-sm font-semibold text-white">
                        {task.title}
                      </h3>

                      {(task.is_blocked || task.status === 'BLOCKED') && (
                        <span className="rounded-md border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                          BLOCKED
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#B7ADC9]">
                      <span className="inline-flex items-center gap-1.5">
                        <IconClock className="h-3.5 w-3.5 text-violet-300" />
                        Due {task.due_date || 'Not set'}
                      </span>

                      <span className="text-white/20">•</span>

                      <span>{task.estimated_hours}h estimated</span>
                    </div>
                  </div>

                  <div className="w-20 shrink-0 text-right">
                    <span className="block text-xs font-bold text-white">
                      {task.progress_pct}%
                    </span>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          task.is_blocked || task.status === 'BLOCKED'
                            ? 'bg-rose-400'
                            : 'bg-violet-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, task.progress_pct || 0)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Leave Requests */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
                My Leave Requests
              </h2>

              <p className="mt-1 text-xs text-[#A99DBD]">
                Your time-off history
              </p>
            </div>

            <Link
              to="/employee/leave"
              className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 transition-all hover:border-violet-300/60 hover:bg-violet-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              Request Time Off
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#19112B] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.15)]">
            {isLoading ? (
              <p className="py-6 text-center text-sm text-[#B7ADC9]">
                Loading leave requests...
              </p>
            ) : myLeaves.length === 0 ? (
              <div className="py-6 text-center">
                <IconCalendarDays className="mx-auto h-8 w-8 text-violet-300" />

                <p className="mt-3 text-sm font-semibold text-white">
                  No leave requests yet
                </p>

                <p className="mt-1 text-xs text-[#B7ADC9]">
                  Your submitted requests will appear here.
                </p>
              </div>
            ) : (
              myLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/7 bg-[#211638] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {leave.start_date} – {leave.end_date}
                    </p>

                    <p className="mt-1 truncate text-xs text-[#B7ADC9]">
                      {leave.reason || 'Planned absence'}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      leave.status === 'APPROVED'
                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                        : leave.status === 'REJECTED'
                          ? 'border-rose-400/20 bg-rose-500/10 text-rose-300'
                          : 'border-amber-400/20 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {leave.status}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#19112B] p-4">
              <h3 className="text-sm font-bold text-white">
                Upcoming Deadlines
              </h3>

              <div className="mt-3 space-y-3">
                {upcomingDeadlines.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <IconClock className="h-4 w-4 text-violet-300" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">
                        {task.title}
                      </p>

                      <p className="mt-1 text-xs text-[#B7ADC9]">
                        Due {task.due_date || 'Not set'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EmployeeOverview;
