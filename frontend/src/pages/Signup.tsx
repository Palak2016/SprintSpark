
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { InvitationPreview } from '../types';
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
type ManagerSignupMode = 'CREATE' | 'JOIN';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const reduceMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [managerSignupMode, setManagerSignupMode] =
    useState<ManagerSignupMode>('CREATE');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('EMPLOYEE');
  const [otpCode, setOtpCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Invitation links (/signup?invite=...) pre-fill the email and role. The
  // backend re-validates the token, email and role at signup.
  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    api.previewInvitation(inviteToken)
      .then((preview) => {
        if (!active) return;
        setInvite(preview);
        setEmail(preview.email);
        setRole(preview.intended_role);
      })
      .catch((err: unknown) => {
        if (active) {
          setInviteError(
            err instanceof Error ? err.message : 'This invitation is invalid or has expired.'
          );
        }
      });
    return () => {
      active = false;
    };
  }, [inviteToken]);

  const isInvited = Boolean(invite && inviteToken);
  const isCreatingCompany =
    !isInvited && role === 'MANAGER' && managerSignupMode === 'CREATE';

  const companySignupDetails = isInvited
    ? {
        invitation_token: inviteToken as string,
        ...(role === 'MANAGER' ? { designation: designation.trim() } : {}),
      }
    : role === 'MANAGER'
      ? managerSignupMode === 'CREATE'
        ? {
            company_name: companyName.trim(),
            designation: designation.trim(),
          }
        : {
            company_code: companyCode.trim().toUpperCase(),
            designation: designation.trim(),
          }
      : { company_code: companyCode.trim().toUpperCase() };

  // Mirrors the backend: "98765 43210" or "+91-98765-43210" -> "+919876543210".
  // Returns '' when empty and null when the number can't be valid.
  const normalizePhone = (value: string): string | null => {
    let cleaned = value.replace(/[\s\-().]/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
    if (/^0?[6-9]\d{9}$/.test(cleaned)) cleaned = `+91${cleaned.slice(-10)}`;
    return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (normalizePhone(phoneNumber) === null) {
      setErrorMessage(
        'Enter a valid phone number with country code, for example +91 98765 43210, or leave it empty.'
      );
      return;
    }

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

    if (isCreatingCompany && !companyName.trim()) {
      setErrorMessage('Company name is required to create a company.');
      return;
    }
    if (role === 'MANAGER' && !designation.trim()) {
      setErrorMessage('Designation is required for manager signup.');
      return;
    }
    if (!isInvited && !isCreatingCompany && !companyCode.trim()) {
      setErrorMessage('Enter the company code to join a company.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.sendSignupOtp(
        email.trim(),
        role,
        companySignupDetails
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
        companySignupDetails
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

    if (normalizePhone(phoneNumber) === null) {
      setErrorMessage(
        'The phone number is not valid. Click "Edit details" and use the format +91 98765 43210, or leave it empty.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const createdUser = await signup({
        full_name: fullName.trim(),
        email: email.trim(),
        ...(normalizePhone(phoneNumber)
          ? { phone_number: normalizePhone(phoneNumber) as string }
          : {}),
        password,
        role,
        otp_code: otpCode,
        ...(isInvited
          ? { invitation_token: inviteToken as string }
          : isCreatingCompany
            ? { company_name: companyName.trim() }
            : { company_code: companyCode.trim().toUpperCase() }),
        ...(role === 'MANAGER'
          ? { designation: designation.trim() }
          : {}),
      });

      // People who joined with a company code wait for their Company
      // Admin's approval before they can use their workspace.
      if (createdUser.approval_status !== 'APPROVED') {
        navigate('/pending-approval', { replace: true });
      } else if (role === 'MANAGER') {
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
    'signup-input w-full rounded-xl border border-white/[0.12] bg-[#0C0D0F]/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#73777D] hover:border-white/25 focus:border-white/50 focus:ring-2 focus:ring-white/[0.08]';

  const labelClass =
    'signup-label mb-2 block text-xs font-semibold tracking-wide text-[#D1D3D6]';

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
    <div className="signup-page relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0B0C0E] px-4 py-10 text-white selection:bg-white/20 sm:px-6 lg:py-14">
      {/* Ambient background effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-white/[0.045] blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-slate-400/[0.06] blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="signup-grid pointer-events-none absolute inset-0 opacity-[0.025]"
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
            className="mb-6 inline-flex rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
          >
            <Logo size="lg" onDarkBackground />
          </Link>

          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-white/25" />
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#C4C7CB]">
              Get started
            </span>
            <span className="h-px w-8 bg-white/25" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Create your account
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#AEB4BA]">
            {step === 1
              ? 'Your projects, people, and AI-powered insights — all in one workspace.'
              : 'One quick verification and your WorkPilot workspace is ready.'}
          </p>
        </div>

        {/* Signup card */}
        <div className="signup-card overflow-hidden rounded-3xl border border-white/[0.09] bg-[#141619]/95 shadow-[0_24px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl">
          {/* Card accent */}
          <div className="h-1 bg-gradient-to-r from-[#555B62] via-[#D1D3D6] to-[#73777D]" />

          <div className="p-5 sm:p-8">
            {/* Step indicator */}
            <div
              className="mb-7"
              aria-label={`Signup step ${step} of 2`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#E5E7E9]">
                  {step === 1 ? 'Account details' : 'Email verification'}
                </span>

                <span className="text-xs text-[#92979D]">
                  Step {step} of 2
                </span>
              </div>

              <div className="flex gap-2">
                {[1, 2].map((stepNumber) => (
                  <div
                    key={stepNumber}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      stepNumber <= step
                        ? 'bg-gradient-to-r from-[#AEB4BA] to-white'
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

            {inviteError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-3.5 text-sm text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span>{inviteError}</span>
              </div>
            )}
            {isInvited && invite && (
              <div className="mb-5 rounded-xl border border-white/[0.12] bg-white/[0.04] p-3.5 text-sm text-[#D1D3D6]">
                You're joining <strong className="text-white">{invite.company_name}</strong> as{' '}
                {invite.intended_role === 'MANAGER' ? 'a manager' : 'an employee'} by invitation.
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                {/* Role selection */}
                <fieldset>
                  <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#BFC3C7]">
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
                            disabled={isInvited && !selected}
                            onClick={() => {
                              setRole(value);
                              setErrorMessage(null);
                            }}
                            className={`signup-role-option group relative rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
                              selected
                                ? 'border-white/40 bg-white/[0.08] shadow-[0_0_25px_rgba(255,255,255,.04)]'
                                : 'border-white/[0.09] bg-[#0B0C0E]/45 hover:border-white/20 hover:bg-white/[0.035]'
                            }`}
                          >
                            <div className="mb-4 flex items-center justify-between">
                              <span
                                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                                  selected
                                    ? 'border-white/25 bg-white/[0.12] text-white'
                                    : 'border-white/[0.08] bg-white/[0.035] text-[#9DA2A8] group-hover:text-white'
                                }`}
                              >
                                <Icon className="h-5 w-5" />
                              </span>

                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-white bg-white text-[#111315]'
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

                            <span className="mt-1.5 block text-xs leading-5 text-[#AEB4BA]">
                              {description}
                            </span>

                            {selected && (
                              <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#D1D3D6]">
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

                {/* Company registration and membership */}
                {role === 'MANAGER' && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 rounded-2xl border border-white/[0.1] bg-white/[0.025] p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#D1D3D6]">
                      <BriefcaseBusiness className="h-4 w-4" />
                      Company workspace
                    </div>

                    {!isInvited && (
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['CREATE', 'Create company'],
                        ['JOIN', 'Join company'],
                      ] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={managerSignupMode === mode}
                          onClick={() => {
                            setManagerSignupMode(mode);
                            setErrorMessage(null);
                          }}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                            managerSignupMode === mode
                              ? 'border-white/40 bg-white/10 text-white'
                              : 'border-white/10 text-[#AEB4BA] hover:border-white/25'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    )}

                    {isInvited ? null : isCreatingCompany ? (
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
                    ) : (
                      <div>
                        <label htmlFor="companyCode" className={labelClass}>
                          Company code *
                        </label>
                        <input
                          id="companyCode"
                          type="text"
                          required
                          autoComplete="off"
                          placeholder="Enter your company code"
                          value={companyCode}
                          onChange={(e) => setCompanyCode(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    )}

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

                {role === 'EMPLOYEE' && !isInvited && (
                  <div>
                    <label htmlFor="companyCode" className={labelClass}>
                      Company code *
                    </label>
                    <input
                      id="companyCode"
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="Enter your company code"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-2 text-[11px] text-[#92979D]">
                      Ask your Company Admin for its signup code. You can use
                      WorkPilot once they approve your account.
                    </p>
                  </div>
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
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92979D]" />

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
                      readOnly={isInvited}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phoneNumber" className={labelClass}>
                    Phone number{' '}
                    <span className="font-normal text-[#92979D]">
                      (optional)
                    </span>
                  </label>

                  <input
                    id="phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={inputClass}
                  />

                  <p className="mt-2 text-[11px] leading-5 text-[#92979D]">
                    Your account will be activated after email verification.
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password *
                  </label>

                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92979D]" />

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
                      className="signup-secondary-action absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#92979D] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <p className="mt-2 text-[11px] text-[#92979D]">
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
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-xs leading-5 text-[#AEB4BA]">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-white/30 bg-[#0B0C0E] accent-white focus:ring-2 focus:ring-white/30"
                  />

                  <span>
                    I agree to the{' '}
                    <Link
                      to="/terms"
                      className="font-semibold text-white hover:text-[#D1D3D6] hover:underline"
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
                  className="signup-primary-action group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="rounded-2xl border border-white/[0.1] bg-white/[0.035] p-5 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06]">
                    <Mail className="h-7 w-7 text-[#D1D3D6]" />
                  </div>

                  <h2 className="text-lg font-bold text-white">
                    Check your inbox
                  </h2>

                  <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-[#AEB4BA]">
                    Enter the 6-digit verification code sent to
                  </p>

                  <p className="mt-1 break-all text-sm font-semibold text-white">
                    {email}
                  </p>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0B0C0E]/60 px-3 py-1.5 text-[10px] text-[#BFC3C7]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#D1D3D6]" />
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

                  <p className="mt-2 text-[11px] text-[#92979D]">
                    Enter all six digits from the email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length !== 6}
                  className="signup-primary-action group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    {isSubmitting
                      ? 'Verifying your account...'
                      : 'Verify & Create Account'}
                  </span>

                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtpCode('');
                      setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    className="signup-secondary-action inline-flex items-center gap-1.5 rounded-lg py-2 text-[#AEB4BA] transition hover:text-white disabled:opacity-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Edit details
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSubmitting}
                    className="signup-secondary-action rounded-lg py-2 font-semibold text-[#D1D3D6] transition hover:text-white hover:underline disabled:opacity-50"
                  >
                    {isSubmitting ? 'Please wait...' : 'Resend code'}
                  </button>
                </div>
              </form>
            )}

            {/* Sign in link */}
            <div className="mt-7 border-t border-white/[0.08] pt-5 text-center text-xs text-[#92979D]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="signup-secondary-action font-bold text-white transition hover:text-[#D1D3D6] hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-[#92979D]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#BFC3C7]" />
            Secure account verification
          </span>

          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole className="h-3.5 w-3.5 text-[#BFC3C7]" />
            Role-aware workspace access
          </span>
        </div>

        <p className="mt-5 text-center font-mono text-[9px] tracking-[0.18em] text-[#666B72]">
          PROJECT INTELLIGENCE · HUMAN-CONTROLLED DECISIONS
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
