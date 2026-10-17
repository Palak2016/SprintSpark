import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  AuthShell,
  AuthError,
  authIconClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authTextLinkClass,
} from '../components/auth/AuthShell';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
} from 'lucide-react';

/* Left panel: an example of what WorkPilot surfaces after signing in. */
const LoginAside: React.FC = () => {
  const reduceMotion = useReducedMotion();

  const activity = [
    {
      Icon: AlertTriangle,
      tone: 'text-rose-300 bg-rose-400/10',
      text: 'Delivery risk rose to high on Enterprise Cloud Migration',
    },
    {
      Icon: Sparkles,
      tone: 'text-violet-300 bg-violet-400/10',
      text: 'Recovery plan drafted and waiting for manager approval',
    },
    {
      Icon: CheckCircle2,
      tone: 'text-[#7EE2B8] bg-[#7EE2B8]/10',
      text: '4 tasks completed since yesterday',
    },
  ];

  return (
    <div className="max-w-[480px]">
      <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-[#FAF8FF] xl:text-[2.75rem]">
        Pick up where your projects left off.
      </h2>
      <p className="mt-4 max-w-md text-[15px] leading-7 text-[#B7ADC9]">
        WorkPilot keeps reading delivery signals while you are away, so
        risks and blockers are waiting for you when you sign in.
      </p>

      {/* Project signal card */}
      <figure className="mt-10 rounded-2xl border border-violet-200/[0.12] bg-[#19112B]/90 p-5 shadow-[0_30px_90px_rgba(107,56,220,.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#FAF8FF]">
              Enterprise Cloud Migration
            </p>
            <p className="mt-1 text-xs text-[#9287A8]">
              Sprint 4 of 6, progress against plan
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-rose-300/20 bg-rose-300/[0.08] px-2.5 py-1 text-[11px] font-semibold text-rose-200">
            Risk 72/100
          </span>
        </div>

        <svg
          viewBox="0 0 320 110"
          className="mt-5 h-auto w-full"
          role="img"
          aria-label="Chart showing actual progress falling behind the planned line"
        >
          <defs>
            <linearGradient id="wp-gap" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FDA4AF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#FDA4AF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[22, 55, 88].map((y) => (
            <line
              key={y}
              x1="0"
              x2="320"
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,.06)"
            />
          ))}

          {/* Gap between plan and actual */}
          <path
            d="M110 68 L240 34 L240 62 L200 64 L160 66 L120 68 Z"
            fill="url(#wp-gap)"
          />

          {/* Planned */}
          <line
            x1="0"
            y1="98"
            x2="320"
            y2="12"
            stroke="#8B7FA3"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />

          {/* Actual */}
          <motion.path
            d="M0 98 L40 88 L80 77 L120 68 L160 66 L200 64 L240 62"
            fill="none"
            stroke="#A78BFA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
          />
          <motion.circle
            cx="240"
            cy="62"
            r="4.5"
            fill="#FDA4AF"
            stroke="#19112B"
            strokeWidth="2"
            initial={reduceMotion ? false : { opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 1.55 }}
          />
        </svg>

        <figcaption className="mt-3 flex items-center gap-5 text-[11px] text-[#9287A8]">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-[#A78BFA]" />
            Actual
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0 w-4 border-t border-dashed border-[#8B7FA3]" />
            Planned
          </span>
          <span className="ml-auto text-rose-200/90">18% behind plan</span>
        </figcaption>
      </figure>

      {/* Activity */}
      <ul className="mt-6 space-y-3" aria-label="Example activity">
        {activity.map(({ Icon, tone, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-[#D8CFE7]">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, user, isManager } = useAuth();

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

  return (
    <AuthShell
      aside={<LoginAside />}
      headerAction={
        <>
          <span className="hidden sm:inline">New to WorkPilot? </span>
          <Link to="/signup" className={authTextLinkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-[#FAF8FF]">
        Sign in to WorkPilot
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#A99DBB]">
        Use the email and password for your account.
      </p>

      {errorMessage && (
        <div className="mt-6">
          <AuthError message={errorMessage} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="loginEmail" className={authLabelClass}>
            Work email
          </label>

          <div className="relative">
            <Mail className={authIconClass} />
            <input
              id="loginEmail"
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${authInputClass} pl-10`}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="loginPassword"
              className={`${authLabelClass} mb-0`}
            >
              Password
            </label>

            <Link
              to="/forgot-password"
              className="rounded text-xs font-medium text-violet-300 transition-colors hover:text-violet-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <LockKeyhole className={authIconClass} />
            <input
              id="loginPassword"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInputClass} pl-10 pr-12`}
            />

            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#9287A8] transition-colors hover:bg-white/[0.05] hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-violet-300"
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
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-[#A99DBB]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-violet-300/30 bg-[#19112B] accent-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          />
          Remember me for 30 days
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`${authPrimaryButtonClass} mt-2`}
        >
          {isSubmitting && (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
};

export default Login;
