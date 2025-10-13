"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { CNFTCard } from "./CNFTCard";
import { useCNFT } from "../hooks/useCNFT";

interface UserStats {
  totalSwaps: number;
  totalVolume: number;
  totalNPI: number;
  totalRebates: number;
  pendingRebates: number;
  lockedAmount: number;
  rebateBoost: number;
}

export const Dashboard = () => {
  const { connected, publicKey } = useWallet();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [globalStats] = useState({
    totalVolume: 1234567,
    totalBurned: 45678,
    totalRebates: 98765,
  });

  // 🔥 Utiliser le hook pour récupérer les vraies données blockchain
  const { cnftData, lockData, levelName } = useCNFT();

  useEffect(() => {
    if (connected && publicKey) {
      // NOTE: Données mockées pour le MVP - à remplacer par vraies données on-chain
      setStats({
        totalSwaps: 23,
        totalVolume: 15420,
        totalNPI: 308.4,
        totalRebates: 231.3,
        pendingRebates: 12.45,
        lockedAmount: lockData?.amount || 0, // Utiliser vraies données si disponibles
        rebateBoost: lockData?.boost || 0,
      });
    } else {
      setStats(null);
    }
  }, [connected, publicKey, lockData]);

  return (
      return (
    <div className="space-y-8">
      {/* Global Stats */}
      <div className="swap-card">
        <h2 className="text-2xl font-bold mb-8 text-center">Global Statistics</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="stat-card text-center">
            <div className="text-sm text-gray-400 mb-2">Total Volume</div>
            <div className="text-2xl font-bold text-[var(--primary)]">
              ${globalStats.totalVolume.toLocaleString('en-US')}
            </div>
          </div>
          <div className="stat-card text-center">
            <div className="text-sm text-gray-400 mb-2">$BACK Burned</div>
            <div className="text-2xl font-bold text-orange-400">
              {globalStats.totalBurned.toLocaleString('en-US')}
            </div>
          </div>
          <div className="stat-card text-center">
            <div className="text-sm text-gray-400 mb-2">
              Rebates Distributed
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${globalStats.totalRebates.toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* cNFT Card - Affiché en premier quand connecté */}
      {connected && cnftData && cnftData.exists && cnftData.isActive && (
        <CNFTCard
          level={levelName || "Bronze"}
          boost={cnftData.boost}
          lockedAmount={cnftData.lockedAmount}
          lockDuration={cnftData.lockDuration}
          isActive={cnftData.isActive}
          unlockDate={cnftData.unlockDate}
        />
      )}

      {/* User Stats */}
      {connected && stats && (
        <div className="swap-card">
          <h2 className="text-2xl font-bold mb-8 text-center">Your Statistics</h2>

          <div className="space-y-6">
            <div className="flex justify-between items-center p-4 bg-black/20 rounded-lg">
              <span className="text-gray-400">Swap count</span>
              <span className="text-xl font-semibold">{stats.totalSwaps}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-black/20 rounded-lg">
              <span className="text-gray-400">Total volume</span>
              <span className="text-xl font-semibold">
                ${stats.totalVolume.toLocaleString('en-US')}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 bg-black/20 rounded-lg">
              <span className="text-gray-400">NPI accumulated</span>
              <span className="text-xl font-semibold text-green-400">
                +${stats.totalNPI.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 bg-black/20 rounded-lg">
              <span className="text-gray-400">Rebates claimed</span>
              <span className="text-xl font-semibold text-green-400">
                ${stats.totalRebates.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-[var(--primary)]/20 to-[var(--secondary)]/20 rounded-lg border border-[var(--primary)]/30">
              <span className="font-semibold">Pending rebates</span>
              <span className="text-xl font-bold text-[var(--primary)]">
                ${stats.pendingRebates.toFixed(2)}
              </span>
            </div>

            {stats.pendingRebates > 0 && (
              <button className="btn-primary w-full">
                Claim rebates
              </button>
            )}
          </div>

          {/* Lock Info */}
          {stats.lockedAmount > 0 && (
            <div className="mt-8 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/30">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold">$BACK locked</span>
                <span className="text-xl font-bold">
                  {stats.lockedAmount.toLocaleString('en-US')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Rebate boost</span>
                <span className="text-lg font-semibold text-purple-400">
                  +{stats.rebateBoost}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {!connected && (
        <div className="swap-card text-center text-gray-400 py-8">
          Connectez votre wallet pour voir vos statistiques
        </div>
      )}
    </div>
  );
};
