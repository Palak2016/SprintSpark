import React, { useState } from 'react';
import { Eye, ShieldCheck, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';

export const FocusGuardianView: React.FC = () => {
  const [contextNote, setContextNote] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Refactoring Legacy Architecture');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const tags = [
    'Refactoring Legacy Architecture',
    'Assisted Teammate with Production Incident',
    'Unexpected Edge Case Investigation',
    'Third-Party API & Library Incompatibilities',
    'Spec Clarification & Design Alignment'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setContextNote('');
    }, 3500);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Focus Guardian — Work Context Clarification</h1>
        <p className="text-xs text-charcoal-500 mt-0.5">
          A respectful, transparent mechanism to clarify schedule deviations without intrusive surveillance
        </p>
      </div>

      {/* Philosophy Card */}
      <div className="p-5 rounded-2xl bg-forest-50/70 border border-forest-200 text-xs text-forest-900 space-y-2 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-sm text-forest-900">
          <ShieldCheck className="w-5 h-5 text-forest-700" />
          <span>Zero Device Monitoring Guarantee</span>
        </div>
        <p>
          WorkPilot AI never installs spyware, monitors keystrokes, tracks screens, or infers misconduct from schedule shifts. Software engineering is non-linear: complex bugs, incident response, and teammate mentoring naturally alter planned estimates.
        </p>
        <p className="text-forest-800 font-medium">
          When velocity deviates from baseline, Focus Guardian provides a direct space to share technical context with your manager before AI flags delay risk.
        </p>
      </div>

      {isSubmitted && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-bold">Context Logged</p>
            <p className="mt-0.5">Your technical clarification has been attached to the project baseline. The risk engine will factor this into upcoming recovery models.</p>
          </div>
        </div>
      )}

      {/* Context Clarification Form */}
      <div className="p-6 bg-white rounded-2xl border border-charcoal-100 shadow-card">
        <h3 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-forest-700" />
          <span>Provide Delivery Context</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-2">
              Primary Nature of Schedule Divergence
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedTag === tag
                      ? 'bg-forest-700 text-white shadow-sm'
                      : 'bg-charcoal-50 text-charcoal-700 border border-charcoal-200 hover:bg-charcoal-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Engineering Context & Narrative
            </label>
            <textarea
              rows={4}
              required
              placeholder="e.g. During schema cutover, uncovered unindexed foreign key queries causing connection pool exhaustion. Spent 4 hours refactoring query joins to prevent downtime."
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-charcoal-200 focus:outline-none focus:ring-1 focus:ring-forest-600"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-forest-700 text-white text-xs font-bold hover:bg-forest-800 shadow-sm transition-all"
            >
              Attach Context to Baseline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
