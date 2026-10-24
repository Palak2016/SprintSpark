import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Building2,
  KeyRound,
  LogOut,
  Mail,
  UserCheck,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AdministeredCompany } from '../../types';

export interface CompanyPortalContext {
  companies: AdministeredCompany[];
  refreshCompanies: () => Promise<void>;
}

/**
 * Dedicated shell for the Company Portal.
 *
 * Only reachable by designated Company Admins (route guard), and every API
 * call it makes is authorized again by the backend for the specific company
 * in the URL. Admins of several companies switch between them here.
 */
export const CompanyLayout: React.FC = () => {
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [companies, setCompanies] = useState<AdministeredCompany[]>([]);

  const currentId = useMemo(() => {
    const match = location.pathname.match(/^\/company\/(\d+)/);
    return match ? Number(match[1]) : null;
  }, [location.pathname]);

  const refreshCompanies = useCallback(async () => {
    try {
      setCompanies(await api.getAdministeredCompanies());
    } catch (err) {
      console.error('Failed to load administered companies:', err);
    }
  }, []);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies, currentId]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Failed to log out:', err);
      setLoggingOut(false);
    }
  };

  const switchCompany = (nextId: number) => {
    const section = location.pathname.replace(/^\/company\/\d+/, '');
    navigate(`/company/${nextId}${section}`);
  };

  const current = companies.find((company) => company.id === currentId);
  const base = currentId ? `/company/${currentId}` : '/company';
  const workspacePath = isManager ? '/manager' : '/employee';

  const sections = [
    { to: base, label: 'Overview', icon: Building2, end: true },
    {
      to: `${base}/approvals`,
      label: 'Approvals',
      icon: UserCheck,
      badge: current?.pending_approvals || undefined,
    },
    { to: `${base}/invitations`, label: 'Invitations', icon: Mail },
    { to: `${base}/analytics`, label: 'Analytics', icon: BarChart3 },
    { to: `${base}/ownership`, label: 'Ownership', icon: KeyRound },
    { to: `${base}/activity`, label: 'Activity', icon: Activity },
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-gradient-to-r from-violet-500/25 via-violet-500/15 to-transparent text-white'
        : 'text-[#A99DBD] hover:bg-white/[0.055] hover:text-white'
    }`;

  return (
    <div className="dashboard-layout min-h-screen bg-[#100B1D] text-[#FAF8FF]">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#100B1D]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 pt-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size="sm" onDarkBackground />
            <span className="hidden items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Company Portal
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            {companies.length > 1 && currentId && (
              <label className="flex min-w-0 items-center gap-2 text-xs text-[#A99DBD]">
                <span className="hidden sm:inline">Company</span>
                <select
                  aria-label="Switch company"
                  value={currentId}
                  onChange={(event) => switchCompany(Number(event.target.value))}
                  className="max-w-[180px] rounded-lg border border-white/10 bg-[#19112B] px-2.5 py-2 text-sm text-white focus:border-violet-400/50 focus:outline-none"
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <NavLink to={workspacePath} end className={navLinkClass}>
              <ArrowLeft className="h-4 w-4" />
              <span>{isManager ? 'Manager Portal' : 'My Workspace'}</span>
            </NavLink>
            {user && (
              <div className="hidden min-w-0 text-right md:block">
                <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
                <p className="truncate text-xs text-[#9487AA]">{user.email}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out of your account"
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-500/[0.08] px-2.5 py-2.5 text-xs font-semibold text-rose-300 transition-all hover:border-rose-400/30 hover:bg-rose-500/[0.15] hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">
                {loggingOut ? 'Signing out...' : 'Logout'}
              </span>
            </button>
          </div>
        </div>

        <nav
          aria-label="Company portal navigation"
          className="mx-auto flex w-full max-w-[1600px] gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8"
        >
          {sections.map((section) => (
            <NavLink key={section.label} to={section.to} end={section.end} className={navLinkClass}>
              <section.icon className="h-4 w-4" />
              <span>{section.label}</span>
              {section.badge ? (
                <span className="rounded-full bg-amber-400/20 px-1.5 text-[10px] font-bold text-amber-200">
                  {section.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="relative min-h-[calc(100vh-112px)] overflow-x-hidden bg-[#100B1D] p-4 text-[#FAF8FF] sm:p-6 lg:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed right-0 top-20 -z-0 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]"
        />
        <div className="relative z-10 mx-auto w-full max-w-[1600px] text-[#FAF8FF]">
          <div className="[&_h1]:text-[#FAF8FF] [&_h2]:text-[#FAF8FF] [&_h3]:text-[#FAF8FF] [&_p]:text-[#B7ADC9] [&_label]:text-[#B7ADC9]">
            <Outlet context={{ companies, refreshCompanies } satisfies CompanyPortalContext} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompanyLayout;
