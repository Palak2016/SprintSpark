
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
          overflow-hidden rounded-full
          border border-[#B4BCC4]
          bg-[#1C2025]
          text-white
          transition-all duration-300
          group-hover:scale-105
          ${sizeMap[size]}
        `}
      >
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
          <path d="M4 6L7.5 18L12 11L16.5 18L20 6" />
          <path d="M13.5 12.5L20 6" />
          <path d="M15.5 6H20V10.5" />
        </svg>
      </div>

      {/* Brand Name */}
      {showText && (
        <span
          className={`
            workpilot-logo-name whitespace-nowrap font-semibold tracking-tight
            ${textMap[size]}
          `}
        >
          WorkPilot
          <span className="workpilot-logo-ai ml-1 font-normal">
            AI
          </span>
        </span>
      )}
    </div>
  );
};

export default Logo;
