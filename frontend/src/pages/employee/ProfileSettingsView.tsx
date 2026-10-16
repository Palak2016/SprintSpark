
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LogOut,
  UserRound,
  Mail,
  ShieldCheck,
  LockKeyhole,
  Settings2,
} from 'lucide-react';

export const ProfileSettingsView: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-3xl space-y-6 text-[#FAF8FF]">
      {/* Page Header */}
      <header>
        <div className="mb-2 flex items-center gap-2 text-xs text-[#A99DBD]">
          <span>Workspace</span>
          <span>/</span>
          <span className="text-violet-300">Profile & Preferences</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
            <Settings2 size={24} className="text-violet-300" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Profile & Preferences
            </h1>
            <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
              Manage your account identity and access information.
            </p>
          </div>
        </div>
      </header>

      {/* Profile Card */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B]">
        {/* Card Header */}
        <div className="border-b border-white/[0.07] bg-violet-500/[0.04] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <UserRound size={17} className="text-violet-300" />
            <h2 className="text-sm font-semibold">Account Information</h2>
          </div>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Your registered identity and organization role.
          </p>
        </div>

        {/* User Identity */}
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <img
                src={
                  user?.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    user?.full_name || 'User',
                  )}`
                }
                alt={user?.full_name || 'User profile'}
                className="h-20 w-20 rounded-2xl border border-violet-400/20 bg-[#241836] object-cover"
              />
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-[#19112B] bg-emerald-400" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="break-words text-lg font-bold text-[#FAF8FF]">
                {user?.full_name || 'User'}
              </h3>

              <p className="mt-1 break-all text-xs text-[#A99DBD]">
                {user?.email || 'No email available'}
              </p>

              <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                <ShieldCheck size={13} />
                {user?.role || 'Member'}
              </span>
            </div>
          </div>

          {/* Account Details */}
          <div className="space-y-1 pt-5">
            <div className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-white/[0.025]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                <UserRound size={17} className="text-violet-300" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#827694]">
                  Full Name
                </p>
                <p className="mt-1 break-words text-xs font-semibold text-[#E5DDF0]">
                  {user?.full_name || 'Not provided'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-white/[0.025]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                <Mail size={17} className="text-violet-300" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#827694]">
                  Email Address
                </p>
                <p className="mt-1 break-all text-xs font-semibold text-[#E5DDF0]">
                  {user?.email || 'Not provided'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-white/[0.025]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <ShieldCheck size={17} className="text-emerald-300" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#827694]">
                  Account Type
                </p>
                <p className="mt-1 text-xs font-semibold text-[#E5DDF0]">
                  Organization Member
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#A99DBD]">
                  Role-based access to your assigned WorkPilot features.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Session */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19112B]">
        <div className="border-b border-white/[0.07] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <LockKeyhole size={17} className="text-violet-300" />
            <h2 className="text-sm font-semibold">Security & Session</h2>
          </div>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Current authentication and session information.
          </p>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#E5DDF0]">
                Session Status
              </p>
              <p className="mt-1 text-[11px] text-[#A99DBD]">
                Your current login session
              </p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
          </div>

          <div className="border-t border-white/[0.07]" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#E5DDF0]">
                Authentication
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[#A99DBD]">
                Token-based authentication
              </p>
            </div>

            <span className="shrink-0 rounded-lg border border-violet-400/15 bg-violet-500/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-violet-300">
              JWT
            </span>
          </div>
        </div>
      </section>

      {/* Sign Out */}
      <section className="flex flex-col gap-4 rounded-2xl border border-rose-400/15 bg-rose-500/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-[#FAF8FF]">
            Sign out of WorkPilot
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#A99DBD]">
            End your current session on this device.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </section>
    </div>
  );
};

export default ProfileSettingsView;
