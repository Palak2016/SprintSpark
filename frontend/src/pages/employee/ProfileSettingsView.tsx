import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';

export const ProfileSettingsView: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Profile & Preferences</h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Your personal account identity and access credentials
        </p>
      </div>

      <div className="p-6 bg-white rounded-2xl border border-charcoal-100 shadow-card space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-charcoal-100">
          <img
            src={user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.full_name}`}
            alt={user?.full_name}
            className="w-16 h-16 rounded-full border border-charcoal-200"
          />
          <div>
            <h2 className="text-lg font-bold text-charcoal-900">{user?.full_name}</h2>
            <p className="text-xs text-charcoal-500">{user?.email}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-forest-50 text-forest-800 border border-forest-200">
              {user?.role}
            </span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-2 border-b border-charcoal-50">
            <span className="text-charcoal-500">Account Type</span>
            <span className="font-semibold text-charcoal-800">Organization Member</span>
          </div>
          <div className="flex justify-between py-2 border-b border-charcoal-50">
            <span className="text-charcoal-500">Permission Scope</span>
            <span className="font-semibold text-charcoal-800">Assigned Tasks, Work Logs & Leave</span>
          </div>
          <div className="flex justify-between py-2 border-b border-charcoal-50">
            <span className="text-charcoal-500">Session Status</span>
            <span className="font-semibold text-emerald-600">Active (Encrypted JWT)</span>
          </div>
        </div>

        <div className="pt-4 border-t border-charcoal-100 flex justify-end">
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
