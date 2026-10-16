
import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'forest';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  action,
}) => {
  const variantStyles = {
    default: {
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-300',
      border: 'hover:border-violet-400/40',
      glow: 'group-hover:bg-violet-500/[0.06]',
    },
    success: {
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-300',
      border: 'hover:border-emerald-400/40',
      glow: 'group-hover:bg-emerald-500/[0.05]',
    },
    warning: {
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-300',
      border: 'hover:border-amber-400/40',
      glow: 'group-hover:bg-amber-500/[0.05]',
    },
    danger: {
      iconBg: 'bg-rose-500/15',
      iconColor: 'text-rose-300',
      border: 'hover:border-rose-400/40',
      glow: 'group-hover:bg-rose-500/[0.05]',
    },
    forest: {
      iconBg: 'bg-indigo-500/15',
      iconColor: 'text-indigo-300',
      border: 'hover:border-indigo-400/40',
      glow: 'group-hover:bg-indigo-500/[0.05]',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`
        group relative flex min-h-[156px] flex-col justify-between
        overflow-hidden rounded-2xl border border-violet-200/10
        bg-[#19112B] p-5 text-[#FAF8FF]
        shadow-[0_8px_30px_rgba(0,0,0,0.15)]
        transition-all duration-300
        hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.25)]
        ${style.border}
      `}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-colors duration-300 ${style.glow}`}
      />

      <div
        aria-hidden="true"
        className="absolute left-5 right-5 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent"
      />

      {/* Title, value and icon */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C4B6DB]">
            {title}
          </p>

          <p className="mt-3 break-words text-3xl font-bold tracking-tight text-white">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 ${style.iconBg}`}
        >
          <Icon className={`h-5 w-5 ${style.iconColor}`} />
        </div>
      </div>

      {/* Subtitle and action */}
      {(subtitle || action) && (
        <div className="relative mt-5 flex min-h-8 flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          {subtitle && (
            <span className="min-w-0 text-xs leading-5 text-[#C4B6DB]">
              {subtitle}
            </span>
          )}

          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="dashboard-stat-action
                ml-auto inline-flex shrink-0 items-center gap-1.5
                rounded-lg border border-violet-400/25
                bg-violet-500/10 px-3 py-2
                text-xs font-bold text-violet-200
                transition-all duration-200
                hover:border-violet-300/50 hover:bg-violet-500/20
                hover:text-white
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-violet-400
              "
            >
              {action.label}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
