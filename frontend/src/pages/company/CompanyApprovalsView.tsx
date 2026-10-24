import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { api } from '../../services/api';
import { CompanyMember } from '../../types';
import { AdminConsoleContext } from '../../components/admin/AdminLayout';
import {
  ErrorBanner,
  Loading,
  PageHeader,
  Panel,
  StatusPill,
  buttonClass,
  dangerButtonClass,
  errorText,
  formatWhen,
  useCompanyId,
} from './shared';

export const CompanyApprovalsView: React.FC = () => {
  const companyId = useCompanyId();
  const { refreshCompanies } = useOutletContext<AdminConsoleContext>();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const portal = await api.getCompanyPortal(companyId);
      setMembers(portal.members.filter((m) => m.approval_status !== 'APPROVED'));
    } catch (err) {
      setError(errorText(err, 'Could not load membership requests.'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (member: CompanyMember, decision: 'approve' | 'reject') => {
    if (!companyId) return;
    setBusyId(member.id);
    setError(null);
    try {
      await api.decideCompanyMember(companyId, member.id, decision);
      await Promise.all([load(), refreshCompanies()]);
    } catch (err) {
      setError(errorText(err, 'Could not update this member.'));
    } finally {
      setBusyId(null);
    }
  };

  const pending = members.filter((m) => m.approval_status === 'PENDING');
  const rejected = members.filter((m) => m.approval_status === 'REJECTED');

  return (
    <div className="space-y-7">
      <PageHeader
        title="Approvals"
        description="People who joined with your company's signup code cannot use WorkPilot until you approve them. Approving never grants Company Admin rights."
      />
      <ErrorBanner message={error} />
      {isLoading ? (
        <Loading label="Loading membership requests..." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <MemberList
            title="Awaiting approval"
            description="Approve to give access with the role they signed up for."
            members={pending}
            empty="No one is waiting for approval."
            busyId={busyId}
            onApprove={(m) => void decide(m, 'approve')}
            onReject={(m) => void decide(m, 'reject')}
          />
          <MemberList
            title="Rejected"
            description="Rejected accounts cannot sign in to company data. You can still approve them later."
            members={rejected}
            empty="No rejected requests."
            busyId={busyId}
            onApprove={(m) => void decide(m, 'approve')}
          />
        </div>
      )}
    </div>
  );
};

const MemberList: React.FC<{
  title: string;
  description: string;
  members: CompanyMember[];
  empty: string;
  busyId: number | null;
  onApprove: (member: CompanyMember) => void;
  onReject?: (member: CompanyMember) => void;
}> = ({ title, description, members, empty, busyId, onApprove, onReject }) => (
  <Panel title={title} description={description}>
    {members.length === 0 ? (
      <p className="px-5 py-8 text-center text-sm text-[#A99DBD]">{empty}</p>
    ) : (
      <ul className="divide-y divide-white/[0.06]">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{member.full_name}</p>
              <p className="truncate text-xs text-[#A99DBD]">{member.email}</p>
              <p className="mt-1 text-[11px] text-[#8F849F]">
                {member.role === 'MANAGER' ? 'Manager' : 'Employee'}
                {member.designation ? ` · ${member.designation}` : ''} · requested {formatWhen(member.created_at)}
              </p>
            </div>
            <StatusPill status={member.approval_status} />
            <div className="flex gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={busyId === member.id}
                onClick={() => onApprove(member)}
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </button>
              {onReject && (
                <button
                  type="button"
                  className={dangerButtonClass}
                  disabled={busyId === member.id}
                  onClick={() => onReject(member)}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

export default CompanyApprovalsView;
