"use client";

import { useEffect, useState } from "react";

interface RealtimeStats {
  totalSwaps: number;
  totalVolume: number;
  totalNPI: number;
  totalRebates: number;
  pendingRebates: number;
  lockedAmount: number;
  rebateBoost: number;
  recentSwaps: SwapActivity[];
}

interface SwapActivity {
  id: string;
  timestamp: number;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  npi: number;
  rebate: number;
  type: "swap" | "claim" | "lock";
}

interface GlobalStats {
  totalVolume: number;
  totalBurned: number;
  totalRebates: number;
  activeUsers: number;
  swapsLast24h: number;
}

export const useRealtimeStats = (publicKey: string | undefined) => {
  const [userStats, setUserStats] = useState<RealtimeStats | null>(null);
  const [globalStats] = useState<GlobalStats>({
    totalVolume: 1234567,
    totalBurned: 45678,
    totalRebates: 98765,
    activeUsers: 1234,
    swapsLast24h: 567,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  // Fonction de rafraîchissement manuel
  const refresh = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      // Fetch stats logic here (moved from useEffect)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockStats: RealtimeStats = {
        totalSwaps: 23,
        totalVolume: 15420,
        totalNPI: 308.4,
        totalRebates: 231.3,
        pendingRebates: 12.45,
        lockedAmount: 1000,
        rebateBoost: 25,
        recentSwaps: [
          {
            id: "1",
            timestamp: Date.now() - 3600000,
            inputToken: "USDC",
            outputToken: "SOL",
            inputAmount: 100,
            outputAmount: 1.2,
            npi: 2.5,
            rebate: 1.8,
            type: "swap",
          },
          {
            id: "2",
            timestamp: Date.now() - 7200000,
            inputToken: "SOL",
            outputToken: "USDT",
            inputAmount: 2,
            outputAmount: 200,
            npi: 4.2,
            rebate: 3.1,
            type: "swap",
          },
        ],
      };

      setUserStats(mockStats);
      setLastRefresh(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!publicKey) {
      setUserStats(null);
      setLoading(false);
      return;
    }

    // Appeler refresh au montage initial
    refresh();

    // Auto-refresh uniquement toutes les 5 minutes pour éviter les rafraîchissements fréquents
    const interval = setInterval(refresh, 300000);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  return {
    userStats,
    globalStats,
    loading,
    error,
    refresh, // Exposer la fonction refresh pour rafraîchissement manuel
    lastRefresh,
  };
};
