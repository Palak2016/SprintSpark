import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CompanyAnalytics } from '../../types';
import { ErrorBanner, Loading, PageHeader, Panel, errorText, useCompanyId } from './shared';

const RISK_LABELS: Record<string, string> = {
  HIGH: 'High risk',
  MEDIUM: 'Medium risk',
  LOW: 'Low risk',
  INSUFFICIENT_DATA: 'Insufficient data',
  NOT_ANALYZED: 'Not analyzed',
};

export const CompanyAnalyticsView: React.FC = () => {
  const companyId = useCompanyId();
  const [data, setData] = useState<CompanyAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setData(null);
    setError(null);
    api.getCompanyAnalytics(companyId)
      .then((result) => active && setData(result))
      .catch((err: unknown) => active && setError(errorText(err, 'Could not load company analytics.')));
    return () => {
      active = false;
    };
  }, [companyId]);

  const tiles = data
    ? [
        { label: 'Managers', value: data.members.managers },
        { label: 'Employees', value: data.members.employees },
        { label: 'Awaiting approval', value: data.members.pending },
        { label: 'Pending invitations', value: data.pending_invitations },
        { label: 'Projects', value: data.project_count },
      ]
    : [];
  const maxRisk = data ? Math.max(1, ...data.portfolio.distribution.map((d) => d.count)) : 1;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Company analytics"
        description="Membership and project health for this company only."
      />
      <ErrorBanner message={error} />
      {!data && !error ? (
        <Loading label="Loading analytics..." />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-xs text-[#A99DBD]">{tile.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{tile.value}</p>
              </div>
            ))}
          </div>
          <Panel title="Project delivery risk" description="Latest risk analysis per project.">
            <ul className="space-y-3 p-5">
              {data.portfolio.distribution.map((row) => (
                <li key={row.risk_level} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-[#D1C7E0]">{RISK_LABELS[row.risk_level] ?? row.risk_level}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-violet-400/70"
                      style={{ width: `${(row.count / maxRisk) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 text-right font-semibold text-white">{row.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : null}
    </div>
  );
};

export default CompanyAnalyticsView;
