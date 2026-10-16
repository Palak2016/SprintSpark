
import React, { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { RiskBadge } from '../../components/common/RiskBadge';
import { Modal } from '../../components/common/Modal';
import type { Project, UserSimple } from '../../types';
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  Users,
  Check,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  X,
  UserRound,
  Pencil,
  Trash2,
  Save,
  ShieldAlert,
} from 'lucide-react';

const getCurrentUserId = (): number | null => {
  if (typeof window === 'undefined') return null;

  const possibleUserKeys = [
    'workpilot_user',
    'workpilot_current_user',
    'current_user',
    'currentUser',
    'auth_user',
    'user',
  ];

  for (const key of possibleUserKeys) {
    try {
      const storedValue = localStorage.getItem(key);
      if (!storedValue) continue;

      const parsed = JSON.parse(storedValue);
      const id =
        parsed?.id ??
        parsed?.user_id ??
        parsed?.userId ??
        parsed?.user?.id ??
        parsed?.user?.user_id;

      if (id !== undefined && id !== null && Number.isFinite(Number(id))) {
        return Number(id);
      }
    } catch {
      // This key may not contain JSON. Try the next supported key.
    }
  }

  // Fallback: try reading the user ID from the JWT payload.
  try {
    const token = localStorage.getItem('workpilot_token');

    if (token) {
      const parts = token.split('.');

      if (parts.length === 3) {
        const base64 = parts[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        const paddedBase64 = base64.padEnd(
          base64.length + ((4 - (base64.length % 4)) % 4),
          '='
        );

        const payload = JSON.parse(atob(paddedBase64));

        const id =
          payload?.user_id ??
          payload?.userId ??
          payload?.id ??
          payload?.sub;

        if (id !== undefined && id !== null && Number.isFinite(Number(id))) {
          return Number(id);
        }
      }
    }
  } catch {
    // If the token cannot be decoded, return null.
  }

  return null;
};

export const ProjectsView: React.FC = () => {
  const {
    projects,
    activeProject,
    activeProjects,
    setActiveProject,
    refreshProjects,
  } = useProject();

  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [teamUsers, setTeamUsers] = useState<UserSimple[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(
    null
  );

  // Resolve the logged-in user's ID.
  const [currentUserId, setCurrentUserId] = useState<number | null>(
    getCurrentUserId
  );

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
  }, []);

  // Creation still allows an employee to be assigned initially.
  const employees = teamUsers.filter(
    (user) => user.role?.toUpperCase() === 'EMPLOYEE'
  );

  // For editing, show all employees and managers except the logged-in user.
  const assignableUsers = teamUsers.filter((user) => {
    const role = user.role?.toUpperCase();
    const eligibleRole = role === 'EMPLOYEE' || role === 'MANAGER';
    const isCurrentUser =
      currentUserId !== null && Number(user.id) === currentUserId;

    return eligibleRole && !isCurrentUser;
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [targetEndDate, setTargetEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<Project['status']>('PLANNING');
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetEndDate, setEditTargetEndDate] = useState('');
  const [editTeamMemberIds, setEditTeamMemberIds] = useState<number[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(
    null
  );
  const [activatingProjectId, setActivatingProjectId] = useState<number | null>(
    null
  );
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const loadTeamUsers = async () => {
    setIsLoadingEmployees(true);
    setEmployeeLoadError(null);

    try {
      const users = await api.getAllUsers();

      setTeamUsers(
        users.filter((user) => {
          const role = user.role?.toUpperCase();
          return role === 'EMPLOYEE' || role === 'MANAGER';
        })
      );
    } catch (error) {
      setEmployeeLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load employees and managers. Please try again.'
      );
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoadingEmployees(true);
      setEmployeeLoadError(null);

      try {
        const users = await api.getAllUsers();

        if (cancelled) return;

        setTeamUsers(
          users.filter((user) => {
            const role = user.role?.toUpperCase();
            return role === 'EMPLOYEE' || role === 'MANAGER';
          })
        );
      } catch (error) {
        if (cancelled) return;

        setEmployeeLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load employees and managers. Please try again.'
        );
      } finally {
        if (!cancelled) setIsLoadingEmployees(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProjects = projects.filter((project) => {
    const query = search.trim().toLowerCase();

    return (
      project.name.toLowerCase().includes(query) ||
      (project.description ?? '').toLowerCase().includes(query)
    );
  });

  const resetProjectForm = () => {
    setName('');
    setDescription('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setTargetEndDate(
      new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    );
    setSelectedEmployeeId('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await refreshProjects();
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to refresh projects.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateProject = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter a project name.');
      return;
    }

    if (!selectedEmployeeId) {
      setErrorMsg('Please select an employee for this project.');
      return;
    }

    if (targetEndDate < startDate) {
      setErrorMsg('The target end date cannot be earlier than the start date.');
      return;
    }

    setIsSubmitting(true);

    try {
      const createdProject = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        start_date: startDate,
        target_end_date: targetEndDate,
      });

      try {
        await api.addProjectMember(
          createdProject.id,
          Number(selectedEmployeeId),
          'Project Member'
        );
      } catch (assignmentError) {
        await refreshProjects().catch(console.error);
        setActiveProject(createdProject);

        setErrorMsg(
          `Project "${createdProject.name}" was created, but the employee could not be assigned. ${
            assignmentError instanceof Error
              ? assignmentError.message
              : 'Please assign the employee separately.'
          }`
        );
        return;
      }

      setIsCreateModalOpen(false);
      resetProjectForm();

      await refreshProjects();
      setActiveProject(createdProject);

      setSuccessMsg(
        `Project "${createdProject.name}" created and assigned successfully.`
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Failed to create the project.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCreateModal = () => {
    if (isSubmitting) return;
    setIsCreateModalOpen(false);
    setErrorMsg(null);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description ?? '');
    setEditStatus(project.status);
    setEditStartDate(project.start_date?.slice(0, 10) ?? '');
    setEditTargetEndDate(project.target_end_date?.slice(0, 10) ?? '');

    // Keep existing membership in state, including the hidden current user.
    // This preserves membership when the edit form is saved.
    setEditTeamMemberIds(
      (project.members ?? []).map((member) => member.user_id)
    );

    setEditError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (teamUsers.length === 0 && !isLoadingEmployees) {
      void loadTeamUsers();
    }
  };

  const closeEditModal = () => {
    if (isSavingEdit) return;
    setEditingProject(null);
    setEditError(null);
  };

  const handleUpdateProject = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!editingProject) return;

    setEditError(null);

    if (!editName.trim()) {
      setEditError('Project name is required.');
      return;
    }

    if (!editStartDate || !editTargetEndDate) {
      setEditError('Please select both project dates.');
      return;
    }

    if (editTargetEndDate < editStartDate) {
      setEditError('The target end date cannot be earlier than the start date.');
      return;
    }

    setIsSavingEdit(true);

    try {
      await api.updateProject(editingProject.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        status: editStatus,
        start_date: editStartDate,
        target_end_date: editTargetEndDate,
      });
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : 'Unable to update the project details.'
      );
      setIsSavingEdit(false);
      return;
    }

    const existingIds = new Set(
      (editingProject.members ?? []).map((member) => member.user_id)
    );

    const selectedIds = new Set(editTeamMemberIds);

    // Preserve the logged-in user's existing membership if present.
    // Their checkbox is hidden, so they cannot be removed accidentally.
    if (currentUserId !== null && existingIds.has(currentUserId)) {
      selectedIds.add(currentUserId);
    }

    const membersToAdd = [...selectedIds].filter(
      (id) => !existingIds.has(id)
    );

    const membersToRemove = [...existingIds].filter((id) => {
      if (currentUserId !== null && id === currentUserId) {
        return false;
      }

      return !selectedIds.has(id);
    });

    const membershipResults = await Promise.allSettled([
      ...membersToAdd.map((id) => {
        const user = assignableUsers.find(
          (candidate) => Number(candidate.id) === Number(id)
        );
        const accountRole = user?.role?.toUpperCase();

        const membershipRole =
          accountRole === 'MANAGER' ? 'Project Manager' : 'Project Member';

        return api.addProjectMember(
          editingProject.id,
          id,
          membershipRole
        );
      }),
      ...membersToRemove.map((id) =>
        api.removeProjectMember(editingProject.id, id)
      ),
    ]);

    const failedChanges = membershipResults.filter(
      (result) => result.status === 'rejected'
    );

    try {
      await refreshProjects();
    } catch (error) {
      console.error('Project refresh failed:', error);
    }

    if (failedChanges.length > 0) {
      setEditError(
        `Project details were saved, but ${failedChanges.length} team change(s) failed. Refresh the project and check its team before retrying.`
      );
      setIsSavingEdit(false);
      return;
    }

    const projectName = editName.trim();

    setEditingProject(null);
    setIsSavingEdit(false);
    setSuccessMsg(`Project "${projectName}" updated successfully.`);
  };

  const openDeleteConfirmation = (project: Project) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setProjectToDelete(project);
  };

  const closeDeleteConfirmation = () => {
    if (deletingProjectId !== null) return;
    setProjectToDelete(null);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete || deletingProjectId !== null) return;

    const project = projectToDelete;

    setDeletingProjectId(project.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.deleteProject(project.id);

      if (activeProject?.id === project.id) {
        setActiveProject(null);
      }

      setProjectToDelete(null);
      await refreshProjects();

      setSuccessMsg(`Project "${project.name}" deleted successfully.`);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to delete the project. Please try again.'
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleMarkProjectActive = async (project: Project) => {
    if (project.status === 'ACTIVE') return;

    setActivatingProjectId(project.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.updateProject(project.id, { status: 'ACTIVE' });
      await refreshProjects();

      setSuccessMsg(
        `"${project.name}" is now active. Other active projects remain active.`
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to activate this project.'
      );
    } finally {
      setActivatingProjectId(null);
    }
  };

  const handleSelectWorkspace = (project: Project) => {
    setActiveProject(project);
    setSuccessMsg(`"${project.name}" is now your selected workspace.`);
    setErrorMsg(null);
  };

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-[#130D21] px-3 py-3 text-sm text-white outline-none placeholder:text-[#807493] focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20';

  const labelClass =
    'mb-2 block text-xs font-semibold uppercase tracking-wider text-[#D8CDEF]';

  return (
    <div className="space-y-6 text-[#FAF8FF]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#B7ADC9]">
            <FolderKanban className="h-4 w-4 text-[#A78BFA]" />
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#E5D9FF]">Projects</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Projects Directory
          </h1>
          <p className="mt-1 text-sm text-[#B7ADC9]">
            Manage projects, timelines, team allocation, and project status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#19112B] px-3 py-2.5 text-sm font-medium text-[#D8CDEF] transition hover:bg-[#211638] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorMsg(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button
            type="button"
            aria-label="Dismiss success message"
            onClick={() => setSuccessMsg(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Total Projects</p>
            <FolderKanban className="h-5 w-5 text-violet-300" />
          </div>
          <p className="mt-3 text-2xl font-bold">{projects.length}</p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Available project workspaces
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Active Projects</p>
            <Check className="h-5 w-5 text-emerald-300" />
          </div>
          <p className="mt-3 text-2xl font-bold">{activeProjects.length}</p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Projects currently marked active
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Selected Workspace</p>
            <ArrowRight className="h-5 w-5 text-violet-300" />
          </div>
          <p
            className="mt-3 truncate text-lg font-bold"
            title={activeProject?.name ?? 'None selected'}
          >
            {activeProject?.name ?? 'None selected'}
          </p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Current workspace selection
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#19112B] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B7ADC9]">Matching Projects</p>
            <Search className="h-5 w-5 text-sky-300" />
          </div>
          <p className="mt-3 text-2xl font-bold">{filteredProjects.length}</p>
          <p className="mt-1 text-xs text-[#A99DBD]">
            Projects matching your search
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A99DBD]" />
          <input
            type="search"
            aria-label="Search projects"
            placeholder="Search by project name or description..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} pl-10 pr-10`}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A99DBD] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-[#A99DBD]">
          Showing {filteredProjects.length} of {projects.length} projects
        </p>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const isSelectedWorkspace = activeProject?.id === project.id;
            const isDeleting = deletingProjectId === project.id;
            const isActivating = activatingProjectId === project.id;
            const progress = Math.min(
              100,
              Math.max(0, project.completion_percentage ?? 0)
            );

            return (
              <article
                key={project.id}
                className={`flex min-w-0 flex-col justify-between rounded-2xl border bg-[#19112B] p-5 transition hover:-translate-y-0.5 hover:bg-[#1D1431] ${
                  isSelectedWorkspace
                    ? 'border-violet-400/50 ring-1 ring-violet-400/20'
                    : 'border-white/[0.08] hover:border-white/15'
                }`}
              >
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="manager-project-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-charcoal-200 bg-forest-100 text-charcoal-900">
                        <FolderKanban className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2
                          className="truncate text-base font-bold text-white"
                          title={project.name}
                        >
                          {project.name}
                        </h2>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#A99DBD]">
                          {project.status.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <RiskBadge
                      level={project.latest_risk_level || 'LOW'}
                      size="sm"
                      showIcon={false}
                    />
                  </div>

                  <p className="mb-5 min-h-[40px] text-sm leading-5 text-[#B7ADC9]">
                    {project.description || 'No project description provided.'}
                  </p>

                  <div className="mb-5 space-y-3 rounded-xl border border-white/[0.06] bg-[#130D21] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex shrink-0 items-center gap-2 text-xs text-[#A99DBD]">
                        <Calendar className="h-4 w-4 text-violet-300" />
                        Timeline
                      </span>
                      <span className="text-right text-xs font-medium text-[#E5D9FF]">
                        {project.start_date?.slice(0, 10) || 'Not set'}
                        <span className="text-[#807493]"> to </span>
                        {project.target_end_date?.slice(0, 10) || 'Not set'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs text-[#A99DBD]">
                        <Users className="h-4 w-4 text-violet-300" />
                        Assigned Team
                      </span>
                      <span className="text-xs font-medium text-[#E5D9FF]">
                        {project.members?.length ?? 0}{' '}
                        {(project.members?.length ?? 0) === 1
                          ? 'member'
                          : 'members'}
                      </span>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-[#A99DBD]">
                        Project Progress
                      </span>
                      <span className="text-sm font-bold text-white">
                        {progress}%
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-white/[0.08]"
                      role="progressbar"
                      aria-label={`${project.name} completion`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <div
                        className="manager-progress-fill h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/[0.08] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[#A99DBD]">
                      {project.task_count ?? 0} total tasks
                    </span>
                    {isSelectedWorkspace ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200">
                        <Check className="h-3.5 w-3.5" />
                        Selected Workspace
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectWorkspace(project)}
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
                      >
                        Set Workspace
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleMarkProjectActive(project)}
                    disabled={project.status === 'ACTIVE' || isActivating}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActivating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isActivating
                      ? 'Activating...'
                      : project.status === 'ACTIVE'
                        ? 'Project Active'
                        : 'Mark Project Active'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(project)}
                      disabled={
                        isDeleting ||
                        isSavingEdit ||
                        deletingProjectId !== null
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteConfirmation(project)}
                      disabled={
                        isDeleting ||
                        isSavingEdit ||
                        deletingProjectId !== null
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#19112B]/70 px-6 py-16 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-violet-300" />
          <h2 className="mt-4 text-lg font-semibold text-white">
            {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#B7ADC9]">
            {projects.length === 0
              ? 'Create your first project to organize tasks, manage timelines, and coordinate your team.'
              : 'Try another search term or clear your search to see all projects.'}
          </p>
          {projects.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIsCreateModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Create First Project
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-5 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#E5D9FF] transition hover:bg-white/5"
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Create New Project"
        subtitle="Set up a workspace, assign an employee, and define its timeline."
        maxWidth="md"
      >
        <form onSubmit={handleCreateProject} className="space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="project-name" className={labelClass}>
              Project Name *
            </label>
            <input
              id="project-name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. NextGen API Gateway Migration"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="project-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="project-description"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Project goals, scope, and target outcomes..."
              className={`${inputClass} resize-y`}
            />
            <p className="mt-1 text-right text-xs text-[#807493]">
              {description.length}/2000
            </p>
          </div>

          <div>
            <label htmlFor="project-employee" className={labelClass}>
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4 text-violet-300" />
                Assign Initial Employee *
              </span>
            </label>
            <select
              id="project-employee"
              required
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              disabled={isLoadingEmployees || employees.length === 0}
              className={inputClass}
            >
              <option value="" className="bg-[#130D21]">
                {isLoadingEmployees
                  ? 'Loading employees...'
                  : employees.length === 0
                    ? 'No employees available'
                    : 'Select an employee'}
              </option>
              {employees.map((employee) => (
                <option
                  key={employee.id}
                  value={String(employee.id)}
                  className="bg-[#130D21]"
                >
                  {employee.full_name} — {employee.email}
                </option>
              ))}
            </select>

            {employeeLoadError && (
              <div className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">
                <p>{employeeLoadError}</p>
                <button
                  type="button"
                  disabled={isLoadingEmployees}
                  onClick={() => void loadTeamUsers()}
                  className="mt-2 font-semibold text-violet-200 underline underline-offset-2"
                >
                  Retry loading users
                </button>
              </div>
            )}
            <p className="mt-2 text-xs leading-5 text-[#A99DBD]">
              You can add more employees and managers from Edit Project after
              creating the project.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="project-start-date" className={labelClass}>
                Start Date *
              </label>
              <input
                id="project-start-date"
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="project-end-date" className={labelClass}>
                Target End Date *
              </label>
              <input
                id="project-end-date"
                type="date"
                required
                min={startDate}
                value={targetEndDate}
                onChange={(event) => setTargetEndDate(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={isSubmitting}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#D8CDEF] hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingEmployees ||
                employees.length === 0
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating & Assigning...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create & Assign Project
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT PROJECT MODAL */}
      <Modal
        isOpen={editingProject !== null}
        onClose={closeEditModal}
        title="Edit Project"
        subtitle="Update project details, team members, status, and timeline."
        maxWidth="md"
      >
        <form onSubmit={handleUpdateProject} className="space-y-5">
          {editError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label htmlFor="edit-project-name" className={labelClass}>
              Project Name *
            </label>
            <input
              id="edit-project-name"
              required
              maxLength={120}
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="edit-project-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="edit-project-description"
              rows={3}
              maxLength={2000}
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              className={`${inputClass} resize-y`}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className={`${labelClass} mb-0`}>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-300" />
                  Project Team
                </span>
              </label>
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
                {editTeamMemberIds.filter(
                  (id) => currentUserId === null || id !== currentUserId
                ).length}{' '}
                selected
              </span>
            </div>

            <p className="mb-3 text-xs leading-5 text-[#A99DBD]">
              Select employees and managers who should be assigned to this
              project. Your own account is excluded because you created the
              project. Uncheck a person to remove them when you save.
            </p>

            {isLoadingEmployees ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#130D21] p-4 text-sm text-[#B7ADC9]">
                <RefreshCw className="h-4 w-4 animate-spin text-violet-300" />
                Loading employees and managers...
              </div>
            ) : assignableUsers.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#130D21] p-4">
                <p className="text-sm text-[#B7ADC9]">
                  No other employees or managers are available to assign.
                </p>
                {employeeLoadError && (
                  <p className="mt-2 text-xs text-rose-300">
                    {employeeLoadError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void loadTeamUsers()}
                  disabled={isLoadingEmployees}
                  className="mt-3 text-xs font-semibold text-violet-200 underline underline-offset-2 disabled:opacity-50"
                >
                  Retry loading users
                </button>
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#130D21] p-2">
                {assignableUsers.map((person) => {
                  const checked = editTeamMemberIds.includes(person.id);
                  const isManager =
                    person.role?.toUpperCase() === 'MANAGER';

                  return (
                    <label
                      key={person.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isSavingEdit}
                        onChange={(event) => {
                          const shouldAdd = event.target.checked;

                          setEditTeamMemberIds((previous) =>
                            shouldAdd
                              ? [...new Set([...previous, person.id])]
                              : previous.filter((id) => id !== person.id)
                          );
                        }}
                        className="h-4 w-4 shrink-0 accent-violet-500"
                      />

                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isManager
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-violet-500/15 text-violet-200'
                        }`}
                      >
                        <UserRound className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {person.full_name}
                        </p>
                        <p className="truncate text-xs text-[#A99DBD]">
                          {person.email}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                          isManager
                            ? 'border-sky-400/20 bg-sky-500/10 text-sky-300'
                            : 'border-violet-400/20 bg-violet-500/10 text-violet-200'
                        }`}
                      >
                        {isManager ? 'Manager' : 'Employee'}
                      </span>

                      {checked && (
                        <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            {employeeLoadError && assignableUsers.length > 0 && (
              <p className="mt-2 text-xs text-rose-300">
                Some users could not be loaded: {employeeLoadError}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSavingEdit || assignableUsers.length === 0}
                onClick={() =>
                  setEditTeamMemberIds((previous) => [
                    ...new Set([
                      ...previous,
                      ...assignableUsers
                        .filter(
                          (person) =>
                            person.role?.toUpperCase() === 'EMPLOYEE'
                        )
                        .map((person) => person.id),
                    ]),
                  ])
                }
                className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                Select All Employees
              </button>

              <button
                type="button"
                disabled={isSavingEdit || assignableUsers.length === 0}
                onClick={() =>
                  setEditTeamMemberIds((previous) => [
                    ...new Set([
                      ...previous,
                      ...assignableUsers
                        .filter(
                          (person) => person.role?.toUpperCase() === 'MANAGER'
                        )
                        .map((person) => person.id),
                    ]),
                  ])
                }
                className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
              >
                Select All Managers
              </button>

              <button
                type="button"
                disabled={isSavingEdit || editTeamMemberIds.length === 0}
                onClick={() => {
                  // Clear visible selections while preserving the creator.
                  setEditTeamMemberIds(
                    currentUserId !== null &&
                      (editingProject?.members ?? []).some(
                        (member) => member.user_id === currentUserId
                      )
                      ? [currentUserId]
                      : []
                  );
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-[#B7ADC9] transition hover:bg-white/5 disabled:opacity-50"
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="edit-project-status" className={labelClass}>
              Project Status *
            </label>
            <select
              id="edit-project-status"
              value={editStatus}
              onChange={(event) =>
                setEditStatus(event.target.value as Project['status'])
              }
              className={inputClass}
            >
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <p className="mt-2 text-xs text-[#A99DBD]">
              Setting a project to Active does not deactivate other projects.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-project-start-date" className={labelClass}>
                Start Date *
              </label>
              <input
                id="edit-project-start-date"
                type="date"
                required
                value={editStartDate}
                onChange={(event) => setEditStartDate(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-project-end-date" className={labelClass}>
                Target End Date *
              </label>
              <input
                id="edit-project-end-date"
                type="date"
                required
                min={editStartDate || undefined}
                value={editTargetEndDate}
                onChange={(event) => setEditTargetEndDate(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={isSavingEdit}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#D8CDEF] hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingEdit || isLoadingEmployees}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingEdit ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={projectToDelete !== null}
        onClose={closeDeleteConfirmation}
        title="Delete Project"
        subtitle="Review this action before continuing."
        maxWidth="sm"
      >
        {projectToDelete && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/15">
                <ShieldAlert className="h-5 w-5 text-rose-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-6 text-white">
                  Are you sure you want to delete this project?
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#B7ADC9]">
                  You are about to delete{' '}
                  <span className="break-words font-semibold text-white">
                    &quot;{projectToDelete.name}&quot;
                  </span>
                  .
                </p>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/[0.08] p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <p className="text-xs leading-5 text-rose-200">
                    This action cannot be undone. Associated tasks and linked
                    records may be affected, depending on your backend
                    configuration.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deletingProjectId !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#D8CDEF] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteProject()}
                disabled={deletingProjectId !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingProjectId !== null ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Project
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectsView;
