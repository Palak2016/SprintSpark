import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle, Pencil, Power, Search, ShieldCheck, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Company, CompanyMember } from '../../types';
import { adminPath } from '../../utils/workspace';
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
} from '../company/shared';

type RoleFilter = 'ALL' | 'MANAGER' | 'EMPLOYEE' | 'ADMIN';
type StatusFilter = 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'DEACTIVATED';
type ProjectRole = 'MANAGER' | 'EMPLOYEE' | 'ADMIN';

const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  ADMIN: 'Administration only',
};

const selectClass =
  'rounded-lg border border-white/10 bg-[#19112B] px-3 py-2 text-sm text-white focus:border-violet-400/50 focus:outline-none';

export const AdminMembersView: React.FC = () => {
  const companyId = useCompanyId();
  const { user, refreshUser } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [editing, setEditing] = useState<CompanyMember | null>(null);
  const [toggling, setToggling] = useState<CompanyMember | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setCompany(null);
    setError(null);
    api.getCompanyPortal(companyId)
      .then((data) => active && setCompany(data))
      .catch((err: unknown) => active && setError(errorText(err, 'Could not load members.')));
    return () => {
      active = false;
    };
  }, [companyId]);

  const members = useMemo(() => {
    if (!company) return [];
    const q = query.trim().toLowerCase();
    return company.members.filter(
      (m) =>
        (role === 'ALL' || m.role === role) &&
        (status === 'ALL' || m.approval_status === status) &&
        (!q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
    );
  }, [company, query, role, status]);

  const replaceMember = (updated: CompanyMember) =>
    setCompany((previous) =>
      previous
        ? { ...previous, members: previous.members.map((m) => (m.id === updated.id ? updated : m)) }
        : previous,
    );

  const onSaved = async (updated: CompanyMember, message: string) => {
    replaceMember(updated);
    setEditing(null);
    setToggling(null);
    setError(null);
    setNotice(message);
    // Changing your own project role changes which workspaces you can open.
    if (updated.id === user?.id) await refreshUser();
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title="Members"
        description="Everyone in this company. Edit job designations, grant or remove Manager access, and deactivate accounts that should no longer sign in. Pending sign-ups are handled under Approvals."
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={notice} />

      {!company && !error ? (
        <Loading label="Loading members..." />
      ) : company && companyId ? (
        <Panel
          title={`${company.members.length} member${company.members.length === 1 ? '' : 's'}`}
          description={members.length === company.members.length ? 'Showing everyone.' : `Showing ${members.length} after filters.`}
        >
          <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 lg:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search members</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76698D]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                className={`${inputClass} pl-9`}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              Access
              <select value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} className={selectClass}>
                <option value="ALL">All</option>
                <option value="MANAGER">Managers</option>
                <option value="EMPLOYEE">Employees</option>
                <option value="ADMIN">Administration only</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={selectClass}>
                <option value="ALL">All</option>
                <option value="APPROVED">Active</option>
                <option value="PENDING">Pending</option>
                <option value="REJECTED">Rejected</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </label>
          </div>

          {members.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm">No members match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#9487AA]">
                    <th scope="col" className="px-5 py-3 font-medium">Member</th>
                    <th scope="col" className="px-5 py-3 font-medium">Designation</th>
                    <th scope="col" className="px-5 py-3 font-medium">Access</th>
                    <th scope="col" className="px-5 py-3 font-medium">Status</th>
                    <th scope="col" className="px-5 py-3 font-medium">Joined</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {members.map((m) => {
                    const isAdmin = m.id === company.admin_user_id;
                    const isSelf = m.id === user?.id;
                    const canEdit = m.approval_status === 'APPROVED' || m.approval_status === 'PENDING';
                    return (
                      <tr key={m.id} className={m.approval_status === 'DEACTIVATED' ? 'opacity-70' : undefined}>
                        <td className="px-5 py-3">
                          <span className="block font-medium text-white">
                            {m.full_name}
                            {isSelf && <span className="ml-1.5 text-xs font-normal text-[#9487AA]">(you)</span>}
                          </span>
                          <span className="block text-xs text-[#9487AA]">{m.email}</span>
                        </td>
                        <td className="px-5 py-3 text-[#D1C7E0]">{m.designation || '—'}</td>
                        <td className="px-5 py-3">
                          <span className="text-white">{ROLE_LABELS[m.role] ?? m.role}</span>
                          {isAdmin && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                              <ShieldCheck className="h-3 w-3" /> Company Admin
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {m.approval_status === 'PENDING' ? (
                            <Link to={adminPath(companyId, 'approvals')} className="hover:opacity-80" title="Review in Approvals">
                              <StatusPill status={m.approval_status} />
                            </Link>
                          ) : (
                            <StatusPill status={m.approval_status === 'APPROVED' ? 'ACTIVE' : m.approval_status} />
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#B7ADC9]">{formatWhen(m.created_at)}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <button type="button" onClick={() => { setNotice(null); setEditing(m); }} className={buttonClass} aria-label={`Edit ${m.full_name}`}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                            )}
                            {m.approval_status === 'APPROVED' && !isSelf && !isAdmin && (
                              <button type="button" onClick={() => { setNotice(null); setToggling(m); }} className={dangerButtonClass} aria-label={`Deactivate ${m.full_name}`}>
                                <Power className="h-3.5 w-3.5" /> Deactivate
                              </button>
                            )}
                            {m.approval_status === 'DEACTIVATED' && (
                              <button type="button" onClick={() => { setNotice(null); setToggling(m); }} className={buttonClass} aria-label={`Reactivate ${m.full_name}`}>
                                <Power className="h-3.5 w-3.5" /> Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-white/[0.07] px-5 py-3 text-xs">
            The Company Admin cannot be deactivated. To hand over administration, use Ownership.
          </p>
        </Panel>
      ) : null}

      {editing && companyId && (
        <EditMemberDialog
          companyId={companyId}
          member={editing}
          isSelf={editing.id === user?.id}
          isCompanyAdmin={editing.id === company?.admin_user_id}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
      {toggling && companyId && (
        <ToggleActiveDialog
          companyId={companyId}
          member={toggling}
          onClose={() => setToggling(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
};

const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl border border-violet-300/20 bg-[#19112B] p-6 text-white shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#B7ADC9] hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
};

const EditMemberDialog: React.FC<{
  companyId: number;
  member: CompanyMember;
  isSelf: boolean;
  isCompanyAdmin: boolean;
  onClose: () => void;
  onSaved: (member: CompanyMember, message: string) => Promise<void>;
}> = ({ companyId, member, isSelf, isCompanyAdmin, onClose, onSaved }) => {
  const [designation, setDesignation] = useState(member.designation ?? '');
  const [projectRole, setProjectRole] = useState<ProjectRole>(member.role as ProjectRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let updated = member;
      const changes: string[] = [];
      if (designation.trim() !== (member.designation ?? '')) {
        updated = await api.updateMemberDesignation(companyId, member.id, designation.trim());
        changes.push('designation');
      }
      if (projectRole !== member.role) {
        updated = await api.updateMemberRole(companyId, member.id, projectRole);
        changes.push('access');
      }
      await onSaved(updated, changes.length
        ? `Updated ${changes.join(' and ')} for ${member.full_name}.`
        : 'Nothing changed.');
    } catch (err) {
      setError(errorText(err, 'Could not save the changes.'));
      setSaving(false);
    }
  };

  return (
    <Dialog title={`Edit ${member.full_name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <div>
          <label htmlFor="member-designation" className="mb-1.5 block text-xs font-semibold">
            Designation (job title)
          </label>
          <input
            id="member-designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            maxLength={255}
            placeholder="Software Engineer, HR Head, ..."
            className={inputClass}
          />
          <p className="mt-1.5 text-[11px]">A label only. It does not change what this person can do.</p>
        </div>

        <div>
          <label htmlFor="member-role" className="mb-1.5 block text-xs font-semibold">
            Project access
          </label>
          <select
            id="member-role"
            value={projectRole}
            onChange={(e) => setProjectRole(e.target.value as ProjectRole)}
            className={`${selectClass} w-full`}
          >
            <option value="MANAGER">Manager: creates and manages projects</option>
            <option value="EMPLOYEE">Employee: works on assigned tasks</option>
            {isSelf && isCompanyAdmin && (
              <option value="ADMIN">Administration only: no project workspace</option>
            )}
          </select>
          <p className="mt-1.5 text-[11px]">
            {isSelf && isCompanyAdmin
              ? 'You stay Company Admin whatever you choose; this only decides your project workspace.'
              : 'Company Admin rights are separate and can only move through Ownership.'}
          </p>
        </div>

        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass} disabled={saving}>Cancel</button>
          <button type="submit" className={buttonClass} disabled={saving}>
            {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

const ToggleActiveDialog: React.FC<{
  companyId: number;
  member: CompanyMember;
  onClose: () => void;
  onSaved: (member: CompanyMember, message: string) => Promise<void>;
}> = ({ companyId, member, onClose, onSaved }) => {
  const deactivating = member.approval_status !== 'DEACTIVATED';
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setMemberActive(companyId, member.id, !deactivating, notes.trim() || undefined);
      await onSaved(updated, deactivating
        ? `${member.full_name} has been deactivated and signed out everywhere.`
        : `${member.full_name} can sign in again.`);
    } catch (err) {
      setError(errorText(err, 'Could not change the account status.'));
      setBusy(false);
    }
  };

  return (
    <Dialog title={deactivating ? `Deactivate ${member.full_name}?` : `Reactivate ${member.full_name}?`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p>
          {deactivating
            ? 'They will be signed out of every session right away and cannot use WorkPilot until reactivated. Their projects, tasks, logs and history are kept.'
            : 'They will be able to sign in again with their existing password and role.'}
        </p>
        <div>
          <label htmlFor="status-notes" className="mb-1.5 block text-xs font-semibold">
            Reason <span className="font-normal">(optional, kept in the activity log)</span>
          </label>
          <input id="status-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className={inputClass} />
        </div>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass} disabled={busy}>Cancel</button>
          <button type="button" onClick={() => void confirm()} className={deactivating ? dangerButtonClass : buttonClass} disabled={busy}>
            {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            {deactivating ? 'Deactivate account' : 'Reactivate account'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default AdminMembersView;
