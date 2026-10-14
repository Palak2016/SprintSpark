import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { UserSimple } from '../../types';
import {
  Settings, FolderKanban, Users, ShieldCheck, RefreshCw,
  Plus, Trash2, CheckCircle2, Cpu
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { activeProject, refreshActiveProject, refreshProjects } = useProject();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [allUsers, setAllUsers] = useState<UserSimple[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>();
  const [memberRole, setMemberRole] = useState('Contributor');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject) {
      setName(activeProject.name);
      setDescription(activeProject.description || '');
      setStatus(activeProject.status);
      loadAllUsers();
    }
  }, [activeProject]);

  const loadAllUsers = async () => {
    try {
      const usersData = await api.getAllUsers();
      setAllUsers(usersData);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setIsUpdating(true);
    setMessage(null);
    try {
      await api.updateProject(activeProject.id, {
        name,
        description,
        status: status as any
      });
      await refreshActiveProject();
      setMessage("Project settings updated successfully.");
    } catch (err: any) {
      alert("Failed to update project: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !selectedUserId) return;
    setIsAddingMember(true);
    try {
      await api.addProjectMember(activeProject.id, selectedUserId, memberRole);
      await refreshActiveProject();
      setSelectedUserId(undefined);
    } catch (err: any) {
      alert("Failed to add member: " + err.message);
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeProject) return;
    if (!window.confirm("Remove this member from the project?")) return;
    try {
      await api.removeProjectMember(activeProject.id, userId);
      await refreshActiveProject();
    } catch (err: any) {
      alert("Failed to remove member: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Project & Platform Settings</h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Configure project parameters, team memberships, and responsible AI governance
        </p>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* General Project Config */}
      <div className="p-6 bg-white rounded-2xl border border-charcoal-100 shadow-card">
        <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-forest-700" />
          <span>Project Configuration</span>
        </h3>

        <form onSubmit={handleUpdateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Project Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full sm:w-60 px-3 py-2 text-xs rounded-lg border border-charcoal-200 bg-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="PLANNING">Planning</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 text-xs font-bold bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isUpdating ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Team Roster Management */}
      <div className="p-6 bg-white rounded-2xl border border-charcoal-100 shadow-card">
        <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-forest-700" />
          <span>Project Team Roster</span>
        </h3>

        {/* Members List */}
        <div className="divide-y divide-charcoal-50 mb-6">
          {activeProject?.members?.map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <img
                  src={m.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.user?.full_name}`}
                  alt={m.user?.full_name}
                  className="w-7 h-7 rounded-full border border-charcoal-200"
                />
                <div>
                  <p className="font-semibold text-charcoal-900">{m.user?.full_name}</p>
                  <p className="text-[11px] text-charcoal-400">{m.role_in_project} • {m.user?.email}</p>
                </div>
              </div>
              {m.user_id !== activeProject.manager_id && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.user_id)}
                  className="p-1 text-charcoal-400 hover:text-rose-600 transition-colors"
                  title="Remove from project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="pt-4 border-t border-charcoal-100 flex flex-col sm:flex-row items-end gap-3">
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Add Team Member
            </label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 bg-white"
            >
              <option value="">Select an employee...</option>
              {allUsers.filter(u => !activeProject?.members.some(m => m.user_id === u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Role
            </label>
            <input
              type="text"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedUserId || isAddingMember}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm disabled:opacity-50"
          >
            Add Member
          </button>
        </form>
      </div>

      {/* System Architecture Metadata */}
      <div className="p-6 bg-charcoal-900 text-white rounded-2xl shadow-card space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Platform Architecture & Engine Status</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-charcoal-300">
          <div className="p-3 rounded-lg bg-charcoal-800">
            <span className="text-charcoal-400 block text-[10px] uppercase font-bold">Risk Analyzer</span>
            <span className="text-white font-medium">Deterministic Rule Base (6 Rules Active)</span>
          </div>
          <div className="p-3 rounded-lg bg-charcoal-800">
            <span className="text-charcoal-400 block text-[10px] uppercase font-bold">Workflow Orchestrator</span>
            <span className="text-white font-medium">LangGraph Multi-Node State Machine</span>
          </div>
          <div className="p-3 rounded-lg bg-charcoal-800">
            <span className="text-charcoal-400 block text-[10px] uppercase font-bold">Persistence</span>
            <span className="text-white font-medium">PostgreSQL / SQLite via SQLAlchemy 2.0</span>
          </div>
          <div className="p-3 rounded-lg bg-charcoal-800">
            <span className="text-charcoal-400 block text-[10px] uppercase font-bold">Role-Based Access Control</span>
            <span className="text-white font-medium">JWT Secure Sessions (Server Enforced)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
