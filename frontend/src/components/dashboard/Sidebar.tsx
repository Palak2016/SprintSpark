import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, CalendarDays,
  AlertTriangle, Sparkles, History, Settings, ChevronLeft, ChevronRight,
  Clock, Send, Eye, UserRound, Sun, Moon, CircleHelp, UsersRound, LogOut,
  X, Check, ArrowUpRight
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  highlight?: boolean;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { user, isManager, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [quickstartOpen, setQuickstartOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('workpilot_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!accountMenuOpen && !quickstartOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
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
    { name: 'Team & Capacity', href: '/manager/team', icon: Users },
    { name: 'Leave Requests', href: '/manager/leave', icon: CalendarDays },
    { name: 'Risk Intelligence', href: '/manager/risk', icon: AlertTriangle, highlight: true },
    { name: 'Recovery Plans', href: '/manager/recovery', icon: Sparkles, badge: 'AI' },
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

  const navItems: NavItem[] = isManager ? managerNav : employeeNav;
  const accountSettingsPath = isManager ? '/manager/settings' : '/employee/settings';
  const quickstartLinks = isManager
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

  const selectTheme = (selectedTheme: 'light' | 'dark') => {
    setTheme(selectedTheme);
  };

  const switchAccount = () => {
    setAccountMenuOpen(false);
    setThemeMenuOpen(false);
    logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'U';

  return (
    <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-charcoal-900 text-charcoal-300 transition-all duration-200 border-r border-charcoal-800 ${
      collapsed ? 'w-20' : 'w-64'
    }`}>
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-charcoal-800">
        <div className="flex items-center overflow-hidden">
          <Logo size="sm" showText={!collapsed} onDarkBackground />
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Role Tag */}
      {!collapsed && (
        <div className="px-4 py-2 border-b border-charcoal-800/60 bg-charcoal-950/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-charcoal-400 uppercase tracking-wider font-semibold text-[10px]">
              Workspace
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              isManager ? 'bg-forest-900 text-forest-200 border border-forest-700' : 'bg-charcoal-800 text-charcoal-200'
            }`}>
              {isAdmin ? 'Admin Portal' : isManager ? 'Manager Portal' : 'Contributor Workspace'}
            </span>
          </div>
        </div>
      )}

      {/* Navigation items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/manager' || item.href === '/employee'}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
              isActive
                ? 'bg-forest-700 text-white shadow-sm'
                : 'text-charcoal-400 hover:text-white hover:bg-charcoal-800/80'
            }`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 transition-colors ${
              item.highlight ? 'text-amber-400' : ''
            }`} />
            {!collapsed && (
              <span className="truncate flex-1 flex items-center justify-between">
                <span>{item.name}</span>
                {item.badge && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-forest-900 text-forest-300 border border-forest-700">
                    {item.badge}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Card at bottom */}
      <div className="relative p-3 border-t border-charcoal-800 bg-charcoal-950/30" ref={accountMenuRef}>
        {accountMenuOpen && (
          <div className="absolute left-3 bottom-full mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-charcoal-700 bg-charcoal-800 p-2 text-charcoal-100 shadow-2xl">
            <div className="mb-1 flex items-center gap-3 rounded-lg bg-charcoal-950 p-3">
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-charcoal-200 text-base font-semibold text-charcoal-900">
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.full_name || 'Your account'}</p>
                <p className="truncate text-sm text-charcoal-400">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-0.5 py-1" role="menu" aria-label="Account menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => navigateFromMenu('/profile')}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
              >
                <UserRound className="h-4 w-4" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => navigateFromMenu(accountSettingsPath)}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
              >
                <Settings className="h-4 w-4" />
                <span>Account settings</span>
              </button>

              <button
                type="button"
                role="menuitem"
                aria-expanded={themeMenuOpen}
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
              >
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <span className="flex-1">Theme</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${themeMenuOpen ? 'rotate-90' : ''}`} />
              </button>
              {themeMenuOpen && (
                <div className="ml-9 space-y-0.5 pb-1" role="group" aria-label="Choose theme">
                  {(['light', 'dark'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => selectTheme(option)}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm capitalize hover:bg-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
                    >
                      <span>{option}</span>
                      {theme === option && <Check className="h-4 w-4" />}
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
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
              >
                <CircleHelp className="h-4 w-4" />
                <span>Open Quickstart</span>
              </button>

              <div className="my-1 border-t border-charcoal-700" />
              <button
                type="button"
                role="menuitem"
                onClick={switchAccount}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
              >
                <UsersRound className="h-4 w-4" />
                <span>Switch account</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => navigateFromMenu('/')}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          onClick={() => {
            setAccountMenuOpen(!accountMenuOpen);
            setThemeMenuOpen(false);
          }}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-charcoal-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal-400"
        >
          <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-charcoal-200 text-xs font-semibold text-charcoal-900">
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
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-charcoal-400 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && <ChevronRight className={`h-4 w-4 flex-shrink-0 text-charcoal-400 transition-transform ${accountMenuOpen ? '-rotate-90' : ''}`} />}
        </button>
      </div>

      {quickstartOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal-950/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickstart-title"
            className="w-full max-w-md rounded-2xl border border-charcoal-100 bg-white p-6 text-charcoal-800 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">Workpilot guide</p>
                <h2 id="quickstart-title" className="mt-1 text-xl font-bold text-charcoal-900">Quickstart</h2>
                <p className="mt-2 text-sm text-charcoal-600">
                  Start with your overview, then jump straight to the work you need to manage.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close quickstart"
                onClick={() => setQuickstartOpen(false)}
                className="rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-100 hover:text-charcoal-900"
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
                  className="flex w-full items-center gap-3 rounded-xl border border-charcoal-100 px-3 py-3 text-left transition-colors hover:bg-charcoal-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal-100 text-xs font-semibold text-charcoal-700">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{link.label}</span>
                  <ArrowUpRight className="h-4 w-4 text-charcoal-400" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setQuickstartOpen(false)}
              className="mt-5 w-full rounded-lg bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
            >
              Done
            </button>
          </section>
        </div>
      )}
    </aside>
  );
};
