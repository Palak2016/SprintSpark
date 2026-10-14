import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const MainLayout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white shadow-lg">
        <div className="flex h-16 items-center justify-center border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-wider">WorkPilot AI</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="mb-6 px-3">
            <p className="px-4 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Employee</p>
            <ul className="space-y-1">
              <li>
                <Link to="/" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/tasks" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/tasks' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Tasks
                </Link>
              </li>
              <li>
                <Link to="/leave" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/leave' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Leave Requests
                </Link>
              </li>
              <li>
                <Link to="/work-log" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/work-log' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Work Log
                </Link>
              </li>
            </ul>
          </div>

          <div className="px-3 border-t border-slate-700 pt-4">
            <p className="px-4 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Manager & AI</p>
            <ul className="space-y-1">
              <li>
                <Link to="/manager" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/manager' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Manager Dashboard
                </Link>
              </li>
              <li>
                <Link to="/manager/leave" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/manager/leave' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Leave Approvals
                </Link>
              </li>
              <li>
                <Link to="/manager/recovery" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/manager/recovery' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Recovery Planner
                </Link>
              </li>
              <li>
                <Link to="/manager/automation" className={`block rounded-md px-4 py-2 text-sm font-medium transition-colors ${location.pathname === '/manager/automation' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  Automation Advisor
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8" role="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;