import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { TeamMemberAvailability } from '../../types';
import {
  Users, Calendar, Clock, AlertTriangle, CheckCircle2,
  CalendarDays, ArrowUpRight
} from 'lucide-react';

export const TeamAvailabilityView: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    setIsLoading(true);
    try {
      const data = await api.getTeamAvailability();
      setTeamMembers(data);
    } catch (err) {
      console.error("Failed to load availability:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getCapacityBadge = (status: string) => {
    switch (status) {
      case 'OVERLOADED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">Overloaded (&gt;45h)</span>;
      case 'OPTIMAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Optimal Load</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Capacity Available</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Team Capacity & Availability</h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Committed workload and approved leave schedules for delivery planning
        </p>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMembers.map((member) => (
          <div
            key={member.user.id}
            className="p-5 rounded-2xl bg-white border border-charcoal-100 shadow-card flex flex-col justify-between"
          >
            <div>
              {/* Member Card Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={member.user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user.full_name}`}
                    alt={member.user.full_name}
                    className="w-10 h-10 rounded-full border border-charcoal-200"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-charcoal-900">{member.user.full_name}</h3>
                    <p className="text-xs text-charcoal-500">{member.user.role}</p>
                  </div>
                </div>
                {getCapacityBadge(member.capacity_status)}
              </div>

              {/* Workload Stats */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-offwhite/80 border border-charcoal-100 mb-4 text-xs">
                <div>
                  <span className="text-charcoal-400 block text-[10px] uppercase font-bold">Active Tasks</span>
                  <span className="text-base font-bold text-charcoal-900 mt-0.5 block">{member.active_task_count}</span>
                </div>
                <div>
                  <span className="text-charcoal-400 block text-[10px] uppercase font-bold">Remaining Effort</span>
                  <span className="text-base font-bold text-forest-700 mt-0.5 block">{member.total_remaining_hours}h</span>
                </div>
              </div>

              {/* Today's Availability Status */}
              <div className="flex items-center gap-2 text-xs mb-4">
                {member.is_on_leave_today ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Currently on Approved Leave Today</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active and Available Today</span>
                  </span>
                )}
              </div>

              {/* Upcoming Leaves */}
              <div>
                <h4 className="text-[11px] font-bold text-charcoal-400 uppercase tracking-wider mb-2">
                  Scheduled Approved Leaves
                </h4>
                {member.upcoming_leaves.length === 0 ? (
                  <p className="text-xs text-charcoal-400 italic">No upcoming planned absences.</p>
                ) : (
                  <div className="space-y-1.5">
                    {member.upcoming_leaves.map((leave) => (
                      <div
                        key={leave.id}
                        className="p-2 rounded-lg bg-charcoal-50 border border-charcoal-100 text-xs text-charcoal-700 flex items-center justify-between"
                      >
                        <span className="font-medium">{leave.start_date} to {leave.end_date}</span>
                        {leave.reason && (
                          <span className="text-[11px] text-charcoal-500 truncate max-w-[120px]" title={leave.reason}>
                            {leave.reason}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
