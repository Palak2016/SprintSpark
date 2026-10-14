import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { getProjectTasks } from '../services/managerService';

const ProjectTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isKanban, setIsKanban] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        const response = await getProjectTasks();
        setTasks(response.data);
      } catch (err) {
        setError('Failed to load project tasks.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const kanbanColumns = ['Todo', 'In Progress', 'Review', 'Done'];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="mb-6 flex justify-between items-center">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200"></div>
          <div className="h-10 w-24 animate-pulse rounded bg-gray-200"></div>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="min-w-[280px] flex-1 rounded-xl bg-gray-100 p-4 h-96 animate-pulse"></div>
          ))}
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex h-64 items-center justify-center rounded-xl bg-red-50 text-red-600">
          {error}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Project Tasks</h2>
          <p className="text-sm text-gray-500 mt-1">Manage and track development phases.</p>
        </div>
        
        {/* View Toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setIsKanban(true)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isKanban ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setIsKanban(false)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              !isKanban ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            List
          </button>
        </div>
      </header>

      {isKanban ? (
        /* KANBAN VIEW */
        <div className="flex gap-6 overflow-x-auto pb-4 items-start">
          {kanbanColumns.map((columnStatus) => (
            <div key={columnStatus} className="min-w-[280px] flex-1 rounded-xl bg-slate-100 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">{columnStatus}</h3>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                  {tasks.filter((t) => t.status === columnStatus).length}
                </span>
              </div>
              
              <div className="space-y-3">
                {tasks
                  .filter((task) => task.status === columnStatus)
                  .map((task) => (
                    <div key={task.id} className="rounded-lg bg-white p-4 shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer">
                      <div className="mb-2 flex items-start justify-between">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${
                          task.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                          task.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="mb-3 font-medium text-gray-800 text-sm">{task.title}</p>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                            {task.assignee.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-500">{task.assignee}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-gray-200 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">Task Title</th>
                  <th className="px-6 py-4 font-semibold">Assignee</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{task.title}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {task.assignee.charAt(0)}
                        </div>
                        {task.assignee}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        task.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                        task.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default ProjectTasks;