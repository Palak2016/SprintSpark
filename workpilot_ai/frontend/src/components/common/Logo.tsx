import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  onDarkBackground?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  onDarkBackground = false,
}) => {
  const sizeMap = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  const textMap = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`relative flex items-center justify-center rounded-lg ${
        onDarkBackground
          ? 'bg-charcoal-700 text-white'
          : 'bg-forest-700 text-white'
      } shadow-sm transition-transform hover:scale-105 ${sizeMap[size]}`}>
        {/* Geometric Abstract W with Forward Movement Arrow */}
        <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6l4.5 12 3.5-7 3.5 7 4.5-12" />
          <path d="M17 6h4v4" />
          <path d="M21 6l-6 6" />
        </svg>
      </div>
      {showText && (
        <span className={`font-semibold tracking-tight ${
          onDarkBackground ? 'text-white' : 'text-charcoal-900'
        } ${textMap[size]}`}>
          WorkPilot <span className={`font-normal ${
            onDarkBackground ? 'text-charcoal-300' : 'text-forest-700'
          }`}>AI</span>
        </span>
      )}
    </div>
  );
};
