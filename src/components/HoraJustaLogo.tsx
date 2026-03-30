import React from 'react';

interface HoraJustaLogoProps {
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
}

const HoraJustaLogo: React.FC<HoraJustaLogoProps> = ({
  size = 40,
  showText = false,
  showTagline = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hjBg" x1="10" y1="10" x2="70" y2="70" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1a3a6b" />
            <stop offset="0.5" stopColor="#2b8a8a" />
            <stop offset="1" stopColor="#4ECDC4" />
          </linearGradient>
          <linearGradient id="hjShadow" x1="40" y1="60" x2="40" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1a3a6b" stopOpacity="0.3" />
            <stop offset="1" stopColor="#1a3a6b" stopOpacity="0" />
          </linearGradient>
          <filter id="hjDrop" x="0" y="0" width="100%" height="100%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1a3a6b" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Speech bubble tail */}
        <path
          d="M18 58 L24 68 L32 58"
          fill="url(#hjBg)"
        />

        {/* Main circle body */}
        <circle cx="40" cy="36" r="28" fill="url(#hjBg)" filter="url(#hjDrop)" />

        {/* Inner ring */}
        <circle cx="40" cy="36" r="21" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />

        {/* Clock tick marks */}
        {[0, 90, 180, 270].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 40 + Math.sin(rad) * 18;
          const y1 = 36 - Math.cos(rad) * 18;
          const x2 = 40 + Math.sin(rad) * 21;
          const y2 = 36 - Math.cos(rad) * 21;
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Check mark (✓) as clock hands */}
        <path
          d="M30 37 L37 44 L52 27"
          stroke="white"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight leading-tight">
            <span className="text-primary">Hora </span>
            <span className="text-accent">Justa</span>
          </span>
          {showTagline && (
            <span className="text-[10px] text-muted-foreground leading-tight">
              Controle suas horas. Conheça seu valor.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default HoraJustaLogo;
