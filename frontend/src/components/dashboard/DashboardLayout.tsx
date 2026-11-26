
import React from 'react';
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

  return (
    <div className="dashboard-layout min-h-screen bg-[#100B1D] text-[#FAF8FF]">
      <div className="sticky top-0 z-30 shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
        <Sidebar {...sidebarProps} />
        <Topbar leading={topbarLeading} />
      </div>

      <main className="relative min-h-[calc(100vh-128px)] overflow-x-hidden bg-[#100B1D] p-4 text-[#FAF8FF] sm:p-6 lg:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed right-0 top-32 z-0 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]"
        />

        <div className="relative z-10 mx-auto w-full max-w-400 text-[#FAF8FF]">
          <div className="[&_h1]:text-[#FAF8FF] [&_h2]:text-[#FAF8FF] [&_h3]:text-[#FAF8FF] [&_p]:text-[#B7ADC9] [&_label]:text-[#B7ADC9]">
            <Outlet context={outletContext} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;