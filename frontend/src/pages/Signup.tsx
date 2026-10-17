import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
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
  AlertOctagon,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  Eye,
  EyeOff,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  Timer,
  UserRound,
} from 'lucide-react';

type SignupRole = 'EMPLOYEE' | 'MANAGER';

const roleContent: Record<
  SignupRole,
  {
    heading: string;
    intro: string;
    features: { Icon: typeof Gauge; title: string; text: string }[];
  }
> = {
  EMPLOYEE: {
    heading: 'All your assigned work in one queue.',
    intro:
      'See every task assigned to you across projects, keep your manager up to date, and protect time for focused work.',
    features: [
      {
        Icon: CheckSquare,
        title: 'Update progress in place',
        text: 'Move a task forward and add a note without leaving your queue.',
      },
      {
        Icon: AlertOctagon,
        title: 'Flag blockers early',
        text: 'Report what is stopping you and your manager sees it straight away.',
      },
      {
        Icon: Timer,
        title: 'Log focus hours',
        text: 'Record time against tasks so estimates stay realistic.',
      },
    ],
  },
  MANAGER: {
    heading: 'Spot delivery risk before it reaches your deadline.',
    intro:
      'WorkPilot reads progress, blockers, and leave across your projects and tells you where delivery is slipping.',
    features: [
      {
        Icon: Gauge,
        title: 'Risk score for every project',
        text: 'Updated as tasks move, so you know which project needs you first.',
      },
      {
        Icon: Sparkles,
        title: 'Recovery plans you approve',
        text: 'AI drafts the plan. Nothing changes until you accept it.',
      },
      {
        Icon: CalendarDays,
        title: 'Leave with its impact',
        text: 'Each request shows which tasks and dates it affects.',
      },
    ],
  },
};

/* Left panel: changes with the role picked in the form. */
const SignupAside: React.FC<{ role: SignupRole }> = ({ role }) => {
  const reduceMotion = useReducedMotion();
  const content = roleContent[role];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={role}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="max-w-[480px]"
      >
        <p className="text-sm font-medium text-violet-300">
          {role === 'MANAGER' ? 'For managers' : 'For employees'}
        </p>
        <h2 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-[#FAF8FF] xl:text-[2.75rem]">
          {content.heading}
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-7 text-[#B7ADC9]">
          {content.intro}
        </p>

        <ul className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {content.features.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-4 py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-400/20 to-indigo-400/10 text-violet-300">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#FAF8FF]">
                  {title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-[#A99DBB]">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
};

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

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

  const roleOptions = [
    {
      value: 'EMPLOYEE' as const,
      label: 'Employee',
      description: 'Manage your tasks and daily work.',
      Icon: UserRound,
    },
    {
      value: 'MANAGER' as const,
      label: 'Manager',
      description: 'Coordinate projects and your team.',
      Icon: BriefcaseBusiness,
    },
  ];

  const selectedRole = roleOptions.find((option) => option.value === role);
  const passwordsMatch = password === confirmPassword;

  return (
    <AuthShell
      aside={<SignupAside role={role} />}
      formWidthClass="max-w-[440px]"
      headerAction={
        <>
          <span className="hidden sm:inline">Already have an account? </span>
          <Link to="/login" className={authTextLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      {/* Step indicator */}
      <div aria-label={`Signup step ${step} of 2`}>
        <p className="text-xs font-medium text-[#9287A8]">
          Step {step} of 2
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {[1, 2].map((stepNumber) => (
            <span
              key={stepNumber}
              className={`h-1 w-10 rounded-full transition-colors duration-300 ${
                stepNumber <= step ? 'bg-violet-400' : 'bg-white/[0.1]'
              }`}
            />
          ))}
        </div>
      </div>

      <h1 className="mt-6 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-[#FAF8FF]">
        {step === 1 ? 'Create your account' : 'Check your inbox'}
      </h1>

      {step === 1 ? (
        <p className="mt-2 text-sm leading-6 text-[#A99DBB]">
          We will email you a code to confirm your address.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-[#A99DBB]">
          Enter the 6-digit code we sent to{' '}
          <span className="break-all font-semibold text-violet-200">
            {email}
          </span>
          .
        </p>
      )}

      {errorMessage && (
        <div className="mt-6">
          <AuthError message={errorMessage} />
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleSendOtp} className="mt-8 space-y-5">
          {/* Role selection */}
          <fieldset>
            <legend className={authLabelClass}>I am joining as</legend>

            <div className="auth-role-options grid grid-cols-2 gap-1 rounded-xl border border-white/[0.09] bg-[#19112B] p-1">
              {roleOptions.map(({ value, label, Icon }) => {
                const selected = role === value;

                return (
                  <label
                    key={value}
                    data-selected={selected}
                    className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet-300 ${
                      selected
                        ? 'bg-violet-400/[0.16] text-[#F1E9FF] shadow-[inset_0_0_0_1px_rgba(196,181,253,.35)]'
                        : 'text-[#A99DBB] hover:bg-white/[0.03] hover:text-[#E9DFFF]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="signupRole"
                      value={value}
                      checked={selected}
                      onChange={() => {
                        setRole(value);
                        setErrorMessage(null);
                      }}
                      className="sr-only"
                    />
                    <Icon className="h-4 w-4" />
                    {label}
                  </label>
                );
              })}
            </div>

            <p className="auth-role-description mt-2 text-xs text-[#827795]">
              {selectedRole?.description}
            </p>
          </fieldset>

          {/* Manager-only fields */}
          {role === 'MANAGER' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="companyName" className={authLabelClass}>
                  Company name
                </label>
                <input
                  id="companyName"
                  type="text"
                  required
                  autoComplete="organization"
                  placeholder="Your company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={authInputClass}
                />
              </div>

              <div>
                <label htmlFor="designation" className={authLabelClass}>
                  Designation
                </label>
                <input
                  id="designation"
                  type="text"
                  required
                  autoComplete="organization-title"
                  placeholder="Engineering lead"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className={authInputClass}
                />
              </div>
            </div>
          )}

          {/* Full name */}
          <div>
            <label htmlFor="fullName" className={authLabelClass}>
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={authInputClass}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={authLabelClass}>
              {role === 'MANAGER' ? 'Official work email' : 'Email address'}
            </label>
            <div className="relative">
              <Mail className={authIconClass} />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder={
                  role === 'MANAGER' ? 'name@company.com' : 'name@example.com'
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${authInputClass} pl-10`}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phoneNumber" className={authLabelClass}>
              Phone number{' '}
              <span className="font-normal text-[#827795]">(optional)</span>
            </label>
            <input
              id="phoneNumber"
              type="tel"
              autoComplete="tel"
              placeholder="Add a contact phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={authInputClass}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className={authLabelClass}>
              Password
            </label>
            <div className="relative">
              <LockKeyhole className={authIconClass} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
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

          {/* Confirm password */}
          <div>
            <label htmlFor="confirmPassword" className={authLabelClass}>
              Confirm password
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
              aria-describedby={
                confirmPassword.length > 0 ? 'passwordMatchStatus' : undefined
              }
              className={authInputClass}
            />
            {confirmPassword.length > 0 && (
              <p
                id="passwordMatchStatus"
                className={`mt-2 text-xs ${
                  passwordsMatch ? 'text-[#7EE2B8]' : 'text-rose-300'
                }`}
              >
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          {/* Terms */}
          <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-[#A99DBB]">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-violet-300/30 bg-[#19112B] accent-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className={authTextLinkClass}>
                Terms of Service
              </Link>{' '}
              and acknowledge the Responsible AI and transparent operations
              policy.
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className={authPrimaryButtonClass}
          >
            {isSubmitting && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isSubmitting ? 'Sending code...' : 'Send verification code'}
          </button>
        </form>
      ) : (
        /* Step 2: Email OTP verification */
        <form onSubmit={handleVerifyAndCreate} className="mt-8 space-y-5">
          <div>
            <label htmlFor="otpCode" className={authLabelClass}>
              Verification code
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
              className={`${authInputClass} h-14 text-center text-2xl font-semibold tracking-[0.5em] placeholder:text-[#4A3F5E]`}
            />
            <p className="mt-2 text-xs text-[#827795]">
              The code is in an email from WorkPilot. Check spam if you do
              not see it.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || otpCode.length !== 6}
            className={authPrimaryButtonClass}
          >
            {isSubmitting && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isSubmitting ? 'Creating account...' : 'Verify and create account'}
          </button>

          <div className="flex items-center justify-between gap-3 text-[13px]">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtpCode('');
                setErrorMessage(null);
              }}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[#A99DBB] transition-colors hover:text-[#FAF8FF] focus-visible:outline-2 focus-visible:outline-violet-300 disabled:opacity-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Edit details
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isSubmitting}
              className={`${authTextLinkClass} py-2 disabled:opacity-50`}
            >
              {isSubmitting ? 'Please wait...' : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export default Signup;
