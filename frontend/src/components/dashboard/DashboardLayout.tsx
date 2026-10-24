
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { NavItem, Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Shell shared by every workspace (Manager, Employee and the Admin console),
 * so they look and theme the same. The Admin console passes its own
 * navigation, workspace label and header content.
 */
export interface DashboardLayoutProps {
  navItems?: NavItem[];
  workspaceLabel?: string;
  /** Replaces the project picker in the top bar. */
  topbarLeading?: React.ReactNode;
  outletContext?: unknown;
  isAdminConsole?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  navItems,
  workspaceLabel,
  topbarLeading,
  outletContext,
  isAdminConsole = false,
}) => {
  const sidebarProps = { navItems, workspaceLabel, isAdminConsole };
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
          {...sidebarProps}
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
              {...sidebarProps}
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
          leading={topbarLeading}
        />

        
<main className="relative min-h-[calc(100vh-64px)] overflow-x-hidden bg-[#100B1D] p-4 text-[#FAF8FF] sm:p-6 lg:p-8">
  <div
    aria-hidden="true"
    className="pointer-events-none fixed right-0 top-20 -z-0 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]"
  />

  <div className="relative z-10 mx-auto w-full max-w-[1600px] text-[#FAF8FF]">
    <div className="[&_h1]:text-[#FAF8FF] [&_h2]:text-[#FAF8FF] [&_h3]:text-[#FAF8FF] [&_p]:text-[#B7ADC9] [&_label]:text-[#B7ADC9]">
      <Outlet context={outletContext} />
    </div>
  </div>
</main>

      </div>
    </div>
  );
};

export default DashboardLayout;