import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { Logo } from '../components/common/Logo';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  ArrowRight, ShieldCheck, Sparkles, AlertOctagon, CheckCircle2,
  Calendar, Clock, Users, Link2, ChevronDown, ChevronUp,
  LayoutDashboard, FolderKanban, Activity, Compass, Cpu,
  Layers, Lock, Database, Check, CheckSquare, AlertTriangle
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [activePreviewTab, setActivePreviewTab] = useState<'overview' | 'tasks' | 'risk' | 'recovery' | 'leave'>('overview');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  const faqItems = [
    {
      q: "What is WorkPilot AI?",
      a: "WorkPilot AI is an enterprise AI-assisted project intelligence and recovery platform. It connects everyday task progress, blocker alerts, dependencies, and employee availability to help teams detect delivery risks weeks before milestones slip."
    },
    {
      q: "How does AI-assisted risk analysis work?",
      a: "Risk is computed deterministically through rigorous backend rules that evaluate slack, remaining effort velocity, active blockers, critical path dependencies, and planned leave overlaps. AI interprets these structured findings to explain root causes and formulate recovery recommendations."
    },
    {
      q: "How are recovery recommendations generated?",
      a: "Our LangGraph state machine orchestrates context collection, rule evaluation, and recovery action formulation (such as reassigning tasks to available engineers or inserting buffer days). Every proposal is schema-validated and checked against project member rosters before being presented to a manager."
    },
    {
      q: "Can AI change deadlines automatically?",
      a: "No. WorkPilot AI strictly enforces human-in-the-loop governance. The AI can only formulate proposals. No dates, assignees, or task states are ever mutated without the explicit approval of an authorized project manager."
    },
    {
      q: "How does leave affect project planning?",
      a: "When an employee submits a leave request and the manager approves it, the system commits that absence into availability models. If an approved leave overlaps with an active critical-path task, the deterministic risk engine immediately alerts the manager."
    },
    {
      q: "What happens if the AI service is unavailable?",
      a: "The platform remains 100% operational. Deterministic risk scoring, task management, kanban boards, leave requests, and audit logging function continuously. When external LLMs are unreachable, our built-in heuristic recovery engine steps in automatically."
    },
    {
      q: "Who can access project information?",
      a: "Access is governed by server-side Role-Based Access Control (RBAC). Project managers have comprehensive oversight, while team members access their assigned tasks, personal timesheets, daily standup submissions, and leave records."
    }
  ];

  return (
    <div className="min-h-screen bg-offwhite flex flex-col text-charcoal-900">
      <Navbar />

      {/* --- HERO SECTION --- */}
      <section className="relative pt-8 pb-20 lg:pt-14 lg:pb-28 overflow-hidden">
        {/* Subtle decorative background gradient accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-forest-50/50 via-sage-50/30 to-transparent -z-10 pointer-events-none rounded-b-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Messaging & CTA */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-100 text-forest-800 text-xs font-semibold uppercase tracking-wider border border-forest-200">
                <Sparkles className="w-3.5 h-3.5 text-forest-700" />
                <span>AI-Assisted Project Intelligence</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-charcoal-900 leading-[1.12]">
                Don't just track work. <br />
                <span className="text-forest-700">Stay ahead of risk.</span>
              </h1>

              <p className="text-base sm:text-lg text-charcoal-600 max-w-xl leading-relaxed">
                WorkPilot AI connects project progress, blockers, deadlines, and employee availability to help teams understand delivery risks early and plan validated recovery actions.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-800 shadow-md transition-all group"
                >
                  <span>Start Managing Projects</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#preview"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-charcoal-200 bg-white text-charcoal-800 font-semibold hover:bg-charcoal-50 transition-all shadow-sm"
                >
                  Explore Platform
                </a>
              </div>

              {/* Trust statement */}
              <div className="flex items-center gap-2 text-xs text-charcoal-500 pt-1">
                <ShieldCheck className="w-4 h-4 text-forest-700" />
                <span>Built for transparent, human-approved AI decisions.</span>
              </div>
            </div>

            {/* Right Column: Realistic Interactive Product Dashboard Preview */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-charcoal-200/80 bg-white shadow-2xl p-5 sm:p-6 space-y-5 relative">
                {/* Window header */}
                <div className="flex items-center justify-between pb-4 border-b border-charcoal-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 font-mono text-xs font-semibold text-charcoal-500">
                      WorkPilot Enterprise Migration
                    </span>
                  </div>
                  <RiskBadge level="HIGH" score={88} size="sm" />
                </div>

                {/* Progress & Milestone stats */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-charcoal-50 border border-charcoal-100">
                    <span className="text-charcoal-400 block text-[10px] font-bold uppercase">Progress</span>
                    <span className="text-lg font-bold text-charcoal-900 mt-0.5 block">68%</span>
                    <span className="text-[10px] text-forest-700 font-medium">4 of 6 complete</span>
                  </div>
                  <div className="p-3 rounded-xl bg-charcoal-50 border border-charcoal-100">
                    <span className="text-charcoal-400 block text-[10px] font-bold uppercase">Milestone Due</span>
                    <span className="text-lg font-bold text-charcoal-900 mt-0.5 block">In 8 Days</span>
                    <span className="text-[10px] text-charcoal-500">Critical Path Active</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                    <span className="text-rose-700 block text-[10px] font-bold uppercase">Blockers</span>
                    <span className="text-lg font-bold text-rose-700 mt-0.5 block">1 Active</span>
                    <span className="text-[10px] text-rose-600 font-medium">Halting Auth service</span>
                  </div>
                </div>

                {/* High Risk Task Alert Row */}
                <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 flex items-start gap-3">
                  <AlertOctagon className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-rose-900">Task #4: Risk Calculation Pipeline</p>
                      <span className="text-[10px] text-rose-700 font-semibold bg-rose-100 px-1.5 py-0.5 rounded">Schedule Collision</span>
                    </div>
                    <p className="text-rose-800 text-[11px] mt-0.5 leading-relaxed">
                      Assignee Marcus Chen is on approved leave during this delivery window & upstream Task #3 is blocked.
                    </p>
                  </div>
                </div>

                {/* Team Workload preview */}
                <div className="text-xs">
                  <div className="flex justify-between items-center mb-1 text-charcoal-500">
                    <span className="font-semibold text-charcoal-700">Team Capacity Utilization</span>
                    <span className="text-[11px]">2 of 3 Available</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                      <span className="font-medium text-emerald-900">Elena Rostova</span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">Available (24h)</span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50/50 border border-amber-100 flex items-center justify-between">
                      <span className="font-medium text-amber-900">Marcus Chen</span>
                      <span className="text-[10px] text-amber-700 font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200">On Leave Soon</span>
                    </div>
                  </div>
                </div>

                {/* Compact AI Recovery Panel with action button */}
                <div className="p-4 rounded-xl bg-forest-900 text-white shadow-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-forest-200 font-semibold">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>AI Recovery Proposal Ready</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-forest-800 text-emerald-300 font-mono">
                      Validated
                    </span>
                  </div>
                  <p className="text-xs text-forest-100 leading-relaxed">
                    Reassign Task #4 to Elena Rostova to prevent 4-day stoppage, escalate Task #3 IdP credentials, and buffer timeline.
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-forest-300">Requires Manager Approval</span>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-charcoal-900 text-xs font-bold hover:bg-emerald-400 transition-colors"
                    >
                      <span>Review Proposal</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- PROBLEM SECTION --- */}
      <section className="py-20 bg-white border-y border-charcoal-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <span className="text-xs font-bold text-forest-700 uppercase tracking-wider">The Reality of Delivery</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-charcoal-900 tracking-tight mt-2">
              Project delays rarely happen without warning.
            </h2>
            <p className="text-charcoal-600 mt-3 text-base">
              Projects don't fail overnight. They erode incrementally when daily blockers, silent leave conflicts, and dependency dominoes remain disconnected from schedule forecasts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-charcoal-100 text-charcoal-700 flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h3 className="text-lg font-bold text-charcoal-900">Fragmented project visibility</h3>
              <p className="text-sm text-charcoal-600 leading-relaxed">
                Task trackers, calendar leaves, timesheets, and standup notes live in disconnected silos. Managers only uncover bottlenecks during Friday status meetings when it is too late to react.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-charcoal-100 text-charcoal-700 flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h3 className="text-lg font-bold text-charcoal-900">Blockers discovered too late</h3>
              <p className="text-sm text-charcoal-600 leading-relaxed">
                An engineer hits an external API dependency or credential blocker on Tuesday. The critical-path downstream tasks wait silently until sprint review reveals a two-week delay.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-charcoal-100 text-charcoal-700 flex items-center justify-center font-bold text-sm">
                03
              </div>
              <h3 className="text-lg font-bold text-charcoal-900">Aware of issues, lacking recovery</h3>
              <p className="text-sm text-charcoal-600 leading-relaxed">
                Teams recognize that a milestone is in jeopardy, but manually recomputing dependency shifts, team workloads, and feasible trade-offs takes days of spreadsheet firefighting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- SOLUTION SECTION --- */}
      <section className="py-20 bg-offwhite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-forest-700 uppercase tracking-wider">The WorkPilot Workflow</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-charcoal-900 tracking-tight mt-2">
              From project updates to actionable decisions.
            </h2>
            <p className="text-charcoal-600 mt-3 text-base">
              A unified pipeline that turns routine work logs and blocker reports into explainable delivery predictions and authorized recovery plans.
            </p>
          </div>

          {/* Process Diagram: Horizontal on desktop, vertical on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {[
              {
                step: '01',
                title: 'Track Progress',
                desc: 'Daily task updates, logged effort, and active blockers entered by engineers.',
                icon: CheckSquare
              },
              {
                step: '02',
                title: 'Detect Risks',
                desc: 'Deterministic backend rules calculate slack, velocity deficits, and leave collisions.',
                icon: AlertTriangle
              },
              {
                step: '03',
                title: 'Verify Evidence',
                desc: 'Inspect triggered rules, affected task IDs, and exact root-cause metrics.',
                icon: ShieldCheck
              },
              {
                step: '04',
                title: 'Generate Plan',
                desc: 'LangGraph orchestrates validated recovery actions (reassignments, buffer days).',
                icon: Sparkles
              },
              {
                step: '05',
                title: 'Approve & Apply',
                desc: 'Manager reviews side-by-side changes and commits updates with full audit history.',
                icon: CheckCircle2
              }
            ].map((st, idx) => (
              <div
                key={st.step}
                className="p-5 rounded-2xl bg-white border border-charcoal-100 shadow-card flex flex-col justify-between relative group hover:border-forest-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-md border border-forest-100">
                      Step {st.step}
                    </span>
                    <st.icon className="w-5 h-5 text-charcoal-400 group-hover:text-forest-700 transition-colors" />
                  </div>
                  <h3 className="text-base font-bold text-charcoal-900 mb-1.5">{st.title}</h3>
                  <p className="text-xs text-charcoal-600 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FEATURE SHOWCASE (8 Polished Feature Cards) --- */}
      <section id="features" className="py-20 bg-white border-y border-charcoal-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <span className="text-xs font-bold text-forest-700 uppercase tracking-wider">Enterprise Feature Suite</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-charcoal-900 tracking-tight mt-2">
              Engineered for project rigor and explainability.
            </h2>
            <p className="text-charcoal-600 mt-3 text-base">
              Every feature is built around verifiable project data, deterministic rules, and human oversight.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-800 flex items-center justify-center mb-4">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">Intelligent Workspace</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  Interactive Kanban and tabular views with estimated effort, start dates, hard deadlines, and circular dependency prevention.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Zero Circular Loops →</span>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center mb-4">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">Explainable Risk Intelligence</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  Transparent risk categorization (Low, Medium, High, or Insufficient Data) showing the exact mathematical rules and task IDs that triggered alerts.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Evidence-backed →</span>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">AI Recovery Planner</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  LangGraph workflow generates concrete recovery schedules with explicit rationale, side-by-side diffs, and assumption matrices.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Human-approved →</span>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">Leave-Aware Capacity</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  Absences and planned vacations automatically update committed availability and trigger immediate warnings if critical-path tasks collide.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Availability sync →</span>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">Progress & Work Logs</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  Engineers record session timesheets and standup progress sliders. Missing updates are treated as unknown data rather than punishment.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Transparent logs →</span>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center mb-4">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">Decision Audit Trail</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  Every proposal approval, rejection, deadline adjustment, and blocker change is permanently logged with timestamps and responsible deciders.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Immutable history →</span>
            </div>

            {/* Feature 7 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-charcoal-200 text-charcoal-800 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">Role-Based Workspaces</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  Strict backend-enforced separation between Manager oversight (risk, proposals, approvals) and Employee focus (tasks, daily logs, leave).
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Enforced RBAC →</span>
            </div>

            {/* Feature 8 */}
            <div className="p-6 rounded-2xl bg-offwhite border border-charcoal-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-sage-200 text-forest-900 flex items-center justify-center mb-4">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-charcoal-900 mb-2">Advisory Automations</h3>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  System suggestions remain purely advisory. No autonomous bots making stealth deadline changes or silent ticket reallocations.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-forest-700 mt-4 inline-block">Zero stealth edits →</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS (5 Steps) --- */}
      <section id="how-it-works" className="py-20 bg-offwhite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-forest-700 uppercase tracking-wider">Predictable Mechanics</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-charcoal-900 tracking-tight mt-2">
              Deterministic Rules. Generative Explanation.
            </h2>
            <p className="text-charcoal-600 mt-3 text-base">
              We never use opaque AI to hallucinate delivery dates. Deterministic math computes the risk; AI articulates the recovery.
            </p>
          </div>

          <div className="space-y-4 max-w-4xl mx-auto">
            {[
              {
                num: '01',
                title: 'Create project and define dependency DAG',
                desc: 'Establish projects, assign effort estimates (hours), specify due dates, and map prerequisites with cycle prevention algorithms.'
              },
              {
                num: '02',
                title: 'Record actual progress and work blockers',
                desc: 'Engineers submit daily completion updates and flag blockers as soon as impediments arise in development.'
              },
              {
                num: '03',
                title: 'Deterministic backend evaluation',
                desc: 'Our engine computes required velocity, evaluates critical path slack, checks approved leaves, and flags insufficient data.'
              },
              {
                num: '04',
                title: 'LangGraph recovery orchestration',
                desc: 'Multi-node state graph generates a structured intervention plan, validating that every proposed assignee and task ID exists.'
              },
              {
                num: '05',
                title: 'Human review, approval, and verified execution',
                desc: 'The project manager reviews side-by-side diffs, clicks Approve, and changes are atomically applied with audit logs.'
              }
            ].map((step) => (
              <div
                key={step.num}
                className="p-5 sm:p-6 rounded-2xl bg-white border border-charcoal-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5 hover:border-forest-300 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-forest-700 text-white font-mono font-bold text-lg flex items-center justify-center flex-shrink-0">
                  {step.num}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-charcoal-900">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-charcoal-600 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- INTERACTIVE PRODUCT PREVIEW SECTION --- */}
      <section id="preview" className="py-20 bg-white border-y border-charcoal-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold text-forest-700 uppercase tracking-wider">Live Platform Explorer</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-charcoal-900 tracking-tight mt-2">
              Explore the interface without signing in.
            </h2>
            <p className="text-charcoal-600 mt-3 text-base">
              Click the tabs below to preview the actual manager and employee screens from our canonical enterprise migration scenario.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { id: 'overview', label: 'Project Overview' },
              { id: 'tasks', label: 'Kanban Tasks Board' },
              { id: 'risk', label: 'Risk Intelligence' },
              { id: 'recovery', label: 'Recovery Proposal' },
              { id: 'leave', label: 'Team Availability & Leave' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActivePreviewTab(t.id as any)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activePreviewTab === t.id
                    ? 'bg-forest-700 text-white shadow-sm'
                    : 'bg-offwhite text-charcoal-600 hover:bg-charcoal-100 hover:text-charcoal-900 border border-charcoal-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Interactive Screen Preview Container */}
          <div className="rounded-2xl border border-charcoal-200 bg-offwhite p-4 sm:p-6 shadow-xl max-w-5xl mx-auto min-h-[460px]">
            {activePreviewTab === 'overview' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-charcoal-200">
                  <div>
                    <h3 className="text-lg font-bold text-charcoal-900">WorkPilot Enterprise Cloud Migration</h3>
                    <p className="text-xs text-charcoal-500">Alex Vance (Project Manager) • 6 Total Tasks</p>
                  </div>
                  <RiskBadge level="HIGH" score={88} size="md" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-charcoal-100 shadow-sm">
                    <span className="text-charcoal-400 block font-bold text-[10px] uppercase">Active Tasks</span>
                    <span className="text-xl font-bold text-charcoal-900 mt-1 block">5</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-charcoal-100 shadow-sm">
                    <span className="text-charcoal-400 block font-bold text-[10px] uppercase">Completion</span>
                    <span className="text-xl font-bold text-forest-700 mt-1 block">68%</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-charcoal-100 shadow-sm">
                    <span className="text-charcoal-400 block font-bold text-[10px] uppercase">Active Blockers</span>
                    <span className="text-xl font-bold text-rose-600 mt-1 block">1</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-charcoal-100 shadow-sm">
                    <span className="text-charcoal-400 block font-bold text-[10px] uppercase">Pending Leaves</span>
                    <span className="text-xl font-bold text-amber-600 mt-1 block">1</span>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-charcoal-100 shadow-sm">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-semibold text-charcoal-800">Critical Milestone Burn-down</span>
                    <span className="text-rose-600 font-semibold">Overdue Risk: High</span>
                  </div>
                  <div className="w-full h-3 bg-charcoal-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 w-[45%]" title="Completed (45%)" />
                    <div className="h-full bg-forest-600 w-[23%]" title="In Progress (23%)" />
                    <div className="h-full bg-rose-500 w-[12%]" title="Blocked (12%)" />
                    <div className="h-full bg-charcoal-300 w-[20%]" title="Remaining (20%)" />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-charcoal-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-forest-600" /> In Progress</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Blocked</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-charcoal-300" /> Todo</span>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'tasks' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in duration-200">
                <div className="p-3 bg-white rounded-xl border border-charcoal-200 shadow-sm space-y-2">
                  <span className="text-xs font-bold text-charcoal-600 uppercase tracking-wider block">To Do (2)</span>
                  <div className="p-2.5 rounded-lg bg-offwhite border border-charcoal-100 text-xs space-y-1">
                    <span className="font-mono text-[10px] text-charcoal-400">#4 • Critical</span>
                    <p className="font-semibold text-charcoal-800">Real-Time Risk Engine Event Streaming</p>
                    <span className="text-[11px] text-charcoal-500 block">Marcus Chen • 36h</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-offwhite border border-charcoal-100 text-xs space-y-1">
                    <span className="font-mono text-[10px] text-charcoal-400">#6 • High</span>
                    <p className="font-semibold text-charcoal-800">End-to-End Penetration Testing</p>
                    <span className="text-[11px] text-charcoal-500 block">Marcus Chen • 16h</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-charcoal-200 shadow-sm space-y-2">
                  <span className="text-xs font-bold text-forest-700 uppercase tracking-wider block">In Progress (2)</span>
                  <div className="p-2.5 rounded-lg bg-offwhite border border-charcoal-100 text-xs space-y-1">
                    <span className="font-mono text-[10px] text-charcoal-400">#2 • High</span>
                    <p className="font-semibold text-charcoal-800">PostgreSQL Database Schema & CDC Replication</p>
                    <span className="text-[11px] text-forest-700 font-medium block">Elena Rostova • 75% complete</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-offwhite border border-charcoal-100 text-xs space-y-1">
                    <span className="font-mono text-[10px] text-charcoal-400">#5 • Medium</span>
                    <p className="font-semibold text-charcoal-800">Executive Client Dashboard UI</p>
                    <span className="text-[11px] text-forest-700 font-medium block">Elena Rostova • 30% complete</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-charcoal-200 shadow-sm space-y-2">
                  <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">Blocked (1)</span>
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-1">
                    <span className="font-mono text-[10px] text-rose-700">#3 • Critical</span>
                    <p className="font-semibold text-rose-900">Auth & Enterprise SSO Microservice</p>
                    <p className="text-[11px] text-rose-800 font-medium italic">"Awaiting customer SAML credentials"</p>
                    <span className="text-[10px] text-rose-600 block">Halts downstream Task #4</span>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'risk' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">High Delivery Risk Detected (Score 88/100)</h4>
                    <p className="text-xs text-rose-800 mt-0.5">
                      Deterministic engine triggered 3 concurrent risk flags requiring manager intervention.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-charcoal-100 shadow-sm">
                    <span className="font-mono text-[10px] text-charcoal-400">RULE_ACTIVE_BLOCKER</span>
                    <h5 className="font-bold text-charcoal-900 mt-1">Active Work Blocker Halting Progress</h5>
                    <p className="text-charcoal-600 mt-0.5">Task #3 is blocked and has dependent Task #4.</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-charcoal-100 shadow-sm">
                    <span className="font-mono text-[10px] text-charcoal-400">RULE_LEAVE_CONFLICT</span>
                    <h5 className="font-bold text-charcoal-900 mt-1">Approved Leave Overlaps Critical Task</h5>
                    <p className="text-charcoal-600 mt-0.5">Marcus Chen is on leave during Task #4 schedule.</p>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'recovery' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-4 rounded-xl bg-forest-50 border border-forest-200 text-xs">
                  <div className="flex items-center gap-2 text-forest-900 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-forest-700" />
                    <span>Sprint Recovery & Critical Path Realignment Plan</span>
                  </div>
                  <p className="text-forest-800 mt-1">
                    AI generated 2 validated actions to recover 15% estimated milestone slippage.
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-charcoal-200 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-charcoal-900">Action 1: Reassign Task #4</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-forest-100 text-forest-800">REASSIGN</span>
                  </div>
                  <p className="text-charcoal-600">Reassign from Marcus Chen (on leave) to Elena Rostova (available 24h capacity).</p>
                  <div className="text-[11px] font-mono p-2 bg-charcoal-50 rounded text-charcoal-700">
                    Marcus Chen → Elena Rostova
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-lg bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800"
                  >
                    Test Live Approval Flow →
                  </Link>
                </div>
              </div>
            )}

            {activePreviewTab === 'leave' && (
              <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                <div className="p-4 bg-white rounded-xl border border-charcoal-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center font-bold">
                      MC
                    </div>
                    <div>
                      <h4 className="font-bold text-charcoal-900">Marcus Chen</h4>
                      <p className="text-charcoal-500 text-[11px]">Lead Cloud Systems Architect</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Approved Leave: Next 4 Days
                  </span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-charcoal-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center font-bold">
                      ER
                    </div>
                    <div>
                      <h4 className="font-bold text-charcoal-900">Elena Rostova</h4>
                      <p className="text-charcoal-500 text-[11px]">Senior Full-Stack Engineer</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Fully Available (32h capacity)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --- SECURITY AND RESPONSIBLE AI --- */}
      <section id="security" className="py-20 bg-charcoal-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Governed Systems</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
              AI assistance. Human accountability.
            </h2>
            <p className="text-charcoal-400 mt-3 text-base">
              WorkPilot AI is intentionally designed to prevent silent algorithmic drift, employee surveillance, and unauthorized schedule disruptions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-charcoal-800/80 border border-charcoal-700/80 space-y-3">
              <Lock className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Backend-Enforced RBAC</h3>
              <p className="text-xs text-charcoal-400 leading-relaxed">
                Roles are derived strictly from authenticated JWT server sessions. Client roles are never trusted. Employees only access authorized project artifacts.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-charcoal-800/80 border border-charcoal-700/80 space-y-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Validated Schema Outputs</h3>
              <p className="text-xs text-charcoal-400 leading-relaxed">
                AI proposals must conform to Pydantic schemas. Every referenced task ID, proposed assignee, and prerequisite constraint is verified before presentation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-charcoal-800/80 border border-charcoal-700/80 space-y-3">
              <Users className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Human Approval Gate</h3>
              <p className="text-xs text-charcoal-400 leading-relaxed">
                No silent deadline changes or automatic reassignments. Consequential schedule mutations strictly require an authorized manager's explicit review and approval.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-charcoal-800/80 border border-charcoal-700/80 space-y-3">
              <Activity className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Zero Surveillance Tracking</h3>
              <p className="text-xs text-charcoal-400 leading-relaxed">
                We believe in work outcomes, not intrusive keystroke or device spying. Progress is based on transparent work logs and engineer-reported blockers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-charcoal-800/80 border border-charcoal-700/80 space-y-3">
              <Database className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Visible Missing-Data Warnings</h3>
              <p className="text-xs text-charcoal-400 leading-relaxed">
                When essential project estimates or assignees are missing, the system outputs "Insufficient Data" rather than inventing inaccurate delivery predictions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-charcoal-800/80 border border-charcoal-700/80 space-y-3">
              <Cpu className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Zero-Downtime Determinism</h3>
              <p className="text-xs text-charcoal-400 leading-relaxed">
                If third-party LLMs experience downtime or latency spikes, our deterministic rules and built-in heuristic planner ensure uninterrupted platform operation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-forest-700 uppercase tracking-wider">Frequently Asked Questions</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-charcoal-900 tracking-tight mt-2">
              Everything you need to know.
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-charcoal-200 bg-offwhite overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-sm sm:text-base font-semibold text-charcoal-900 hover:text-forest-700 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-forest-700 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-charcoal-400 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-charcoal-600 leading-relaxed border-t border-charcoal-100 bg-white">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- FINAL CTA BANNER --- */}
      <section className="py-20 bg-forest-700 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Make your next project easier to steer.
          </h2>
          <p className="text-forest-100 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Unify everyday task execution with transparent delivery risk intelligence. Start as a manager or team member in seconds.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white text-forest-800 font-bold text-sm hover:bg-forest-50 shadow-md transition-all group"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-forest-700" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-forest-800/80 border border-forest-600 text-white font-semibold text-sm hover:bg-forest-900 transition-all"
            >
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
