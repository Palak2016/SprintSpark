
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Logo } from '../components/common/Logo';
import { AuthShowcase } from '../components/common/AuthShowcase';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { InvitationPreview } from '../types';
import { homePath } from '../utils/workspace';
import { SignupRole, buildSignupDetails } from '../utils/signup';
import { prepareProfilePhoto, profilePhotoStorageKey } from '../utils/profilePhoto';
import { IconAlertCircle, IconArrowLeft, IconArrowRight, IconBriefcaseBusiness, IconBuilding2, IconCheckCircle2, IconEye, IconEyeOff, IconLockKeyhole, IconMail, IconShieldCheck, IconUserRound } from '../icons';

/**
 * Three separate signup paths:
 *  - ADMIN:    create a NEW company and become its Company Admin.
 *  - MANAGER:  join an existing company (signup code or invitation).
 *  - EMPLOYEE: join an existing company (signup code or invitation).
 * The backend enforces the same rules; this form only guides the user.
 */

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const reduceMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [alsoManager, setAlsoManager] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // /signup?type=admin opens the "Create a company" path directly.
  const [role, setRole] = useState<SignupRole>(() =>
    searchParams.get('type') === 'admin' ? 'ADMIN' : 'EMPLOYEE'
  );
  const [otpCode, setOtpCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const uploadPhotoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);

  useEffect(() => {
    if (!isCameraOpen) return;
    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    void video.play().catch((error: unknown) => {
      console.error('Could not start the camera preview:', error);
      setProfilePhotoError('Could not start the camera preview. Try uploading a photo instead.');
    });

    return () => {
      video.srcObject = null;
    };
  }, [isCameraOpen]);

  useEffect(() => () => {
    cameraRequestIdRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
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
  const isCreatingCompany = !isInvited && role === 'ADMIN';

  const handleProfilePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    setProfilePhotoError(null);
    setIsPreparingPhoto(true);

    try {
      setProfilePhoto(await prepareProfilePhoto(file));
    } catch (error) {
      setProfilePhotoError(
        error instanceof Error
          ? error.message
          : 'Could not prepare this photo.',
      );
    } finally {
      setIsPreparingPhoto(false);
    }
  };

  const clearProfilePhoto = () => {
    setProfilePhoto(null);
    setProfilePhotoError(null);
    if (uploadPhotoRef.current) uploadPhotoRef.current.value = '';
  };

  const stopCamera = () => {
    cameraRequestIdRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setIsOpeningCamera(false);
    setCameraReady(false);
    setIsCameraOpen(false);
  };

  const startCamera = async () => {
    setProfilePhotoError(null);
    setIsOpeningCamera(true);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setProfilePhotoError('Camera access is not available here. Upload a photo instead.');
      setIsOpeningCamera(false);
      return;
    }

    const requestId = ++cameraRequestIdRef.current;
    let timeoutId: number | undefined;

    try {
      const cameraRequest = navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      void cameraRequest.then(
        (stream) => {
          if (requestId !== cameraRequestIdRef.current) {
            stream.getTracks().forEach((track) => track.stop());
          }
        },
        () => undefined,
      );
      const cameraTimeout = new Promise<MediaStream>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new DOMException('Camera access request timed out.', 'TimeoutError')),
          15000,
        );
      });
      const stream = await Promise.race([cameraRequest, cameraTimeout]);
      if (requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch (error) {
      if (requestId !== cameraRequestIdRef.current) return;
      console.error('Could not access the camera:', error);
      const cameraError = error instanceof DOMException ? error.name : '';
      if (cameraError === 'TimeoutError') {
        cameraRequestIdRef.current += 1;
        setProfilePhotoError(
          'Camera access took too long. Allow camera access in your browser, or upload a photo.',
        );
        setIsOpeningCamera(false);
        return;
      }
      setProfilePhotoError(
        cameraError === 'NotAllowedError'
          ? 'Camera permission is blocked. Allow camera access in your browser, or upload a photo.'
          : cameraError === 'NotFoundError'
            ? 'No camera was found. Upload a photo instead.'
            : 'Could not open the camera. Check browser permissions or upload a photo.',
      );
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (requestId === cameraRequestIdRef.current) setIsOpeningCamera(false);
    }
  };

  const captureProfilePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setProfilePhotoError('Wait for the camera preview before taking a photo.');
      return;
    }

    const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');

    if (!context) {
      setProfilePhotoError('Your browser could not capture this photo.');
      return;
    }

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setProfilePhoto(canvas.toDataURL('image/jpeg', 0.82));
      setProfilePhotoError(null);
      stopCamera();
    } catch (error) {
      console.error('Could not capture the profile photo:', error);
      setProfilePhotoError('Could not capture the photo. Try uploading an image instead.');
    }
  };

  const companySignupDetails = buildSignupDetails({
    role,
    inviteToken: isInvited ? inviteToken : null,
    companyName,
    companyCode,
    designation,
    alsoManager,
  });

  // Mirrors the backend: "98765 43210" or "+91-98765-43210" -> "+919876543210".
  // Returns '' when empty and null when the number can't be valid.
  const normalizePhone = (value: string): string | null => {
    let cleaned = value.replace(/[\s\-().]/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
    if (/^0?[6-9]\d{9}$/.test(cleaned)) cleaned = `+91${cleaned.slice(-10)}`;
    return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  };

  const handleProfileContinue = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (isPreparingPhoto) {
      setProfilePhotoError('Wait for your photo to finish preparing.');
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

    stopCamera();
    setStep(2);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isPreparingPhoto) {
      setProfilePhotoError('Wait for your photo to finish preparing.');
      return;
    }

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

      setStep(3);
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

    let localPhotoKey: string | null = null;
    let previousPhoto: string | null = null;
    let photoSaved = false;

    try {
      if (profilePhoto) {
        localPhotoKey = profilePhotoStorageKey(email);
        try {
          previousPhoto = localStorage.getItem(localPhotoKey);
          localStorage.setItem(localPhotoKey, profilePhoto);
          photoSaved = true;
        } catch (storageError) {
          console.error('Could not save profile photo in this browser:', storageError);
          throw new Error(
            'Could not save your photo in this browser. Remove it or choose a smaller photo.',
          );
        }
      }

      const createdUser = await signup({
        full_name: fullName.trim(),
        email: email.trim(),
        ...(normalizePhone(phoneNumber)
          ? { phone_number: normalizePhone(phoneNumber) as string }
          : {}),
        password,
        role,
        otp_code: otpCode,
        ...companySignupDetails,
      });

      // People who joined with a company code wait for their Company
      // Admin's approval before they can use their workspace.
      // Company creators are its Company Admin and land in the Admin console;
      // everyone else goes to their workspace or waits for approval.
      navigate(homePath(createdUser), { replace: true });
    } catch (err) {
      if (photoSaved && localPhotoKey) {
        try {
          if (previousPhoto) {
            localStorage.setItem(localPhotoKey, previousPhoto);
          } else {
            localStorage.removeItem(localPhotoKey);
          }
        } catch (storageError) {
          console.error('Could not restore the previous local profile photo:', storageError);
        }
      }

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
    'signup-input w-full rounded-xl border border-white/12 bg-[#0C0D0F]/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#73777D] hover:border-white/25 focus:border-white/50 focus:ring-2 focus:ring-white/8';

  const labelClass =
    'signup-label mb-2 block text-xs font-semibold tracking-wide text-[#D1D3D6]';

  const roleOptions = [
    {
      value: 'ADMIN' as const,
      label: 'Create a company',
      description: 'New company. You become its Company Admin.',
      Icon: IconBuilding2,
    },
    {
      value: 'MANAGER' as const,
      label: 'Manager',
      description: 'Join your company to run projects.',
      Icon: IconBriefcaseBusiness,
    },
    {
      value: 'EMPLOYEE' as const,
      label: 'Employee',
      description: 'Join your company for your daily work.',
      Icon: IconUserRound,
    },
  ];

  return (
    <div className="signup-page relative flex min-h-screen items-start justify-center overflow-hidden bg-[#0B0C0E] px-4 py-8 text-white selection:bg-white/20 sm:px-6 lg:items-center lg:py-8">
      {/* Ambient background effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-white/4.5 blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-slate-400/6 blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="signup-grid pointer-events-none absolute inset-0 opacity-[0.025]"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 mx-auto grid w-full max-w-350 items-start gap-5 lg:min-h-185 lg:grid-cols-2 lg:items-stretch"
      >
        <AuthShowcase mode="signup" />

        <section className="mx-auto w-full max-w-3xl lg:flex lg:h-full lg:flex-col">
          {/* Compact mobile heading; desktop branding lives in the side panel. */}
          <div className="mb-6 text-center lg:hidden">
          <Link
            to="/"
            aria-label="WorkPilot AI home"
            className="mb-4 inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
          >
            <Logo size="md" onDarkBackground />
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
              ? 'Start with your profile and workspace details.'
              : step === 2
                ? 'Choose your sign-in details and confirm your email.'
                : 'Enter the one-time code to finish creating your account.'}
          </p>
        </div>

        {/* Signup card */}
        <div className="signup-card overflow-hidden rounded-3xl border border-white/9 bg-[#141619]/95 shadow-[0_24px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl lg:flex-1">
          {/* Card accent */}
          <div className="h-1 bg-linear-to-r from-[#555B62] via-[#D1D3D6] to-[#73777D]" />

          <div className="p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4" aria-label={`Signup step ${step} of 3`}>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5B4694]">
                  {step === 1 ? 'Your profile' : step === 2 ? 'Account security' : 'Email verification'}
                </p>
                <h1 className="mt-1 hidden text-2xl font-bold tracking-tight text-white lg:block">
                  {step === 1
                    ? 'Create your account'
                    : step === 2
                      ? 'Secure your account'
                      : 'Verify your email'}
                </h1>
                <p className="mt-1 hidden text-xs text-[#AEB4BA] lg:block">
                  {step === 1
                    ? 'Set up your WorkPilot profile.'
                    : step === 2
                      ? 'Choose credentials and confirm your contact details.'
                      : `Enter the code sent to ${email}.`}
                </p>
              </div>

              <div className="w-28 shrink-0">
                <p className="mb-2 text-right text-xs text-[#92979D]">
                  Step {step} of 3
                </p>
                <div className="flex gap-1.5">
                {[1, 2, 3].map((stepNumber) => (
                  <div
                    key={stepNumber}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      stepNumber <= step
                        ? 'bg-linear-to-r from-[#AEB4BA] to-white'
                        : 'bg-white/8'
                    }`}
                  />
                ))}
                </div>
              </div>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/8 p-3.5 text-sm text-rose-200"
              >
                <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span>{errorMessage}</span>
              </div>
            )}

            {inviteError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/8 p-3.5 text-sm text-rose-200"
              >
                <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span>{inviteError}</span>
              </div>
            )}
            {isInvited && invite && (
              <div className="mb-5 rounded-xl border border-white/12 bg-white/4 p-3.5 text-sm text-[#D1D3D6]">
                You're joining <strong className="text-white">{invite.company_name}</strong> as{' '}
                {invite.intended_role === 'MANAGER' ? 'a manager' : 'an employee'} by invitation.
              </div>
            )}

            {step < 3 ? (
              <form
                onSubmit={step === 1 ? handleProfileContinue : handleSendOtp}
                className="space-y-4"
              >
                {step === 1 ? (
                  <>
                {/* Role selection */}
                <fieldset>
                  <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#BFC3C7]">
                    How are you joining?
                  </legend>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                            className={`signup-role-option group relative rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
                              selected
                                ? 'border-white/40 bg-white/8 shadow-[0_0_25px_rgba(255,255,255,.04)]'
                                : 'border-white/9 bg-[#0B0C0E]/45 hover:border-white/20 hover:bg-white/3.5'
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                                  selected
                                    ? 'border-white/25 bg-white/12 text-white'
                                    : 'border-white/8 bg-white/3.5 text-[#9DA2A8] group-hover:text-white'
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </span>

                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-white bg-white text-[#111315]'
                                    : 'border-white/20 text-transparent'
                                }`}
                              >
                                {selected && (
                                  <IconCheckCircle2 className="h-4 w-4" />
                                )}
                              </span>
                            </div>

                            <span className="block text-xs font-bold text-white">
                              {label}
                            </span>

                            <span className="mt-1 block text-[10px] leading-4 text-[#AEB4BA]">
                              {description}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </fieldset>

                {/* A. Create a company: the creator becomes its Company Admin */}
                {role === 'ADMIN' && !isInvited && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 rounded-2xl border border-white/10 bg-white/2.5 p-4"
                  >
                    <div className="flex items-start gap-2 text-xs leading-5 text-[#D1D3D6]">
                      <IconBuilding2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        This creates a <strong className="text-white">new company</strong> and
                        makes you its <strong className="text-white">Company Admin</strong>: you
                        approve members, send invitations and manage access from the Admin
                        console. To join a company that already uses WorkPilot, choose
                        Manager or Employee instead.
                      </span>
                    </div>

                    <div>
                      <label htmlFor="companyName" className={labelClass}>
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
                      <label htmlFor="designation" className={labelClass}>
                        Your designation{' '}
                        <span className="font-normal text-[#92979D]">(optional)</span>
                      </label>
                      <input
                        id="designation"
                        type="text"
                        autoComplete="organization-title"
                        placeholder="Founder, HR Head, ..."
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/2 p-3 text-xs leading-5 text-[#D1D3D6]">
                      <input
                        type="checkbox"
                        checked={alsoManager}
                        onChange={(e) => setAlsoManager(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-white"
                      />
                      <span>
                        <span className="block font-semibold text-white">I will also manage projects</span>
                        Adds Manager access so you can switch between the Admin console
                        and the Manager workspace. You can change this later in Members.
                      </span>
                    </label>
                  </motion.div>
                )}

                {/* B. Manager: joins an existing company */}
                {role === 'MANAGER' && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 rounded-2xl border border-white/10 bg-white/2.5 p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#D1D3D6]">
                      <IconBriefcaseBusiness className="h-4 w-4" />
                      Join your company as a manager
                    </div>

                    {!isInvited && (
                      <div>
                        <label htmlFor="companyCode" className={labelClass}>
                          Company signup code *
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
                          Ask your Company Admin for the code, or use the invitation link
                          they sent you. Accounts that join with a code wait for approval.
                        </p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="designation" className={labelClass}>
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

                <div className={role === 'EMPLOYEE' && !isInvited ? 'grid gap-3 sm:grid-cols-2' : 'space-y-4'}>
                  {/* C. Employee: joins an existing company */}
                  {role === 'EMPLOYEE' && !isInvited && (
                    <div>
                      <label htmlFor="companyCode" className={labelClass}>
                        Company signup code *
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
                        Ask your Company Admin for the code, or use the invitation link they sent.
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
                </div>

                {/* Optional profile photo; saved locally because signup remains backend-free. */}
                <div className="rounded-2xl border border-white/10 bg-white/2.5 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/6 text-[#D1D3D6]">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt="Profile photo preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <IconUserRound aria-hidden="true" className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={labelClass}>
                        Profile photo <span className="font-normal text-[#92979D]">(optional)</span>
                      </p>
                      <p id="profile-photo-help" className="text-[10px] leading-4 text-[#92979D]">
                        Local to this browser. Not uploaded.
                      </p>
                    </div>

                    <input
                      ref={uploadPhotoRef}
                      id="profilePhotoUpload"
                      type="file"
                      accept="image/*"
                      aria-describedby="profile-photo-help"
                      className="hidden"
                      onChange={handleProfilePhotoChange}
                    />
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                      <button
                        type="button"
                        onClick={() => uploadPhotoRef.current?.click()}
                        disabled={isPreparingPhoto}
                        className="signup-secondary-action inline-flex items-center rounded-lg border border-white/12 bg-white/4 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Upload photo
                      </button>

                      <button
                        type="button"
                        onClick={isCameraOpen ? stopCamera : startCamera}
                        disabled={isPreparingPhoto || isOpeningCamera}
                        className="signup-secondary-action inline-flex items-center rounded-lg border border-white/12 bg-white/4 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isOpeningCamera
                          ? 'Waiting for camera...'
                          : isCameraOpen
                            ? 'Close camera'
                            : 'Open camera'}
                      </button>

                      {profilePhoto && (
                        <button
                          type="button"
                          onClick={clearProfilePhoto}
                          className="signup-secondary-action rounded-lg px-2 py-2 text-xs font-semibold text-[#AEB4BA] transition hover:text-white"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {isCameraOpen && (
                    <div className="mt-4 max-w-sm overflow-hidden rounded-xl border border-white/12 bg-[#0C0D0F] p-2">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onLoadedMetadata={() => setCameraReady(true)}
                        aria-label="Live camera preview"
                        className="aspect-video w-full rounded-lg bg-black object-cover"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="signup-secondary-action rounded-lg px-3 py-2 text-xs font-semibold text-[#AEB4BA] transition hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={captureProfilePhoto}
                          disabled={!cameraReady}
                          className="signup-primary-action rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Capture photo
                        </button>
                      </div>
                    </div>
                  )}

                  {isOpeningCamera && (
                    <p className="mt-2 text-[11px] text-[#BFC3C7]" role="status">
                      Allow camera access in your browser when prompted.
                    </p>
                  )}

                  {isPreparingPhoto && (
                    <p className="mt-2 text-[11px] text-[#BFC3C7]" role="status">
                      Preparing photo...
                    </p>
                  )}
                  {profilePhotoError && (
                    <p className="mt-2 text-[11px] text-rose-300" role="alert">
                      {profilePhotoError}
                    </p>
                  )}
                </div>
                    </>
                  ) : (
                    <>

                <div className="grid gap-4 md:grid-cols-2">
                {/* Email */}
                <div>
                  <label htmlFor="email" className={labelClass}>
                    {role === 'EMPLOYEE'
                      ? 'Email address *'
                      : 'Official work email *'}
                  </label>

                  <div className="relative">
                    <IconMail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92979D]" />

                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={
                        role === 'EMPLOYEE'
                          ? 'name@example.com'
                          : 'name@company.com'
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
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                {/* Password */}
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password *
                  </label>

                  <div className="relative">
                    <IconLockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92979D]" />

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
                      title={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="signup-secondary-action absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#92979D] transition hover:text-white focus-visible:outline-2 focus-visible:outline-white/70"
                    >
                      {showPassword ? (
                        <IconEyeOff className="h-4 w-4" />
                      ) : (
                        <IconEye className="h-4 w-4" />
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
                </div>

                {/* Terms */}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/2 p-3.5 text-xs leading-5 text-[#AEB4BA]">
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
                  </>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {step === 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setErrorMessage(null);
                      }}
                      className="signup-secondary-action rounded-xl border border-white/12 px-4 py-3 text-sm font-semibold text-[#AEB4BA] transition hover:text-white"
                    >
                      Back to profile
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || isPreparingPhoto}
                    className="signup-primary-action group flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      {isPreparingPhoto
                        ? 'Preparing photo...'
                        : isSubmitting
                          ? 'Sending verification code...'
                          : step === 1
                            ? 'Continue to account security'
                            : 'Send verification code'}
                    </span>

                    <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </form>
            ) : (
              /* Step 3: Email OTP verification */
              <form
                onSubmit={handleVerifyAndCreate}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-white/10 bg-white/3.5 p-5 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/6">
                    <IconMail className="h-7 w-7 text-[#D1D3D6]" />
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

                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0B0C0E]/60 px-3 py-1.5 text-[10px] text-[#BFC3C7]">
                    <IconShieldCheck className="h-3.5 w-3.5 text-[#D1D3D6]" />
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
                  className="signup-primary-action group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    {isSubmitting
                      ? 'Verifying your account...'
                      : 'Verify & Create Account'}
                  </span>

                  <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(2);
                      setOtpCode('');
                      setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    className="signup-secondary-action inline-flex items-center gap-1.5 rounded-lg py-2 text-[#AEB4BA] transition hover:text-white disabled:opacity-50"
                  >
                    <IconArrowLeft className="h-3.5 w-3.5" />
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
            <div className="mt-7 border-t border-white/8 pt-5 text-center text-xs text-[#92979D]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="signup-secondary-action font-bold text-white transition hover:text-[#D1D3D6] hover:underline"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/8 pt-5 text-[10px] text-[#92979D]">
              <span className="inline-flex items-center gap-1.5">
                <IconShieldCheck className="h-3.5 w-3.5 text-[#BFC3C7]" />
                Secure account verification
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconLockKeyhole className="h-3.5 w-3.5 text-[#BFC3C7]" />
                Role-aware workspace access
              </span>
            </div>
          </div>
        </div>

        </section>
      </motion.div>
    </div>
  );
};

export default Signup;
