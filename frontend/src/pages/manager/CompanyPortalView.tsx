import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Clipboard,
  LoaderCircle,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { api } from '../../services/api';
import { Company, CompanyMember } from '../../types';

export const CompanyPortalView: React.FC = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadCompany = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      setCompany(await api.getMyCompany());
    } catch (loadError) {
      console.error('Failed to load company portal:', loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load the company portal.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.getMyCompany()
      .then((data) => {
        if (isMounted) {
          setCompany(data);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        console.error('Failed to load company portal:', loadError);
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load the company portal.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const generateJoinCode = async () => {
    setIsGeneratingCode(true);
    setError(null);
    try {
      setCompany(await api.generateCompanyJoinCode());
      setCopied(false);
    } catch (generateError) {
      console.error('Failed to generate a company signup code:', generateError);
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Could not generate a new company code.'
      );
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const copyCode = async () => {
    if (!company) return;
    try {
      await navigator.clipboard.writeText(company.join_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Could not copy company signup code:', copyError);
      setError('Could not copy the code. Please select and copy it manually.');
    }
  };

  const managers = company?.members.filter(
    (member) => member.role === 'MANAGER'
  ) ?? [];
  const employees = company?.members.filter(
    (member) => member.role === 'EMPLOYEE'
  ) ?? [];

  return (
    <div className="space-y-7">
      <header>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
          Company workspace
        </span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Company Portal
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B7ADC9]">
          View the people in your company and manage the signup code used by
          new managers and employees.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-4 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-[#B7ADC9]">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading company details...
        </div>
      ) : company ? (
        <>
          <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.12] to-white/[0.025] p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-[#A99DBD]">
                      Company
                    </p>
                    <h2 className="text-xl font-bold text-white">
                      {company.name}
                    </h2>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3 text-xs text-[#D1C7E0]">
                  <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5">
                    {company.manager_count} manager{company.manager_count === 1 ? '' : 's'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5">
                    {company.employee_count} employee{company.employee_count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-white/10 bg-[#100B1D]/70 p-4 sm:min-w-[330px]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#A99DBD]">
                  Company signup code
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-2xl font-bold tracking-[0.18em] text-white">
                    {company.join_code}
                  </code>
                  <button
                    type="button"
                    onClick={copyCode}
                    aria-label={copied ? 'Code copied' : 'Copy company code'}
                    className="rounded-lg border border-white/10 p-2.5 text-[#D1C7E0] transition hover:bg-white/10 hover:text-white"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#A99DBD]">
                  Share this code with people who should join this company.
                  Generating a new code invalidates the current one.
                </p>
                <button
                  type="button"
                  onClick={() => void generateJoinCode()}
                  disabled={isGeneratingCode}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300/25 bg-violet-400/10 px-3.5 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGeneratingCode ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {isGeneratingCode ? 'Generating...' : 'Generate new code'}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <MemberDirectory
              title="Managers"
              description="Managers registered in this company"
              members={managers}
            />
            <MemberDirectory
              title="Employees"
              description="Employees registered in this company"
              members={employees}
            />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-[#B7ADC9]">
          Company details are unavailable.
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsLoading(true);
              void loadCompany();
            }}
            className="ml-2 font-semibold text-violet-200 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};

const MemberDirectory: React.FC<{
  title: string;
  description: string;
  members: CompanyMember[];
}> = ({ title, description, members }) => (
  <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
    <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
      <div>
        <h2 className="font-bold text-white">{title}</h2>
        <p className="mt-1 text-xs text-[#A99DBD]">{description}</p>
      </div>
      <span className="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 text-xs font-semibold text-[#D1C7E0]">
        <UsersRound className="h-3.5 w-3.5" />
        {members.length}
      </span>
    </header>

    {members.length > 0 ? (
      <ul className="divide-y divide-white/[0.06]">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-3 px-5 py-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-300/15 bg-violet-400/10 text-sm font-bold text-violet-100">
              {member.full_name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {member.full_name}
              </p>
              <p className="truncate text-xs text-[#A99DBD]">
                {member.email}
              </p>
              {member.designation && (
                <p className="mt-1 truncate text-[11px] text-[#D1C7E0]">
                  {member.designation}
                </p>
              )}
              <p className="mt-1 text-[10px] text-[#8F849F]">
                Joined {new Date(member.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-[#C4B6DB]">
              {member.approval_status}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="px-5 py-8 text-center text-sm text-[#A99DBD]">
        No {title.toLowerCase()} have joined yet.
      </p>
    )}
  </section>
);

export default CompanyPortalView;
