
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  CalendarDays, CheckCircle2, ChevronDown, Clock3, Compass, Database,
  FolderKanban, Layers3, LockKeyhole, MoveUpRight, ShieldCheck,
  Sparkles, Users, Workflow, Zap, ChartNoAxesCombined, CircleHelp,
  BrainCircuit, Gauge, Menu, X
} from 'lucide-react';

import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';

type PreviewTab = 'overview' | 'tasks' | 'risk' | 'recovery' | 'leave';

const C = {
  bg: '#100B1D',
  panel: '#19112B',
  panel2: '#211638',
  purple: '#A78BFA',
  violet: '#8B5CF6',
  lilac: '#E9DFFF',
  muted: '#B7ADC9',
  white: '#FAF8FF',
  border: 'rgba(210,190,255,.13)',
};

const reveal = {
  hidden: { opacity: 0, y: 35, filter: 'blur(7px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

const features = [
  {
    icon: FolderKanban,
    title: 'Intelligent workspace',
    description: 'Manage projects, milestones, priorities, deadlines, and dependencies in one connected workspace.',
    label: 'PROJECT VISIBILITY',
  },
  {
    icon: AlertTriangle,
    title: 'Explainable risk intelligence',
    description: 'Identify blockers and schedule pressure with evidence your team can inspect.',
    label: 'EVIDENCE-BACKED ALERTS',
  },
  {
    icon: Sparkles,
    title: 'AI recovery planner',
    description: 'Explore recovery proposals with clear reasoning, assumptions, and suggested actions.',
    label: 'AI-ASSISTED PLANNING',
  },
  {
    icon: CalendarDays,
    title: 'Leave-aware capacity',
    description: 'Compare workload with approved leave to uncover capacity conflicts before delivery suffers.',
    label: 'TEAM AVAILABILITY',
  },
  {
    icon: Clock3,
    title: 'Progress and work logs',
    description: 'Keep task updates, blockers, work logs, and progress visible throughout execution.',
    label: 'LIVE WORK CONTEXT',
  },
  {
    icon: Activity,
    title: 'Decision audit trail',
    description: 'Track approvals and project changes so important actions remain traceable.',
    label: 'ACCOUNTABILITY',
  },
  {
    icon: Users,
    title: 'Role-based workspaces',
    description: 'Give managers project oversight while employees focus on their own tasks.',
    label: 'ROLE-AWARE ACCESS',
  },
  {
    icon: Compass,
    title: 'Guided decision-making',
    description: 'Explore solutions with AI while keeping consequential decisions under human control.',
    label: 'HUMAN IN THE LOOP',
  },
];

const workflow = [
  { icon: Database, title: 'Capture project reality', description: 'Collect tasks, dependencies, progress, blockers, and team availability.' },
  { icon: ChartNoAxesCombined, title: 'Evaluate delivery risk', description: 'Identify schedule pressure and potential capacity conflicts.' },
  { icon: ShieldCheck, title: 'Understand the evidence', description: 'Inspect the project data behind every important risk signal.' },
  { icon: Sparkles, title: 'Explore recovery options', description: 'Generate possible interventions and explain their trade-offs.' },
  { icon: CheckCircle2, title: 'Review and approve', description: 'Let authorized managers review changes before they are applied.' },
];

const faqs = [
  {
    question: 'What is WorkPilot AI?',
    answer: 'WorkPilot AI connects project progress, task dependencies, blockers, deadlines, and team availability to help teams make better delivery decisions.',
  },
  {
    question: 'How does project risk detection work?',
    answer: 'Risk checks evaluate structured project information such as active blockers, task dependencies, schedule slack, remaining effort, and approved leave. Alerts should explain their supporting evidence.',
  },
  {
    question: 'What does the AI recovery planner do?',
    answer: 'It suggests possible responses to delivery risks, explains its reasoning, and presents options for a manager to review before consequential changes are made.',
  },
  {
    question: 'Can AI change a task without permission?',
    answer: 'The intended workflow requires human approval for consequential changes. This must be enforced by backend authorization and validation, not just the frontend.',
  },
  {
    question: 'Does leave affect project planning?',
    answer: 'Approved leave can be considered when assessing team availability and task allocations, helping managers identify scheduling conflicts.',
  },
  {
    question: 'Who can access project information?',
    answer: 'Access should be controlled through server-side authentication and role-based permissions so users can only access authorized projects and actions.',
  },
];

const tabs: { id: PreviewTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Task board' },
  { id: 'risk', label: 'Risk signals' },
  { id: 'recovery', label: 'AI recovery' },
  { id: 'leave', label: 'Team capacity' },
];

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={reveal}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-violet-200 sm:text-xs">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-300" />
      </span>
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  centered?: boolean;
}) {
  return (
    <Reveal className={`mb-12 max-w-3xl ${centered ? 'mx-auto text-center' : ''}`}>
      <p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-.045em] text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-8 text-[#B7ADC9] sm:text-lg">
        {description}
      </p>
    </Reveal>
  );
}

function GlowOrb({
  className = '',
  duration = 12,
}: {
  className?: string;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      animate={reduceMotion ? undefined : {
        x: [0, 18, -10, 0],
        y: [0, -22, 12, 0],
        scale: [1, 1.08, 0.95, 1],
      }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      className={`pointer-events-none absolute rounded-full blur-[85px] ${className}`}
    />
  );
}

function FloatingCard({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={{ duration: 0.65, delay, ease: 'easeOut' }}
      className={className}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
        transition={{
          duration: 5 + delay,
          repeat: Infinity,
          ease: 'easeInOut',
          delay,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function DashboardMockup() {
  const reduceMotion = useReducedMotion();

  const metrics = [
    { label: 'Completion', value: '68%', width: '68%', color: 'bg-violet-400' },
    { label: 'Open tasks', value: '05', width: '54%', color: 'bg-sky-300' },
    { label: 'Blockers', value: '01', width: '22%', color: 'bg-rose-400' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <GlowOrb className="-inset-8 bg-violet-600/30" duration={9} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 45, rotateX: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        whileHover={reduceMotion ? undefined : { rotateX: 1, rotateY: -1, scale: 1.01 }}
        style={{ transformPerspective: 1200 }}
        className="relative rounded-2xl border border-violet-200/20 bg-[#1A132B]/95 p-1 shadow-[0_30px_100px_rgba(107,56,220,.23)] sm:rounded-3xl sm:p-2"
      >
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#130E21] sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div>
                <Logo size="md" onDarkBackground />
                <p className="mt-1 text-[10px] text-[#9287A8]">Project intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-300/[0.08] px-2.5 py-1.5 text-[10px] font-bold text-rose-200">
              <motion.span
                animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-rose-300"
              />
              HIGH RISK
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-5">
            {metrics.map((item, index) => (
              <motion.div
                key={item.label}
                initial={reduceMotion ? false : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.12 }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 sm:p-4"
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#9287A8] sm:text-[10px]">
                  {item.label}
                </p>
                <p className="mt-2 text-xl font-semibold text-white sm:text-3xl">{item.value}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: item.width }}
                    transition={{ duration: 1.3, delay: 0.9 + index * 0.15 }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="px-3 sm:px-5">
            <div className="rounded-xl border border-rose-300/15 bg-rose-400/[0.055] p-4">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={reduceMotion ? undefined : { rotate: [0, -7, 7, 0] }}
                  transition={{ duration: 2.8, repeat: Infinity }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-400/10"
                >
                  <AlertTriangle className="h-4 w-4 text-rose-300" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-rose-100">Delivery risk detected</p>
                  <p className="mt-1 text-xs leading-5 text-[#B7ADC9]">
                    A blocked prerequisite may delay a critical downstream task.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            <div className="relative overflow-hidden rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/[0.14] to-indigo-500/[0.04] p-4 sm:p-5">
              <motion.div
                aria-hidden="true"
                animate={reduceMotion ? undefined : { x: ['-100%', '200%'] }}
                transition={{ duration: 5, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
                className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-25deg] bg-gradient-to-r from-transparent via-white/[0.045] to-transparent"
              />
              <div className="relative flex items-center gap-2">
                <motion.div
                  animate={reduceMotion ? undefined : { rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="h-5 w-5 text-violet-300" />
                </motion.div>
                <p className="text-sm font-semibold text-white">AI recovery proposal</p>
                <span className="ml-auto rounded-full border border-violet-300/20 px-2 py-1 text-[9px] text-violet-200">DRAFT</span>
              </div>
              <p className="relative mt-3 text-xs leading-6 text-[#B7ADC9]">
                Resolve the upstream blocker, assess available capacity, and review milestone impact.
              </p>
              <div className="relative mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center">
                <span className="text-[10px] text-[#9287A8]">Manager approval required</span>
                <Link
                  to="/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#E9DFFF] px-3 py-2 text-xs font-bold text-[#211638] transition hover:bg-white"
                >
                  Review proposal <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.07] px-4 py-3 text-center text-[10px] text-[#756987]">
            Illustrative sample data · Not live project metrics
          </div>
        </div>
      </motion.div>

      <FloatingCard
        delay={0.8}
        className="absolute -left-4 top-16 hidden sm:block lg:-left-12"
      >
        <div className="rounded-xl border border-violet-200/20 bg-[#211638]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/15">
              <BrainCircuit className="h-4 w-4 text-violet-300" />
            </span>
            <div>
              <p className="text-[10px] font-semibold text-white">AI insight</p>
              <p className="text-[9px] text-[#B7ADC9]">Blocker identified</p>
            </div>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
          </div>
        </div>
      </FloatingCard>

      <FloatingCard delay={1.1} className="absolute -right-2 bottom-14 hidden sm:block lg:-right-8">
        <div className="rounded-xl border border-violet-200/20 bg-[#211638]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10">
              <Gauge className="h-4 w-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Project health</p>
              <p className="text-[10px] text-emerald-300">Monitoring signals</p>
            </div>
          </div>
        </div>
      </FloatingCard>
    </div>
  );
}

export const LandingPage = () => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('overview');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();
  const { user, isManager } = useAuth();
  const workspacePath = isManager ? '/manager' : '/employee';

  return (
    <main className="landing-page min-h-screen overflow-hidden bg-[#100B1D] text-[#FAF8FF] selection:bg-violet-400/30">
      <Navbar />

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-[#100B1D]">
        <GlowOrb className="-right-32 -top-20 h-96 w-96 bg-violet-600/30" duration={12} />
        <GlowOrb className="-bottom-36 left-[15%] h-80 w-80 bg-fuchsia-600/20" duration={15} />
        <GlowOrb className="right-[35%] top-[35%] h-64 w-64 bg-indigo-500/15" duration={10} />

        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(226,210,255,.09)_1px,transparent_0)] [background-size:27px_27px]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-[#100B1D]" />

        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.92fr_1.08fr] lg:gap-12 lg:py-28">
          <motion.div
            initial={reduceMotion ? false : 'hidden'}
            animate="visible"
            variants={reveal}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow>Project intelligence, reimagined</Eyebrow>

            <h1 className="mt-7 text-4xl font-semibold leading-[1.06] tracking-[-.055em] sm:text-6xl lg:text-[4.5rem]">
              See project risks.
              <span className="relative mt-2 block pb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#F1E9FF] via-[#BCA4FF] to-[#8B5CF6]">
                Act before delays.
                <motion.span
                  aria-hidden="true"
                  animate={reduceMotion ? undefined : { opacity: [0.2, 0.65, 0.2], scaleX: [0.7, 1, 0.7] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-1 left-0 h-[2px] w-3/4 origin-left bg-gradient-to-r from-violet-400 to-transparent"
                />
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-[#B7ADC9] sm:text-lg">
              Bring project execution, team capacity, and delivery risks into one intelligent workspace. Understand what is happening, why it matters, and what your team can do next.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to={user ? workspacePath : '/signup'}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-400 to-[#A78BFA] px-6 py-3.5 text-sm font-bold text-[#1C1230] shadow-[0_8px_35px_rgba(139,92,246,.25)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_45px_rgba(139,92,246,.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
              >
                <motion.span
                  aria-hidden="true"
                  animate={reduceMotion ? undefined : { x: ['-150%', '250%'] }}
                  transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 1.5, ease: 'linear' }}
                  className="absolute inset-y-0 w-1/3 skew-x-[-25deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                />
                <span className="relative">{user ? 'Go to workspace' : 'Get started free'}</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#preview"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200/20 bg-white/[0.035] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-violet-300/50 hover:bg-violet-300/[0.08]"
              >
                Explore the platform
                <ArrowDownRight className="h-4 w-4 text-violet-300 transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#B7ADC9]">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-300" /> Explainable risk signals</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-300" /> Manager-approved actions</span>
            </div>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                ['01', 'Spot risks earlier'],
                ['02', 'Inspect evidence'],
                ['03', 'Plan with control'],
              ].map(([number, label], i) => (
                <motion.div
                  key={number}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.12, duration: 0.5 }}
                >
                  <p className="font-mono text-xs text-violet-300">{number}</p>
                  <p className="mt-2 text-sm leading-5 text-[#B7ADC9]">{label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <DashboardMockup />
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 border-t border-white/[0.07] pt-7 text-xs text-[#827795] sm:justify-between">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-300" /> Explainable by design</span>
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-300" /> People stay in control</span>
            <span className="flex items-center gap-2"><Database className="h-4 w-4 text-violet-300" /> Grounded in project data</span>
          </div>
        </div>
      </section>

      {/* THE CHALLENGE */}
      <section className="relative bg-[#140E23] py-20 sm:py-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/20 to-transparent" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="The delivery challenge"
            title="Project delays rarely happen without warning."
            description="Risks grow when updates, blockers, dependencies, and team availability are scattered across tools. WorkPilot brings those signals together."
          />

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Layers3, number: '01', title: 'Fragmented visibility', text: 'Task trackers, leave calendars, and progress notes often live separately, hiding the full delivery picture.' },
              { icon: AlertTriangle, number: '02', title: 'Late blocker discovery', text: 'A blocked prerequisite can stall downstream work before the delay reaches a milestone.' },
              { icon: Compass, number: '03', title: 'Slow recovery planning', text: 'Managers need to compare dependencies, workloads, and trade-offs before deciding how to recover.' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.number} delay={i * 0.12}>
                  <motion.article
                    whileHover={reduceMotion ? undefined : { y: -8, scale: 1.015 }}
                    className="group h-full rounded-2xl border border-violet-200/[0.1] bg-gradient-to-br from-[#211638] to-[#181126] p-6 transition-colors hover:border-violet-300/30 hover:shadow-[0_20px_60px_rgba(91,33,182,.12)] sm:p-7"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-violet-300">{item.number}</span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-200/10 bg-violet-300/[0.06] text-violet-300 transition duration-300 group-hover:rotate-6 group-hover:scale-110">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="mt-7 text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#B7ADC9]">{item.text}</p>
                    <div className="mt-6 h-px w-full overflow-hidden bg-white/[0.07]">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: '35%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-300"
                      />
                    </div>
                  </motion.article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="relative overflow-hidden bg-[#100B1D] py-20 sm:py-24">
        <GlowOrb className="-left-48 top-1/3 h-96 w-96 bg-indigo-600/15" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="The WorkPilot workflow"
            title="From project updates to confident decisions."
            description="Structured data helps determine the risk. AI helps formulate a response. People remain accountable for consequential changes."
          />

          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="pointer-events-none absolute left-[8%] right-[8%] top-6 hidden h-px bg-gradient-to-r from-violet-500/0 via-violet-300/40 to-violet-500/0 lg:block" />
            {workflow.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={i * 0.1}>
                  <motion.article
                    whileHover={reduceMotion ? undefined : { y: -7 }}
                    className="relative h-full rounded-2xl border border-violet-200/10 bg-[#19112B]/90 p-5 transition-colors hover:border-violet-300/35 hover:bg-[#211638]"
                  >
                    <motion.div
                      whileHover={reduceMotion ? undefined : { rotate: 10, scale: 1.08 }}
                      className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/20 bg-[#211638] text-violet-300 shadow-[0_0_25px_rgba(139,92,246,.12)]"
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    <p className="mt-5 font-mono text-[10px] font-bold tracking-widest text-violet-300">STEP 0{i + 1}</p>
                    <h3 className="mt-3 text-sm font-semibold leading-6 text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#A99DBB]">{step.description}</p>
                  </motion.article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative bg-[#140E23] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="Platform capabilities"
            title="Built for project rigor and explainability."
            description="A connected toolkit for planning, risk analysis, recovery, and accountable execution."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={(i % 4) * 0.07}>
                  <motion.article
                    whileHover={reduceMotion ? undefined : { y: -8, scale: 1.015 }}
                    className="group flex h-full flex-col rounded-2xl border border-violet-200/[0.1] bg-[#1B132B] p-6 transition-colors duration-300 hover:border-violet-300/35 hover:bg-[#211638] hover:shadow-[0_20px_60px_rgba(91,33,182,.13)]"
                  >
                    <motion.div
                      whileHover={reduceMotion ? undefined : { rotate: 8, scale: 1.12 }}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-400/20 to-indigo-400/10 text-violet-300"
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    <h3 className="mt-5 font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-7 text-[#B7ADC9]">{feature.description}</p>
                    <div className="mt-5 flex items-center gap-2 border-t border-white/[0.07] pt-4 text-[9px] font-bold tracking-[.12em] text-violet-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {feature.label}
                    </div>
                  </motion.article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* INTERACTIVE PREVIEW */}
      <section id="preview" className="relative overflow-hidden bg-[#100B1D] py-20 sm:py-24">
        <GlowOrb className="-left-40 top-20 h-96 w-96 bg-violet-600/20" />
        <GlowOrb className="-right-40 bottom-0 h-96 w-96 bg-indigo-600/20" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            centered
            eyebrow="Platform explorer"
            title="A clearer view of the work that matters."
            description="Explore sample screens to see how project visibility, risk signals, and recovery proposals fit together."
          />

          <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Product preview screens">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`preview-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="preview-panel"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 ${
                  activeTab === tab.id
                    ? 'border-violet-300/50 bg-violet-300 text-[#1A1030] shadow-[0_0_25px_rgba(167,139,250,.18)]'
                    : 'border-violet-200/10 bg-white/[0.025] text-[#B7ADC9] hover:border-violet-300/30 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id="preview-panel"
            role="tabpanel"
            aria-labelledby={`preview-tab-${activeTab}`}
            className="mx-auto min-h-[340px] max-w-5xl rounded-2xl border border-violet-200/15 bg-gradient-to-br from-[#211638] to-[#171025] p-4 shadow-[0_25px_90px_rgba(0,0,0,.25)] sm:p-7"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={reduceMotion ? false : { opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === 'overview' && (
                  <div className="space-y-5">
                    <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-lg font-semibold text-white">Enterprise Cloud Migration</p>
                        <p className="mt-1 text-sm text-[#9287A8]">Sample manager view · 6 total tasks</p>
                      </div>
                      <span className="w-fit rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-bold text-rose-200">HIGH RISK · 88/100</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ['Active tasks', '5'],
                        ['Completion', '68%'],
                        ['Active blockers', '1'],
                        ['Pending leave', '1'],
                      ].map(([label, value], i) => (
                        <motion.div
                          key={label}
                          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
                        >
                          <p className="text-xs text-[#9287A8]">{label}</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                        </motion.div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                      <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
                        <span className="font-medium text-[#E8E0F5]">Illustrative project progress</span>
                        <span className="font-semibold text-rose-300">Risk needs review</span>
                      </div>
                      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
                        <motion.div initial={{ width: 0 }} animate={{ width: '45%' }} transition={{ duration: 1 }} className="bg-violet-400" />
                        <motion.div initial={{ width: 0 }} animate={{ width: '23%' }} transition={{ duration: 1, delay: .15 }} className="bg-sky-300" />
                        <motion.div initial={{ width: 0 }} animate={{ width: '12%' }} transition={{ duration: 1, delay: .3 }} className="bg-rose-400" />
                        <motion.div initial={{ width: 0 }} animate={{ width: '20%' }} transition={{ duration: 1, delay: .45 }} className="bg-[#655775]" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#9287A8]">
                        <span>Completed</span><span>In progress</span><span>Blocked</span><span>Remaining</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { title: 'To do', color: 'text-[#B7ADC9]', tasks: [['#4 · Critical', 'Risk engine event streaming', '36 hours estimated'], ['#6 · High', 'End-to-end security testing', '16 hours estimated']] },
                      { title: 'In progress', color: 'text-sky-300', tasks: [['#2 · High', 'Database schema', '75% complete'], ['#5 · Medium', 'Executive dashboard UI', '30% complete']] },
                      { title: 'Blocked', color: 'text-rose-300', tasks: [['#3 · Critical', 'Authentication and SSO', 'Waiting on credentials']] },
                    ].map((column, i) => (
                      <div key={column.title} className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className={`mb-3 text-xs font-bold uppercase tracking-wider ${column.color}`}>{column.title} ({column.tasks.length})</p>
                        <div className="space-y-3">
                          {column.tasks.map(([id, title, detail], j) => (
                            <motion.div
                              key={id}
                              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * .1 + j * .08 }}
                              whileHover={reduceMotion ? undefined : { x: 3 }}
                              className="rounded-lg border border-white/[0.08] bg-[#160F25] p-3"
                            >
                              <p className="text-[10px] font-semibold text-[#827795]">{id}</p>
                              <p className="mt-1 text-sm font-semibold text-[#F5F0FF]">{title}</p>
                              <p className="mt-2 text-xs leading-5 text-[#9287A8]">{detail}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'risk' && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] p-4">
                      <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-rose-300" />
                      <div>
                        <h3 className="font-semibold text-rose-100">High delivery risk · Sample score 88/100</h3>
                        <p className="mt-1 text-sm leading-6 text-[#B7ADC9]">This illustrative scenario contains signals that require manager review.</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        ['ACTIVE_BLOCKER', 'Active blocker', 'A blocked task may prevent a dependent task from progressing.'],
                        ['LEAVE_CONFLICT', 'Capacity conflict', 'An assignment may overlap with an approved absence.'],
                        ['SCHEDULE_SLACK', 'Limited schedule slack', 'The milestone has less remaining buffer than planned.'],
                        ['DATA_QUALITY', 'Evidence check', 'Risk results depend on accurate estimates and current updates.'],
                      ].map(([rule, title, detail], i) => (
                        <motion.div key={rule} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                          <p className="font-mono text-[10px] text-violet-300">{rule}</p>
                          <h4 className="mt-2 text-sm font-semibold text-white">{title}</h4>
                          <p className="mt-1 text-sm leading-6 text-[#A99DBB]">{detail}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'recovery' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-violet-300/20 bg-violet-400/[0.07] p-4">
                      <div className="flex items-center gap-2 font-semibold text-violet-100"><Sparkles className="h-5 w-5" /> Recovery proposal · Demo</div>
                      <p className="mt-2 text-sm leading-6 text-[#B7ADC9]">Illustrative suggestions for a manager to review. This preview does not modify any task.</p>
                    </div>
                    {[
                      ['01', 'Review reassignment', 'Check whether another available team member has the required skills and capacity.'],
                      ['02', 'Resolve the blocker', 'Identify the prerequisite preventing downstream work from progressing.'],
                      ['03', 'Reassess the milestone', 'Compare remaining effort with available schedule slack.'],
                    ].map(([number, title, detail], i) => (
                      <motion.div key={number} initial={reduceMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .1 }} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/15 font-mono text-xs font-bold text-violet-200">{number}</span>
                        <div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-[#A99DBB]">{detail}</p></div>
                      </motion.div>
                    ))}
                    <p className="text-xs text-[#827795]">Manager approval required before consequential changes.</p>
                  </div>
                )}

                {activeTab === 'leave' && (
                  <div className="space-y-4">
                    {[
                      { initials: 'MC', name: 'Marcus Chen', role: 'Lead Cloud Systems Architect', status: 'Sample: leave scheduled', color: 'border-amber-300/20 bg-amber-300/10 text-amber-200' },
                      { initials: 'ER', name: 'Elena Rostova', role: 'Senior Full-Stack Engineer', status: 'Sample: capacity available', color: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' },
                    ].map((person, i) => (
                      <motion.div key={person.name} initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .1 }} className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/10 font-semibold text-violet-200">{person.initials}</div>
                          <div><h3 className="font-semibold text-white">{person.name}</h3><p className="mt-1 text-sm text-[#9287A8]">{person.role}</p></div>
                        </div>
                        <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${person.color}`}>{person.status}</span>
                      </motion.div>
                    ))}
                    <p className="text-xs leading-5 text-[#827795]">Sample statuses only. Live capacity should come from approved leave, allocations, and the working calendar.</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="mt-4 text-center text-xs text-[#827795]">Demo interface · Values are illustrative, not live metrics.</p>
        </div>
      </section>

      {/* RESPONSIBLE AI */}
      <section id="security" className="relative bg-[#140E23] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="Responsible project intelligence"
            title="AI assistance. Human accountability."
            description="Make recommendations inspectable, restrict access by role, and keep consequential project changes under authorized human control."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: LockKeyhole, title: 'Backend-enforced access', text: 'Authenticate requests and enforce role and project permissions on the server.' },
              { icon: ShieldCheck, title: 'Validated AI proposals', text: 'Validate proposal schemas, task IDs, assignees, and constraints before review.' },
              { icon: Users, title: 'Human approval gate', text: 'Require authorized approval before consequential schedule or assignment changes.' },
              { icon: Activity, title: 'Transparent work signals', text: 'Use project progress and reported blockers rather than intrusive device surveillance.' },
              { icon: Database, title: 'Missing-data awareness', text: 'Identify incomplete estimates and stale inputs instead of presenting unsupported predictions.' },
              { icon: Workflow, title: 'Resilient workflows', text: 'Keep core project features independent of optional LLM services where possible.' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={(i % 3) * .08}>
                  <motion.article whileHover={reduceMotion ? undefined : { y: -5 }} className="h-full rounded-2xl border border-violet-200/10 bg-[#1B132B] p-6 transition-colors hover:border-violet-300/30 hover:bg-[#211638]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-violet-300"><Icon className="h-5 w-5" /></div>
                    <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#B7ADC9]">{item.text}</p>
                  </motion.article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative bg-[#100B1D] py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Reveal className="mb-10 text-center">
            <motion.div whileHover={reduceMotion ? undefined : { rotate: 12, scale: 1.05 }} className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-violet-200/15 bg-[#211638] text-violet-300">
              <CircleHelp className="h-5 w-5" />
            </motion.div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-violet-300">Frequently asked questions</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Everything you need to know.</h2>
          </Reveal>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              const answerId = `faq-answer-${i}`;

              return (
                <div key={faq.question} className={`overflow-hidden rounded-xl border bg-[#19112B] transition-colors ${isOpen ? 'border-violet-300/30' : 'border-violet-200/10'}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-semibold text-white transition hover:text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 sm:p-5 sm:text-base"
                  >
                    <span>{faq.question}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: .25 }} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isOpen ? 'bg-violet-400/15 text-violet-200' : 'bg-white/[0.04] text-[#9287A8]'}`}>
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={answerId}
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: .3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-white/[0.07] px-4 pb-5 pt-4 text-sm leading-7 text-[#B7ADC9] sm:px-5">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative isolate overflow-hidden border-t border-violet-300/10 bg-[#140E23] py-20 sm:py-28">
        <GlowOrb className="-right-20 -top-20 h-80 w-80 bg-violet-600/25" />
        <GlowOrb className="-bottom-28 -left-20 h-80 w-80 bg-indigo-600/20" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(226,210,255,.07)_1px,transparent_0)] [background-size:26px_26px]" />

        <Reveal className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -5, 0], rotate: [0, 3, -3, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200/20 bg-violet-400/10 text-violet-300 shadow-[0_0_35px_rgba(139,92,246,.18)]"
          >
            <Zap className="h-6 w-6" />
          </motion.div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[.22em] text-violet-300">Ready to move forward?</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl lg:text-6xl">
            Make your next project
            <span className="mt-2 block bg-gradient-to-r from-[#F1E9FF] via-[#BCA4FF] to-[#8B5CF6] bg-clip-text text-transparent">easier to steer.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-8 text-[#B7ADC9] sm:text-lg">
            Bring project execution and delivery risk into one view. Give your team the context to act earlier and the control to act responsibly.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={user ? workspacePath : '/signup'} className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-[#C4B5FD] px-7 py-3.5 text-sm font-bold text-[#211638] shadow-[0_8px_35px_rgba(139,92,246,.2)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_45px_rgba(139,92,246,.35)]">
              {user ? 'Go to workspace' : 'Get started free'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {!user && (
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200/20 bg-white/[0.035] px-7 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-1 hover:border-violet-300/40 hover:bg-violet-300/[0.06]">
                Sign in <MoveUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <p className="mt-6 text-xs text-[#827795]">Project intelligence with transparent signals and human-controlled decisions.</p>
        </Reveal>
      </section>

      <Footer />
    </main>
  );
};

export default LandingPage;
