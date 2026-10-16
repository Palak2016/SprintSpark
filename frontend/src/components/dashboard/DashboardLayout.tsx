
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="dashboard-layout min-h-screen bg-[#100B1D] text-[#FAF8FF]">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden md:block ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />

          <aside className="absolute inset-y-0 left-0 z-10 w-64 overflow-y-auto border-r border-white/10 bg-[#19112B] shadow-2xl">
            <Sidebar
              collapsed={false}
              setCollapsed={() => setMobileSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main Dashboard */}
      <div
        className={`min-h-screen min-w-0 transition-[margin] duration-200 ${
          collapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <Topbar
          onToggleMobileSidebar={() =>
            setMobileSidebarOpen((previous) => !previous)
          }
        />

        
<main className="relative min-h-[calc(100vh-64px)] overflow-x-hidden bg-[#100B1D] p-4 text-[#FAF8FF] sm:p-6 lg:p-8">
  <div
    aria-hidden="true"
    className="pointer-events-none fixed right-0 top-20 -z-0 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]"
  />

  <div className="relative z-10 mx-auto w-full max-w-[1600px] text-[#FAF8FF]">
    <div className="[&_h1]:text-[#FAF8FF] [&_h2]:text-[#FAF8FF] [&_h3]:text-[#FAF8FF] [&_p]:text-[#B7ADC9] [&_label]:text-[#B7ADC9]">
      <Outlet />
    </div>
  </div>
</main>

      </div>
    </div>
  );
};

export default DashboardLayout;