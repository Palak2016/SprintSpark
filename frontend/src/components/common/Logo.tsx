
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
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const textMap = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`group inline-flex items-center gap-2.5 ${className}`}>
      {/* Logo Icon */}
      <div
        className={`
          workpilot-logo-icon
          relative flex shrink-0 items-center justify-center
          overflow-hidden rounded-xl
          border border-violet-300/20
          bg-gradient-to-br from-violet-400 via-violet-500 to-indigo-600
          text-white
          shadow-[0_4px_18px_rgba(139,92,246,0.25)]
          transition-all duration-300
          group-hover:scale-105
          group-hover:shadow-[0_6px_26px_rgba(139,92,246,0.4)]
          ${sizeMap[size]}
        `}
      >
        {/* Subtle inner glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10"
        />

        {/* WorkPilot W + Forward Arrow */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 h-[76%] w-[76%]"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6L7.5 18L11 11L14.5 18L19 6" />
          <path d="M15 12L21 6" />
          <path d="M16 6H21V11" />
        </svg>
      </div>

      {/* Brand Name */}
      {showText && (
        <span
          className={`
            whitespace-nowrap font-semibold tracking-tight
            ${textMap[size]}
            ${onDarkBackground ? 'text-white' : 'text-[#FAF8FF]'}
          `}
        >
          WorkPilot
          <span className="ml-1 font-normal text-[#A78BFA]">
            AI
          </span>
        </span>
      )}
    </div>
  );
};

export default Logo;
