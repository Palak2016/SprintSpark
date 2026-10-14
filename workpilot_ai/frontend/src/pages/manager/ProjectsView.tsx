import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { Project } from '../../types';
import { RiskBadge } from '../../components/common/RiskBadge';
import { Modal } from '../../components/common/Modal';
import {
  FolderKanban, Plus, Search, Calendar, Users, CheckCircle2,
  Clock, ArrowRight, ShieldCheck, Check
} from 'lucide-react';

export const ProjectsView: React.FC = () => {
  const { projects, activeProject, setActiveProject, refreshProjects } = useProject();

  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetEndDate, setTargetEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await api.createProject({
        name,
        description,
        start_date: startDate,
        target_end_date: targetEndDate
      });
      await refreshProjects();
      setActiveProject(created);
      setIsCreateModalOpen(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Projects Directory</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Manage organization workspaces, milestones, and resource allocation
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-charcoal-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-charcoal-200 bg-white focus:outline-none focus:ring-1 focus:ring-forest-600"
        />
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((proj) => {
          const isActive = activeProject?.id === proj.id;

          return (
            <div
              key={proj.id}
              className={`p-5 rounded-2xl bg-white border transition-all flex flex-col justify-between shadow-card hover:shadow-md ${
                isActive ? 'border-forest-600 ring-2 ring-forest-600/10' : 'border-charcoal-100'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-forest-100 text-forest-800' : 'bg-charcoal-100 text-charcoal-700'}`}>
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-charcoal-900 line-clamp-1">{proj.name}</h3>
                      <span className="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wider">
                        {proj.status}
                      </span>
                    </div>
                  </div>
                  <RiskBadge level={proj.latest_risk_level || 'LOW'} size="sm" showIcon={false} />
                </div>

                {/* Description */}
                <p className="text-xs text-charcoal-600 line-clamp-2 mb-4 leading-relaxed">
                  {proj.description || 'No project description provided.'}
                </p>

                {/* Dates & Members */}
                <div className="space-y-1.5 text-xs text-charcoal-500 mb-4 bg-offwhite/80 p-3 rounded-xl border border-charcoal-100">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-charcoal-400" />
                      <span>Timeline:</span>
                    </span>
                    <span className="font-medium text-charcoal-800">{proj.start_date} to {proj.target_end_date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-charcoal-400" />
                      <span>Assigned Team:</span>
                    </span>
                    <span className="font-medium text-charcoal-800">{proj.members?.length || 1} members</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-charcoal-500">Progress</span>
                    <span className="font-bold text-charcoal-800">{proj.completion_percentage || 0}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-charcoal-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-forest-700 rounded-full transition-all"
                      style={{ width: `${proj.completion_percentage || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-3 border-t border-charcoal-50 flex items-center justify-between">
                <span className="text-[11px] text-charcoal-400">
                  {proj.task_count || 0} total tasks
                </span>
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-forest-700">
                    <Check className="w-3.5 h-3.5" />
                    <span>Active Workspace</span>
                  </span>
                ) : (
                  <button
                    onClick={() => setActiveProject(proj)}
                    className="text-xs font-semibold text-charcoal-600 hover:text-forest-700 transition-colors"
                  >
                    Set Active →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
        subtitle="Configure target milestone delivery dates and project parameters"
        maxWidth="md"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. NextGen API Gateway Migration"
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
              placeholder="Project goals, scope, and target outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Target Milestone *
              </label>
              <input
                type="date"
                required
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-charcoal-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold bg-forest-700 text-white hover:bg-forest-800 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
