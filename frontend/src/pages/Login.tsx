
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, user, isManager, isApproved } = useAuth();
  const reduceMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirect authenticated users to their workspace.
  useEffect(() => {
    if (user) {
      navigate(
        !isApproved ? '/pending-approval' : isManager ? '/manager' : '/employee',
        { replace: true }
      );
    }
  }, [user, isManager, isApproved, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email address and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Preserve the existing AuthContext authentication flow.
      await login(email.trim(), password);

      // AuthContext updates the user; the effect above redirects.
      // rememberMe is retained in the UI, but persistence must be
      // implemented by AuthContext if it is not already supported.
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Invalid email or password. Please check your credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'signin-input w-full rounded-xl border border-white/[0.12] bg-[#0C0D0F]/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#73777D] hover:border-white/25 focus:border-white/50 focus:ring-2 focus:ring-white/[0.08]';

  const labelClass =
    'signin-label mb-2 block text-xs font-semibold tracking-wide text-[#D1D3D6]';

  return (
    <div className="signin-page relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0B0C0E] px-4 py-10 text-white selection:bg-white/20 sm:px-6 lg:py-14">
      {/* Background glow effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-white/[0.045] blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-slate-400/[0.06] blur-[120px]"
      />

      {/* Subtle background grid */}
      <div
        aria-hidden="true"
        className="signin-grid pointer-events-none absolute inset-0 opacity-[0.025]"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand and heading */}
        <div className="mb-8 text-center">
          <Link
            to="/"
            aria-label="WorkPilot AI home"
            className="mb-6 inline-flex rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
          >
            <Logo size="lg" onDarkBackground />
          </Link>

          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-white/25" />
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#C4C7CB]">
              Welcome back
            </span>
            <span className="h-px w-8 bg-white/25" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sign in to your workspace
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#AEB4BA]">
            Pick up where you left off. Your projects, team updates, and
            AI-powered insights are waiting for you.
          </p>
        </div>

        {/* Login card */}
        <div className="signin-card overflow-hidden rounded-3xl border border-white/[0.09] bg-[#141619]/95 shadow-[0_24px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl">
          <div className="signin-card-accent h-1" />

          <div className="p-6 sm:p-8">
            {/* Card intro */}
            <div className="mb-6 flex items-center gap-3">
              <div className="signin-icon-tile flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-[#D1D3D6]">
                <LockKeyhole className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-white">
                  Welcome to WorkPilot
                </h2>
                <p className="mt-1 text-xs text-[#92979D]">
                  Enter your account credentials below.
                </p>
              </div>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-3.5 text-sm text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="loginEmail" className={labelClass}>
                  Work email
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92979D]" />

                  <input
                    id="loginEmail"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="loginPassword" className={labelClass + ' mb-0'}>
                    Password
                  </label>

                  <Link
                    to="/forgot-password"
                    className="signin-secondary-action text-xs font-medium text-[#D1D3D6] transition hover:text-white hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92979D]" />

                  <input
                    id="loginPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pl-10 pr-12`}
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="signin-secondary-action absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#92979D] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center">
                <label className="signin-label flex cursor-pointer items-center gap-2.5 text-xs text-[#AEB4BA]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-white/30 bg-[#0B0C0E] accent-white focus:ring-2 focus:ring-white/30"
                  />
                  Remember me for 30 days
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="signin-primary-action group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {isSubmitting ? 'Signing in...' : 'Sign in to workspace'}
                </span>

                {!isSubmitting && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#92979D]">
                New to WorkPilot?
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Signup link */}
            <Link
              to="/signup"
              className="signin-secondary-action flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.025] px-4 py-3 text-sm font-semibold text-[#D1D3D6] transition hover:border-white/25 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-[#92979D]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#BFC3C7]" />
            Role-aware access
          </span>

          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#BFC3C7]" />
            AI-assisted delivery
          </span>
        </div>

        <p className="mt-5 text-center font-mono text-[9px] tracking-[0.18em] text-[#666B72]">
          PROJECT INTELLIGENCE · HUMAN-CONTROLLED DECISIONS
        </p>

        <div className="mt-5 text-center">
          <Link
            to="/"
            className="signin-secondary-action text-xs text-[#92979D] transition hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
