
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconDashboardArrowUpRight, IconDashboardBell, IconDashboardCheck, IconDashboardCheckCheck, IconDashboardChevronDown, IconDashboardFolderKanban, IconDashboardLayers3, IconDashboardLogOut } from '../../icons';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { Notification } from '../../types';
import { formatIndianDateTime } from '../../utils/date';

interface TopbarProps {
  /** Shown instead of the project picker (the Admin console's company picker). */
  leading?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({
  leading,
}) => {
  const { logout } = useAuth();
  const { projects, activeProject, setActiveProject } = useProject();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const projectMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const data = await api.getNotifications();

        if (!cancelled) {
          setNotifications(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load notifications:', err);
        }
      }
    };

    void loadNotifications();

    const intervalId = window.setInterval(
      () => void loadNotifications(),
      30_000,
    );
    window.addEventListener('focus', loadNotifications);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadNotifications);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (!projectMenuRef.current?.contains(target)) {
        setShowProjectMenu(false);
      }

      if (!notificationsRef.current?.contains(target)) {
        setShowNotifications(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProjectMenu(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleMarkAllRead = async () => {
    if (markingRead || unreadCount === 0) return;

    setMarkingRead(true);

    try {
      await api.markAllNotificationsRead();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
        })),
      );
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    } finally {
      setMarkingRead(false);
    }
  };

  // Only follow in-app paths; "/login" links are useless once signed in.
  const notificationTarget = (notification: Notification) => {
    const link = notification.link;
    if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
    if (link === '/login') return null;
    return link;
  };

  const openNotification = (notification: Notification) => {
    const target = notificationTarget(notification);
    if (!target) return;

    setShowNotifications(false);

    if (!notification.is_read) {
      setNotifications((previous) =>
        previous.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n,
        ),
      );
      api.markNotificationRead(notification.id).catch((err) => {
        console.error('Failed to mark notification read:', err);
      });
    }

    navigate(target);
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read,
  ).length;

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

  const controlClass =
    'dashboard-control rounded-xl border border-white/8 bg-white/2.5 text-[#B7ADC9] transition-all hover:border-violet-400/25 hover:bg-violet-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400';

  return (
    <header className="relative z-10 flex min-h-14 shrink-0 items-center justify-between gap-3 border-t border-b border-t-white/6 border-b-white/8 bg-[#100B1D]/90 px-3 backdrop-blur-xl sm:px-6">
      {/* Project selector and company context */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {leading ?? (
        /* Project Selector */
        <div ref={projectMenuRef} className="relative min-w-0">
          <button
            type="button"
            aria-expanded={showProjectMenu}
            aria-haspopup="menu"
            onClick={() => {
              setShowProjectMenu((previous) => !previous);
              setShowNotifications(false);
            }}
            className={`flex max-w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm sm:px-3 ${controlClass}`}
          >
            <span className="dashboard-project-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/15">
              <IconDashboardFolderKanban className="dashboard-topbar-icon h-4 w-4 text-violet-300" />
            </span>

            <span className="min-w-0 text-left">
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8F83A7] sm:block">
                Active project
              </span>

              <span className="block max-w-31.25 truncate font-medium text-[#F3EDFF] sm:max-w-50">
                {activeProject?.name || 'Select Project'}
              </span>
            </span>

            <IconDashboardChevronDown
              className={`h-4 w-4 shrink-0 text-[#8F83A7] transition-transform ${
                showProjectMenu ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showProjectMenu && (
            <div
              role="menu"
              aria-label="Select active project"
              className="absolute left-0 top-full z-40 mt-3 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-violet-300/15 bg-[#19112B] p-2 shadow-[0_18px_55px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center gap-3 border-b border-white/7 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
                  <IconDashboardLayers3 className="h-4 w-4 text-violet-300" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    Your projects
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#9487AA]">
                    Choose an active workspace
                  </p>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto py-2">
                {projects.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <IconDashboardFolderKanban className="mx-auto mb-2 h-6 w-6 text-[#76698D]" />
                    <p className="text-sm text-[#D8D0E7]">
                      No projects available
                    </p>
                    <p className="mt-1 text-xs text-[#9487AA]">
                      Projects will appear here when available.
                    </p>
                  </div>
                ) : (
                  projects.map((project) => {
                    const isActive = activeProject?.id === project.id;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setActiveProject(project);
                          setShowProjectMenu(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'bg-violet-500/15 text-white'
                            : 'text-[#B7ADC9] hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isActive
                              ? 'bg-violet-500/20 text-violet-200'
                              : 'bg-white/5 text-[#9487AA]'
                          }`}
                        >
                          <IconDashboardFolderKanban className="h-4 w-4" />
                        </span>

                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {project.name}
                        </span>

                        {isActive && (
                          <IconDashboardCheck className="h-4 w-4 shrink-0 text-violet-300" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Right: Notifications and logout */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <div ref={notificationsRef} className="relative">
          <button
            type="button"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
            onClick={() => {
              setShowNotifications((previous) => !previous);
              setShowProjectMenu(false);
            }}
            className={`relative p-2.5 ${controlClass}`} title={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <IconDashboardBell className="dashboard-topbar-icon h-5 w-5" />

            {unreadCount > 0 && (
              <>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-400" />
                <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-[#100B1D] bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              </>
            )}
          </button>

          {showNotifications && (
            <div
              role="dialog"
              aria-label="Notifications"
              className="absolute right-0 top-full z-40 mt-3 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-violet-300/15 bg-[#19112B] shadow-[0_18px_55px_rgba(0,0,0,0.5)]"
            >
              {/* Notifications header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Notifications
                  </h2>
                  <p className="mt-1 text-xs text-[#9487AA]">
                    {unreadCount === 0
                      ? 'You are all caught up'
                      : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingRead}
                    className="notification-mark-read inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/10 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconDashboardCheckCheck className="h-3.5 w-3.5" />
                    {markingRead ? 'Updating...' : 'Mark all read'}
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-[min(22rem,60vh)] divide-y divide-white/6 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/10 bg-violet-500/8">
                      <IconDashboardBell className="h-5 w-5 text-violet-300" />
                    </div>
                    <p className="text-sm font-medium text-[#E5DDF2]">
                      All quiet here
                    </p>
                    <p className="mt-1 text-xs text-[#9487AA]">
                      You don't have any notifications yet.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const clickable = notificationTarget(notification) !== null;

                    return (
                    <div
                      key={notification.id}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => openNotification(notification) : undefined}
                      onKeyDown={
                        clickable
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openNotification(notification);
                              }
                            }
                          : undefined
                      }
                      className={`relative px-4 py-3.5 transition-colors hover:bg-white/2.5 ${
                        notification.is_read ? '' : 'bg-violet-500/4.5'
                      } ${
                        clickable
                          ? 'cursor-pointer hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            notification.is_read
                              ? 'bg-[#5F536F]'
                              : 'bg-violet-400'
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#F3EDFF]">
                            {notification.title}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-[#B7ADC9]">
                            {notification.message}
                          </p>

                          <span className="mt-2 block text-[10px] text-[#827594]">
                            
                            {formatIndianDateTime(notification.created_at)}
                          </span>
                        </div>

                        {clickable && (
                          <IconDashboardArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#8F83A7]" />
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/7 bg-white/1.5 px-4 py-2.5">
                <p className="text-center text-[10px] text-[#827594]">
                  WorkPilot AI · Workspace updates
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out of your account"
          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-500/8 px-2.5 py-2.5 text-xs font-semibold text-rose-300 transition-all hover:border-rose-400/30 hover:bg-rose-500/15 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
        >
          <IconDashboardLogOut className="h-4 w-4" />
          <span className="hidden sm:inline">
            {loggingOut ? 'Signing out...' : 'Logout'}
          </span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
