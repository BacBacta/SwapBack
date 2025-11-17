"use client";

import Image from "next/image";

interface LogoProps {
  withText?: boolean;
  size?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * SwapBack Logo Component
 * Displays either the full logo with text or just the icon
 * 
 * @param withText - Show the complete logo with text (true) or just the icon (false)
 * @param size - Height/width of the logo in pixels (default: 32)
 * @param className - Additional CSS classes
 * @param onClick - Optional click handler
 */
export default function Logo({
  withText = true,
  size = 32,
  className = "",
  onClick,
}: LogoProps) {
  const altText = withText ? "SwapBack Logo" : "SwapBack Icon";
  const wordmarkFontSize = Math.round(size * 0.9);

  const icon = (
    <Image
      src="/icons/icon_swapback.svg"
      alt={altText}
      width={size}
      height={size}
      className="transition-transform hover:scale-110"
      priority
    />
  );

  const wordmark = withText ? (
    <span
      className="swapback-wordmark"
      style={{ fontSize: `${wordmarkFontSize}px` }}
      aria-hidden="true"
    >
      <span className="swapback-wordmark__swap">SWAP</span>
      <span className="swapback-wordmark__back">BACK</span>
    </span>
  ) : null;

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer ${className}`}
        aria-label={altText}
      >
        {icon}
        {wordmark}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {icon}
      {wordmark}
    </div>
  );
}
