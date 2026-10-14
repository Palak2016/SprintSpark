import React from 'react';
import { RiskAnalysis, TriggeredRule, MissingDataFlag } from '../../types';
import { RiskBadge } from '../common/RiskBadge';
import {
  AlertTriangle, AlertOctagon, Info, CheckCircle2,
  Calendar, Users, Link2, Sparkles, HelpCircle
} from 'lucide-react';

interface RiskDetailCardProps {
  analysis: RiskAnalysis | null;
  onGenerateRecoveryPlan?: () => void;
  isGenerating?: boolean;
}

export const RiskDetailCard: React.FC<RiskDetailCardProps> = ({
  analysis,
  onGenerateRecoveryPlan,
  isGenerating = false
}) => {
  if (!analysis) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-charcoal-100 shadow-card">
        <p className="text-sm text-charcoal-500">No risk evaluation available for this project.</p>
      </div>
    );
  }

  const isInsufficient = analysis.risk_level === 'INSUFFICIENT_DATA';
  const isHighRisk = analysis.risk_level === 'HIGH';

  return (
    <div className="space-y-6">
      {/* Risk Summary Header Banner */}
      <div className={`p-6 rounded-xl border shadow-card transition-all ${
        isHighRisk ? 'bg-gradient-to-r from-rose-50/80 to-amber-50/50 border-rose-200' :
        analysis.risk_level === 'MEDIUM' ? 'bg-gradient-to-r from-amber-50/80 to-white border-amber-200' :
        isInsufficient ? 'bg-charcoal-50 border-charcoal-200' :
        'bg-gradient-to-r from-emerald-50/80 to-white border-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <RiskBadge level={analysis.risk_level} score={analysis.score} size="lg" />
              <span className="text-xs text-charcoal-500">
                Evaluated {new Date(analysis.created_at).toLocaleString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-charcoal-900 mt-2">
              {isInsufficient 
                ? 'Insufficient Project Data for Reliable Forecast'
                : isHighRisk 
                ? 'Delivery Risk Detected on Critical Milestones' 
                : analysis.risk_level === 'MEDIUM'
                ? 'Potential Delivery Headwinds Observed'
                : 'Project Velocity Healthy and On Track'}
            </h2>
            <p className="text-xs sm:text-sm text-charcoal-600 mt-1 max-w-2xl leading-relaxed">
              {isInsufficient 
                ? 'Deterministic models require complete task estimates and resource assignments before computing delivery probability vectors.'
                : isHighRisk 
                ? 'Multiple concurrent risk triggers (blocked downstream paths, leave overlaps, or velocity deficit) jeopardize target delivery dates.'
                : 'Deterministic backend verification passed without unmitigated schedule bottlenecks.'}
            </p>
          </div>

          {/* Action button */}
          {onGenerateRecoveryPlan && (
            <div className="flex-shrink-0">
              <button
                onClick={onGenerateRecoveryPlan}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-700 text-white text-xs sm:text-sm font-semibold hover:bg-forest-800 shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>{isGenerating ? 'Evaluating Graph Nodes...' : 'Generate AI Recovery Proposal'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Missing Data Warnings */}
      {analysis.missing_data_flags && analysis.missing_data_flags.length > 0 && (
        <div className="p-4 rounded-xl bg-charcoal-50 border border-charcoal-200">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-charcoal-800 uppercase tracking-wider">
            <HelpCircle className="w-4 h-4 text-charcoal-600" />
            <span>Missing Information Warnings ({analysis.missing_data_flags.length})</span>
          </div>
          <div className="space-y-1.5">
            {analysis.missing_data_flags.map((flag, idx) => (
              <div key={idx} className="text-xs text-charcoal-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-charcoal-400 mt-1.5 flex-shrink-0" />
                <span>{flag.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triggered Deterministic Rules Grid */}
      <div>
        <h3 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-3">
          Triggered Rule Evaluations ({analysis.triggered_rules.length})
        </h3>

        {analysis.triggered_rules.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-white border border-charcoal-100 shadow-card text-xs text-charcoal-500">
            No risk rules currently triggered. All parameters operate within safe thresholds.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.triggered_rules.map((rule) => {
              const isCrit = rule.severity === 'CRITICAL';
              const isHigh = rule.severity === 'HIGH';

              return (
                <div
                  key={rule.rule_id}
                  className={`p-4 rounded-xl border bg-white shadow-card transition-all ${
                    isCrit ? 'border-rose-200' : isHigh ? 'border-amber-200' : 'border-charcoal-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isCrit ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      isHigh ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-charcoal-100 text-charcoal-700'
                    }`}>
                      {rule.severity}
                    </span>
                    <span className="font-mono text-[10px] text-charcoal-400">{rule.rule_id}</span>
                  </div>

                  <h4 className="text-sm font-semibold text-charcoal-900 mt-2">{rule.rule_name}</h4>
                  <p className="text-xs text-charcoal-600 mt-1 leading-relaxed">{rule.description}</p>

                  {/* Affected Tasks */}
                  {rule.affected_task_ids && rule.affected_task_ids.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-charcoal-50 flex items-center gap-2 text-xs text-charcoal-500">
                      <span className="font-medium">Affected Tasks:</span>
                      <div className="flex flex-wrap gap-1">
                        {rule.affected_task_ids.map((id) => (
                          <span key={id} className="px-1.5 py-0.5 rounded bg-charcoal-100 font-mono text-[10px] text-charcoal-800">
                            #{id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Metrics Evidence Footprint */}
      {analysis.evidence_json && (
        <div className="p-4 rounded-xl bg-white border border-charcoal-100 shadow-card">
          <h3 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-3">
            Deterministic Engine Evidence Footprint
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-2.5 rounded-lg bg-charcoal-50/60">
              <span className="text-charcoal-500 block">Total Active Tasks</span>
              <span className="text-base font-bold text-charcoal-900 mt-0.5 block">{analysis.evidence_json.total_tasks || 0}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-charcoal-50/60">
              <span className="text-charcoal-500 block">Blocked Bottlenecks</span>
              <span className={`text-base font-bold mt-0.5 block ${analysis.evidence_json.blocked_tasks > 0 ? 'text-rose-600' : 'text-charcoal-900'}`}>
                {analysis.evidence_json.blocked_tasks || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-charcoal-50/60">
              <span className="text-charcoal-500 block">Leave Schedule Conflicts</span>
              <span className={`text-base font-bold mt-0.5 block ${analysis.evidence_json.tasks_with_leave_conflict > 0 ? 'text-amber-600' : 'text-charcoal-900'}`}>
                {analysis.evidence_json.tasks_with_leave_conflict || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-charcoal-50/60">
              <span className="text-charcoal-500 block">Dependency Conflicts</span>
              <span className="text-base font-bold text-charcoal-900 mt-0.5 block">{analysis.evidence_json.dependency_conflicts || 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
