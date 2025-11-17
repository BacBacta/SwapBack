"use client";

import Image from "next/image";

interface BrandProps {
  size?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * SwapBack Brand Component
 * Displays the icon + text logo side by side
 * 
 * @param size - Height of the icon in pixels (default: 32)
 * @param className - Additional CSS classes
 * @param onClick - Optional click handler
 */
export default function Brand({ 
  size = 32,
  className = "",
  onClick 
}: BrandProps) {
  // Calculate text height proportionally (slightly larger than icon)
  const textHeight = Math.round(size * 1.2);
  // Text width is approximately 4x its height to maintain original proportions
  const textWidth = Math.round(textHeight * 4);

  const content = (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Image 
        src="/icons/icon_swapback.svg"
        alt="Icône SwapBack"
        width={size}
        height={size}
        className="shrink-0 transition-transform hover:scale-110"
        priority
      />
      <Image 
        src="/icons/swapback_text_with_bg.png"
        alt="Logo texte SwapBack"
        width={textWidth}
        height={textHeight}
        className="shrink-0"
        priority
      />
    </div>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="hover:opacity-90 transition-opacity cursor-pointer"
        aria-label="SwapBack - Retour à l'accueil"
      >
        {content}
      </button>
    );
  }

  return content;
}
