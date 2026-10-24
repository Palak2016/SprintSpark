import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CompanyAdminTransfer, CompanyMember } from '../../types';
import {
  ErrorBanner,
  Loading,
  PageHeader,
  Panel,
  StatusPill,
  SuccessBanner,
  buttonClass,
  dangerButtonClass,
  errorText,
  formatWhen,
  inputClass,
  useCompanyId,
} from './shared';

export const CompanyOwnershipView: React.FC = () => {
  const companyId = useCompanyId();
  const { user } = useAuth();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [transfers, setTransfers] = useState<CompanyAdminTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const [portal, history] = await Promise.all([
        api.getCompanyPortal(companyId),
        api.listCompanyTransfers(companyId),
      ]);
      setMembers(portal.members.filter((m) => m.approval_status === 'APPROVED' && m.id !== user?.id));
      setTransfers(history);
    } catch (err) {
      setError(errorText(err, 'Could not load ownership details.'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = transfers.find((t) => t.status === 'PENDING');

  const requestTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !targetId || !password) return;
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const transfer = await api.requestCompanyTransfer(companyId, Number(targetId), password);
      setNotice(`Transfer requested. ${transfer.to_user_name} must accept it before anything changes; you remain Company Admin until then.`);
      setPassword('');
      setTargetId('');
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not request the transfer.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancel = async (transfer: CompanyAdminTransfer) => {
    setError(null);
    try {
      await api.cancelCompanyTransfer(transfer.id);
      setNotice('Transfer cancelled.');
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not cancel the transfer.'));
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title="Ownership"
        description="Each company has exactly one designated Company Admin. Transfer the role to another approved member; it only takes effect when they accept, so the company is never left without an administrator."
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={notice} />
      {isLoading ? (
        <Loading label="Loading ownership details..." />
      ) : (
        <>
          <Panel title="Transfer Company Admin role" description="Confirm with your password. The new admin must also confirm with theirs.">
            {pending ? (
              <div className="flex flex-wrap items-center gap-3 p-5 text-sm">
                <span className="flex-1">
                  Waiting for <strong className="text-white">{pending.to_user_name}</strong> to accept (expires {formatWhen(pending.expires_at)}).
                </span>
                <button type="button" className={dangerButtonClass} onClick={() => void cancel(pending)}>
                  Cancel transfer
                </button>
              </div>
            ) : members.length === 0 ? (
              <p className="p-5 text-sm">There are no other approved members to transfer to yet.</p>
            ) : (
              <form onSubmit={requestTransfer} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
                <label className="flex-1 text-xs">
                  <span className="mb-1 block font-semibold">New Company Admin</span>
                  <select required value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputClass}>
                    <option value="">Select a member</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.role === 'MANAGER' ? 'Manager' : 'Employee'})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs sm:w-56">
                  <span className="mb-1 block font-semibold">Your password</span>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <button type="submit" className={buttonClass} disabled={isSubmitting}>
                  <KeyRound className="h-3.5 w-3.5" /> {isSubmitting ? 'Requesting...' : 'Request transfer'}
                </button>
              </form>
            )}
          </Panel>

          <Panel title="Transfer history">
            {transfers.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#A99DBD]">No transfers yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {transfers.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                    <span className="min-w-0 flex-1">
                      {t.from_user_name} → <strong className="text-white">{t.to_user_name}</strong>
                      <span className="block text-[11px] text-[#8F849F]">
                        Requested {formatWhen(t.created_at)}
                        {t.decided_at ? ` · decided ${formatWhen(t.decided_at)}` : ''}
                      </span>
                    </span>
                    <StatusPill status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default CompanyOwnershipView;
