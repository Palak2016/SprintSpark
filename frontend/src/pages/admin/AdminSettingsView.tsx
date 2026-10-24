import React, { useEffect, useState } from 'react';
import { Check, Clipboard, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { Company } from '../../types';
import {
  ErrorBanner,
  Loading,
  PageHeader,
  Panel,
  SuccessBanner,
  buttonClass,
  errorText,
  formatWhen,
  useCompanyId,
} from '../company/shared';

export const AdminSettingsView: React.FC = () => {
  const companyId = useCompanyId();
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setCompany(null);
    setError(null);
    api.getCompanyPortal(companyId)
      .then((data) => active && setCompany(data))
      .catch((err: unknown) => active && setError(errorText(err, 'Could not load company settings.')));
    return () => {
      active = false;
    };
  }, [companyId]);

  const rotate = async () => {
    if (!companyId) return;
    setRotating(true);
    setError(null);
    setNotice(null);
    try {
      setCompany(await api.rotateCompanyJoinCode(companyId));
      setNotice('A new signup code is active. The previous code no longer works.');
      setCopied(false);
      setConfirmRotate(false);
    } catch (err) {
      setError(errorText(err, 'Could not generate a new signup code.'));
    } finally {
      setRotating(false);
    }
  };

  const copy = async () => {
    if (!company) return;
    try {
      await navigator.clipboard.writeText(company.join_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the code. Select it and copy it manually.');
    }
  };

  const admin = company?.members.find((m) => m.id === company.admin_user_id);

  return (
    <div className="space-y-7">
      <PageHeader title="Settings" description="Company details and how new people join this company." />
      <ErrorBanner message={error} />
      <SuccessBanner message={notice} />

      {!company && !error ? (
        <Loading label="Loading settings..." />
      ) : company ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Company profile">
            <dl className="divide-y divide-white/[0.06] text-sm">
              {[
                ['Name', company.name],
                ['Company ID', String(company.id)],
                ['Created', formatWhen(company.created_at)],
                ['Company Admin', admin ? `${admin.full_name} (${admin.email})` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                  <dt className="text-[#9487AA]">{label}</dt>
                  <dd className="font-medium text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel
            title="Company signup code"
            description="People who sign up with this code join as pending members and wait for your approval. Invitations skip the approval step."
          >
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#100B1D] p-4">
                <code className="min-w-0 flex-1 break-all font-mono text-2xl font-bold tracking-[0.18em] text-white">
                  {company.join_code}
                </code>
                <button
                  type="button"
                  onClick={() => void copy()}
                  aria-label={copied ? 'Code copied' : 'Copy signup code'}
                  className="rounded-lg border border-white/10 p-2.5 text-[#D1C7E0] transition hover:bg-white/10 hover:text-white"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                </button>
              </div>

              {confirmRotate ? (
                <div role="alertdialog" aria-label="Confirm new signup code" className="rounded-xl border border-amber-300/25 bg-amber-400/[0.06] p-4 text-sm">
                  <p className="text-amber-100">
                    The current code stops working immediately. Anyone you already shared it with needs the new one.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void rotate()} disabled={rotating} className={buttonClass}>
                      {rotating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {rotating ? 'Generating...' : 'Generate new code'}
                    </button>
                    <button type="button" onClick={() => setConfirmRotate(false)} disabled={rotating} className={buttonClass}>
                      Keep current code
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmRotate(true)} className={buttonClass}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate new code
                </button>
              )}
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
};

export default AdminSettingsView;
