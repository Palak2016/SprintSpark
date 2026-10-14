import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, FolderKanban, LogOut, ChevronDown, Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { Notification } from '../../types';

interface TopbarProps {
  onToggleMobileSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileSidebar }) => {
  const { logout } = useAuth();
  const { projects, activeProject, setActiveProject } = useProject();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-charcoal-100 shadow-subtle">
      {/* Left: Mobile trigger & Project Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 text-charcoal-600 hover:text-charcoal-900 hover:bg-charcoal-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Project Selector */}
        <div className="relative">
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-charcoal-200 bg-offwhite hover:bg-charcoal-50 text-sm font-medium text-charcoal-800 transition-colors"
          >
            <FolderKanban className="w-4 h-4 text-forest-700" />
            <span className="max-w-[180px] sm:max-w-[240px] truncate">
              {activeProject ? activeProject.name : 'Select Project'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-charcoal-400" />
          </button>

          {showProjectMenu && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl bg-white border border-charcoal-100 shadow-popover py-1 z-40 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-charcoal-100 text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
                Select Active Workspace
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p);
                      setShowProjectMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-charcoal-50 transition-colors ${
                      activeProject?.id === p.id ? 'bg-forest-50/70 text-forest-800 font-semibold' : 'text-charcoal-700'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {activeProject?.id === p.id && <Check className="w-4 h-4 text-forest-700" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-charcoal-600 hover:text-charcoal-900 hover:bg-charcoal-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-charcoal-100 shadow-popover py-2 z-40 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between px-4 py-2 border-b border-charcoal-100">
                <span className="text-xs font-semibold text-charcoal-900">Notifications ({unreadCount} unread)</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-forest-700 hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-charcoal-50">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-charcoal-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors ${
                        n.is_read ? 'bg-white' : 'bg-forest-50/40'
                      }`}
                    >
                      <p className="font-semibold text-charcoal-800">{n.title}</p>
                      <p className="text-charcoal-600 mt-0.5 leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-charcoal-400 block mt-1">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
          title="Sign out of current account"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
