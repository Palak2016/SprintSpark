import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { AuditEvent } from '../../types';
import {
  History, Search, ShieldCheck, CheckCircle2, AlertOctagon,
  Calendar, Clock, User
} from 'lucide-react';

export const AuditHistoryView: React.FC = () => {
  const { activeProject } = useProject();

  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeProject) {
      loadAudits();
    }
  }, [activeProject]);

  const loadAudits = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const data = await api.getAuditTrail(activeProject.id);
      setAudits(data);
    } catch (err) {
      console.error("Failed to load audits:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAudits = audits.filter((a) =>
    a.description.toLowerCase().includes(search.toLowerCase()) ||
    a.event_type.toLowerCase().includes(search.toLowerCase()) ||
    (a.actor?.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Project Decision & Audit Trail</h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Immutable chronological record of proposal approvals, blocker reports, and task mutations
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-charcoal-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-charcoal-200 bg-white focus:outline-none focus:ring-1 focus:ring-forest-600"
          />
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-6">
        {filteredAudits.length === 0 ? (
          <p className="text-xs text-charcoal-400 text-center py-10">No audit events match your search.</p>
        ) : (
          <div className="relative border-l border-charcoal-200 ml-4 space-y-6 pl-6">
            {filteredAudits.map((event) => (
              <div key={event.id} className="relative group">
                {/* Dot */}
                <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-forest-700 shadow-sm" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-forest-900 font-mono uppercase tracking-wider text-[11px]">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    {event.actor && (
                      <span className="text-charcoal-500 flex items-center gap-1">
                        by <span className="font-semibold text-charcoal-800">{event.actor.full_name}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-charcoal-400 text-[11px]">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-charcoal-800 mt-1 leading-relaxed">
                  {event.description}
                </p>

                {/* Metadata JSON preview if applied changes exist */}
                {event.metadata_json && event.metadata_json.applied_changes && (
                  <div className="mt-2 p-2.5 rounded-lg bg-charcoal-50 border border-charcoal-100 text-[11px] font-mono text-charcoal-600">
                    <span className="font-semibold text-charcoal-700 block mb-1">Applied State Diffs:</span>
                    <pre className="overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(event.metadata_json.applied_changes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
