
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  CalendarDays,
  Sparkles,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  Eye,
  UserRound,
  Sun,
  Moon,
  CircleHelp,
  UsersRound,
  Building2,
  LogOut,
  X,
  Check,
  ArrowUpRight,
  ArrowLeftRight,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { WORKSPACE_LABELS, Workspace, workspaceHome } from '../../utils/workspace';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Overrides the workspace navigation (used by the Admin console). */
  navItems?: NavItem[];
  workspaceLabel?: string;
  isAdminConsole?: boolean;
}

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  highlight?: boolean;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  navItems: customNavItems,
  workspaceLabel,
  isAdminConsole = false,
}) => {
  const { user, isManager, logout, canOpen, workspaces } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Pending "become Company Admin" requests addressed to this user.
  const [incomingTransfers, setIncomingTransfers] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadIncomingTransfers = async () => {
      try {
        const transfers = await api.getIncomingCompanyTransfers();
        if (!cancelled) {
          setIncomingTransfers(
            transfers.filter((t) => t.status === 'PENDING').length,
          );
        }
      } catch {
        // Not critical: the link just stays hidden.
      }
    };

    void loadIncomingTransfers();
    window.addEventListener('focus', loadIncomingTransfers);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadIncomingTransfers);
    };
  }, [location.pathname]);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [quickstartOpen, setQuickstartOpen] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = window.localStorage.getItem('workpilot_theme');

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('workpilot_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!accountMenuOpen && !quickstartOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !accountMenuRef.current?.contains(event.target)
      ) {
        setAccountMenuOpen(false);
        setThemeMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
        setThemeMenuOpen(false);
        setQuickstartOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen, quickstartOpen]);

  const managerNav: NavItem[] = [
    { name: 'Overview', href: '/manager', icon: LayoutDashboard },
    { name: 'Projects', href: '/manager/projects', icon: FolderKanban },
    { name: 'Tasks Board', href: '/manager/tasks', icon: CheckSquare },
    { name: 'My Tasks', href: '/manager/my-tasks', icon: CheckSquare },
    { name: 'Daily Updates', href: '/manager/daily-updates', icon: Send },
    { name: 'Work Logs', href: '/manager/work-logs', icon: Clock },
    { name: 'Team & Capacity', href: '/manager/team', icon: Users },
    { name: 'Leave Requests', href: '/manager/leave', icon: CalendarDays },
    {
      name: 'Recovery Plans',
      href: '/manager/recovery',
      icon: Sparkles,
      badge: 'AI',
    },
    { name: 'Activity History', href: '/manager/audit', icon: History },
    { name: 'Settings', href: '/manager/settings', icon: Settings },
  ];

  const employeeNav: NavItem[] = [
    { name: 'My Overview', href: '/employee', icon: LayoutDashboard },
    { name: 'My Tasks', href: '/employee/tasks', icon: CheckSquare },
    { name: 'Work Logs', href: '/employee/work-logs', icon: Clock },
    { name: 'Daily Updates', href: '/employee/daily-updates', icon: Send },
    { name: 'Leave Requests', href: '/employee/leave', icon: CalendarDays },
    { name: 'Focus Guardian', href: '/employee/focus', icon: Eye },
  ];

  const transferItem: NavItem = {
    name: 'Admin Transfer',
    href: '/company-transfer',
    icon: ShieldCheck,
    highlight: true,
    badge: String(incomingTransfers),
  };
  // Only the workspace the server granted: an administration-only account
  // gets no Manager/Employee links here.
  const workspaceNav = customNavItems
    ?? (canOpen('manager') ? managerNav : canOpen('employee') ? employeeNav : []);
  const navItems = [
    ...(incomingTransfers > 0 ? [transferItem] : []),
    ...workspaceNav,
  ];

  // Other workspaces this account may open (server-decided).
  const currentWorkspace: Workspace = isAdminConsole
    ? 'admin'
    : isManager
      ? 'manager'
      : 'employee';
  const switchTargets = workspaces.filter((w) => w !== currentWorkspace);

  const accountSettingsPath = canOpen('manager')
    ? '/manager/settings'
    : canOpen('employee')
      ? '/employee/settings'
      : '/profile';

  const quickstartLinks = isAdminConsole
    ? workspaceNav.slice(0, 3).map((item) => ({ label: `Open ${item.name}`, path: item.href }))
    : isManager
    ? [
        { label: 'Review your overview', path: '/manager' },
        { label: 'Manage projects', path: '/manager/projects' },
        { label: 'Open the tasks board', path: '/manager/tasks' },
      ]
    : [
        { label: 'Review your overview', path: '/employee' },
        { label: 'View your tasks', path: '/employee/tasks' },
        { label: 'Log your work', path: '/employee/work-logs' },
      ];

  const navigateFromMenu = (path: string) => {
    setAccountMenuOpen(false);
    setThemeMenuOpen(false);
    setQuickstartOpen(false);
    navigate(path);
  };

  const switchAccount = async () => {
    setAccountMenuOpen(false);
    setThemeMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    setThemeMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const initials =
    user?.full_name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'U';

  const iconButtonClass =
    'rounded-lg p-1.5 text-[#B7ADC9] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400';

  const menuItemClass =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#D8D0E7] transition-colors hover:bg-violet-500/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400';

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/[0.08] bg-[#100B1D] text-[#D8D0E7] shadow-[8px_0_32px_rgba(0,0,0,0.12)] transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
        <div className="flex min-w-0 items-center overflow-hidden">
          <Logo size="sm" showText={!collapsed} onDarkBackground />
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`${iconButtonClass} hidden md:flex`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Workspace Role */}
      {!collapsed && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F83A7]">
              Workspace
            </span>

            <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              {workspaceLabel ?? (isManager ? 'Manager workspace' : 'My workspace')}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-5"
        aria-label="Dashboard navigation"
      >
        {!collapsed && (
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#76698D]">
            Main Menu
          </p>
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/manager' || item.href === '/employee'}
            title={collapsed ? item.name : undefined}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-violet-500/25 via-violet-500/15 to-transparent text-white shadow-[inset_2px_0_0_#A78BFA]'
                  : 'text-[#A99DBD] hover:bg-white/[0.055] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive
                      ? 'text-[#C4B5FD]'
                      : item.highlight
                        ? 'text-amber-300 group-hover:text-amber-200'
                        : 'text-[#8F83A7] group-hover:text-[#D8CCF5]'
                  }`}
                />

                {!collapsed && (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{item.name}</span>

                    {item.badge && (
                      <span className="rounded-md border border-violet-400/25 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200">
                        {item.badge}
                      </span>
                    )}
                  </span>
                )}

                {collapsed && item.badge && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-violet-400" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Switch between the workspaces this account was granted (for
            example Admin console + Manager). The backend enforces each. */}
        {switchTargets.length > 0 && (
          <div className="mt-5 border-t border-white/[0.07] pt-4">
            {!collapsed && (
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#76698D]">
                Switch workspace
              </p>
            )}
            {switchTargets.map((target) => {
              const Icon = target === 'admin' ? Building2 : ArrowLeftRight;
              return (
                <NavLink
                  key={target}
                  to={workspaceHome(target)}
                  title={collapsed ? WORKSPACE_LABELS[target] : undefined}
                  className="group mb-1 flex items-center gap-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] px-3 py-2.5 text-sm font-medium text-violet-100 transition-all hover:border-violet-400/30 hover:bg-violet-500/[0.12] hover:text-white"
                >
                  <Icon className="h-5 w-5 shrink-0 text-violet-300" />
                  {!collapsed && (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{WORKSPACE_LABELS[target]}</span>
                      <ArrowUpRight className="h-4 w-4 text-violet-300/70" />
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </nav>

      {/* Account Section */}
      <div
        ref={accountMenuRef}
        className="relative shrink-0 border-t border-white/[0.08] bg-[#130D21] p-3"
      >
        {/* Account Dropdown */}
        {accountMenuOpen && (
          <div className="absolute bottom-full left-3 z-40 mb-3 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-violet-300/15 bg-[#19112B] p-2 text-white shadow-[0_16px_60px_rgba(0,0,0,0.5)]">
            {/* User Details */}
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.035] p-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-300/25 bg-gradient-to-br from-violet-500 to-indigo-700 text-sm font-bold text-white">
                <span aria-hidden="true">{initials}</span>

                {user?.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.full_name || 'Your account'}
                </p>
                <p className="truncate text-xs text-[#A99DBD]">
                  {user?.email}
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-violet-300">
                  {[
                    canOpen('admin') && 'Company Admin',
                    canOpen('manager') && 'Manager',
                    canOpen('employee') && 'Employee',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No workspace'}
                </p>
              </div>
            </div>

            {/* Account Actions */}
            <div
              className="space-y-0.5 py-1"
              role="menu"
              aria-label="Account menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => navigateFromMenu('/profile')}
                className={menuItemClass}
              >
                <UserRound className="h-4 w-4 text-[#A78BFA]" />
                <span>Profile</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => navigateFromMenu(accountSettingsPath)}
                className={menuItemClass}
              >
                <Settings className="h-4 w-4 text-[#A78BFA]" />
                <span>Account settings</span>
              </button>

              {/* Theme Selector */}
              <button
                type="button"
                role="menuitem"
                aria-expanded={themeMenuOpen}
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className={menuItemClass}
              >
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4 text-[#A78BFA]" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-300" />
                )}

                <span className="flex-1">Theme</span>

                <ChevronRight
                  className={`h-4 w-4 text-[#8F83A7] transition-transform ${
                    themeMenuOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {themeMenuOpen && (
                <div
                  className="ml-5 space-y-1 border-l border-violet-400/20 py-1 pl-3"
                  role="group"
                  aria-label="Choose theme"
                >
                  {(['dark', 'light'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTheme(option)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm capitalize transition-colors ${
                        theme === option
                          ? 'bg-violet-500/15 text-violet-200'
                          : 'text-[#B7ADC9] hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <span>{option}</span>
                      {theme === option && (
                        <Check className="h-4 w-4 text-violet-300" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountMenuOpen(false);
                  setThemeMenuOpen(false);
                  setQuickstartOpen(true);
                }}
                className={menuItemClass}
              >
                <CircleHelp className="h-4 w-4 text-[#A78BFA]" />
                <span>Open Quickstart</span>
              </button>

              <div className="my-2 border-t border-white/[0.08]" />

              <button
                type="button"
                role="menuitem"
                onClick={switchAccount}
                className={menuItemClass}
              >
                <UsersRound className="h-4 w-4 text-[#A78BFA]" />
                <span>Switch account</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}

        {/* Account Button */}
        <button
          type="button"
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          onClick={() => {
            setAccountMenuOpen(!accountMenuOpen);
            setThemeMenuOpen(false);
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-all hover:border-white/[0.08] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-300/25 bg-gradient-to-br from-violet-500 to-indigo-700 text-xs font-bold text-white">
            <span aria-hidden="true">{initials}</span>

            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt=""
                className="absolute inset-0 h-full w-full rounded-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.full_name || 'Your account'}
              </p>
              <p className="truncate text-xs text-[#9487AA]">
                {user?.email}
              </p>
            </div>
          )}

          {!collapsed && (
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-[#8F83A7] transition-transform ${
                accountMenuOpen ? '-rotate-90' : ''
              }`}
            />
          )}
        </button>
      </div>

      {/* Quickstart Dialog */}
      {quickstartOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickstart-title"
            className="w-full max-w-md rounded-2xl border border-violet-300/20 bg-[#19112B] p-6 text-white shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/15">
                  <Sparkles className="h-5 w-5 text-violet-300" />
                </div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                  WorkPilot AI Guide
                </p>

                <h2
                  id="quickstart-title"
                  className="mt-1 text-xl font-semibold tracking-tight"
                >
                  Quickstart
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#B7ADC9]">
                  Start with your overview, then jump straight to the work you
                  need to manage.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close Quickstart"
                onClick={() => setQuickstartOpen(false)}
                className="rounded-lg p-2 text-[#A99DBD] transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {quickstartLinks.map((link, index) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigateFromMenu(link.path)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-left transition-all hover:border-violet-400/30 hover:bg-violet-500/10"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-500/10 text-xs font-semibold text-violet-200">
                    {index + 1}
                  </span>

                  <span className="flex-1 text-sm font-medium text-[#E5DDF2] group-hover:text-white">
                    {link.label}
                  </span>

                  <ArrowUpRight className="h-4 w-4 text-[#8F83A7] transition-colors group-hover:text-violet-300" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setQuickstartOpen(false)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition-all hover:from-violet-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#19112B]"
            >
              Done
            </button>
          </section>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
