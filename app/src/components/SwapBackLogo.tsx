"use client";

import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  onClick?: () => void;
}

export default function SwapBackLogo({ 
  size = 32, 
  className = "", 
  showText = true,
  onClick 
}: LogoProps) {
  const content = (
    <>
      <Image 
        src="/231305681[1].svg" 
        alt="SwapBack Logo" 
        width={size} 
        height={size}
        className="transition-transform hover:scale-110"
        priority
      />
      {showText && (
        <span className="text-xl font-bold terminal-text uppercase tracking-wider">
          SWAPBACK
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-3 hover:text-[var(--accent)] transition-colors cursor-pointer ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {content}
    </div>
  );
}
