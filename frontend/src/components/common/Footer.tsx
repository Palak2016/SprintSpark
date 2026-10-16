
import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import {
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  LockKeyhole,
  Activity,
  Sparkles,
  Heart,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-violet-300/10 bg-[#100B1D] text-[#B7ADC9]">
      {/* Background effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-[15%] h-80 w-80 rounded-full bg-violet-600/[0.08] blur-[100px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-indigo-600/[0.08] blur-[100px]"
      />

      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:py-20">

        {/* Main footer */}
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">

          {/* Brand */}
          <div className="space-y-5 lg:col-span-4">
            <Link
              to="/"
              aria-label="WorkPilot AI home"
              className="inline-flex rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
            >
              <Logo size="lg" onDarkBackground />
            </Link>

            <p className="max-w-sm text-sm leading-7 text-[#A99DBB]">
              Your AI copilot for project delivery. Connect task progress,
              team capacity, and explainable risk intelligence in one
              intelligent workspace.
            </p>

            {/* Trust indicator */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3.5 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-400/10">
                <ShieldCheck className="h-4 w-4 text-violet-300" />
              </span>

              <div>
                <p className="text-xs font-semibold text-[#E9DFFF]">
                  Human-in-the-loop AI
                </p>
                <p className="mt-0.5 text-[10px] text-[#9287A8]">
                  People remain in control
                </p>
              </div>
            </div>

            {/* Platform principles */}
            <div className="flex flex-wrap gap-4 pt-1 text-xs text-[#9287A8]">
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="h-3.5 w-3.5 text-violet-300" />
                Role-aware access
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-violet-300" />
                Explainable signals
              </span>
            </div>
          </div>

          {/* Product links */}
          <div className="lg:col-span-2">
            <h3 className="mb-5 text-xs font-bold uppercase tracking-[.18em] text-white">
              Product
            </h3>

            <ul className="space-y-3.5 text-sm">
              <li>
                <a
                  href="/#preview"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-violet-200"
                >
                  Workspace Overview
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </a>
              </li>

              <li>
                <a
                  href="/#features"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-violet-200"
                >
                  Platform Features
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </a>
              </li>

              <li>
                <a
                  href="/#preview"
                  className="transition-colors hover:text-violet-200"
                >
                  Risk Intelligence
                </a>
              </li>

              <li>
                <a
                  href="/#preview"
                  className="transition-colors hover:text-violet-200"
                >
                  AI Recovery Planner
                </a>
              </li>

              <li>
                <a
                  href="/#preview"
                  className="transition-colors hover:text-violet-200"
                >
                  Team Capacity
                </a>
              </li>
            </ul>
          </div>

          {/* Governance */}
          <div className="lg:col-span-3">
            <h3 className="mb-5 text-xs font-bold uppercase tracking-[.18em] text-white">
              Governance
            </h3>

            <ul className="space-y-3.5 text-sm">
              <li>
                <a
                  href="/#security"
                  className="transition-colors hover:text-violet-200"
                >
                  Security & RBAC
                </a>
              </li>

              <li>
                <a
                  href="/#security"
                  className="transition-colors hover:text-violet-200"
                >
                  Responsible AI
                </a>
              </li>

              <li>
                <a
                  href="/#security"
                  className="transition-colors hover:text-violet-200"
                >
                  Human Approval
                </a>
              </li>

              <li>
                <a
                  href="/#faq"
                  className="transition-colors hover:text-violet-200"
                >
                  Frequently Asked Questions
                </a>
              </li>
            </ul>
          </div>

          {/* Get started */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-violet-200/10 bg-gradient-to-br from-[#211638] to-[#171025] p-5 sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-violet-300">
                <Sparkles className="h-5 w-5" />
              </div>

              <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">
                Ready to move forward?
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#A99DBB]">
                Bring your projects and delivery decisions into one place.
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <Link
                  to="/signup"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-[#C4B5FD] px-4 py-3 text-sm font-bold text-[#211638] shadow-[0_6px_24px_rgba(139,92,246,.15)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(139,92,246,.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200/15 bg-white/[0.025] px-4 py-3 text-sm font-semibold text-[#E9DFFF] transition-colors hover:border-violet-300/30 hover:bg-violet-300/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                >
                  Sign in to workspace
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-10 h-px bg-gradient-to-r from-transparent via-violet-300/15 to-transparent sm:my-12" />

        {/* Bottom bar */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

          <div className="space-y-2 text-center sm:text-left">
            <p className="text-xs text-[#9287A8]">
              © {currentYear}{' '}
              <span className="font-semibold text-[#E9DFFF]">
                WorkPilot AI
              </span>
              . All rights reserved.
            </p>

            <p className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-[#756987] sm:justify-start">
              Built for smarter project delivery
              <Heart className="h-3 w-3 fill-violet-400/50 text-violet-300" />
              with responsible AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs sm:justify-end">
            <a
              href="/privacy"
              className="transition-colors hover:text-violet-200"
            >
              Privacy Policy
            </a>

            <a
              href="/terms"
              className="transition-colors hover:text-violet-200"
            >
              Terms of Service
            </a>

            <span className="inline-flex items-center gap-2 text-[#9287A8]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Platform information
            </span>
          </div>
        </div>

        {/* Brand signature */}
        <div className="mt-8 text-center">
          <p className="font-mono text-[10px] tracking-[.18em] text-[#554768]">
            PROJECT INTELLIGENCE · HUMAN-CONTROLLED DECISIONS
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
