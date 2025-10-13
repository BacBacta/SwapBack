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
    <div className="swap-card hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">🎖️ Votre cNFT</h3>
        <LevelBadge level={level} boost={boost} isActive={isActive} size="md" />
      </div>

      <div className="space-y-3 mt-4">
        <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
          <span className="text-gray-400">Montant locké</span>
          <span className="text-white font-semibold">
            {lockedAmount.toLocaleString()} $BACK
          </span>
        </div>

        <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
          <span className="text-gray-400">Durée de lock</span>
          <span className="text-white font-semibold">{lockDuration} jours</span>
        </div>

        {unlockDate && (
          <>
            <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400">Date de déblocage</span>
              <span className="text-white font-semibold">{formatDate(unlockDate)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400">Temps restant</span>
              <span className={`font-semibold ${getRemainingDaysColor()}`}>
                {daysRemaining} jour{daysRemaining !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}

        <div className="p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/30">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="text-sm text-gray-400">Boost actif</div>
              <div className="text-lg font-bold text-purple-300">+{boost}% sur les rebates</div>
            </div>
          </div>
        </div>
      </div>

      {!isActive && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">
            ⚠️ Ce cNFT est inactif. Vos tokens ont été débloqués.
          </p>
        </div>
      )}
    </div>
  );
};
