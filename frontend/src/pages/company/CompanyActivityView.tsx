import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CompanyAuditEvent } from '../../types';
import { ErrorBanner, Loading, PageHeader, Panel, errorText, formatWhen, useCompanyId } from './shared';

const EVENT_LABELS: Record<string, string> = {
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
};

export const CompanyActivityView: React.FC = () => {
  const companyId = useCompanyId();
  const [events, setEvents] = useState<CompanyAuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setEvents(null);
    api.getCompanyAuditEvents(companyId)
      .then((result) => active && setEvents(result))
      .catch((err: unknown) => active && setError(errorText(err, 'Could not load company activity.')));
    return () => {
      active = false;
    };
  }, [companyId]);

  return (
    <div className="space-y-7">
      <PageHeader title="Activity" description="Audit trail of administrative actions for this company." />
      <ErrorBanner message={error} />
      {!events && !error ? (
        <Loading label="Loading activity..." />
      ) : events ? (
        <Panel title="Recent activity" description="Most recent first.">
          {events.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#A99DBD]">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="font-medium text-white">{EVENT_LABELS[event.event_type] ?? event.event_type}</span>
                  <span className="text-xs text-[#8F849F]">{formatWhen(event.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
};

export default CompanyActivityView;
