import React from 'react';
import { AlertTriangle, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

interface RiskBadgeProps {
  level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level = 'LOW',
  score,
  size = 'md',
  showIcon = true
}) => {
  const configs = {
    LOW: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'On Track / Low Risk'
    },
    MEDIUM: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      dot: 'bg-amber-500',
      icon: AlertTriangle,
      label: 'Attention / Medium Risk'
    },
    HIGH: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      dot: 'bg-rose-500',
      icon: AlertOctagon,
      label: 'Critical / High Risk'
    },
    INSUFFICIENT_DATA: {
      bg: 'bg-charcoal-100 border-charcoal-200 text-charcoal-700',
      dot: 'bg-charcoal-400',
      icon: HelpCircle,
      label: 'Insufficient Data'
    }
  };

  const current = configs[level] || configs.LOW;
  const Icon = current.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-medium'
  };

  return (
    <span className={`inline-flex items-center rounded-full border ${current.bg} ${sizeClasses[size]} font-medium transition-colors`}>
      {showIcon && <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{current.label}</span>
      {score !== undefined && level !== 'INSUFFICIENT_DATA' && (
        <span className="opacity-75 text-[0.9em]">({score}/100)</span>
      )}
    </span>
  );
};
