import React from 'react';
import { useParams } from 'react-router-dom';
import { IconAlertCircle, IconSpinner } from '../../icons';
import { formatIndianDateTime } from '../../utils/date';

/** The company being administered, taken from /admin/:companyId/... */
export const useCompanyId = (): number | null => {
  const { companyId } = useParams();
  const parsed = Number(companyId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Readable names for recorded company audit events. */
export const EVENT_LABELS: Record<string, string> = {
  COMPANY_CREATED: 'Company created',
  COMPANY_ADMIN_GRANTED: 'Company Admin assigned',
  COMPANY_ADMIN_TRANSFER_REQUESTED: 'Admin transfer requested',
  COMPANY_ADMIN_TRANSFERRED: 'Admin role transferred',
  COMPANY_ADMIN_TRANSFER_DECLINED: 'Admin transfer declined',
  COMPANY_ADMIN_TRANSFER_CANCELLED: 'Admin transfer cancelled',
  JOIN_CODE_ROTATED: 'Signup code regenerated',
  MEMBER_JOIN_REQUESTED: 'Member asked to join',
  MEMBER_APPROVED: 'Member approved',
  MEMBER_REJECTED: 'Member rejected',
  INVITATION_CREATED: 'Invitation sent',
  INVITATION_REVOKED: 'Invitation revoked',
  INVITATION_ACCEPTED: 'Invitation accepted',
  MEMBER_DESIGNATION_CHANGED: 'Designation changed',
  MEMBER_ROLE_CHANGED: 'Project access changed',
  MEMBER_DEACTIVATED: 'Account deactivated',
  MEMBER_REACTIVATED: 'Account reactivated',
};

export const eventLabel = (type: string): string => EVENT_LABELS[type] ?? type;

const ROLE_WORDS: Record<string, string> = {
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  ADMIN: 'Administration only',
};

/** "by Alice · Bob · Employee → Manager", built only from what was recorded. */
export const eventDetail = (
  event: { actor_id?: number | null; metadata_json: Record<string, unknown> },
  names: Record<number, string>,
): string => {
  const meta = event.metadata_json ?? {};
  const who = (id: unknown) =>
    typeof id === 'number' ? names[id] ?? `user #${id}` : null;
  const word = (value: unknown) =>
    value === null || value === undefined || value === ''
      ? '—'
      : ROLE_WORDS[String(value)] ?? String(value);
  const parts: string[] = [];
  const actor = who(event.actor_id);
  if (actor) parts.push(`by ${actor}`);
  const target = who(meta.user_id ?? meta.to_user_id);
  if (target && meta.user_id !== event.actor_id) parts.push(target);
  if ('from' in meta || 'to' in meta) parts.push(`${word(meta.from)} → ${word(meta.to)}`);
  if (typeof meta.notes === 'string' && meta.notes) parts.push(`“${meta.notes}”`);
  return parts.join(' · ');
};

export const errorText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const formatWhen = (value?: string | null): string =>
  value ? formatIndianDateTime(value) : '—';

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ eyebrow = 'Admin console', title, description, actions }) => (
  <header className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-white/8 bg-linear-to-br from-white/3.5 to-transparent p-5 sm:flex-row sm:items-end sm:p-6">
    <span aria-hidden="true" className="absolute bottom-5 left-0 top-5 w-1 rounded-r-full bg-violet-300/60" />
    <div className="relative min-w-0 pl-1">
      <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-violet-300">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-300" />
        {eyebrow}
      </span>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B7ADC9]">{description}</p>
    </div>
    {actions && <div className="relative shrink-0">{actions}</div>}
  </header>
);

export const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-400/8 p-4 text-sm text-rose-200"
    >
      <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null;

export const SuccessBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div
      role="status"
      className="rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-4 text-sm text-emerald-200"
    >
      {message}
    </div>
  ) : null;

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 p-8 text-sm text-[#B7ADC9]">
    <IconSpinner className="h-5 w-5 animate-spin" />
    {label}
  </div>
);

export const Panel: React.FC<{
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, aside, children }) => (
  <section className="company-admin-panel relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-[#1B1428] to-[#19112B] shadow-[0_12px_34px_rgba(0,0,0,0.12)]">
    <header className="flex items-center justify-between gap-4 border-b border-white/8 bg-white/1.5 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-violet-300/50" />
        <div className="min-w-0">
        <h2 className="font-bold text-white">{title}</h2>
        {description && <p className="mt-1 text-xs text-[#A99DBD]">{description}</p>}
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
    {children}
  </section>
);

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const tone: Record<string, string> = {
    APPROVED: 'border-emerald-300/25 text-emerald-200',
    ACTIVE: 'border-emerald-300/25 text-emerald-200',
    DEACTIVATED: 'border-white/15 text-[#A99DBD]',
    ACCEPTED: 'border-emerald-300/25 text-emerald-200',
    PENDING: 'border-amber-300/25 text-amber-200',
    REJECTED: 'border-rose-300/25 text-rose-200',
    REVOKED: 'border-rose-300/25 text-rose-200',
    DECLINED: 'border-rose-300/25 text-rose-200',
    EXPIRED: 'border-white/15 text-[#A99DBD]',
    CANCELLED: 'border-white/15 text-[#A99DBD]',
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
        tone[status] ?? 'border-white/10 text-[#C4B6DB]'
      }`}
    >
      {status}
    </span>
  );
};

export const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300/25 bg-violet-400/10 px-3.5 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50';

export const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3.5 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50';

export const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#100B1D]/70 px-3 py-2 text-sm text-white placeholder:text-[#8F849F] focus:border-violet-400/50 focus:outline-none';
