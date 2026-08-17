import React from 'react';

interface TimerProps {
  secondsLeft: number;
  total: number;
}

export default function Timer({ secondsLeft, total }: TimerProps) {
  const clamped = Math.max(0, Math.min(secondsLeft, total));
  const pct = total > 0 ? clamped / total : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const urgent = clamped <= 5;

  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={urgent ? '#ef4444' : '#FFD700'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-2xl sm:text-3xl font-extrabold ${urgent ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
        {clamped}
      </div>
    </div>
  );
}
