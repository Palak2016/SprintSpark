
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
  const { login, user, isManager } = useAuth();
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
      navigate(isManager ? '/manager' : '/employee', {
        replace: true,
      });
    }
  }, [user, isManager, navigate]);

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
    'w-full rounded-xl border border-violet-200/15 bg-[#100B1D]/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#716581] hover:border-violet-300/25 focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/10';

  const labelClass =
    'mb-2 block text-xs font-semibold tracking-wide text-[#D8CFE7]';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#100B1D] px-4 py-10 text-white selection:bg-violet-400/30 sm:px-6 lg:py-14">
      {/* Background glow effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-violet-600/[0.12] blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-indigo-600/[0.12] blur-[120px]"
      />

      {/* Subtle background grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
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
            className="mb-6 inline-flex rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
          >
            <Logo size="lg" onDarkBackground />
          </Link>

          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-violet-400/40" />
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300">
              Welcome back
            </span>
            <span className="h-px w-8 bg-violet-400/40" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sign in to your workspace
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#A99DBB]">
            Pick up where you left off. Your projects, team updates, and
            AI-powered insights are waiting for you.
          </p>
        </div>

        {/* Login card */}
        <div className="overflow-hidden rounded-3xl border border-violet-200/10 bg-[#19112B]/90 shadow-[0_24px_100px_rgba(0,0,0,.35)] backdrop-blur-2xl">
          <div className="h-1 bg-gradient-to-r from-violet-500 via-violet-300 to-indigo-500" />

          <div className="p-6 sm:p-8">
            {/* Card intro */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
                <LockKeyhole className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-white">
                  Welcome to WorkPilot
                </h2>
                <p className="mt-1 text-xs text-[#9287A8]">
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
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#827795]" />

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
                    className="text-xs font-medium text-violet-300 transition hover:text-violet-200 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#827795]" />

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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9287A8] transition hover:text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
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
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#A99DBB]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-violet-300/30 bg-[#100B1D] accent-violet-400 focus:ring-2 focus:ring-violet-400/30"
                  />
                  Remember me for 30 days
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-[#C4B5FD] px-4 py-3.5 text-sm font-bold text-[#211638] shadow-[0_8px_30px_rgba(139,92,246,.15)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_35px_rgba(139,92,246,.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
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
              <div className="h-px flex-1 bg-violet-200/10" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#716581]">
                New to WorkPilot?
              </span>
              <div className="h-px flex-1 bg-violet-200/10" />
            </div>

            {/* Signup link */}
            <Link
              to="/signup"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200/15 bg-white/[0.025] px-4 py-3 text-sm font-semibold text-[#E9DFFF] transition hover:border-violet-300/30 hover:bg-violet-300/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-[#827795]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
            Role-aware access
          </span>

          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
            AI-assisted delivery
          </span>
        </div>

        <p className="mt-5 text-center font-mono text-[9px] tracking-[0.18em] text-[#554768]">
          PROJECT INTELLIGENCE · HUMAN-CONTROLLED DECISIONS
        </p>

        <div className="mt-5 text-center">
          <Link
            to="/"
            className="text-xs text-[#827795] transition hover:text-violet-200"
          >
            Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
