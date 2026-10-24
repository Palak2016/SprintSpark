import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  FolderKanban,
  KeyRound,
  Mail,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from 'lucide-react';
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
  const count = (role: string, status: string) =>
    portal.members.filter((m) => m.role === role && m.approval_status === status).length;

  const tiles = [
    { label: 'Managers', value: portal.manager_count, icon: ShieldCheck, to: 'members' },
    { label: 'Employees', value: portal.employee_count, icon: UsersRound, to: 'members' },
    { label: 'Awaiting approval', value: portal.pending_count, icon: UserCheck, to: 'approvals', warn: portal.pending_count > 0 },
    { label: 'Pending invitations', value: invitations ? pendingInvites.length : '—', icon: Mail, to: 'invitations' },
    { label: 'Projects', value: analytics ? analytics.project_count : '—', icon: FolderKanban, to: 'analytics' },
  ];

  const riskRows = analytics?.portfolio.distribution ?? [];
  const riskMax = Math.max(1, ...riskRows.map((r) => r.count));

  return (
    <div className="space-y-7">
      <PageHeader
        title="Overview"
        description="Membership, pending work and recent administrative activity for this company."
      />
      {partial && (
        <ErrorBanner message="Some panels could not be loaded. Refresh the page to try again." />
      )}

      {/* Company summary */}
      <section className="flex flex-col gap-5 rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-400/[0.08] to-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-100">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-white">{portal.name}</h2>
            <p className="mt-1 text-xs">Created {formatWhen(portal.created_at)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <dt className="text-xs text-[#9487AA]">Company Admin</dt>
          <dd className="truncate font-medium text-white">{admin?.full_name ?? '—'}</dd>
          <dt className="text-xs text-[#9487AA]">Members</dt>
          <dd className="font-medium text-white">{portal.members.length}</dd>
        </dl>
      </section>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={adminPath(companyId, tile.to)}
            className={`group rounded-2xl border p-4 transition hover:border-violet-300/30 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              tile.warn ? 'border-amber-300/25 bg-amber-400/[0.05]' : 'border-white/10 bg-white/[0.025]'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs">{tile.label}</p>
              <tile.icon className="h-4 w-4 text-violet-200/70" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{tile.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Membership by role and status */}
        <Panel title="Membership" description="People in this company by role and approval status.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#9487AA]">
                  <th scope="col" className="px-5 py-3 font-medium">Role</th>
                  {STATUSES.map((s) => (
                    <th key={s} scope="col" className="px-5 py-3 text-right font-medium">
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {ROLES.map((role) => (
                  <tr key={role.key}>
                    <th scope="row" className="px-5 py-3 text-left font-medium text-white">{role.label}</th>
                    {STATUSES.map((s) => (
                      <td key={s} className="px-5 py-3 text-right tabular-nums text-white">
                        {count(role.key, s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Pending approvals */}
        <Panel
          title="Awaiting your approval"
          description="People who joined with the company signup code."
          aside={
            <Link to={adminPath(companyId, 'approvals')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
              Review <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {pendingMembers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm">Nobody is waiting for approval.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {pendingMembers.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">{m.full_name}</span>
                    <span className="block truncate text-xs text-[#9487AA]">{m.email}</span>
                  </span>
                  <span className="shrink-0 text-xs text-[#B7ADC9]">{m.role.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Ownership */}
        <Panel
          title="Ownership"
          description="Company Admin transfers."
          aside={
            <Link to={adminPath(companyId, 'ownership')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="flex items-start gap-3 px-5 py-4 text-sm">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-violet-200/70" />
            {transfers === null ? (
              <p>Transfer status is unavailable.</p>
            ) : pendingTransfer ? (
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white">Transfer to {pendingTransfer.to_user_name}</span>
                  <StatusPill status={pendingTransfer.status} />
                </div>
                <p className="mt-1 text-xs">
                  Waiting for them to accept. Expires {formatWhen(pendingTransfer.expires_at)}.
                  You stay Company Admin until then.
                </p>
              </div>
            ) : (
              <p>No transfer in progress. You are this company's Company Admin.</p>
            )}
          </div>
        </Panel>

        {/* Project risk */}
        <Panel
          title="Project delivery risk"
          description="Latest risk analysis of each project in this company."
          aside={
            <Link to={adminPath(companyId, 'analytics')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
              Analytics <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {!analytics ? (
            <p className="px-5 py-8 text-center text-sm">Analytics are unavailable.</p>
          ) : analytics.project_count === 0 ? (
            <p className="px-5 py-8 text-center text-sm">This company has no projects yet.</p>
          ) : (
            <ul className="space-y-3 p-5" aria-label="Projects by risk level">
              {riskRows.map((row) => (
                <li key={row.risk_level} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 text-[#D1C7E0]">{RISK_LABELS[row.risk_level] ?? row.risk_level}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={`block h-full rounded-full ${RISK_BAR[row.risk_level] ?? 'bg-slate-400/60'}`}
                      style={{ width: `${(row.count / riskMax) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-right font-semibold tabular-nums text-white">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Recent activity */}
      <Panel
        title="Recent activity"
        description="Recorded administrative actions, most recent first."
        aside={
          <Link to={adminPath(companyId, 'activity')} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-violet-100">
            All activity <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {events === null ? (
          <p className="px-5 py-8 text-center text-sm">Activity is unavailable.</p>
        ) : events.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {events.slice(0, 6).map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium text-white">{eventLabel(event.event_type)}</span>
                <span className="text-xs text-[#9487AA]">{formatWhen(event.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default AdminOverview;
