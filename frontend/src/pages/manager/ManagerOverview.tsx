
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Task,
  Company,
  RiskAnalysis,
  LeaveRequest,
  RecoveryProposal,
  AuditEvent,
} from '../../types';
import { StatCard } from '../../components/dashboard/StatCard';
import { RiskBadge } from '../../components/common/RiskBadge';
import { RecoveryReviewModal } from '../../components/risk/RecoveryReviewModal';
import { ProjectAnalyticsPanel } from '../../components/analytics/ProjectAnalyticsPanel';
import { ProvenanceBadge } from '../../components/risk/RecoveryInsights';
import { formatIndianTime } from '../../utils/date';
import {
  CheckSquare,
  AlertOctagon,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Building2,
  UsersRound,
} from 'lucide-react';

export const ManagerOverview: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProject, refreshProjects } = useProject();
  const [company, setCompany] = useState<Company | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [riskAnalysis, setRiskAnalysis] =
    useState<RiskAnalysis | null>(null);
  const [pendingLeaves, setPendingLeaves] =
    useState<LeaveRequest[]>([]);
  const [pendingProposals, setPendingProposals] =
    useState<RecoveryProposal[]>([]);
  const [recentAudits, setRecentAudits] =
    useState<AuditEvent[]>([]);
  const [selectedProposal, setSelectedProposal] =
    useState<RecoveryProposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Prevent overlapping refresh requests.
  const isRefreshing = useRef(false);

  // Track the project associated with the current request.
  const activeProjectId = activeProject?.id;

  useEffect(() => {
    if (user?.role !== 'MANAGER') {
      setCompany(null);
      return;
    }

    let isMounted = true;
    api.getMyCompany()
      .then((data) => {
        if (isMounted) {
          setCompany(data);
          setCompanyError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load company workspace:', error);
        if (isMounted) {
          setCompanyError(
            error instanceof Error
              ? error.message
              : 'Could not load your company workspace.'
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  const loadOverviewData = useCallback(
    async (showLoader = false) => {
      if (!activeProjectId || isRefreshing.current) {
        if (!activeProjectId) {
          setIsLoading(false);
        }
        return;
      }

      isRefreshing.current = true;

      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const [
          tasksData,
          riskData,
          leavesData,
          proposalsData,
          auditsData,
        ] = await Promise.all([
          api.getTasks({ project_id: activeProjectId }),
          api.getRiskAnalysis(activeProjectId),
          api.getLeaveRequests({ status_filter: 'PENDING' }),
          api.getRecoveryProposals(activeProjectId),
          api.getAuditTrail(activeProjectId),
        ]);

        setTasks(tasksData);
        setRiskAnalysis(riskData);
        setPendingLeaves(leavesData);

        setPendingProposals(
          proposalsData.filter(
            (proposal) =>
              proposal.status === 'PENDING_APPROVAL'
          )
        );

        setRecentAudits(auditsData.slice(0, 8));
        setLastUpdated(new Date());
      } catch (error) {
        console.error(
          'Failed to load manager overview:',
          error
        );
      } finally {
        isRefreshing.current = false;

        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [activeProjectId]
  );

  // Load when the project changes and poll every five seconds.
  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      setRiskAnalysis(null);
      setPendingLeaves([]);
      setPendingProposals([]);
      setRecentAudits([]);
      setLastUpdated(null);
      setIsLoading(false);
      return;
    }

    void loadOverviewData(true);

    const intervalId = window.setInterval(() => {
      void loadOverviewData(false);
    }, 5000);

    // Refresh immediately when the manager returns to this tab.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadOverviewData(false);
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(intervalId);

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [activeProjectId, loadOverviewData]);

  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) => task.status === 'COMPLETED'
  ).length;

  const blockedTasks = tasks.filter(
    (task) =>
      task.is_blocked || task.status === 'BLOCKED'
  ).length;

  const overdueTasks = tasks.filter(
    (task) =>
      task.status !== 'COMPLETED' &&
      task.due_date &&
      new Date(task.due_date) < new Date()
  ).length;

  const completionPct =
    totalTasks > 0
      ? Math.round(
          tasks.reduce(
            (total, task) => total + (task.progress_pct || 0),
            0,
          ) / totalTasks,
        )
      : 0;

  return (
    <div className="space-y-8 text-[#FAF8FF]">
      {/* Project header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
            Manager Control Center
          </span>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {activeProject
              ? activeProject.name
              : 'Project Overview'}
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#B7ADC9]">
            Welcome back
            {user?.full_name ? `, ${user.full_name}` : ''}.
            Here is the current delivery status and risk posture.
          </p>

          <p className="mt-2 flex items-center gap-2 text-xs text-[#A99DBD]">
            <RefreshCw
              className={`h-3 w-3 ${
                isLoading ? 'animate-spin' : ''
              }`}
            />

            {lastUpdated
              ? `Last updated at ${formatIndianTime(lastUpdated.toISOString(), true)} · Auto-refresh every 5 seconds`
              : 'Loading latest project data...'}
          </p>
        </div>

        {riskAnalysis && (
          <div className="flex items-center gap-3">
            <RiskBadge
              level={riskAnalysis.risk_level}
              score={riskAnalysis.score}
              size="lg"
            />

            <Link
              to="/manager/risk"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/20 hover:text-white"
              title="Inspect Risk Details"
            >
              Details
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>

      {user?.role === 'MANAGER' && (
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Building2 className="h-4 w-4 text-violet-300" />
              {company?.name ?? 'Company workspace'}
            </div>
            {company ? (
              <>
                <p className="mt-2 text-xs text-[#B7ADC9]">
                  Your company portal manages members and signup access.
                </p>
                <Link
                  to="/manager/company"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-300/25 bg-violet-400/10 px-3.5 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/20"
                >
                  Open company portal
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <p className="mt-2 text-xs text-rose-200">
                {companyError ?? 'Loading company workspace...'}
              </p>
            )}
          </div>
          {company && (
            <div className="flex items-center gap-2 text-xs text-[#D1C7E0]">
              <UsersRound className="h-4 w-4 text-violet-300" />
              {company.employee_count} employees · {company.manager_count} managers
            </div>
          )}
        </section>
      )}

      {/* Pending recovery proposals */}
      {pendingProposals.length > 0 && (
        <section className="manager-recovery-proposal flex flex-col justify-between gap-5 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-[#291849] via-[#211638] to-[#19112B] p-5 shadow-xl md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 rounded-xl border border-violet-300/20 bg-violet-500/15 p-3">
              <Sparkles className="h-6 w-6 text-violet-300" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Action Required: {pendingProposals[0].title}
                </h2>

                <ProvenanceBadge trace={pendingProposals[0].generation_trace} />
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#C4B6DB]">
                {pendingProposals[0].summary} Contains{' '}
                {pendingProposals[0].proposed_actions.length} proposed
                action{pendingProposals[0].proposed_actions.length === 1 ? '' : 's'}.
                Nothing changes until you approve it.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedProposal(pendingProposals[0])
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-300/30 bg-violet-500 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Review proposal
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Overall Completion"
          value={`${completionPct}%`}
          subtitle="Average progress reported across tasks"
          icon={CheckSquare}
          variant="forest"
          action={{
            label: 'View Tasks',
            onClick: () => navigate('/manager/tasks'),
          }}
        />

        <StatCard
          title="Active Blockers"
          value={blockedTasks}
          subtitle={
            blockedTasks > 0
              ? 'Impediments halting progress'
              : 'No active work blockers'
          }
          icon={AlertOctagon}
          variant={blockedTasks > 0 ? 'danger' : 'success'}
          action={{
            label: 'Inspect',
            onClick: () => navigate('/manager/tasks'),
          }}
        />

        <StatCard
          title="Pending Leave"
          value={pendingLeaves.length}
          subtitle={
            pendingLeaves.length > 0
              ? 'Awaiting manager review'
              : 'No pending time off'
          }
          icon={CalendarDays}
          variant={
            pendingLeaves.length > 0 ? 'warning' : 'default'
          }
          action={{
            label: 'Review',
            onClick: () => navigate('/manager/leave'),
          }}
        />

        <StatCard
          title="Overdue Tasks"
          value={overdueTasks}
          subtitle={
            overdueTasks > 0
              ? 'Past scheduled due date'
              : 'All tasks within schedule'
          }
          icon={Clock}
          variant={overdueTasks > 0 ? 'danger' : 'success'}
          action={{
            label: 'Reschedule',
            onClick: () => navigate('/manager/tasks'),
          }}
        />
      </section>

      {/* Charts computed from this project's stored data */}
      {activeProjectId && <ProjectAnalyticsPanel projectId={activeProjectId} />}

      {/* Task list and audit activity */}
      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Critical tasks */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
                Critical Path Tasks & Blockers
              </h2>

              <p className="mt-1 text-xs text-[#A99DBD]">
                Priority work across your project
              </p>
            </div>

            <Link
              to="/manager/tasks"
              className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-200 transition-all hover:border-violet-300/60 hover:bg-violet-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              View All Tasks
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#19112B] shadow-[0_10px_35px_rgba(0,0,0,0.15)]">
            {isLoading ? (
              <p className="p-8 text-center text-sm text-[#B7ADC9]">
                Loading project tasks...
              </p>
            ) : tasks.length === 0 ? (
              <div className="p-8 text-center">
                <CheckSquare className="mx-auto h-8 w-8 text-violet-300" />

                <p className="mt-3 text-sm font-semibold text-white">
                  No tasks found
                </p>

                <p className="mt-1 text-xs text-[#B7ADC9]">
                  Tasks for the active project will appear here.
                </p>
              </div>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => navigate('/manager/tasks')}
                  className="flex w-full items-center justify-between gap-4 border-b border-white/[0.07] p-4 text-left transition-colors last:border-b-0 hover:bg-violet-500/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[#A99DBD]">
                        #{task.id}
                      </span>

                      <h3 className="truncate text-sm font-semibold text-white">
                        {task.title}
                      </h3>

                      {(task.is_blocked ||
                        task.status === 'BLOCKED') && (
                        <span className="rounded-md border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                          BLOCKED
                        </span>
                      )}

                      {task.status === 'IN_PROGRESS' && (
                        <span className="rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                          IN PROGRESS
                        </span>
                      )}

                      {task.status === 'COMPLETED' && (
                        <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          COMPLETED
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#B7ADC9]">
                      <span>
                        {task.assignee?.full_name || 'Unassigned'}
                      </span>

                      <span className="text-white/20">•</span>

                      <span>
                        Due {task.due_date || 'Not set'}
                      </span>

                      <span className="text-white/20">•</span>

                      <span>
                        {task.actual_hours ?? 0}h logged
                      </span>

                      <span className="text-white/20">•</span>

                      <span>
                        {task.estimated_hours ?? 0}h estimated
                      </span>
                    </div>
                  </div>

                  <div className="w-20 shrink-0 text-right">
                    <span className="block text-xs font-bold text-white">
                      {task.progress_pct ?? 0}%
                    </span>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${
                          task.is_blocked ||
                          task.status === 'BLOCKED'
                            ? 'bg-rose-400'
                            : task.status === 'COMPLETED'
                              ? 'bg-emerald-400'
                              : 'manager-task-progress-fill bg-violet-400'
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

        {/* Recent audit activity */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
                Recent Activity & Decisions
              </h2>

              <p className="mt-1 text-xs text-[#A99DBD]">
                Latest project events
              </p>
            </div>

            <Link
              to="/manager/audit"
              className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-200 transition-all hover:border-violet-300/60 hover:bg-violet-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              Full Audit Trail
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#19112B] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.15)]">
            {isLoading ? (
              <p className="py-6 text-center text-sm text-[#B7ADC9]">
                Loading audit activity...
              </p>
            ) : recentAudits.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#B7ADC9]">
                No activity records logged yet.
              </p>
            ) : (
              recentAudits.map((audit) => (
                <div
                  key={audit.id}
                  className="border-b border-white/[0.07] pb-3 text-xs last:border-0 last:pb-0"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-bold uppercase tracking-wider text-violet-300">
                      {audit.event_type.replace(/_/g, ' ')}
                    </span>

                    <span className="shrink-0 text-[10px] text-[#A99DBD]">
                      {formatIndianTime(audit.created_at)}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-[#D8CFE7]">
                    {audit.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Recovery review modal */}
      {selectedProposal && (
        <RecoveryReviewModal
          isOpen={!!selectedProposal}
          onClose={() => setSelectedProposal(null)}
          proposal={selectedProposal}
          onDecided={async () => {
            await loadOverviewData(false);
            await refreshProjects();
          }}
        />
      )}
    </div>
  );
};

export default ManagerOverview;
