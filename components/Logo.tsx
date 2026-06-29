import React from "react";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export default function Logo({ className = "h-8 w-8", iconOnly = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        className={className}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" /> {/* Blue */}
            <stop offset="50%" stopColor="#6366f1" /> {/* Indigo */}
            <stop offset="100%" stopColor="#a855f7" /> {/* Purple */}
          </linearGradient>
          <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer glowing shield/hexagon boundary */}
        <path
          d="M50 8 L85 28 L85 72 L50 92 L15 72 L15 28 Z"
          stroke="url(#logo-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
        />

        {/* Main Logo Geometry: Stylized Digital Canvas / Book & Pen */}
        <path
          d="M50 25 L80 40 L50 55 L20 40 Z"
          fill="url(#logo-gradient)"
          opacity="0.85"
        />
        <path
          d="M20 40 L20 65 L50 80 L50 55 Z"
          fill="url(#logo-gradient)"
          opacity="0.7"
        />
        <path
          d="M50 55 L50 80 L80 65 L80 40 Z"
          fill="url(#logo-gradient)"
          opacity="0.95"
        />

        {/* Central glowing core node representing connection/sync */}
        <circle
          cx="50"
          cy="40"
          r="6"
          fill="#ffffff"
          filter="url(#logo-glow)"
        />
      </svg>
      {!iconOnly && (
        <span className="text-base font-bold tracking-tight text-white bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent">
          EdTech Canvas
        </span>
      )}
    </div>
  );
}
