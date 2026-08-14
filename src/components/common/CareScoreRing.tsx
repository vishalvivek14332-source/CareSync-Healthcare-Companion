import React from 'react';

interface CareScoreRingProps {
  score: number; // 0 - 100
  size?: number; // width & height in px
  strokeWidth?: number;
  showDetails?: boolean;
  showInnerLabel?: boolean;
}

export const CareScoreRing: React.FC<CareScoreRingProps> = ({
  score,
  size = 120,
  strokeWidth = 10,
  showDetails = true,
  showInnerLabel,
}) => {
  const center = size / 2;
  const radius = Math.max(1, center - strokeWidth);
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const shouldShowInnerLabel = showInnerLabel !== undefined ? showInnerLabel : size >= 70;
  const gradientId = `careScoreGrad-${score}-${size}`;

  // Determine color based on score range
  let gradientStart = '#0d9488'; // teal-600
  let gradientEnd = '#0284c7'; // sky-600
  let statusText = 'Excellent Routine';

  if (score < 60) {
    gradientStart = '#e11d48'; // rose-600
    gradientEnd = '#f59e0b'; // amber-500
    statusText = 'Needs Attention';
  } else if (score < 80) {
    gradientStart = '#d97706'; // amber-600
    gradientEnd = '#0284c7'; // sky-600
    statusText = 'Good Progress';
  }

  // Dynamic font sizing if inner label is enabled
  let scoreFontSize = 'text-3xl';
  let subtitleFontSize = 'text-[10px]';

  if (size < 80) {
    scoreFontSize = 'text-sm';
    subtitleFontSize = 'text-[8px]';
  } else if (size < 110) {
    scoreFontSize = 'text-xl';
    subtitleFontSize = 'text-[9px]';
  }

  return (
    <div className="flex flex-col items-center justify-center shrink-0">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradientStart} />
              <stop offset="100%" stopColor={gradientEnd} />
            </linearGradient>
          </defs>
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="stroke-slate-100"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {shouldShowInnerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
            <span className={`${scoreFontSize} font-extrabold text-slate-800 tracking-tight leading-none`}>
              {score}
            </span>
            <span className={`${subtitleFontSize} font-semibold text-slate-400 uppercase tracking-wider mt-0.5`}>
              / 100
            </span>
          </div>
        )}
      </div>
      {showDetails && (
        <div className="mt-2 text-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {statusText}
          </span>
        </div>
      )}
    </div>
  );
};
