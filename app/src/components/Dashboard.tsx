"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

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
  const [globalStats, setGlobalStats] = useState({
    totalVolume: 1234567,
    totalBurned: 45678,
    totalRebates: 98765,
  });

  useEffect(() => {
    if (connected && publicKey) {
      // TODO: Charger les stats réelles depuis la blockchain
      // Pour le MVP, on utilise des données simulées
      setStats({
        totalSwaps: 23,
        totalVolume: 15420,
        totalNPI: 308.4,
        totalRebates: 231.3,
        pendingRebates: 12.45,
        lockedAmount: 1000,
        rebateBoost: 10,
      });
    } else {
      setStats(null);
    }
  }, [connected, publicKey]);

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="swap-card">
        <h2 className="text-2xl font-bold mb-6">Statistiques Globales</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="text-sm text-gray-400 mb-1">Volume Total</div>
            <div className="text-2xl font-bold text-[var(--primary)]">
              ${globalStats.totalVolume.toLocaleString()}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-sm text-gray-400 mb-1">$BACK Brûlés</div>
            <div className="text-2xl font-bold text-orange-400">
              {globalStats.totalBurned.toLocaleString()}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-sm text-gray-400 mb-1">
              Remises Distribuées
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${globalStats.totalRebates.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* User Stats */}
      {connected && stats && (
        <div className="swap-card">
          <h2 className="text-2xl font-bold mb-6">Vos Statistiques</h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
              <span className="text-gray-400">Nombre de swaps</span>
              <span className="text-xl font-semibold">{stats.totalSwaps}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
              <span className="text-gray-400">Volume total</span>
              <span className="text-xl font-semibold">
                ${stats.totalVolume.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
              <span className="text-gray-400">NPI accumulé</span>
              <span className="text-xl font-semibold text-green-400">
                +${stats.totalNPI.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
              <span className="text-gray-400">Remises réclamées</span>
              <span className="text-xl font-semibold text-green-400">
                ${stats.totalRebates.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-[var(--primary)]/20 to-[var(--secondary)]/20 rounded-lg border border-[var(--primary)]/30">
              <span className="font-semibold">Remises en attente</span>
              <span className="text-xl font-bold text-[var(--primary)]">
                ${stats.pendingRebates.toFixed(2)}
              </span>
            </div>

            {stats.pendingRebates > 0 && (
              <button className="btn-primary w-full">
                Réclamer les remises
              </button>
            )}
          </div>

          {/* Lock Info */}
          {stats.lockedAmount > 0 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/30">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">$BACK verrouillés</span>
                <span className="text-xl font-bold">
                  {stats.lockedAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Boost de remise</span>
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
