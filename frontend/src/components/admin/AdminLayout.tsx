import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Building2,
  KeyRound,
  LayoutDashboard,
  Mail,
  Settings,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AdministeredCompany } from '../../types';
import { adminPath } from '../../utils/workspace';
import { DashboardLayout } from '../dashboard/DashboardLayout';
import { NavItem } from '../dashboard/Sidebar';

export interface AdminConsoleContext {
  companies: AdministeredCompany[];
  refreshCompanies: () => Promise<void>;
}

/**
 * Admin console (Company Admins only).
 *
 * Uses the same shell, theme and account menu as the Manager and Employee
 * workspaces, with its own navigation. The company is part of the URL; only
 * companies the server lists as administered by this user are allowed, and
 * every API call is authorized again by the backend for that company.
 */
export const AdminLayout: React.FC = () => {
  const { refreshUser, homePath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [companies, setCompanies] = useState<AdministeredCompany[]>([]);
  const [loaded, setLoaded] = useState(false);

  const currentId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/(\d+)/);
    return match ? Number(match[1]) : null;
  }, [location.pathname]);

  const refreshCompanies = useCallback(async () => {
    try {
      setCompanies(await api.getAdministeredCompanies());
    } catch (err) {
      console.error('Failed to load administered companies:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Re-check on navigation and when the tab regains focus, so a completed
  // ownership transfer takes effect without a reload.
  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies, location.pathname]);

  useEffect(() => {
    const onFocus = () => void refreshCompanies();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshCompanies]);

  const allowed = companies.some((company) => company.id === currentId);

  // Lost admin rights (e.g. ownership transferred): refresh the user so the
  // rest of the app stops offering the Admin console.
  useEffect(() => {
    if (loaded && currentId !== null && !allowed) {
      void refreshUser();
    }
  }, [loaded, currentId, allowed, refreshUser]);

  if (loaded && currentId !== null && !allowed) {
    const fallback = companies[0];
    return <Navigate to={fallback ? adminPath(fallback.id) : homePath} replace />;
  }

  const current = companies.find((company) => company.id === currentId);
  const section = (name: string) => (currentId ? adminPath(currentId, name) : '/admin');

  const navItems: NavItem[] = [
    { name: 'Overview', href: section('overview'), icon: LayoutDashboard },
    { name: 'Members', href: section('members'), icon: UsersRound },
    {
      name: 'Approvals',
      href: section('approvals'),
      icon: UserCheck,
      highlight: Boolean(current?.pending_approvals),
      badge: current?.pending_approvals ? String(current.pending_approvals) : undefined,
    },
    { name: 'Invitations', href: section('invitations'), icon: Mail },
    { name: 'Analytics', href: section('analytics'), icon: BarChart3 },
    { name: 'Activity', href: section('activity'), icon: Activity },
    { name: 'Ownership', href: section('ownership'), icon: KeyRound },
    { name: 'Settings', href: section('settings'), icon: Settings },
  ];

  const switchCompany = (nextId: number) => {
    const rest = location.pathname.replace(/^\/admin\/\d+\/?/, '') || 'overview';
    navigate(adminPath(nextId, rest));
  };

  // Same look as the project picker it replaces in the top bar.
  const companyPicker = (
    <div className="dashboard-control flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-sm sm:px-3">
      <span className="dashboard-project-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/15">
        <Building2 className="dashboard-topbar-icon h-4 w-4 text-violet-300" />
      </span>
      <span className="min-w-0 text-left">
        <span className="hidden text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8F83A7] sm:block">
          Administering
        </span>
        {companies.length > 1 && currentId ? (
          <select
            aria-label="Switch company"
            value={currentId}
            onChange={(event) => switchCompany(Number(event.target.value))}
            className="max-w-[200px] rounded-md bg-transparent font-medium text-[#F3EDFF] focus:outline-none"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="block max-w-[160px] truncate font-medium text-[#F3EDFF] sm:max-w-[240px]">
            {current?.name ?? (loaded ? '—' : 'Loading...')}
          </span>
        )}
      </span>
    </div>
  );

  return (
    <DashboardLayout
      isAdminConsole
      navItems={navItems}
      workspaceLabel="Admin console"
      topbarLeading={companyPicker}
      outletContext={{ companies, refreshCompanies } satisfies AdminConsoleContext}
    />
  );
};

export default AdminLayout;
