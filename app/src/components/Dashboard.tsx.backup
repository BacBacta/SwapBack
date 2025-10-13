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
    <div className="space-y-8">
      {/* Global Stats */}
      <div className="swap-card">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Protocol Statistics</h2>
          <div className="px-3 py-1 bg-[var(--secondary)]/10 rounded-full border border-[var(--secondary)]/20">
            <span className="text-xs font-semibold text-[var(--secondary)]">Live</span>
          </div>
        </div>
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
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <span className="text-xl">📊</span>
            </div>
            <h2 className="section-title">Your Statistics</h2>
          </div>

          <div className="space-y-4">
            <div className="glass-effect rounded-lg p-5 border border-gray-700/50 hover:border-primary/30 transition-all group">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary-dark/20 border border-primary/30 group-hover:scale-110 transition-transform">
                    <span className="text-lg">🔄</span>
                  </div>
                  <span className="text-gray-400 font-medium">Swap count</span>
                </div>
                <span className="text-2xl font-bold">{stats.totalSwaps}</span>
              </div>
            </div>

            <div className="glass-effect rounded-lg p-5 border border-gray-700/50 hover:border-secondary/30 transition-all group">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-secondary/20 to-green-500/20 border border-secondary/30 group-hover:scale-110 transition-transform">
                    <span className="text-lg">💰</span>
                  </div>
                  <span className="text-gray-400 font-medium">Total volume</span>
                </div>
                <span className="text-2xl font-bold">
                  ${stats.totalVolume.toLocaleString('en-US')}
                </span>
              </div>
            </div>

            <div className="glass-effect rounded-lg p-5 border border-gray-700/50 hover:border-secondary/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-radial from-secondary/10 to-transparent rounded-full blur-xl"></div>
              <div className="relative flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-secondary/20 to-green-500/20 border border-secondary/30 group-hover:scale-110 transition-transform">
                    <span className="text-lg">📈</span>
                  </div>
                  <span className="text-gray-400 font-medium">NPI accumulated</span>
                </div>
                <span className="text-2xl font-bold text-secondary">
                  +${stats.totalNPI.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="glass-effect rounded-lg p-5 border border-gray-700/50 hover:border-secondary/30 transition-all group">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-secondary/20 to-green-500/20 border border-secondary/30 group-hover:scale-110 transition-transform">
                    <span className="text-lg">✅</span>
                  </div>
                  <span className="text-gray-400 font-medium">Rebates claimed</span>
                </div>
                <span className="text-2xl font-bold text-secondary">
                  ${stats.totalRebates.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="glass-effect rounded-lg p-6 border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/5 hover:scale-[1.02] transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent animate-shimmer"></div>
              <div className="relative flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/40 group-hover:scale-110 transition-transform animate-pulse-glow">
                    <span className="text-xl">💎</span>
                  </div>
                  <span className="font-bold text-lg">Pending rebates</span>
                </div>
                <span className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  ${stats.pendingRebates.toFixed(2)}
                </span>
              </div>
            </div>

            {stats.pendingRebates > 0 && (
              <button className="btn-primary w-full py-4 text-lg font-bold relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent animate-shimmer"></div>
                <span className="relative flex items-center justify-center gap-2">
                  <span>🎁</span>
                  <span>Claim rebates</span>
                </span>
              </button>
            )}
          </div>

          {/* Lock Info */}
          {stats.lockedAmount > 0 && (
            <div className="mt-6 p-6 glass-effect rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-radial from-primary/20 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-radial from-accent/15 to-transparent rounded-full blur-2xl"></div>
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/40">
                    <span className="text-sm">🔒</span>
                  </div>
                  <span className="font-bold text-primary">Lock Information</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">$BACK locked</span>
                    <span className="text-2xl font-bold">
                      {stats.lockedAmount.toLocaleString('en-US')}
                    </span>
                  </div>
                  
                  <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Rebate boost</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold bg-gradient-to-r from-secondary to-green-400 bg-clip-text text-transparent">
                        +{stats.rebateBoost}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
                    <span>Boost actif sur tous vos swaps</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!connected && (
        <div className="swap-card text-center py-12">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 mx-auto mb-6">
            <span className="text-4xl">👛</span>
          </div>
          <p className="text-gray-400 text-lg mb-4">Wallet non connecté</p>
          <p className="text-gray-500 text-sm">Connectez votre wallet pour voir vos statistiques</p>
        </div>
      )}
    </div>
  );
};
