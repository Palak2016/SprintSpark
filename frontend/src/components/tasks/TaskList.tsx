import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus } from '../../types';
import {
  Search, Filter, AlertOctagon, Link2, Clock, CheckCircle2,
  Calendar, MoreVertical, Edit2, AlertCircle
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onBlockerClick: (task: Task) => void;
  onEditClick: (task: Task) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onTaskClick,
  onBlockerClick,
  onEditClick
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                          (t.assignee?.full_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="bg-white rounded-xl border border-charcoal-100 shadow-card overflow-hidden">
      {/* Filters Toolbar */}
      <div className="p-4 border-b border-charcoal-100 flex flex-col sm:flex-row gap-3 items-center justify-between bg-offwhite/40">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-charcoal-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tasks or assignees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-charcoal-200 bg-white focus:outline-none focus:ring-1 focus:ring-forest-600 focus:border-forest-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-charcoal-200 bg-white text-charcoal-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-charcoal-200 bg-white text-charcoal-700 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-charcoal-50 text-charcoal-500 uppercase tracking-wider font-semibold border-b border-charcoal-100">
            <tr>
              <th className="py-3 px-4">Task</th>
              <th className="py-3 px-3">Assignee</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Priority</th>
              <th className="py-3 px-3">Progress</th>
              <th className="py-3 px-3">Due Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-50 text-charcoal-800">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-charcoal-400">
                  No tasks found matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="hover:bg-charcoal-50/70 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 max-w-xs">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-charcoal-400 mt-0.5">#{task.id}</span>
                      <div>
                        <p className="font-medium text-charcoal-900 group-hover:text-forest-700 transition-colors">
                          {task.title}
                        </p>
                        {task.is_blocked && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                            {task.blocker_reason || 'Blocked'}
                          </span>
                        )}
                        {task.dependencies && task.dependencies.length > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-charcoal-500 ml-2">
                            <Link2 className="w-2.5 h-2.5" />
                            Depends on #{task.dependencies.map(d => d.prerequisite_task_id).join(', #')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={task.assignee.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${task.assignee.full_name}`}
                          alt={task.assignee.full_name}
                          className="w-5 h-5 rounded-full border border-charcoal-200"
                        />
                        <span className="truncate max-w-[100px]">{task.assignee.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-charcoal-400 italic">Unassigned</span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      task.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      task.status === 'IN_PROGRESS' ? 'bg-forest-50 text-forest-700 border border-forest-200' :
                      'bg-charcoal-100 text-charcoal-600'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className={`font-semibold text-[11px] ${
                      task.priority === 'CRITICAL' ? 'text-rose-700 font-bold' :
                      task.priority === 'HIGH' ? 'text-amber-700' :
                      task.priority === 'MEDIUM' ? 'text-blue-700' :
                      'text-charcoal-500'
                    }`}>
                      {task.priority}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="w-24">
                      <div className="flex justify-between text-[10px] text-charcoal-500 mb-0.5">
                        <span>{task.progress_pct}%</span>
                        <span>{task.estimated_hours}h</span>
                      </div>
                      <div className="w-full h-1.5 bg-charcoal-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${task.progress_pct === 100 ? 'bg-emerald-500' : task.is_blocked ? 'bg-rose-500' : 'bg-forest-600'}`}
                          style={{ width: `${task.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-charcoal-600 whitespace-nowrap">
                    {task.due_date}
                  </td>

                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onBlockerClick(task)}
                        title={task.is_blocked ? "Resolve Blocker" : "Flag Blocker"}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          task.is_blocked 
                            ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
                            : 'border-charcoal-200 text-charcoal-500 hover:text-charcoal-800 hover:bg-charcoal-100'
                        }`}
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onEditClick(task)}
                        title="Edit Task"
                        className="p-1.5 rounded-lg border border-charcoal-200 text-charcoal-500 hover:text-charcoal-800 hover:bg-charcoal-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
