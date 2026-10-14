import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Task, LeaveRequest, DailyUpdate } from '../../types';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  CheckSquare, Clock, AlertOctagon, CalendarDays,
  Send, ArrowRight, CheckCircle2, ChevronRight
} from 'lucide-react';

export const EmployeeOverview: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<DailyUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadEmployeeData();
    }
  }, [user]);

  const loadEmployeeData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [tasksData, leavesData, updatesData] = await Promise.all([
        api.getTasks({ assignee_id: user.id }),
        api.getLeaveRequests({ user_id: user.id }),
        api.getDailyUpdates({ user_id: user.id })
      ]);
      setMyTasks(tasksData);
      setMyLeaves(leavesData);
      setRecentUpdates(updatesData.slice(0, 5));
    } catch (err) {
      console.error("Failed to load employee data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTasks = myTasks.filter(t => t.status !== 'COMPLETED');
  const completedTasks = myTasks.filter(t => t.status === 'COMPLETED');
  const blockedTasks = myTasks.filter(t => t.is_blocked || t.status === 'BLOCKED');
  const upcomingDeadlines = activeTasks
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
          Contributor Workspace
        </span>
        <h1 className="text-2xl font-bold text-charcoal-900 mt-0.5">
          Welcome back, {user?.full_name}
        </h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Here is your task queue, upcoming milestones, and time-off status.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Tasks"
          value={activeTasks.length}
          subtitle={`${completedTasks.length} tasks completed`}
          icon={CheckSquare}
          variant="forest"
          action={{ label: "Open Queue", onClick: () => navigate('/employee/tasks') }}
        />
        <StatCard
          title="Active Blockers"
          value={blockedTasks.length}
          subtitle={blockedTasks.length > 0 ? "Impediment flagged" : "Clear of blockers"}
          icon={AlertOctagon}
          variant={blockedTasks.length > 0 ? "danger" : "success"}
          action={{ label: "Details", onClick: () => navigate('/employee/tasks') }}
        />
        <StatCard
          title="Daily Updates"
          value={recentUpdates.length}
          subtitle="Standup records logged"
          icon={Send}
          variant="default"
          action={{ label: "Submit", onClick: () => navigate('/employee/daily-updates') }}
        />
        <StatCard
          title="Leave Requests"
          value={myLeaves.length}
          subtitle={myLeaves.find(l => l.status === 'PENDING') ? "1 request pending" : "All decided"}
          icon={CalendarDays}
          variant={myLeaves.find(l => l.status === 'PENDING') ? "warning" : "default"}
          action={{ label: "Apply", onClick: () => navigate('/employee/leave') }}
        />
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: My Upcoming Priority Tasks */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">
              My Active Tasks ({activeTasks.length})
            </h3>
            <Link to="/employee/tasks" className="text-xs font-semibold text-forest-700 hover:underline">
              View All Tasks →
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card divide-y divide-charcoal-50 overflow-hidden">
            {activeTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-charcoal-400">
                You have no active tasks currently assigned. Great job!
              </div>
            ) : (
              activeTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate('/employee/tasks')}
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
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-charcoal-400" />
                        <span>Due {t.due_date}</span>
                      </span>
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
              ))
            )}
          </div>
        </div>

        {/* Right: Planned Absences & Daily Updates */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">
              My Leave Requests
            </h3>
            <Link to="/employee/leave" className="text-xs font-semibold text-forest-700 hover:underline">
              Request Time Off →
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-4 space-y-3">
            {myLeaves.length === 0 ? (
              <p className="text-xs text-charcoal-400 text-center py-4">No leave requests submitted yet.</p>
            ) : (
              myLeaves.map((l) => (
                <div key={l.id} className="p-3 rounded-xl bg-charcoal-50 border border-charcoal-100 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-charcoal-800 block">{l.start_date} to {l.end_date}</span>
                    <span className="text-[11px] text-charcoal-500 truncate max-w-[180px] block mt-0.5">{l.reason || 'Planned absence'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    l.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                    l.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
