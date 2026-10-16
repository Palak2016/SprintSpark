
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

type SignupRole = 'EMPLOYEE' | 'MANAGER';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('EMPLOYEE');
  const [otpCode, setOtpCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage(
        'You must agree to the Terms of Service and Privacy Policy.'
      );
      return;
    }

    if (
      role === 'MANAGER' &&
      (!companyName.trim() || !designation.trim())
    ) {
      setErrorMessage(
        'Company name and designation are required for manager signup.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await api.sendSignupOtp(
        email.trim(),
        role,
        role === 'MANAGER'
          ? {
              company_name: companyName.trim(),
              designation: designation.trim(),
            }
          : undefined
      );

      setStep(2);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not send the verification code.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await api.sendSignupOtp(
        email.trim(),
        role,
        role === 'MANAGER'
          ? {
              company_name: companyName.trim(),
              designation: designation.trim(),
            }
          : undefined
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not resend the verification code.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!/^\d{6}$/.test(otpCode)) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signup({
        full_name: fullName.trim(),
        email: email.trim(),
        ...(phoneNumber.trim()
          ? { phone_number: phoneNumber.trim() }
          : {}),
        password,
        role,
        otp_code: otpCode,
        ...(role === 'MANAGER'
          ? {
              company_name: companyName.trim(),
              designation: designation.trim(),
            }
          : {}),
      });

      // Redirect according to the role selected during registration.
      if (role === 'MANAGER') {
        navigate('/manager', { replace: true });
      } else {
        navigate('/employee', { replace: true });
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to create account.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-violet-200/15 bg-[#100B1D]/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#716581] hover:border-violet-300/25 focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/10';

  const labelClass =
    'mb-2 block text-xs font-semibold tracking-wide text-[#D8CFE7]';

  const roleOptions = [
    {
      value: 'EMPLOYEE' as const,
      label: 'Employee',
      description: 'Manage your tasks and daily work.',
      Icon: UserRound,
    },
    {
      value: 'MANAGER' as const,
      label: 'Manager / Team Lead',
      description: 'Coordinate projects and your team.',
      Icon: BriefcaseBusiness,
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#100B1D] px-4 py-10 text-white selection:bg-violet-400/30 sm:px-6 lg:py-14">
      {/* Ambient background effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-violet-600/[0.12] blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-indigo-600/[0.12] blur-[120px]"
      />

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
        className="relative z-10 w-full max-w-lg"
      >
        {/* Logo and page heading */}
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
              Get started
            </span>
            <span className="h-px w-8 bg-violet-400/40" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Create your account
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#A99DBB]">
            {step === 1
              ? 'Your projects, people, and AI-powered insights — all in one workspace.'
              : 'One quick verification and your WorkPilot workspace is ready.'}
          </p>
        </div>

        {/* Signup card */}
        <div className="overflow-hidden rounded-3xl border border-violet-200/10 bg-[#19112B]/90 shadow-[0_24px_100px_rgba(0,0,0,.35)] backdrop-blur-2xl">
          {/* Card accent */}
          <div className="h-1 bg-gradient-to-r from-violet-500 via-violet-300 to-indigo-500" />

          <div className="p-5 sm:p-8">
            {/* Step indicator */}
            <div
              className="mb-7"
              aria-label={`Signup step ${step} of 2`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#E9DFFF]">
                  {step === 1 ? 'Account details' : 'Email verification'}
                </span>

                <span className="text-xs text-[#9287A8]">
                  Step {step} of 2
                </span>
              </div>

              <div className="flex gap-2">
                {[1, 2].map((stepNumber) => (
                  <div
                    key={stepNumber}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      stepNumber <= step
                        ? 'bg-gradient-to-r from-violet-400 to-indigo-400'
                        : 'bg-white/[0.08]'
                    }`}
                  />
                ))}
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

            {step === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                {/* Role selection */}
                <fieldset>
                  <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#B7ADC9]">
                    Choose your workspace
                  </legend>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {roleOptions.map(
                      ({ value, label, description, Icon }) => {
                        const selected = role === value;

                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setRole(value);
                              setErrorMessage(null);
                            }}
                            className={`group relative rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
                              selected
                                ? 'border-violet-400/60 bg-violet-400/[0.10] shadow-[0_0_25px_rgba(139,92,246,.08)]'
                                : 'border-violet-200/10 bg-[#100B1D]/40 hover:border-violet-300/30 hover:bg-violet-300/[0.04]'
                            }`}
                          >
                            <div className="mb-4 flex items-center justify-between">
                              <span
                                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                                  selected
                                    ? 'border-violet-300/25 bg-violet-400/15 text-violet-200'
                                    : 'border-white/[0.08] bg-white/[0.035] text-[#9287A8] group-hover:text-violet-200'
                                }`}
                              >
                                <Icon className="h-5 w-5" />
                              </span>

                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-violet-300 bg-violet-300 text-[#19112B]'
                                    : 'border-white/20 text-transparent'
                                }`}
                              >
                                {selected && (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </span>
                            </div>

                            <span className="block text-sm font-bold text-white">
                              {label}
                            </span>

                            <span className="mt-1.5 block text-xs leading-5 text-[#A99DBB]">
                              {description}
                            </span>

                            {selected && (
                              <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                                <Sparkles className="h-3 w-3" />
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </fieldset>

                {/* Manager-only fields */}
                {role === 'MANAGER' && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 rounded-2xl border border-violet-300/15 bg-violet-300/[0.035] p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-violet-200">
                      <BriefcaseBusiness className="h-4 w-4" />
                      Manager workspace details
                    </div>

                    <div>
                      <label
                        htmlFor="companyName"
                        className={labelClass}
                      >
                        Company name *
                      </label>

                      <input
                        id="companyName"
                        type="text"
                        required
                        autoComplete="organization"
                        placeholder="Your company"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="designation"
                        className={labelClass}
                      >
                        Designation *
                      </label>

                      <input
                        id="designation"
                        type="text"
                        required
                        autoComplete="organization-title"
                        placeholder="Engineering Team Lead"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Full name */}
                <div>
                  <label htmlFor="fullName" className={labelClass}>
                    Full name *
                  </label>

                  <input
                    id="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className={labelClass}>
                    {role === 'MANAGER'
                      ? 'Official work email *'
                      : 'Email address *'}
                  </label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#827795]" />

                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={
                        role === 'MANAGER'
                          ? 'name@company.com'
                          : 'name@example.com'
                      }
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phoneNumber" className={labelClass}>
                    Phone number{' '}
                    <span className="font-normal text-[#827795]">
                      (optional)
                    </span>
                  </label>

                  <input
                    id="phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Add a contact phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={inputClass}
                  />

                  <p className="mt-2 text-[11px] leading-5 text-[#827795]">
                    Your account will be activated after email verification.
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password *
                  </label>

                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#827795]" />

                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pl-10 pr-12`}
                    />

                    <button
                      type="button"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
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

                  <p className="mt-2 text-[11px] text-[#827795]">
                    Use at least 8 characters.
                  </p>
                </div>

                {/* Confirm password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className={labelClass}
                  >
                    Confirm password *
                  </label>

                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />

                  {confirmPassword.length > 0 && (
                    <p
                      className={`mt-2 text-[11px] ${
                        password === confirmPassword
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }`}
                    >
                      {password === confirmPassword
                        ? 'Passwords match'
                        : 'Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Terms */}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200/[0.07] bg-white/[0.02] p-3.5 text-xs leading-5 text-[#A99DBB]">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-violet-300/30 bg-[#100B1D] accent-violet-400 focus:ring-2 focus:ring-violet-400/30"
                  />

                  <span>
                    I agree to the{' '}
                    <Link
                      to="/terms"
                      className="font-semibold text-violet-300 hover:text-violet-200 hover:underline"
                    >
                      Terms of Service
                    </Link>{' '}
                    and acknowledge the Responsible AI and transparent
                    operations policy.
                  </span>
                </label>

                {/* Continue */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-[#C4B5FD] px-4 py-3.5 text-sm font-bold text-[#211638] shadow-[0_8px_30px_rgba(139,92,246,.15)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_35px_rgba(139,92,246,.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span>
                    {isSubmitting
                      ? 'Sending verification code...'
                      : 'Continue to verification'}
                  </span>

                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </form>
            ) : (
              /* Step 2: Email OTP verification */
              <form
                onSubmit={handleVerifyAndCreate}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] p-5 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10">
                    <Mail className="h-7 w-7 text-violet-200" />
                  </div>

                  <h2 className="text-lg font-bold text-white">
                    Check your inbox
                  </h2>

                  <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-[#A99DBB]">
                    Enter the 6-digit verification code sent to
                  </p>

                  <p className="mt-1 break-all text-sm font-semibold text-violet-200">
                    {email}
                  </p>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-[#100B1D]/50 px-3 py-1.5 text-[10px] text-[#B7ADC9]">
                    <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                    Email verification
                  </div>
                </div>

                <div>
                  <label htmlFor="otpCode" className={labelClass}>
                    Verification code *
                  </label>

                  <input
                    id="otpCode"
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className={`${inputClass} py-4 text-center text-2xl font-bold tracking-[0.5em]`}
                  />

                  <p className="mt-2 text-[11px] text-[#827795]">
                    Enter all six digits from the email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length !== 6}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-[#C4B5FD] px-4 py-3.5 text-sm font-bold text-[#211638] shadow-[0_8px_30px_rgba(139,92,246,.15)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_35px_rgba(139,92,246,.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span>
                    {isSubmitting
                      ? 'Verifying your account...'
                      : 'Verify & Create Account'}
                  </span>

                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                <div className="flex items-center justify-between gap-3 border-t border-violet-200/10 pt-5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtpCode('');
                      setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[#A99DBB] transition hover:text-white disabled:opacity-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Edit details
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSubmitting}
                    className="rounded-lg py-2 font-semibold text-violet-300 transition hover:text-violet-200 hover:underline disabled:opacity-50"
                  >
                    {isSubmitting ? 'Please wait...' : 'Resend code'}
                  </button>
                </div>
              </form>
            )}

            {/* Sign in link */}
            <div className="mt-7 border-t border-violet-200/10 pt-5 text-center text-xs text-[#9287A8]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-violet-300 transition hover:text-violet-200 hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-[#827795]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
            Secure account verification
          </span>

          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole className="h-3.5 w-3.5 text-violet-300" />
            Role-aware workspace access
          </span>
        </div>

        <p className="mt-5 text-center font-mono text-[9px] tracking-[0.18em] text-[#554768]">
          PROJECT INTELLIGENCE · HUMAN-CONTROLLED DECISIONS
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
