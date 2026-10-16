
import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
} from 'lucide-react';

interface RiskBadgeProps {
  level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const configs = {
  LOW: {
    bg: 'bg-emerald-400/10 border-emerald-400/20 text-emerald-300',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
    label: 'On Track / Low Risk',
  },
  MEDIUM: {
    bg: 'bg-amber-400/10 border-amber-400/20 text-amber-300',
    dot: 'bg-amber-400',
    icon: AlertTriangle,
    label: 'Attention / Medium Risk',
  },
  HIGH: {
    bg: 'bg-rose-400/10 border-rose-400/20 text-rose-300',
    dot: 'bg-rose-400',
    icon: AlertOctagon,
    label: 'Critical / High Risk',
  },
  INSUFFICIENT_DATA: {
    bg: 'bg-violet-400/10 border-violet-300/20 text-violet-200',
    dot: 'bg-violet-300',
    icon: HelpCircle,
    label: 'Insufficient Data',
  },
} as const;

const sizeClasses = {
  sm: 'text-[10px] px-2 py-1 gap-1',
  md: 'text-xs px-2.5 py-1.5 gap-1.5',
  lg: 'text-sm px-3.5 py-2 gap-2 font-medium',
} as const;

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level = 'LOW',
  score,
  size = 'md',
  showIcon = true,
}) => {
  const current = configs[level];
  const Icon = current.icon;

  return (
    <span
      role="status"
      className={[
        'inline-flex items-center whitespace-nowrap rounded-full border',
        current.bg,
        sizeClasses[size],
        'font-medium backdrop-blur-sm transition-colors duration-200',
      ].join(' ')}
    >
      {showIcon && (
        <Icon
          className={size === 'lg' ? 'h-4 w-4 shrink-0' : 'h-3.5 w-3.5 shrink-0'}
          aria-hidden="true"
        />
      )}

      <span>{current.label}</span>

      {score !== undefined && level !== 'INSUFFICIENT_DATA' && (
        <span className="ml-0.5 tabular-nums opacity-75">
          ({score}/100)
        </span>
      )}
    </span>
  );
};
