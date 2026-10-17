import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Logo } from '../common/Logo';

/*
 * Shared layout for the sign-in and sign-up pages.
 *
 * Large screens: a WorkPilot panel on the left (content supplied by each
 * page through `aside`) and the form on the right.
 * Small screens: the panel is hidden and the logo sits above the form.
 */

interface AuthShellProps {
  aside: React.ReactNode;
  headerAction: React.ReactNode;
  children: React.ReactNode;
  formWidthClass?: string;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  aside,
  headerAction,
  children,
  formWidthClass = 'max-w-[400px]',
}) => (
  <div className="min-h-screen bg-[#100B1D] text-[#FAF8FF] selection:bg-violet-400/30 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    {/* WorkPilot panel */}
    <aside className="relative hidden overflow-hidden border-r border-white/[0.06] bg-[#140E23] lg:flex lg:min-h-screen lg:flex-col lg:px-12 lg:py-10 xl:px-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(226,210,255,.08)_1px,transparent_0)] [background-size:27px_27px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-24 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-indigo-600/[0.14] blur-[120px]"
      />

      <Link
        to="/"
        aria-label="WorkPilot AI home"
        className="relative w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
      >
        <Logo size="md" />
      </Link>

      <div className="relative flex flex-1 flex-col justify-center py-12">
        {aside}
      </div>

      <p className="relative text-xs leading-5 text-[#827795]">
        Managers and employees each get a workspace built for their role.
      </p>
    </aside>

    {/* Form side */}
    <main className="auth-form flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
      <header className="flex items-center justify-between gap-4">
        <Link
          to="/"
          aria-label="WorkPilot AI home"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 lg:invisible"
        >
          <Logo size="sm" />
        </Link>

        <div className="text-right text-xs text-[#A99DBB]">
          {headerAction}
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center py-10">
        <div className={`w-full ${formWidthClass}`}>{children}</div>
      </div>

      <footer className="text-center">
        <Link
          to="/"
          className="rounded text-xs text-[#827795] transition-colors hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
        >
          Back to home
        </Link>
      </footer>
    </main>
  </div>
);

/* Shared form styles so both pages stay consistent. */

export const authLabelClass =
  'mb-2 block text-[13px] font-medium text-[#D8CFE7]';

export const authInputClass =
  'block h-11 w-full rounded-xl border border-white/[0.09] bg-[#19112B] px-3.5 text-sm text-[#FAF8FF] outline-none transition-colors placeholder:text-[#6F6385] hover:border-violet-300/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-500/15';

export const authPrimaryButtonClass =
  'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-[#C4B5FD] px-4 text-sm font-semibold text-[#211638] shadow-[0_8px_30px_rgba(139,92,246,.18)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100';

export const authTextLinkClass =
  'rounded font-semibold text-violet-300 transition-colors hover:text-violet-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300';

export const authIconClass =
  'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#827795]';

export const AuthError: React.FC<{ message: string }> = ({ message }) => (
  <div
    role="alert"
    className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-3.5 text-sm leading-5 text-rose-200"
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
    <span>{message}</span>
  </div>
);

export default AuthShell;
