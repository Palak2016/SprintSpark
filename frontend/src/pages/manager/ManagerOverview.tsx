import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Project, Task, RiskAnalysis, LeaveRequest, RecoveryProposal, AuditEvent
} from '../../types';
import { StatCard } from '../../components/dashboard/StatCard';
import { RiskBadge } from '../../components/common/RiskBadge';
import { RecoveryReviewModal } from '../../components/risk/RecoveryReviewModal';
import {
  FolderKanban, CheckSquare, AlertOctagon, CalendarDays,
  Sparkles, History, ArrowRight, Clock, Users, ArrowUpRight
} from 'lucide-react';

export const ManagerOverview: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProject, refreshProjects } = useProject();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [pendingProposals, setPendingProposals] = useState<RecoveryProposal[]>([]);
  const [recentAudits, setRecentAudits] = useState<AuditEvent[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<RecoveryProposal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (activeProject) {
      loadOverviewData();
    }
  }, [activeProject]);

  const loadOverviewData = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const [tasksData, riskData, leavesData, proposalsData, auditsData] = await Promise.all([
        api.getTasks({ project_id: activeProject.id }),
        api.getRiskAnalysis(activeProject.id),
        api.getLeaveRequests({ status_filter: 'PENDING' }),
        api.getRecoveryProposals(activeProject.id),
        api.getAuditTrail(activeProject.id)
      ]);

      setTasks(tasksData);
      setRiskAnalysis(riskData);
      setPendingLeaves(leavesData);
      setPendingProposals(proposalsData.filter(p => p.status === 'PENDING_APPROVAL'));
      setRecentAudits(auditsData.slice(0, 8));
    } catch (err) {
      console.error("Failed to load overview data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const blockedTasks = tasks.filter(t => t.is_blocked || t.status === 'BLOCKED').length;
  const overdueTasks = tasks.filter(t => t.status !== 'COMPLETED' && new Date(t.due_date) < new Date()).length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Welcome & Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
            Manager Control Center
          </span>
          <h1 className="text-2xl font-bold text-charcoal-900 mt-0.5">
            {activeProject ? activeProject.name : 'Project Overview'}
          </h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Welcome back, {user?.full_name}. Here is the current delivery status and risk posture.
          </p>
        </div>

        {riskAnalysis && (
          <div className="flex items-center gap-3">
            <RiskBadge level={riskAnalysis.risk_level} score={riskAnalysis.score} size="lg" />
            <Link
              to="/manager/risk"
              className="p-2 rounded-lg border border-charcoal-200 text-charcoal-600 hover:text-charcoal-900 hover:bg-white text-xs font-medium"
              title="Inspect Risk Details"
            >
              Details
            </Link>
          </div>
        )}
      </div>

      {/* High Risk Callout Banner (if risk is high or pending proposals exist) */}
      {pendingProposals.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-forest-900 to-charcoal-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-forest-700 text-emerald-300 mt-0.5">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Action Required: {pendingProposals[0].title}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-forest-800 text-emerald-300 border border-forest-600">
                  AI Proposal Ready
                </span>
              </div>
              <p className="text-xs text-forest-100 mt-1 max-w-2xl leading-relaxed">
                {pendingProposals[0].summary} Contains {pendingProposals[0].proposed_actions.length} validated actions (reassignments, blocker escalation, schedule buffer).
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedProposal(pendingProposals[0])}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 text-charcoal-900 text-xs font-bold hover:bg-emerald-400 shadow-md transition-all whitespace-nowrap"
          >
            <span>Review & Approve Proposal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Completion"
          value={`${completionPct}%`}
          subtitle={`${completedTasks} of ${totalTasks} tasks finished`}
          icon={CheckSquare}
          variant="forest"
          action={{ label: "View Tasks", onClick: () => navigate('/manager/tasks') }}
        />
        <StatCard
          title="Active Blockers"
          value={blockedTasks}
          subtitle={blockedTasks > 0 ? "Impediments halting progress" : "No active work blockers"}
          icon={AlertOctagon}
          variant={blockedTasks > 0 ? "danger" : "success"}
          action={{ label: "Inspect", onClick: () => navigate('/manager/tasks') }}
        />
        <StatCard
          title="Pending Leave"
          value={pendingLeaves.length}
          subtitle={pendingLeaves.length > 0 ? "Awaiting manager review" : "No pending time off"}
          icon={CalendarDays}
          variant={pendingLeaves.length > 0 ? "warning" : "default"}
          action={{ label: "Review", onClick: () => navigate('/manager/leave') }}
        />
        <StatCard
          title="Overdue Tasks"
          value={overdueTasks}
          subtitle={overdueTasks > 0 ? "Past scheduled due date" : "All tasks within schedule"}
          icon={Clock}
          variant={overdueTasks > 0 ? "danger" : "success"}
          action={{ label: "Reschedule", onClick: () => navigate('/manager/tasks') }}
        />
      </div>

      {/* Two Column Layout: Critical Path Tasks & Recent Decision Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Tasks Requiring Attention */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">
              Critical Path Tasks & Blockers
            </h3>
            <Link to="/manager/tasks" className="text-xs font-semibold text-forest-700 hover:underline">
              View All Tasks →
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-charcoal-100 shadow-card divide-y divide-charcoal-50 overflow-hidden">
            {tasks.slice(0, 5).map((t) => (
              <div
                key={t.id}
                onClick={() => navigate('/manager/tasks')}
                className="p-4 hover:bg-charcoal-50/60 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-charcoal-400">#{t.id}</span>
                    <h4 className="text-sm font-semibold text-charcoal-900 truncate">{t.title}</h4>
                    {t.is_blocked && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        BLOCKED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-charcoal-500 mt-1">
                    <span>{t.assignee ? t.assignee.full_name : 'Unassigned'}</span>
                    <span>•</span>
                    <span>Due {t.due_date}</span>
                    <span>•</span>
                    <span>{t.estimated_hours}h estimated</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-bold text-charcoal-700 block">{t.progress_pct}%</span>
                  <div className="w-16 h-1.5 bg-charcoal-100 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full ${t.is_blocked ? 'bg-rose-500' : 'bg-forest-600'}`}
                      style={{ width: `${t.progress_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recent Decision Audit Activity */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">
              Recent Activity & Decisions
            </h3>
            <Link to="/manager/audit" className="text-xs font-semibold text-forest-700 hover:underline">
              Full Audit Trail →
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-charcoal-100 shadow-card p-4 space-y-3">
            {recentAudits.length === 0 ? (
              <p className="text-xs text-charcoal-400 text-center py-6">No activity records logged yet.</p>
            ) : (
              recentAudits.map((a) => (
                <div key={a.id} className="text-xs pb-3 border-b border-charcoal-50 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-charcoal-400 text-[10px] mb-0.5">
                    <span className="font-semibold text-forest-800 uppercase tracking-wider">
                      {a.event_type.replace(/_/g, ' ')}
                    </span>
                    <span>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-charcoal-800 font-medium leading-relaxed">{a.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recovery Review Modal */}
      {selectedProposal && (
        <RecoveryReviewModal
          isOpen={!!selectedProposal}
          onClose={() => setSelectedProposal(null)}
          proposal={selectedProposal}
          onDecided={async () => {
            await loadOverviewData();
            await refreshProjects();
          }}
        />
      )}
    </div>
  );
};
