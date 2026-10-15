import React from 'react';
import { LucideIcon } from 'lucide-react';

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
  action
}) => {
  const variantStyles = {
    default: {
      bg: 'bg-white',
      border: 'border-charcoal-100',
      iconBg: 'bg-charcoal-50 text-charcoal-700',
    },
    success: {
      bg: 'bg-white',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-50 text-emerald-700',
    },
    warning: {
      bg: 'bg-white',
      border: 'border-amber-100',
      iconBg: 'bg-amber-50 text-amber-700',
    },
    danger: {
      bg: 'bg-white',
      border: 'border-rose-100',
      iconBg: 'bg-rose-50 text-rose-700',
    },
    forest: {
      bg: 'bg-white',
      border: 'border-forest-100',
      iconBg: 'bg-forest-50 text-forest-700',
    }
  };

  const style = variantStyles[variant];

  return (
    <div className={`p-5 rounded-xl border ${style.border} ${style.bg} shadow-card transition-all hover:shadow-md flex flex-col justify-between`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-charcoal-900 mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${style.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {(subtitle || action) && (
        <div className="mt-3 pt-3 border-t border-charcoal-50 flex items-center justify-between text-xs">
          {subtitle && <span className="text-charcoal-500">{subtitle}</span>}
          {action && (
            <button
              onClick={action.onClick}
              className="text-forest-700 hover:text-forest-800 font-semibold hover:underline ml-auto"
            >
              {action.label} →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
