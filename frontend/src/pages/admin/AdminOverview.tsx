import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowRight, IconBuilding2, IconKeyRound, IconMail, IconUserCheck, IconUsersRound } from '../../icons';
import { api } from '../../services/api';
import {
  Company,
  CompanyAdminTransfer,
  CompanyAnalytics,
  CompanyAuditEvent,
  CompanyInvitation,
} from '../../types';
import { adminPath } from '../../utils/workspace';
import {
  ErrorBanner,
  Loading,
  PageHeader,
  Panel,
  StatusPill,
  errorText,
  eventLabel,
  formatWhen,
  useCompanyId,
} from '../company/shared';

interface OverviewData {
  portal: Company;
  analytics: CompanyAnalytics | null;
  invitations: CompanyInvitation[] | null;
  events: CompanyAuditEvent[] | null;
  transfers: CompanyAdminTransfer[] | null;
}

const STATUSES = ['APPROVED', 'PENDING', 'REJECTED'] as const;
const ROLES = [
  { key: 'MANAGER', label: 'Managers' },
  { key: 'EMPLOYEE', label: 'Employees' },
] as const;

const RISK_LABELS: Record<string, string> = {
  HIGH: 'High risk',
  MEDIUM: 'Medium risk',
  LOW: 'Low risk',
  INSUFFICIENT_DATA: 'Not enough data',
  NOT_ANALYZED: 'Not analyzed yet',
};

const RISK_BAR: Record<string, string> = {
  HIGH: 'bg-rose-400/80',
  MEDIUM: 'bg-amber-300/80',
  LOW: 'bg-emerald-400/80',
};

const settledValue = <T,>(result: PromiseSettledResult<T>): T | null =>
  result.status === 'fulfilled' ? result.value : null;

export const AdminOverview: React.FC = () => {
  const companyId = useCompanyId();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      // The portal is required; the other panels degrade on their own.
      const portal = await api.getCompanyPortal(companyId);
      const [analytics, invitations, events, transfers] = await Promise.allSettled([
        api.getCompanyAnalytics(companyId),
        api.listCompanyInvitations(companyId),
        api.getCompanyAuditEvents(companyId),
        api.listCompanyTransfers(companyId),
      ]);
      setPartial([analytics, invitations, events, transfers].some((r) => r.status === 'rejected'));
      setData({
        portal,
        analytics: settledValue(analytics),
        invitations: settledValue(invitations),
        events: settledValue(events),
        transfers: settledValue(transfers),
      });
    } catch (err) {
      setError(errorText(err, 'Could not load the company overview.'));
    }
  }, [companyId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="space-y-7">
        <PageHeader title="Overview" description="Company administration at a glance." />
        <ErrorBanner message={error} />
      </div>
    );
  }
  if (!data || !companyId) return <Loading label="Loading company overview..." />;

  const { portal, analytics, invitations, events, transfers } = data;
  const admin = portal.members.find((m) => m.id === portal.admin_user_id);
  const pendingMembers = portal.members.filter((m) => m.approval_status === 'PENDING');
  const pendingInvites = invitations?.filter((i) => i.status === 'PENDING') ?? [];
  const pendingTransfer = transfers?.find((t) => t.status === 'PENDING');
  const teamTotal = portal.manager_count + portal.employee_count;
  const count = (role: string, status: string) =>
    portal.members.filter((m) => m.role === role && m.approval_status === status).length;

  const riskRows = analytics?.portfolio.distribution ?? [];
  const projectTotal = analytics?.project_count ?? 0;
  const ringCircumference = 2 * Math.PI * 48;
  let ringOffset = 0;
  const riskSegments = riskRows.map((row) => {
    const length = projectTotal > 0
      ? (row.count / projectTotal) * ringCircumference
      : 0;
    const segment = { row, length, offset: ringOffset };
    ringOffset += length;
    return segment;
  });
  const adminInitials = (admin?.full_name ?? '—')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const statusTotals = STATUSES.map((status) => ({
    status,
    value: ROLES.reduce((total, role) => total + count(role.key, status), 0),
  }));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Company operations"
        title="Command center"
        description="Monitor portfolio signals, team access and company activity from one place."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to={adminPath(companyId, 'invitations')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3.5 py-2.5 text-sm font-semibold text-[#D8D0E7] transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <IconMail className="h-4 w-4" />
              Invite team
            </Link>
            <Link
              to={adminPath(companyId, 'approvals')}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-400/15 px-3.5 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <IconUserCheck className="h-4 w-4" />
              Review approvals
              {portal.pending_count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-300 px-1 text-[10px] font-bold text-[#211638]">
                  {portal.pending_count}
                </span>
              )}
            </Link>
          </div>
        }
      />
      {partial && (
        <ErrorBanner message="Some panels could not be loaded. Refresh the page to try again." />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/2.5 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
            <IconBuilding2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{portal.name}</p>
            <p className="mt-0.5 text-[11px] text-[#9487AA]">Created {formatWhen(portal.created_at)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-2 text-[#A99DBD]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-400/15 text-[10px] font-bold text-violet-100">
              {adminInitials}
            </span>
            Admin <strong className="font-semibold text-white">{admin?.full_name ?? '—'}</strong>
          </span>
          <span className="h-4 w-px bg-white/10" aria-hidden="true" />
          <span className="text-[#A99DBD]">
            Members <strong className="ml-1 font-semibold tabular-nums text-white">{portal.members.length}</strong>
          </span>
          <span className="text-[#A99DBD]">
            Projects <strong className="ml-1 font-semibold tabular-nums text-white">{analytics ? analytics.project_count : '—'}</strong>
          </span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel
            title="Portfolio pulse"
            description="Project distribution by the latest delivery-risk signal."
            aside={
              <Link to={adminPath(companyId, 'analytics')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
                Open analytics <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {!analytics ? (
              <p className="px-5 py-8 text-center text-sm">Analytics are unavailable.</p>
            ) : projectTotal === 0 ? (
              <p className="px-5 py-8 text-center text-sm">This company has no projects yet.</p>
            ) : (
              <div className="grid gap-5 p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <div className="relative mx-auto h-40 w-40">
                  <svg viewBox="0 0 120 120" role="img" aria-label={`${projectTotal} projects grouped by delivery risk`}>
                    <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="12" className="text-white/7" />
                    <g transform="rotate(-90 60 60)">
                      {riskSegments.map(({ row, length, offset }) => (
                        <circle
                          key={row.risk_level}
                          cx="60"
                          cy="60"
                          r="48"
                          fill="none"
                          stroke={row.risk_level === 'HIGH' ? '#fb7185'
                            : row.risk_level === 'MEDIUM' ? '#fbbf24'
                            : row.risk_level === 'LOW' ? '#34d399'
                            : '#94a3b8'}
                          strokeWidth="12"
                          strokeDasharray={`${length} ${ringCircumference - length}`}
                          strokeDashoffset={-offset}
                        />
                      ))}
                    </g>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold tabular-nums text-white">{projectTotal}</span>
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A99DBD]">Projects</span>
                  </div>
                </div>
                <ul className="space-y-3" aria-label="Project risk distribution">
                  {riskRows.map((row) => {
                    const share = projectTotal > 0 ? (row.count / projectTotal) * 100 : 0;
                    return (
                      <li key={row.risk_level} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                        <span className="text-xs font-medium text-[#D1C7E0]">
                          {RISK_LABELS[row.risk_level] ?? row.risk_level}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-white">
                          {row.count} <span className="font-normal text-[#9487AA]">({Math.round(share)}%)</span>
                        </span>
                        <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/7" aria-hidden="true">
                          <span
                            className={`block h-full rounded-full ${RISK_BAR[row.risk_level] ?? 'bg-slate-400/60'}`}
                            style={{ width: `${share}%` }}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        <div className="xl:col-span-5">
          <Panel
            title="People & access"
            description="A snapshot of team structure and membership status."
            aside={
              <Link to={adminPath(companyId, 'members')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
                Manage team <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <div className="p-5">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tabular-nums text-white">{teamTotal}</p>
                  <p className="mt-1 text-xs text-[#A99DBD]">Managers and employees</p>
                </div>
                <IconUsersRound className="mb-1 h-5 w-5 text-violet-200/70" />
              </div>
              <div
                role="img"
                aria-label={`${portal.manager_count} managers and ${portal.employee_count} employees`}
                className="flex h-2.5 overflow-hidden rounded-full bg-white/7"
              >
                <span
                  className="h-full bg-violet-400"
                  style={{ width: `${teamTotal ? (portal.manager_count / teamTotal) * 100 : 0}%` }}
                />
                <span
                  className="h-full bg-sky-400"
                  style={{ width: `${teamTotal ? (portal.employee_count / teamTotal) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-[#D8D0E7]">
                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                  Managers <strong className="text-white">{portal.manager_count}</strong>
                </span>
                <span className="inline-flex items-center gap-2 text-[#D8D0E7]">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  Employees <strong className="text-white">{portal.employee_count}</strong>
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/7 pt-4">
                {statusTotals.map(({ status, value }) => (
                  <div key={status} className="rounded-xl border border-white/7 bg-white/2.5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9487AA]">
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-8">
          <Panel
            title="Company activity"
            description="Recent administrative events, newest first."
            aside={
              <Link to={adminPath(companyId, 'activity')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
                View audit trail <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {events === null ? (
              <p className="px-5 py-8 text-center text-sm">Activity is unavailable.</p>
            ) : events.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm">No activity recorded yet.</p>
            ) : (
              <ol className="grid divide-y divide-white/6 sm:grid-cols-2 sm:divide-y-0">
                {events.slice(0, 4).map((event, index) => (
                  <li
                    key={event.id}
                    className={`flex items-start gap-3 px-5 py-4 ${
                      index % 2 === 0 ? 'sm:border-r sm:border-white/6' : ''
                    }`}
                  >
                    <span className="relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-300/15 bg-violet-400/8">
                      <span className="h-2 w-2 rounded-full bg-violet-300" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{eventLabel(event.event_type)}</span>
                      <span className="mt-1 block text-xs text-[#9487AA]">{formatWhen(event.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel
            title="Governance"
            description="Ownership and open invitations."
            aside={
              <Link to={adminPath(companyId, 'ownership')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
                Manage <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/8 text-violet-200">
                  <IconKeyRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9487AA]">Company admin</p>
                  <p className="truncate text-sm font-semibold text-white">{admin?.full_name ?? '—'}</p>
                </div>
              </div>
              {transfers === null ? (
                <p className="rounded-xl border border-white/7 bg-white/2.5 p-3 text-xs">Transfer status is unavailable.</p>
              ) : pendingTransfer ? (
                <div className="rounded-xl border border-amber-300/15 bg-amber-400/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">Transfer to {pendingTransfer.to_user_name}</span>
                    <StatusPill status={pendingTransfer.status} />
                  </div>
                  <p className="mt-1 text-xs leading-5">
                    Waiting for acceptance · Expires {formatWhen(pendingTransfer.expires_at)}
                  </p>
                </div>
              ) : (
                <p className="rounded-xl border border-emerald-300/15 bg-emerald-400/4 p-3 text-xs leading-5">
                  No ownership transfer is in progress.
                </p>
              )}
              <Link
                to={adminPath(companyId, 'invitations')}
                className="flex items-center justify-between rounded-xl border border-white/7 bg-white/2.5 px-3.5 py-3 transition hover:bg-white/5"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                  <IconMail className="h-4 w-4 text-violet-200" />
                  Pending invitations
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums text-white">
                  {invitations === null ? '—' : pendingInvites.length}
                  <IconArrowRight className="h-4 w-4 text-[#827795]" />
                </span>
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
