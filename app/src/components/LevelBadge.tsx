"use client";

export type LevelType = "Bronze" | "Silver" | "Gold" | null;

interface LevelBadgeProps {
  level: LevelType;
  boost: number;
  isActive?: boolean;
  size?: "sm" | "md" | "lg";
}

export const LevelBadge = ({ level, boost, isActive = true, size = "md" }: LevelBadgeProps) => {
  const getSizeClass = () => {
    if (size === "sm") return "text-xs px-2 py-1";
    if (size === "lg") return "text-xl px-6 py-4";
    return "text-base px-4 py-2";
  };

  const getIconSize = () => {
    if (size === "lg") return "text-4xl";
    if (size === "md") return "text-2xl";
    return "text-lg";
  };

  if (!level) {
    return (
      <div className={`level-badge-none ${getSizeClass()}`}>
        <span className="text-gray-500">Aucun NFT</span>
        <span className="text-gray-400 text-xs ml-2">Lock $BACK pour débloquer</span>
      </div>
    );
  }

  const levelConfig = {
    Bronze: {
      gradient: "from-amber-700 via-amber-600 to-amber-800",
      glow: "shadow-amber-500/50",
      icon: "🥉",
      color: "text-amber-300",
    },
    Silver: {
      gradient: "from-gray-300 via-gray-100 to-gray-400",
      glow: "shadow-gray-400/50",
      icon: "🥈",
      color: "text-gray-100",
    },
    Gold: {
      gradient: "from-yellow-500 via-yellow-300 to-yellow-600",
      glow: "shadow-yellow-400/50",
      icon: "🥇",
      color: "text-yellow-200",
    },
  };

  const config = levelConfig[level];
  const sizeClasses = {
    sm: "text-sm px-3 py-1.5",
    md: "text-base px-4 py-2",
    lg: "text-2xl px-6 py-4",
  };

  return (
    <div
      className={`
        relative inline-flex items-center gap-2 rounded-xl
        bg-gradient-to-r ${config.gradient}
        ${sizeClasses[size]}
        ${isActive ? `shadow-lg ${config.glow} animate-pulse-glow` : "opacity-50 grayscale"}
        font-bold ${config.color}
        transition-all duration-300 hover:scale-105 hover:shadow-xl
        border-2 border-white/20
      `}
    >
      <span className={`${getIconSize()} animate-bounce-slow`}>
        {config.icon}
      </span>
      <div className="flex flex-col">
        <span className="font-extrabold tracking-wide">{level}</span>
        <span className={`${size === "sm" ? "text-xs" : "text-sm"} opacity-90 font-semibold`}>
          +{boost}% boost
        </span>
      </div>
      {!isActive && (
        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-0.5 rounded-bl-lg rounded-tr-xl font-bold border border-red-400">
          Inactif
        </span>
      )}
    </div>
  );
};
