import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  AlertCircle, ArrowLeft, ArrowRight, BriefcaseBusiness, Eye, EyeOff,
  ShieldCheck, UserRound
} from 'lucide-react';

type SignupRole = 'EMPLOYEE' | 'MANAGER';

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
      setErrorMessage('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }
    if (role === 'MANAGER' && (!companyName.trim() || !designation.trim())) {
      setErrorMessage('Company name and designation are required for manager signup.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.sendSignupOtp(
        email,
        role,
        role === 'MANAGER'
          ? { company_name: companyName, designation }
          : undefined
      );
      setStep(2);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not send the verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await api.sendSignupOtp(
        email,
        role,
        role === 'MANAGER'
          ? { company_name: companyName, designation }
          : undefined
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not resend the verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signup({
        full_name: fullName,
        email,
        ...(phoneNumber.trim() ? { phone_number: phoneNumber.trim() } : {}),
        password,
        role,
        otp_code: otpCode,
        ...(role === 'MANAGER'
          ? { company_name: companyName, designation }
          : {})
      });
      navigate(role === 'MANAGER' ? '/manager' : '/employee');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-offwhite flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-block mb-3">
          <Logo size="lg" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-charcoal-900">
          Create your WorkPilot account
        </h2>
        <p className="text-xs text-charcoal-500 mt-1">
          {step === 1 ? 'Choose your workspace and enter your account details' : 'Verify your email to finish signing up'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-card rounded-2xl border border-charcoal-100 sm:px-8">
          <div className="mb-6 flex items-center gap-2" aria-label={`Signup step ${step} of 2`}>
            {[1, 2].map((stepNumber) => (
              <div
                key={stepNumber}
                className={`h-1.5 flex-1 rounded-full ${stepNumber <= step ? 'bg-forest-700' : 'bg-charcoal-100'}`}
              />
            ))}
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <fieldset>
                <legend className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-2">
                  Choose your workspace
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'EMPLOYEE', label: 'Employee', description: 'Join your team workflow', Icon: UserRound },
                    { value: 'MANAGER', label: 'Manager / Team Lead', description: 'Manager workspace after email OTP', Icon: BriefcaseBusiness }
                  ] as const).map(({ value, label, description, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={role === value}
                      onClick={() => setRole(value)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        role === value
                          ? 'border-forest-600 bg-forest-50 ring-1 ring-forest-600'
                          : 'border-charcoal-200 hover:border-charcoal-300'
                      }`}
                    >
                      <Icon className="mb-2 h-5 w-5 text-forest-700" />
                      <span className="block text-sm font-semibold text-charcoal-900">{label}</span>
                      <span className="mt-1 block text-[11px] text-charcoal-500">{description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {role === 'MANAGER' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                      Company name *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="organization"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                      Designation *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="organization-title"
                      placeholder="Engineering Team Lead"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Elena Rostova"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  {role === 'MANAGER' ? 'Official work email *' : 'Email *'}
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={role === 'MANAGER' ? 'name@company.com' : 'name@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  Phone number (optional)
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="Add a contact phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
                <p className="mt-1 text-[11px] text-charcoal-500">Email verification is used to activate your account.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  Password (min. 8 characters) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  Confirm Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer text-xs text-charcoal-600">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded text-forest-700 focus:ring-forest-600 accent-forest-700"
                />
                <span>I accept the Terms of Service and acknowledge the Responsible AI transparent operations policy.</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-forest-700 text-white hover:bg-forest-800 shadow-sm transition-all disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Sending code...' : 'Continue to email verification'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndCreate} className="space-y-4">
              <div className="rounded-xl border border-forest-100 bg-forest-50 p-4 text-center">
                <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-forest-700" />
                <p className="text-sm font-semibold text-charcoal-900">Check your email</p>
                <p className="mt-1 text-xs text-charcoal-600">Enter the verification code sent to {email}.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  Verification code *
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="Enter email code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 text-center text-lg tracking-[0.3em] rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-forest-700 text-white hover:bg-forest-800 shadow-sm transition-all disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Verifying...' : 'Verify & Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-charcoal-600 hover:text-charcoal-900">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Edit details
                </button>
                <button type="button" onClick={handleResendOtp} disabled={isSubmitting} className="font-semibold text-forest-700 hover:underline disabled:opacity-50">
                  Resend code
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-charcoal-100 text-center text-xs text-charcoal-500">
            Already have an account?{' '}
            <Link to="/login" className="text-forest-700 font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
