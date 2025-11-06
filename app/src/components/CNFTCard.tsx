"use client";

import { LevelBadge, LevelType } from "./LevelBadge";

interface CNFTCardProps {
  level: LevelType;
  boost: number;
  lockedAmount: number;
  lockDuration: number; // en jours
  isActive: boolean;
  unlockDate?: Date;
}

export const CNFTCard = ({
  level,
  boost,
  lockedAmount,
  lockDuration,
  isActive,
  unlockDate,
}: CNFTCardProps) => {
  const formatDate = (date?: Date) => {
    if (!date) return "N/A";
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const daysRemaining = unlockDate
    ? Math.max(
        0,
        Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : 0;

  const getRemainingDaysColor = () => {
    if (daysRemaining > 30) return "text-green-400";
    if (daysRemaining > 7) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="swap-card hover:border-[var(--primary)] transition-all duration-300 relative overflow-hidden group">
      {/* Effet CRT Terminal */}
      <div className="absolute inset-0 bg-[var(--primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-transparent border-2 border-[var(--primary)] group-hover:bg-[var(--primary)]/10 transition-all">
              <span className="text-2xl">🎖️</span>
            </div>
            <h3 className="text-xl font-bold terminal-text">
              <span className="terminal-prefix">&gt;</span> YOUR_CNFT
            </h3>
          </div>
          <LevelBadge
            level={level}
            boost={boost}
            isActive={isActive}
            size="md"
          />
        </div>

        <div className="space-y-3 mt-4">
          <div className="stat-card p-4 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <span className="terminal-text opacity-70">LOCKED_AMOUNT:</span>
              </div>
              <span className="terminal-text font-bold text-lg">
                {lockedAmount.toLocaleString()}{" "}
                <span className="text-[var(--primary)]">$BACK</span>
              </span>
            </div>
          </div>

          <div className="stat-card p-4 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <span className="terminal-text opacity-70">LOCK_DURATION:</span>
              </div>
              <span className="terminal-text font-bold text-lg">
                {lockDuration} DAY{lockDuration !== 1 ? "S" : ""}
              </span>
            </div>
          </div>

          {unlockDate && (
            <>
              <div className="stat-card p-4 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span className="terminal-text opacity-70">
                      UNLOCK_DATE:
                    </span>
                  </div>
                  <span className="terminal-text font-bold">
                    {formatDate(unlockDate)}
                  </span>
                </div>
              </div>

              <div className="stat-card p-4 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <span className="terminal-text opacity-70">
                      TIME_REMAINING:
                    </span>
                  </div>
                  <span
                    className={`font-bold text-lg terminal-text ${getRemainingDaysColor()}`}
                  >
                    {daysRemaining} DAY{daysRemaining !== 1 ? "S" : ""}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="stat-card p-5 bg-[var(--primary)]/10 border-2 border-[var(--primary)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--primary)]/20 to-transparent animate-shimmer"></div>
            </div>
            <div className="relative flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-transparent border-2 border-[var(--primary)]">
                <span className="text-2xl">⚡</span>
              </div>
              <div className="flex-1">
                <div className="text-sm terminal-text opacity-70 mb-1">
                  ACTIVE_BOOST:
                </div>
                <div className="text-2xl font-bold text-[var(--primary)] terminal-text">
                  +{boost}% ON_REBATES
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isActive && (
          <div className="mt-4 p-4 stat-card border-2 border-red-500 bg-red-500/10">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-red-400 text-sm font-medium flex-1 terminal-text">
                [CNFT_INACTIVE] - YOUR_TOKENS_HAVE_BEEN_UNLOCKED
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
