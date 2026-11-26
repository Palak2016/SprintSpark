
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { IconFocusGuardian, IconSidebarActivityHistory, IconSidebarAdminTransfer, IconSidebarArrowLeftRight, IconSidebarArrowUpRight, IconSidebarBuilding2, IconSidebarCheck, IconSidebarChevronRight, IconSidebarCircleHelp, IconSidebarCompass, IconSidebarEmployeeAgenda, IconSidebarEmployeeLeave, IconSidebarEmployeeTasks, IconSidebarEmployeeUpdates, IconSidebarEmployeeWorkLogs, IconSidebarLogOut, IconSidebarManagerAgenda, IconSidebarManagerLeave, IconSidebarManagerTasks, IconSidebarManagerUpdates, IconSidebarManagerWorkLogs, IconSidebarMoon, IconSidebarMyOverview, IconSidebarOverview, IconSidebarProjects, IconSidebarRecoveryPlans, IconSidebarSettings, IconSidebarSun, IconSidebarTaskBoard, IconSidebarTeamCapacity, IconSidebarUserRound, IconSidebarUsersRound, IconSidebarX } from '../../icons';
import { Logo } from '../common/Logo';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { WORKSPACE_LABELS, Workspace, workspaceHome } from '../../utils/workspace';
import { profilePhotoStorageKey } from '../../utils/profilePhoto';

interface SidebarProps {
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

const AccountAvatar: React.FC<{
  email?: string;
  avatarUrl?: string;
  size: 'small' | 'large';
}> = ({ email, avatarUrl, size }) => {
  const [localAvatarUrl] = useState(() => {
    if (!email) return undefined;

    try {
      return window.localStorage.getItem(profilePhotoStorageKey(email)) ?? undefined;
    } catch (error) {
      console.error('Could not load the local profile photo:', error);
      return undefined;
    }
  });
  const photoUrl = localAvatarUrl
    || (avatarUrl?.includes('api.dicebear.com/7.x/initials') ? undefined : avatarUrl);
  const dimensions = size === 'small' ? 'h-9 w-9' : 'h-11 w-11';
  const iconDimensions = size === 'small' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <span className={`relative flex ${dimensions} shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-300/25 bg-linear-to-br from-violet-500 to-indigo-700 text-white`}>
      <IconSidebarUserRound aria-hidden="true" className={`${iconDimensions} text-white/80`} />
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </span>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  navItems: customNavItems,
  workspaceLabel,
  isAdminConsole = false,
}) => {
  const { user, isManager, logout, canOpen, workspaces } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    const closeOpenMenus = () => {
      navigationRef.current
        ?.querySelectorAll<HTMLDetailsElement>('details[open]')
        .forEach((menu) => {
          menu.open = false;
        });
    };

    const closeNavigationMenus = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('details')) {
        return;
      }

      closeOpenMenus();
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOpenMenus();
    };

    document.addEventListener('mousedown', closeNavigationMenus);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeNavigationMenus);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen && !quickstartOpen && !mobileNavOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !accountMenuRef.current?.contains(event.target)
      ) {
        setAccountMenuOpen(false);
        setThemeMenuOpen(false);
      }

      if (
        event.target instanceof Node &&
        !navigationRef.current?.contains(event.target)
      ) {
        setMobileNavOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
        setThemeMenuOpen(false);
        setQuickstartOpen(false);
        setMobileNavOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen, quickstartOpen, mobileNavOpen]);

  const managerNav: NavItem[] = [
    { name: 'Overview', href: '/manager', icon: IconSidebarOverview },
    { name: 'Projects', href: '/manager/projects', icon: IconSidebarProjects },
    { name: 'Tasks Board', href: '/manager/tasks', icon: IconSidebarTaskBoard },
    { name: 'My Tasks', href: '/manager/my-tasks', icon: IconSidebarManagerTasks },
    { name: 'Daily Updates', href: '/manager/daily-updates', icon: IconSidebarManagerUpdates },
    { name: 'Agenda Alignment', href: '/manager/agenda-drift', icon: IconSidebarManagerAgenda },
    { name: 'Work Logs', href: '/manager/work-logs', icon: IconSidebarManagerWorkLogs },
    { name: 'Team & Capacity', href: '/manager/team', icon: IconSidebarTeamCapacity },
    { name: 'Leave Requests', href: '/manager/leave', icon: IconSidebarManagerLeave },
    {
      name: 'Recovery Plans',
      href: '/manager/recovery',
      icon: IconSidebarRecoveryPlans,
      badge: 'AI',
    },
    { name: 'Activity History', href: '/manager/audit', icon: IconSidebarActivityHistory },
    { name: 'Settings', href: '/manager/settings', icon: IconSidebarSettings },
  ];

  const employeeNav: NavItem[] = [
    { name: 'My Overview', href: '/employee', icon: IconSidebarMyOverview },
    { name: 'My Tasks', href: '/employee/tasks', icon: IconSidebarEmployeeTasks },
    { name: 'Work Logs', href: '/employee/work-logs', icon: IconSidebarEmployeeWorkLogs },
    { name: 'Daily Updates', href: '/employee/daily-updates', icon: IconSidebarEmployeeUpdates },
    { name: 'Agenda Alignment', href: '/employee/agenda-drift', icon: IconSidebarEmployeeAgenda },
    { name: 'Leave Requests', href: '/employee/leave', icon: IconSidebarEmployeeLeave },
    { name: 'Focus Guardian', href: '/employee/focus', icon: IconFocusGuardian },
  ];

  const transferItem: NavItem = {
    name: 'Admin Transfer',
    href: '/company-transfer',
    icon: IconSidebarAdminTransfer,
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
  const navGroupDefinitions = isAdminConsole
    ? [
        { label: 'Company', names: ['Admin Transfer', 'Overview', 'Members', 'Approvals', 'Invitations'] },
        { label: 'Insights & governance', names: ['Analytics', 'Activity', 'Ownership', 'Settings'] },
      ]
    : isManager
      ? [
          { label: 'Workspace', names: ['Admin Transfer', 'Overview'] },
          { label: 'Project delivery', names: ['Projects', 'Tasks Board', 'My Tasks', 'Daily Updates', 'Agenda Alignment', 'Work Logs'] },
          { label: 'Team operations', names: ['Team & Capacity', 'Leave Requests', 'Recovery Plans', 'Activity History', 'Settings'] },
        ]
      : [
          { label: 'My workspace', names: ['Admin Transfer', 'My Overview', 'My Tasks'] },
          { label: 'Collaboration', names: ['Work Logs', 'Daily Updates', 'Agenda Alignment'] },
          { label: 'Personal tools', names: ['Leave Requests', 'Focus Guardian'] },
        ];
  const navigationGroups: { label: string; items: NavItem[] }[] = navGroupDefinitions
    .map((group) => ({
      label: group.label,
      items: navItems.filter((item) => group.names.includes(item.name)),
    }))
    .filter((group) => group.items.length > 0);
  const groupedNames = new Set(navGroupDefinitions.flatMap((group) => group.names));
  const ungroupedItems = navItems.filter((item) => !groupedNames.has(item.name));
  if (ungroupedItems.length > 0) {
    navigationGroups.push({ label: 'More', items: ungroupedItems });
  }

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
    setMobileNavOpen(false);
    navigate(path);
  };

  const switchAccount = async () => {
    setAccountMenuOpen(false);
    setThemeMenuOpen(false);
    setMobileNavOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    setThemeMenuOpen(false);
    setMobileNavOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const menuItemClass =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#D8D0E7] transition-colors hover:bg-violet-500/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400';

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.name}
      to={item.href}
      end={item.href === '/manager' || item.href === '/employee'}
      onClick={(event) => {
        setMobileNavOpen(false);
        event.currentTarget.closest('details')?.removeAttribute('open');
      }}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-violet-500/15 text-white'
            : 'text-[#B7ADC9] hover:bg-white/5 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isActive ? 'bg-violet-500/20 text-violet-200' : 'bg-white/4 text-[#9487AA]'
          }`}>
            <item.icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.badge && (
            <span className="rounded-md border border-violet-400/25 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200">
              {item.badge}
            </span>
          )}
          {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />}
        </>
      )}
    </NavLink>
  );

  const renderWorkspaceItem = (target: Workspace) => {
    const Icon = target === 'admin' ? IconSidebarBuilding2 : IconSidebarArrowLeftRight;
    return (
      <NavLink
        key={target}
        to={workspaceHome(target)}
        onClick={() => setMobileNavOpen(false)}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#D8D0E7] transition-colors hover:bg-white/5 hover:text-white"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/4 text-violet-200">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{WORKSPACE_LABELS[target]}</span>
        <IconSidebarArrowUpRight className="h-4 w-4 text-[#8F83A7]" />
      </NavLink>
    );
  };

  return (
    <div
      ref={navigationRef}
      className="dashboard-app-navigation relative border-b border-white/8 bg-[#100B1D] text-[#D8D0E7]"
    >
      <div className="mx-auto flex min-h-17 max-w-450 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center overflow-hidden">
          <Logo size="sm" showText onDarkBackground />
        </div>

        <div className="hidden min-w-0 items-center gap-2 border-l border-white/10 pl-4 xl:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-violet-200">
            {isAdminConsole
              ? <IconSidebarBuilding2 className="h-4 w-4" />
              : <IconSidebarCompass className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8F83A7]">
              Workspace
            </span>
            <span className="mt-0.5 block max-w-37.5 truncate text-xs font-semibold text-white">
              {workspaceLabel ?? (isManager ? 'Manager workspace' : 'My workspace')}
            </span>
          </span>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Primary navigation">
          {navigationGroups.map((group) => {
            const groupActive = group.items.some((item) =>
              location.pathname === item.href
              || (item.href !== '/manager' && item.href !== '/employee' && location.pathname.startsWith(`${item.href}/`))
            );
            return (
              <details key={group.label} name="workspace-navigation" className="group relative">
                <summary className={`flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors [&::-webkit-details-marker]:hidden ${
                  groupActive ? 'bg-white/8 text-white' : 'text-[#B7ADC9] hover:bg-white/5 hover:text-white'
                }`}>
                  {group.label}
                  <IconSidebarChevronRight className="h-3.5 w-3.5 rotate-90 transition-transform group-open:-rotate-90" />
                </summary>
                <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/9 bg-[#19112B] p-2 shadow-[0_18px_55px_rgba(0,0,0,0.4)]">
                  <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#76698D]">
                    {group.label}
                  </p>
                  {group.items.map(renderNavItem)}
                </div>
              </details>
            );
          })}
          {switchTargets.length > 0 && (
            <details name="workspace-navigation" className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#B7ADC9] transition-colors hover:bg-white/5 hover:text-white [&::-webkit-details-marker]:hidden">
                <IconSidebarArrowLeftRight className="h-4 w-4" />
                Workspaces
                <IconSidebarChevronRight className="h-3.5 w-3.5 rotate-90 transition-transform group-open:-rotate-90" />
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/9 bg-[#19112B] p-2 shadow-[0_18px_55px_rgba(0,0,0,0.4)]">
                <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#76698D]">Switch workspace</p>
                {switchTargets.map(renderWorkspaceItem)}
              </div>
            </details>
          )}
        </nav>

        <button
          type="button"
          aria-label="Toggle workspace navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => {
            setMobileNavOpen((open) => !open);
            setAccountMenuOpen(false);
            setThemeMenuOpen(false);
          }}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs font-semibold text-[#D8D0E7] transition hover:bg-white/8 lg:hidden"
        >
          Menu
          <IconSidebarChevronRight className={`h-3.5 w-3.5 transition-transform ${mobileNavOpen ? '-rotate-90' : 'rotate-90'}`} />
        </button>

        <div ref={accountMenuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() => {
              setAccountMenuOpen(!accountMenuOpen);
              setThemeMenuOpen(false);
              setMobileNavOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3.5 p-1.5 pr-2.5 text-left transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <AccountAvatar
              key={user?.email}
              email={user?.email}
              avatarUrl={user?.avatar_url}
              size="small"
            />
            <span className="hidden min-w-0 text-left xl:block">
              <span className="dashboard-account-name block max-w-32.5 truncate text-xs font-semibold text-[#E9D5FF]">{user?.full_name || 'Your account'}</span>
              <span className="dashboard-account-label mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-200">Account</span>
            </span>
            <IconSidebarChevronRight className={`hidden h-3.5 w-3.5 text-[#8F83A7] transition-transform xl:block ${accountMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>

        {/* Account Dropdown */}
        {accountMenuOpen && (
          <div className="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-violet-300/15 bg-[#19112B] p-2 text-white shadow-[0_16px_60px_rgba(0,0,0,0.5)]">
            {/* User Details */}
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/5 bg-white/3.5 p-3">
              <AccountAvatar
                key={user?.email}
                email={user?.email}
                avatarUrl={user?.avatar_url}
                size="large"
              />

              <div className="min-w-0 flex-1">
                <p className="dashboard-account-name truncate text-sm font-semibold text-[#E9D5FF]">
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
                <IconSidebarUserRound className="h-4 w-4 text-[#A78BFA]" />
                <span>Profile</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => navigateFromMenu(accountSettingsPath)}
                className={menuItemClass}
              >
                <IconSidebarSettings className="h-4 w-4 text-[#A78BFA]" />
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
                  <IconSidebarMoon className="h-4 w-4 text-[#A78BFA]" />
                ) : (
                  <IconSidebarSun className="h-4 w-4 text-amber-300" />
                )}

                <span className="flex-1">Theme</span>

                <IconSidebarChevronRight
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
                          : 'text-[#B7ADC9] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{option}</span>
                      {theme === option && (
                        <IconSidebarCheck className="h-4 w-4 text-violet-300" />
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
                <IconSidebarCircleHelp className="h-4 w-4 text-[#A78BFA]" />
                <span>Open Quickstart</span>
              </button>

              <div className="my-2 border-t border-white/8" />

              <button
                type="button"
                role="menuitem"
                onClick={switchAccount}
                className={menuItemClass}
              >
                <IconSidebarUsersRound className="h-4 w-4 text-[#A78BFA]" />
                <span>Switch account</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="dashboard-account-logout flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <IconSidebarLogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}

        </div>
      </div>

      {mobileNavOpen && (
        <div className="dashboard-mobile-nav border-t border-white/8 bg-[#19112B] px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)] lg:hidden sm:px-6">
          <div className="mx-auto max-w-450">
            {navigationGroups.map((group) => (
              <section key={group.label} className="mb-4 last:mb-0">
                <h2 className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#76698D]">
                  {group.label}
                </h2>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.items.map(renderNavItem)}
                </div>
              </section>
            ))}
            {switchTargets.length > 0 && (
              <section className="mt-4 border-t border-white/8 pt-4">
                <h2 className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#76698D]">
                  Switch workspace
                </h2>
                <div className="grid gap-1 sm:grid-cols-2">
                  {switchTargets.map(renderWorkspaceItem)}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

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
                  <IconSidebarCompass className="h-5 w-5 text-violet-300" />
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
                className="rounded-lg p-2 text-[#A99DBD] transition-colors hover:bg-white/10 hover:text-white" title="Close Quickstart"
              >
                <IconSidebarX className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {quickstartLinks.map((link, index) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigateFromMenu(link.path)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/2.5 px-3 py-3 text-left transition-all hover:border-violet-400/30 hover:bg-violet-500/10"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-500/10 text-xs font-semibold text-violet-200">
                    {index + 1}
                  </span>

                  <span className="flex-1 text-sm font-medium text-[#E5DDF2] group-hover:text-white">
                    {link.label}
                  </span>

                  <IconSidebarArrowUpRight className="h-4 w-4 text-[#8F83A7] transition-colors group-hover:text-violet-300" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setQuickstartOpen(false)}
              className="mt-5 w-full rounded-xl bg-linear-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition-all hover:from-violet-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#19112B]"
            >
              Done
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
