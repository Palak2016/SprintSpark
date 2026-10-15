import React from 'react';
import { Task, TaskStatus } from '../../types';
import { AlertOctagon, Clock, User as UserIcon, Link2, CheckCircle2 } from 'lucide-react';

interface TaskKanbanProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (task: Task, newStatus: TaskStatus) => void;
  onBlockerClick: (task: Task) => void;
}

export const TaskKanban: React.FC<TaskKanbanProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  onBlockerClick
}) => {
  const columns: { id: TaskStatus; title: string; color: string; dot: string }[] = [
    { id: 'TODO', title: 'To Do', color: 'border-t-charcoal-300', dot: 'bg-charcoal-400' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-forest-500', dot: 'bg-forest-500' },
    { id: 'BLOCKED', title: 'Blocked', color: 'border-t-rose-500', dot: 'bg-rose-500' },
    { id: 'COMPLETED', title: 'Completed', color: 'border-t-emerald-500', dot: 'bg-emerald-500' },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">MED</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-charcoal-100 text-charcoal-600">LOW</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            className={`bg-charcoal-50/60 rounded-xl border border-charcoal-100 p-3.5 border-t-4 ${col.color}`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <h3 className="text-xs font-bold text-charcoal-800 uppercase tracking-wider">{col.title}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-charcoal-200 text-charcoal-600">
                {colTasks.length}
              </span>
            </div>

            {/* Task Cards */}
            <div className="space-y-2.5 min-h-[300px]">
              {colTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-charcoal-400 border border-dashed border-charcoal-200 rounded-lg">
                  No tasks in this lane
                </div>
              ) : (
                colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 bg-white rounded-lg border border-charcoal-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => onTaskClick(task)}
                  >
                    {/* Priority & ID */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-medium text-charcoal-400">
                        #{task.id}
                      </span>
                      {getPriorityBadge(task.priority)}
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-semibold text-charcoal-900 group-hover:text-forest-700 transition-colors line-clamp-2">
                      {task.title}
                    </h4>

                    {/* Blocker alert if present */}
                    {task.is_blocked && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlockerClick(task);
                        }}
                        className="mt-2.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-1.5"
                      >
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2 font-medium">{task.blocker_reason || 'Blocked'}</span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-charcoal-500 mb-1">
                        <span>Progress</span>
                        <span className="font-semibold text-charcoal-700">{task.progress_pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-charcoal-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            task.progress_pct === 100 
                              ? 'bg-emerald-500' 
                              : task.is_blocked 
                              ? 'bg-rose-500' 
                              : 'bg-forest-600'
                          }`}
                          style={{ width: `${task.progress_pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta info & Assignee */}
                    <div className="mt-3 pt-2.5 border-t border-charcoal-100 flex items-center justify-between text-xs text-charcoal-500">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1" title="Estimated effort">
                          <Clock className="w-3 h-3 text-charcoal-400" />
                          <span>{task.estimated_hours}h</span>
                        </span>
                        {task.dependencies && task.dependencies.length > 0 && (
                          <span className="flex items-center gap-0.5 text-charcoal-400" title={`${task.dependencies.length} prerequisite task(s)`}>
                            <Link2 className="w-3 h-3" />
                            <span>{task.dependencies.length}</span>
                          </span>
                        )}
                      </div>

                      {/* Assignee Avatar */}
                      <div className="flex items-center gap-1.5">
                        {task.assignee ? (
                          <span className="inline-flex items-center gap-1 font-medium text-charcoal-700 text-[11px]">
                            <img
                              src={task.assignee.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${task.assignee.full_name}`}
                              alt={task.assignee.full_name}
                              className="w-4 h-4 rounded-full border border-charcoal-200"
                            />
                            <span className="truncate max-w-[80px]">{task.assignee.full_name.split(' ')[0]}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-charcoal-400 italic">Unassigned</span>
                        )}
                      </div>
                    </div>

                    {/* Quick Move Action bar */}
                    <div className="mt-2.5 pt-2 border-t border-charcoal-50 flex items-center justify-between text-[11px]">
                      <span className="text-charcoal-400 text-[10px]">Due {task.due_date}</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {col.id !== 'TODO' && (
                          <button
                            onClick={() => onStatusChange(task, 'TODO')}
                            className="px-1.5 py-0.5 rounded text-[10px] hover:bg-charcoal-100 text-charcoal-500"
                          >
                            Todo
                          </button>
                        )}
                        {col.id !== 'IN_PROGRESS' && (
                          <button
                            onClick={() => onStatusChange(task, 'IN_PROGRESS')}
                            className="px-1.5 py-0.5 rounded text-[10px] hover:bg-forest-50 text-forest-700 font-medium"
                          >
                            Progress
                          </button>
                        )}
                        {col.id !== 'COMPLETED' && (
                          <button
                            onClick={() => onStatusChange(task, 'COMPLETED')}
                            className="px-1.5 py-0.5 rounded text-[10px] hover:bg-emerald-50 text-emerald-700 font-semibold"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
