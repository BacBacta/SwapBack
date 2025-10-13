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
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const daysRemaining = unlockDate
    ? Math.max(0, Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const getRemainingDaysColor = () => {
    if (daysRemaining > 30) return "text-green-400";
    if (daysRemaining > 7) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="swap-card hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
      {/* Gradient de fond animé */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-accent/10 to-transparent rounded-full blur-3xl"></div>
      
      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/40 group-hover:scale-110 transition-transform animate-pulse-glow">
              <span className="text-2xl">🎖️</span>
            </div>
            <h3 className="text-xl font-bold text-white">Votre cNFT</h3>
          </div>
          <LevelBadge level={level} boost={boost} isActive={isActive} size="md" />
        </div>

        <div className="space-y-3 mt-4">
          <div className="glass-effect rounded-lg p-4 border border-gray-700/50 hover:border-primary/30 transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <span className="text-gray-400 font-medium">Montant locké</span>
              </div>
              <span className="text-white font-bold text-lg">
                {lockedAmount.toLocaleString()} <span className="text-primary">$BACK</span>
              </span>
            </div>
          </div>

          <div className="glass-effect rounded-lg p-4 border border-gray-700/50 hover:border-accent/30 transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <span className="text-gray-400 font-medium">Durée de lock</span>
              </div>
              <span className="text-white font-bold text-lg">{lockDuration} jours</span>
            </div>
          </div>

          {unlockDate && (
            <>
              <div className="glass-effect rounded-lg p-4 border border-gray-700/50 hover:border-secondary/30 transition-all">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span className="text-gray-400 font-medium">Date de déblocage</span>
                  </div>
                  <span className="text-white font-bold">{formatDate(unlockDate)}</span>
                </div>
              </div>

              <div className="glass-effect rounded-lg p-4 border border-gray-700/50 hover:border-yellow-400/30 transition-all">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <span className="text-gray-400 font-medium">Temps restant</span>
                  </div>
                  <span className={`font-bold text-lg ${getRemainingDaysColor()}`}>
                    {daysRemaining} jour{daysRemaining !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="glass-effect rounded-lg p-5 bg-gradient-to-r from-secondary/10 to-green-400/5 border border-secondary/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/5 to-transparent animate-shimmer"></div>
            <div className="relative flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-secondary/30 to-green-400/30 border border-secondary/40 animate-pulse-glow">
                <span className="text-2xl">⚡</span>
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-400 mb-1">Boost actif</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-secondary to-green-400 bg-clip-text text-transparent">
                  +{boost}% sur les rebates
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isActive && (
          <div className="mt-4 p-4 glass-effect border border-red-500/30 rounded-lg bg-red-500/5 animate-slide-up">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-red-400 text-sm font-medium flex-1">
                Ce cNFT est inactif. Vos tokens ont été débloqués.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
