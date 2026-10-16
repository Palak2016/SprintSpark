
import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { UserSimple } from '../../types';
import { formatIndianDate } from '../../utils/date';
import {
  FolderKanban,
  Users,
  Trash2,
  CheckCircle2,
  Cpu,
  Save,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  Settings,
  Crown,
  Mail,
  CircleCheck,
  AlertCircle,
  Sparkles,
  CalendarDays,
  Clock3,
  ChevronRight,
  LockKeyhole,
  Activity,
  X,
} from 'lucide-react';

const PROJECT_STATUSES = [
  'ACTIVE',
  'PLANNING',
  'ON_HOLD',
  'COMPLETED',
  'ARCHIVED',
] as const;

const statusStyles: Record<string, string> = {
  ACTIVE: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  PLANNING: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  ON_HOLD: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  COMPLETED: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  ARCHIVED: 'border-white/10 bg-white/5 text-[#B7ADC9]',
};

const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#100B1D]/80 px-4 py-3 text-sm text-[#FAF8FF] outline-none transition placeholder:text-[#756987] hover:border-violet-400/25 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50';

const labelClass =
  'mb-2 block text-xs font-semibold tracking-wide text-[#D7CDE8]';

const cardClass =
  'overflow-hidden rounded-2xl border border-[rgba(210,190,255,.13)] bg-[#19112B] shadow-[0_16px_50px_rgba(0,0,0,0.16)]';

export const SettingsView: React.FC = () => {
  const {
    activeProject,
    refreshActiveProject,
    refreshProjects,
  } = useProject();

  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [allUsers, setAllUsers] = useState<UserSimple[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>();
  const [memberRole, setMemberRole] = useState('Contributor');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAllUsers = useCallback(async () => {
    setIsLoadingUsers(true);

    try {
      const usersData = await api.getAllUsers();
      setAllUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setErrorMessage('Unable to load employees. Please try again.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    setMessage(null);
    setErrorMessage(null);
    setSelectedUserId(undefined);

    if (!activeProject) {
      setName('');
      setDescription('');
      setStatus('ACTIVE');
      setAllUsers([]);
      return;
    }

    setName(activeProject.name);
    setDescription(activeProject.description || '');
    setStatus(activeProject.status);

    void loadAllUsers();
  }, [activeProject, loadAllUsers]);

  const handleUpdateProject = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!activeProject || !name.trim()) return;

    setIsUpdating(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await api.updateProject(activeProject.id, {
        name: name.trim(),
        description: description.trim(),
        status: status as (typeof PROJECT_STATUSES)[number],
      });

      await refreshActiveProject();
      await refreshProjects();

      setMessage('Project settings updated successfully.');
    } catch (err: unknown) {
      console.error('Failed to update project settings:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to update project settings.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddMember = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!activeProject || selectedUserId === undefined) return;

    setIsAddingMember(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await api.addProjectMember(
        activeProject.id,
        selectedUserId,
        memberRole.trim() || 'Contributor'
      );

      await refreshActiveProject();

      setSelectedUserId(undefined);
      setMemberRole('Contributor');
      setMessage('Team member added successfully.');
    } catch (err: unknown) {
      console.error('Failed to add team member:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to add team member.'
      );
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeProject) return;

    if (Number(userId) === Number(activeProject.manager_id)) {
      setErrorMessage('The project manager cannot be removed.');
      return;
    }

    const member = activeProject.members?.find(
      (m) => Number(m.user_id) === Number(userId)
    );

    const confirmed = window.confirm(
      `Remove ${member?.user?.full_name || 'this member'} from the project?`
    );

    if (!confirmed) return;

    setMessage(null);
    setErrorMessage(null);
    setRemovingUserId(userId);

    try {
      await api.removeProjectMember(activeProject.id, userId);
      await refreshActiveProject();

      setMessage('Team member removed successfully.');
    } catch (err: unknown) {
      console.error('Failed to remove team member:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to remove team member.'
      );
    } finally {
      setRemovingUserId(null);
    }
  };

  const projectMembers = activeProject?.members ?? [];

  const availableUsers = allUsers.filter(
    (u) =>
      !projectMembers.some(
        (m) => Number(m.user_id) === Number(u.id)
      )
  );

  const getInitials = (fullName?: string) => {
    if (!fullName?.trim()) return 'U';

    return fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  const getStatusLabel = (value: string) =>
    value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );

  if (!activeProject) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#100B1D] px-4 py-8 text-[#FAF8FF] sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-600/10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl space-y-8">
          <PageHeading />

          <div className={`${cardClass} px-6 py-16 text-center sm:px-10`}>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 shadow-[0_0_35px_rgba(139,92,246,.12)]">
              <FolderKanban className="h-7 w-7 text-violet-300" />
            </div>

            <h2 className="text-lg font-semibold text-[#FAF8FF]">
              No project selected
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#B7ADC9]">
              Select a project from your workspace to manage its
              configuration and team members.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#100B1D] px-4 py-6 text-[#FAF8FF] sm:px-6 sm:py-8 lg:px-8">
      {/* Ambient background */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-600/[0.09] blur-[120px]" />
      <div className="pointer-events-none absolute -left-32 top-[45%] h-80 w-80 rounded-full bg-purple-500/[0.06] blur-[110px]" />

      <div className="relative mx-auto max-w-5xl space-y-7 pb-8">
        {/* Page header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Workspace Management
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#FAF8FF] sm:text-3xl">
              Project Settings
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#B7ADC9]">
              Configure your workspace, manage team access, and keep
              your project running smoothly.
            </p>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3.5 py-2.5 ${
              statusStyles[status] || statusStyles.ARCHIVED
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'ACTIVE'
                  ? 'bg-emerald-400'
                  : status === 'COMPLETED'
                    ? 'bg-sky-400'
                    : status === 'ON_HOLD'
                      ? 'bg-amber-400'
                      : 'bg-violet-400'
              }`}
            />
            <span className="text-xs font-semibold">
              {getStatusLabel(status)}
            </span>
          </div>
        </div>

        {/* Project summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={<FolderKanban className="h-4 w-4" />}
            label="Current project"
            value={activeProject.name}
            detail="Workspace configuration"
          />

          <SummaryCard
            icon={<Users className="h-4 w-4" />}
            label="Team members"
            value={String(projectMembers.length)}
            detail="People assigned to this project"
          />

          <SummaryCard
            icon={<Activity className="h-4 w-4" />}
            label="Project status"
            value={getStatusLabel(status)}
            detail="Current project lifecycle"
          />
        </div>

        {/* Success message */}
        {message && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 text-sm text-emerald-200"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>

            <button
              type="button"
              onClick={() => setMessage(null)}
              className="ml-auto rounded-md p-1 text-emerald-200/70 transition hover:bg-emerald-300/10 hover:text-emerald-100"
              aria-label="Dismiss success message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-4 text-sm text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>

            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="ml-auto rounded-md p-1 text-rose-200/70 transition hover:bg-rose-300/10 hover:text-rose-100"
              aria-label="Dismiss error message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Project configuration */}
        <section className={cardClass}>
          <SectionHeader
            icon={<FolderKanban className="h-5 w-5" />}
            title="Project Configuration"
            description="Update your project's basic information and lifecycle."
            tag="General"
          />

          <form
            onSubmit={handleUpdateProject}
            className="space-y-6 p-5 sm:p-6 lg:p-7"
          >
            <div>
              <label htmlFor="project-name" className={labelClass}>
                Project Name <span className="text-violet-300">*</span>
              </label>

              <input
                id="project-name"
                type="text"
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className={inputClass}
              />

              <p className="mt-2 text-[11px] text-[#8E82A5]">
                Choose a clear name your team can easily recognize.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="project-description"
                  className={`${labelClass} mb-0`}
                >
                  Project Description
                </label>

                <span className="text-[11px] tabular-nums text-[#8E82A5]">
                  {description.length}/2000
                </span>
              </div>

              <textarea
                id="project-description"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose, goals, and expected outcomes of this project..."
                className={`${inputClass} min-h-28 resize-y leading-6`}
              />
            </div>

            <div>
              <label htmlFor="project-status" className={labelClass}>
                Project Status
              </label>

              <select
                id="project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`${inputClass} sm:max-w-sm`}
              >
                {PROJECT_STATUSES.map((projectStatus) => (
                  <option
                    key={projectStatus}
                    value={projectStatus}
                    className="bg-[#19112B] text-[#FAF8FF]"
                  >
                    {getStatusLabel(projectStatus)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-4 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#8E82A5]">
                Changes apply to the selected project.
              </p>

              <button
                type="submit"
                disabled={isUpdating || !name.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_5px_24px_rgba(139,92,246,.2)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(139,92,246,.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isUpdating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {isUpdating ? 'Saving Changes...' : 'Save Changes'}

                {!isUpdating && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </section>

        {/* Team roster */}
        <section className={cardClass}>
          <SectionHeader
            icon={<Users className="h-5 w-5" />}
            title="Project Team"
            description="Manage the people working on this project and their access."
            tag={`${projectMembers.length} ${
              projectMembers.length === 1 ? 'member' : 'members'
            }`}
          />

          <div className="p-5 sm:p-6 lg:p-7">
            {projectMembers.length > 0 ? (
              <div className="space-y-3">
                {projectMembers.map((m) => {
                  const isMe = Number(m.user_id) === Number(user?.id);
                  const isManager =
                    Number(m.user_id) === Number(activeProject.manager_id);
                  const isRemoving = removingUserId === m.user_id;

                  return (
                    <div
                      key={m.id}
                      className="group flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-[#100B1D]/45 p-4 transition duration-200 hover:border-violet-400/25 hover:bg-violet-500/[0.035] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative shrink-0">
                          {m.user?.avatar_url ? (
                            <img
                              src={m.user.avatar_url}
                              alt={m.user?.full_name || 'Team member'}
                              className="h-12 w-12 rounded-xl border border-violet-300/15 object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-purple-500/10 text-sm font-bold text-violet-200">
                              {getInitials(m.user?.full_name)}
                            </div>
                          )}

                          {isManager && (
                            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#19112B] bg-amber-400">
                              <Crown className="h-2.5 w-2.5 text-[#2A1738]" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[#FAF8FF]">
                              {m.user?.full_name || 'Unknown User'}
                            </p>

                            {isMe && (
                              <span className="rounded-md border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                                You
                              </span>
                            )}

                            {isManager && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                <ShieldCheck className="h-3 w-3" />
                                Project Manager
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#A99BBF]">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <Mail className="h-3 w-3 shrink-0 text-[#8E82A5]" />
                              <span className="break-all">
                                {m.user?.email || 'No email provided'}
                              </span>
                            </span>

                            <span className="rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] font-medium text-[#D7CDE8]">
                              {m.role_in_project || 'Contributor'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isManager ? (
                        <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-[#A99BBF] sm:self-center">
                          <LockKeyhole className="h-3.5 w-3.5" />
                          Protected
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(m.user_id)}
                          disabled={isRemoving}
                          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-xs font-semibold text-rose-300 transition hover:border-rose-400/35 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50 sm:self-center"
                          title="Remove member from project"
                        >
                          {isRemoving ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}

                          {isRemoving ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-violet-300/20 bg-[#100B1D]/40 px-5 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
                  <Users className="h-5 w-5 text-violet-300" />
                </div>

                <p className="mt-4 text-sm font-semibold text-[#FAF8FF]">
                  Your team starts here
                </p>

                <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[#A99BBF]">
                  No members have been assigned yet. Add employees below to
                  start collaborating.
                </p>
              </div>
            )}

            {/* Add team member */}
            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#19112B] p-4 sm:p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/10">
                  <UserPlus className="h-4 w-4 text-violet-300" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#FAF8FF]">
                    Add Team Member
                  </h3>

                  <p className="mt-1 text-xs text-[#A99BBF]">
                    Invite an existing workspace employee to this project.
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleAddMember}
                className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2"
              >
                <div>
                  <label htmlFor="team-member" className={labelClass}>
                    Employee
                  </label>

                  <select
                    id="team-member"
                    required
                    value={selectedUserId ?? ''}
                    onChange={(e) =>
                      setSelectedUserId(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    disabled={isLoadingUsers || availableUsers.length === 0}
                    className={inputClass}
                  >
                    <option value="" className="bg-[#19112B]">
                      {isLoadingUsers
                        ? 'Loading employees...'
                        : availableUsers.length === 0
                          ? 'No available employees'
                          : 'Select an employee...'}
                    </option>

                    {availableUsers.map((u) => (
                      <option
                        key={u.id}
                        value={u.id}
                        className="bg-[#19112B]"
                      >
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>

                  {!isLoadingUsers && allUsers.length === 0 && (
                    <button
                      type="button"
                      onClick={() => void loadAllUsers()}
                      className="mt-2 text-xs font-medium text-violet-300 hover:text-violet-200"
                    >
                      Retry loading employees
                    </button>
                  )}
                </div>

                <div>
                  <label htmlFor="member-role" className={labelClass}>
                    Project Role
                  </label>

                  <input
                    id="member-role"
                    type="text"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    maxLength={50}
                    placeholder="Contributor"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2 sm:flex sm:justify-end">
                  <button
                    type="submit"
                    disabled={
                      selectedUserId === undefined ||
                      isAddingMember ||
                      isLoadingUsers ||
                      availableUsers.length === 0
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_5px_24px_rgba(139,92,246,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(139,92,246,.28)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
                  >
                    {isAddingMember ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}

                    {isAddingMember ? 'Adding Member...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Platform architecture */}
        <section className={cardClass}>
          <SectionHeader
            icon={<Cpu className="h-5 w-5" />}
            title="Platform Architecture"
            description="A quick overview of the systems powering WorkPilot."
            tag="System overview"
          />

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:p-7">
            <ArchitectureCard
              icon={<Activity className="h-4 w-4" />}
              label="Risk Analyzer"
              title="Deterministic Rule Base"
              description="Rule-based project risk assessment and risk scoring."
              accent="violet"
            />

            <ArchitectureCard
              icon={<Sparkles className="h-4 w-4" />}
              label="Workflow Orchestrator"
              title="LangGraph Multi-Node State Machine"
              description="Coordinates workflow, decision-making, and recovery steps."
              accent="purple"
            />

            <ArchitectureCard
              icon={<DatabaseIcon />}
              label="Persistence"
              title="PostgreSQL / SQLite"
              description="SQLAlchemy-based relational data persistence."
              accent="blue"
            />

            <ArchitectureCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Access Control"
              title="JWT & Role-Based Access"
              description="Authenticated sessions with server-side authorization."
              accent="emerald"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.07] bg-[#100B1D]/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-center gap-2 text-xs text-[#A99BBF]">
              <CircleCheck className="h-4 w-4 text-emerald-300" />
              Core platform components configured
            </div>

            <span className="inline-flex items-center gap-2 text-[11px] text-[#8E82A5]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              WorkPilot infrastructure
            </span>
          </div>
        </section>

        {/* Project metadata: shared Indian date formatter */}
        <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-[#19112B]/55 px-4 py-3 text-xs text-[#8E82A5] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>
              Created {formatIndianDate(activeProject.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5" />
            <span>
              Last updated {formatIndianDate(activeProject.updated_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PageHeading: React.FC = () => (
  <div>
    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300">
      <Settings className="h-3.5 w-3.5" />
      Workspace Management
    </div>

    <h1 className="text-2xl font-bold tracking-tight text-[#FAF8FF] sm:text-3xl">
      Project Settings
    </h1>

    <p className="mt-2 max-w-xl text-sm leading-6 text-[#B7ADC9]">
      Manage project configuration, team access, and platform settings.
    </p>
  </div>
);

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  description,
  tag,
}) => (
  <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
      {icon}
    </div>

    <div className="min-w-0 flex-1">
      <h2 className="text-sm font-semibold text-[#FAF8FF]">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-[#A99BBF]">{description}</p>
    </div>

    {tag && (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-medium text-[#C8BCDA]">
        {tag}
      </span>
    )}
  </div>
);

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  icon,
  label,
  value,
  detail,
}) => (
  <div className="rounded-2xl border border-[rgba(210,190,255,.13)] bg-[#19112B]/85 p-4 transition hover:border-violet-400/25">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-[#A99BBF]">{label}</span>

      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/[0.08] text-violet-300">
        {icon}
      </span>
    </div>

    <p className="mt-3 truncate text-lg font-bold text-[#FAF8FF]" title={value}>
      {value}
    </p>

    <p className="mt-1 text-[11px] text-[#8E82A5]">{detail}</p>
  </div>
);

interface ArchitectureCardProps {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  accent: 'violet' | 'purple' | 'blue' | 'emerald';
}

const accentStyles: Record<ArchitectureCardProps['accent'], string> = {
  violet: 'border-violet-400/15 bg-violet-400/[0.08] text-violet-300',
  purple: 'border-purple-400/15 bg-purple-400/[0.08] text-purple-300',
  blue: 'border-sky-400/15 bg-sky-400/[0.08] text-sky-300',
  emerald: 'border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300',
};

const ArchitectureCard: React.FC<ArchitectureCardProps> = ({
  icon,
  label,
  title,
  description,
  accent,
}) => (
  <div className="rounded-xl border border-white/[0.08] bg-[#100B1D]/45 p-4 transition duration-200 hover:border-violet-400/20 hover:bg-violet-500/[0.025]">
    <div className="flex items-center gap-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg border ${accentStyles[accent]}`}
      >
        {icon}
      </span>

      <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#A99BBF]">
        {label}
      </span>
    </div>

    <p className="mt-4 text-sm font-semibold leading-5 text-[#FAF8FF]">
      {title}
    </p>

    <p className="mt-2 text-xs leading-5 text-[#A99BBF]">{description}</p>
  </div>
);

const DatabaseIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
    <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
  </svg>
);
