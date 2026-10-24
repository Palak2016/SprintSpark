import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clipboard, Send, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { CompanyInvitation, CompanyInvitationCreated } from '../../types';
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

export const CompanyInvitationsView: React.FC = () => {
  const companyId = useCompanyId();
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'EMPLOYEE' | 'MANAGER'>('EMPLOYEE');
  const [isSending, setIsSending] = useState(false);
  const [created, setCreated] = useState<CompanyInvitationCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      setInvitations(await api.listCompanyInvitations(companyId));
    } catch (err) {
      setError(errorText(err, 'Could not load invitations.'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !email.trim()) return;
    setIsSending(true);
    setError(null);
    setCreated(null);
    setCopied(false);
    try {
      const result = await api.createCompanyInvitation(companyId, email.trim(), role);
      setCreated(result);
      setEmail('');
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not create the invitation.'));
    } finally {
      setIsSending(false);
    }
  };

  const revoke = async (invitation: CompanyInvitation) => {
    if (!companyId) return;
    setBusyId(invitation.id);
    setError(null);
    try {
      await api.revokeCompanyInvitation(companyId, invitation.id);
      if (created?.id === invitation.id) setCreated(null);
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not revoke the invitation.'));
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.invite_url);
      setCopied(true);
    } catch {
      setError('Could not copy the link. Please select and copy it manually.');
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title="Invitations"
        description="Invite someone to this company by email. Invited people are approved automatically when they sign up with the same email address, but never become Company Admins."
      />
      <ErrorBanner message={error} />

      <Panel title="Invite a person" description="Invitations expire after 7 days and can be revoked at any time.">
        <form onSubmit={invite} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs">
            <span className="mb-1 block font-semibold">Email address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={inputClass}
            />
          </label>
          <label className="text-xs sm:w-44">
            <span className="mb-1 block font-semibold">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'EMPLOYEE' | 'MANAGER')}
              className={inputClass}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
            </select>
          </label>
          <button type="submit" className={buttonClass} disabled={isSending}>
            <Send className="h-3.5 w-3.5" /> {isSending ? 'Sending...' : 'Send invitation'}
          </button>
        </form>
        {created && (
          <div className="space-y-3 border-t border-white/[0.08] p-5">
            <SuccessBanner
              message={
                created.email_sent
                  ? `Invitation emailed to ${created.email}.`
                  : `Invitation created for ${created.email}. Email could not be sent, so share this link with them directly.`
              }
            />
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] text-[#D1C7E0]">
                {created.invite_url}
              </code>
              <button type="button" onClick={copyLink} className={buttonClass} aria-label="Copy invitation link">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px]">This link is shown only once. Anyone with it can sign up only as {created.email}.</p>
          </div>
        )}
      </Panel>

      {isLoading ? (
        <Loading label="Loading invitations..." />
      ) : (
        <Panel title="All invitations" description="Most recent first.">
          {invitations.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#A99DBD]">No invitations yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{inv.email}</p>
                    <p className="text-[11px] text-[#8F849F]">
                      {inv.intended_role === 'MANAGER' ? 'Manager' : 'Employee'} · sent {formatWhen(inv.created_at)} ·
                      {inv.status === 'PENDING' ? ` expires ${formatWhen(inv.expires_at)}` : ''}
                      {inv.status === 'ACCEPTED' ? ` accepted ${formatWhen(inv.accepted_at)}` : ''}
                      {inv.status === 'REVOKED' ? ` revoked ${formatWhen(inv.revoked_at)}` : ''}
                    </p>
                  </div>
                  <StatusPill status={inv.status} />
                  {inv.status === 'PENDING' && (
                    <button
                      type="button"
                      className={dangerButtonClass}
                      disabled={busyId === inv.id}
                      onClick={() => void revoke(inv)}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
};

export default CompanyInvitationsView;
