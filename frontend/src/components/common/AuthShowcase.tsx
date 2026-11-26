import React from 'react';
import { Logo } from './Logo';
import { IconActivity, IconCheckCircle2, IconShieldCheck } from '../../icons';

interface AuthShowcaseProps {
  mode: 'signin' | 'signup';
}

export const AuthShowcase: React.FC<AuthShowcaseProps> = ({ mode }) => {
  const isSignup = mode === 'signup';

  return (
    <aside className={`auth-showcase relative hidden flex-col overflow-hidden rounded-4xl border border-white/10 shadow-[0_28px_90px_rgba(0,0,0,0.28)] lg:flex ${
      isSignup
        ? 'min-h-0 p-6 lg:static xl:p-8'
        : 'min-h-180 p-8 lg:sticky lg:top-6 xl:p-10'
    }`}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full bg-violet-500/20 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-indigo-400/10 blur-[110px]" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <Logo size="sm" onDarkBackground />
        <span className="rounded-full border border-[#D1D5DB] bg-white/80 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#475569]">
          Work management suite
        </span>
      </div>

      <div className={`relative z-10 max-w-lg ${isSignup ? 'mt-6' : 'mt-20'}`}>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5B4694]">
          <IconActivity className="h-3.5 w-3.5" />
          Projects, people, progress
        </div>
        <h2 className={`${isSignup ? 'text-3xl xl:text-4xl' : 'text-4xl xl:text-5xl'} font-semibold leading-[1.12] tracking-tight text-charcoal-900`}>
          {isSignup
            ? 'Give your team a clearer way to move work forward.'
            : 'Pick up where your team left off.'}
        </h2>
        <p className={`max-w-md text-sm text-[#475569] ${isSignup ? 'mt-3 leading-6' : 'mt-5 leading-7'}`}>
          Keep delivery signals, team updates, and decisions connected in one
          calm workspace.
        </p>
      </div>

      <div className={`auth-showcase-preview relative z-10 rounded-2xl border border-white/10 ${
        isSignup ? 'mt-6 p-4' : 'mt-12 p-5'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#667085]">
              Workspace snapshot
            </p>
            <p className="mt-1 text-sm font-semibold text-charcoal-900">
              Delivery at a glance
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/15 bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            In sync
          </span>
        </div>

        <div className={`grid grid-cols-3 gap-3 ${isSignup ? 'mt-3' : 'mt-5'}`}>
          {[
            { label: 'Projects', value: 'One view' },
            { label: 'People', value: 'Aligned' },
            { label: 'Decisions', value: 'Visible' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/7 bg-white/3.5 p-3">
              <p className="text-[9px] font-medium uppercase tracking-wide text-[#667085]">{item.label}</p>
              <p className="mt-2 text-xs font-semibold text-[#5B4694]">{item.value}</p>
            </div>
          ))}
        </div>

        <div className={`space-y-3 ${isSignup ? 'mt-3' : 'mt-5'}`}>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full w-[72%] rounded-full bg-linear-to-r from-violet-400 to-indigo-300" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#475569]">
            <span>Progress stays visible</span>
            <span>Human-led</span>
          </div>
        </div>
      </div>

      <div className={`relative z-10 mt-auto flex items-center gap-2 border-t border-[#D1D5DB] text-xs text-[#475569] ${
        isSignup ? 'pt-4' : 'pt-6'
      }`}>
        <IconShieldCheck className="h-4 w-4 shrink-0 text-violet-700" />
        <span>Clear access controls and decisions that stay with your team.</span>
        <IconCheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-600" />
      </div>
    </aside>
  );
};

export default AuthShowcase;
