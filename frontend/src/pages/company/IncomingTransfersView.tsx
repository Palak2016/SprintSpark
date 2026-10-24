import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { adminPath } from '../../utils/workspace';
import { useAuth } from '../../context/AuthContext';
import { CompanyAdminTransfer } from '../../types';
import {
  ErrorBanner,
  Loading,
  PageHeader,
  Panel,
  buttonClass,
  dangerButtonClass,
  errorText,
  formatWhen,
  inputClass,
} from './shared';

/** Lets the person a Company Admin role is being transferred to accept or
 * decline it. Reachable by any approved user; the backend only lets the
 * named recipient act on a transfer. */
export const IncomingTransfersView: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [transfers, setTransfers] = useState<CompanyAdminTransfer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setTransfers(await api.getIncomingCompanyTransfers());
    } catch (err) {
      setError(errorText(err, 'Could not load transfer requests.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async (transfer: CompanyAdminTransfer) => {
    setBusyId(transfer.id);
    setError(null);
    try {
      await api.acceptCompanyTransfer(transfer.id, passwords[transfer.id] ?? '');
      await refreshUser();
      navigate(adminPath(transfer.company_id), { replace: true });
    } catch (err) {
      setError(errorText(err, 'Could not accept the transfer.'));
      setBusyId(null);
    }
  };

  const decline = async (transfer: CompanyAdminTransfer) => {
    setBusyId(transfer.id);
    setError(null);
    try {
      await api.declineCompanyTransfer(transfer.id);
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not decline the transfer.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Company administration"
        title="Company Admin requests"
        description="Accepting makes you the designated Company Admin of that company and removes the role from the current admin."
      />
      <ErrorBanner message={error} />
      {!transfers ? (
        <Loading label="Loading transfer requests..." />
      ) : transfers.length === 0 ? (
        <Panel title="No pending requests">
          <p className="px-5 py-8 text-center text-sm text-[#A99DBD]">Nobody is transferring a Company Admin role to you.</p>
        </Panel>
      ) : (
        transfers.map((transfer) => (
          <Panel
            key={transfer.id}
            title={transfer.company_name}
            description={`${transfer.from_user_name} wants you to take over as Company Admin. Expires ${formatWhen(transfer.expires_at)}.`}
          >
            <form
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void accept(transfer);
              }}
            >
              <label className="flex-1 text-xs">
                <span className="mb-1 block font-semibold">Confirm with your password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={passwords[transfer.id] ?? ''}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, [transfer.id]: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <button type="submit" className={buttonClass} disabled={busyId === transfer.id}>
                Accept
              </button>
              <button
                type="button"
                className={dangerButtonClass}
                disabled={busyId === transfer.id}
                onClick={() => void decline(transfer)}
              >
                Decline
              </button>
            </form>
          </Panel>
        ))
      )}
    </div>
  );
};

export default IncomingTransfersView;
