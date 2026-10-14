import React, { useState, useEffect } from 'react';
import { getEmployeeDashboard } from '../services/employeeService';
import MainLayout from '../layouts/MainLayout';
import FocusGuardianModal from '../components/ai/FocusGuardianModal';

const EmployeeDashboard = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for controlling the Focus Guardian Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await getEmployeeDashboard();
      setData(response.data);
    } catch (err) {
      setError('Unable to load dashboard data. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="mb-6">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200"></div>
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((skeleton) => (
            <div key={skeleton} className="h-48 animate-pulse rounded-xl bg-white shadow-sm border border-gray-100 p-6">
              <div className="mb-4 h-6 w-1/2 rounded bg-gray-200"></div>
              <div className="h-4 w-full rounded bg-gray-200 mb-2"></div>
              <div className="h-4 w-3/4 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex h-full flex-col items-center justify-center rounded-xl bg-red-50 p-8 border border-red-100">
          <h2 className="mb-2 text-lg font-semibold text-red-800">Something went wrong</h2>
          <p className="mb-6 text-center text-red-600">{error}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back, Komal!</h2>
          <p className="text-sm text-gray-500 mt-1">Here is an overview of your work today.</p>
        </div>
        {/* Test Button for Focus Guardian Modal */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Test Focus Guardian
        </button>
      </header>

      {/* Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* Box 1: My Tasks */}
        <section className="col-span-1 rounded-xl bg-white p-6 shadow-sm border border-gray-100 md:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">My Tasks</h3>
          <ul className="space-y-3">
            {data?.tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 hover:bg-gray-100">
                <div>
                  <p className="font-medium text-gray-800">{task.title}</p>
                  <p className="text-xs text-gray-500 mt-1">Status: {task.status}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full 
                  ${task.priority === 'Critical' ? 'bg-red-100 text-red-700' : ''}
                  ${task.priority === 'High' ? 'bg-orange-100 text-orange-700' : ''}
                  ${task.priority === 'Low' ? 'bg-green-100 text-green-700' : ''}
                `}>
                  {task.priority}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Box 2: Deadlines */}
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 border-b pb-2">Deadlines</h3>
          <ul className="space-y-4">
            {data?.deadlines.map((deadline) => (
              <li key={deadline.id} className="flex flex-col">
                <span className="font-medium text-gray-800 text-sm">{deadline.project}</span>
                <span className="text-xs font-semibold text-indigo-600 mt-1">Due: {deadline.date}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Focus Guardian Modal Component Render */}
      <FocusGuardianModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentTask="Design Landing Page"
        targetTask="Fix Auth Bug"
      />
    </MainLayout>
  );
};

export default EmployeeDashboard;