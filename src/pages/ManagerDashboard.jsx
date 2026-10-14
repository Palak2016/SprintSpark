import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { getManagerDashboard } from '../services/managerService';

const ManagerDashboard = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await getManagerDashboard();
        setData(response.data);
      } catch (err) {
        setError('Failed to load manager dashboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="mb-6">
          <div className="h-8 w-64 animate-pulse rounded bg-gray-200"></div>
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="mb-4 h-6 w-1/2 rounded bg-gray-200"></div>
              <div className="space-y-3">
                <div className="h-10 w-full rounded bg-gray-100"></div>
                <div className="h-10 w-full rounded bg-gray-100"></div>
                <div className="h-10 w-full rounded bg-gray-100"></div>
              </div>
            </div>
          ))}
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex h-64 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
          <p className="font-medium">{error}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Manager Overview</h2>
        <p className="text-sm text-gray-500 mt-1">Track project health and team capacity.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 items-start">
        {/* Widget 1: Project Health */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">Project Health</h3>
          <ul className="space-y-4">
            {data.projectHealth.map((proj) => (
              <li key={proj.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{proj.name}</p>
                  <p className="text-xs text-gray-500">{proj.status}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                  proj.risk === 'High' ? 'bg-red-100 text-red-700' :
                  proj.risk === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {proj.risk} Risk
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Widget 2: Team Workload */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">Team Workload</h3>
          <ul className="space-y-4">
            {data.teamWorkload.map((member) => (
              <li key={member.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{member.member}</span>
                  <span className="text-sm text-gray-500">{member.capacity}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${member.capacity >= 90 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${member.capacity}%` }}
                  ></div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Widget 3: High-Risk Tasks */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 md:col-span-2 xl:col-span-1">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">High-Risk Tasks</h3>
          <ul className="space-y-3">
            {data.highRiskTasks.map((task) => (
              <li key={task.id} className="rounded-lg bg-red-50 p-3 border border-red-100">
                <p className="font-medium text-red-900">{task.title}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-red-700 bg-white px-2 py-1 rounded shadow-sm">{task.project}</span>
                  <span className="text-red-600 font-medium">{task.assignee}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </MainLayout>
  );
};

export default ManagerDashboard;