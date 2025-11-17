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
  onClick 
}: LogoProps) {
  const logoSrc = withText ? "/icons/Logo.svg" : "/icons/icon_swapback.svg";
  const altText = withText ? "SwapBack Logo" : "SwapBack Icon";
  
  // Calculate width based on whether text is shown
  // Icon is square, full logo is wider
  const width = withText ? size * 3.5 : size;
  const height = size;

  const imageElement = (
    <Image 
      src={logoSrc}
      alt={altText}
      width={width}
      height={height}
      className="transition-transform hover:scale-110"
      priority
    />
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer ${className}`}
        aria-label={altText}
      >
        {imageElement}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      {imageElement}
    </div>
  );
}
