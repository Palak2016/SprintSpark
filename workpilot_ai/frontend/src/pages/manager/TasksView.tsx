import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { Task, TaskStatus, UserSimple } from '../../types';
import { TaskKanban } from '../../components/tasks/TaskKanban';
import { TaskList } from '../../components/tasks/TaskList';
import { TaskModal } from '../../components/tasks/TaskModal';
import { BlockerModal } from '../../components/tasks/BlockerModal';
import {
  Kanban, List, Plus, Filter, Search, CheckSquare,
  AlertOctagon, RefreshCw
} from 'lucide-react';

export const TasksView: React.FC = () => {
  const { activeProject } = useProject();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<UserSimple[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [taskForBlocker, setTaskForBlocker] = useState<Task | null>(null);

  useEffect(() => {
    if (activeProject) {
      loadTasks();
      loadUsers();
    }
  }, [activeProject]);

  const loadTasks = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const data = await api.getTasks({ project_id: activeProject.id });
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const usersData = await api.getAllUsers();
      setAllUsers(usersData);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      const updated = await api.updateTask(task.id, {
        status: newStatus,
        progress_pct: newStatus === 'COMPLETED' ? 100 : task.progress_pct
      });
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenBlocker = (task: Task) => {
    setTaskForBlocker(task);
    setIsBlockerModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Task Management</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            {activeProject ? activeProject.name : 'All Project Tasks'} • {tasks.length} tasks scheduled
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View switcher */}
          <div className="flex items-center bg-white border border-charcoal-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban' ? 'bg-forest-700 text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'bg-forest-700 text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* New Task Button */}
          <button
            onClick={() => {
              setSelectedTask(null);
              setIsTaskModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main Board or List */}
      {viewMode === 'kanban' ? (
        <TaskKanban
          tasks={tasks}
          onTaskClick={handleOpenEdit}
          onStatusChange={handleStatusChange}
          onBlockerClick={handleOpenBlocker}
        />
      ) : (
        <TaskList
          tasks={tasks}
          onTaskClick={handleOpenEdit}
          onBlockerClick={handleOpenBlocker}
          onEditClick={handleOpenEdit}
        />
      )}

      {/* Task Create / Edit Modal */}
      {isTaskModalOpen && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          task={selectedTask}
          projectId={activeProject?.id || 1}
          availableTasks={tasks}
          availableUsers={allUsers}
          onSaved={loadTasks}
        />
      )}

      {/* Blocker Modal */}
      {isBlockerModalOpen && (
        <BlockerModal
          isOpen={isBlockerModalOpen}
          onClose={() => setIsBlockerModalOpen(false)}
          task={taskForBlocker}
          onResolvedOrReported={loadTasks}
        />
      )}
    </div>
  );
};
