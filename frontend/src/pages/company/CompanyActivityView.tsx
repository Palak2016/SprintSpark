import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CompanyAuditEvent } from '../../types';
import { ErrorBanner, Loading, PageHeader, Panel, errorText, eventDetail, eventLabel, formatWhen, useCompanyId } from './shared';

export const CompanyActivityView: React.FC = () => {
  const companyId = useCompanyId();
  const [events, setEvents] = useState<CompanyAuditEvent[] | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setEvents(null);
    api.getCompanyAuditEvents(companyId)
      .then((result) => active && setEvents(result))
      .catch((err: unknown) => active && setError(errorText(err, 'Could not load company activity.')));
    // Names for "who did it / to whom"; the log itself stores user ids.
    api.getCompanyPortal(companyId)
      .then((portal) => active && setNames(Object.fromEntries(portal.members.map((m) => [m.id, m.full_name]))))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [companyId]);

  return (
    <div className="space-y-7">
      <PageHeader title="Activity" description="Audit trail of administrative actions for this company: what happened, who did it, to whom and when." />
      <ErrorBanner message={error} />
      {!events && !error ? (
        <Loading label="Loading activity..." />
      ) : events ? (
        <Panel title="Recent activity" description="Most recent first.">
          {events.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#A99DBD]">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {events.map((event) => {
                const detail = eventDetail(event, names);
                return (
                  <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-white">{eventLabel(event.event_type)}</span>
                      {detail && <span className="mt-0.5 block text-xs text-[#B7ADC9]">{detail}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-[#8F849F]">{formatWhen(event.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
};

export default CompanyActivityView;
