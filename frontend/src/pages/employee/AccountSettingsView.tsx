import React from 'react';
import { Settings, ShieldCheck, Bell, Palette, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AccountSettingsView: React.FC = () => {
  const { user } = useAuth();

  const settings = [
    {
      icon: Palette,
      title: 'Appearance',
      description: 'Choose how WorkPilot looks on your device.',
      value: 'Manage theme from the sidebar account menu',
    },
    {
      icon: Bell,
      title: 'Notifications',
      description: 'Stay informed about project activity and updates.',
      value: 'Notification preferences are not configured yet',
    },
    {
      icon: ShieldCheck,
      title: 'Security',
      description: 'Keep your account information secure.',
      value: 'Password and security management are not configured yet',
    },
  ];

  return (
    <div className="min-h-full space-y-6 bg-[#100B1D] p-4 text-[#FAF8FF] sm:p-6 lg:p-8">
      <header>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
          <Settings className="h-6 w-6 text-violet-300" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
          Preferences & Security
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Account Settings
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A99DBD]">
          Manage your WorkPilot account preferences and review your account
          settings.
        </p>
      </header>

      <section className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <UserRound className="h-5 w-5 text-violet-300" />
          </div>

          <div>
            <h2 className="font-semibold text-white">Account information</h2>
            <p className="text-sm text-[#A99DBD]">
              Your currently signed-in account
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-xs text-[#A99DBD]">Account name</p>
            <p className="mt-1 break-words text-sm font-medium text-white">
              {user?.full_name || 'Not available'}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-xs text-[#A99DBD]">Email address</p>
            <p className="mt-1 break-words text-sm font-medium text-white">
              {user?.email || 'Not available'}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Preferences & security
        </h2>

        {settings.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="flex gap-4 rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
                <Icon className="h-5 w-5 text-violet-300" />
              </div>

              <div className="min-w-0">
                <h3 className="font-medium text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-5 text-[#A99DBD]">
                  {item.description}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#8F83A7]">
                  {item.value}
                </p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default AccountSettingsView;