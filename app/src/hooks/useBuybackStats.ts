/**
 * Hook pour récupérer les statistiques du buyback-burn en temps réel
 */

import { useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState, useCallback } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';

// TODO: Import from @swapback/sdk when installed
// import { getBuybackStats, formatBuybackStats, estimateNextBuyback } from '@swapback/sdk';

export interface BuybackStats {
  totalUsdcSpent: string;
  totalBackBurned: string;
  buybackCount: string;
  minBuybackAmount: string;
}

export interface BuybackEstimation {
  usdcAvailable: number;
  estimatedBackAmount: number;
  canExecute: boolean;
  reason?: string;
}

export interface UseBuybackStatsReturn {
  stats: BuybackStats | null;
  estimation: BuybackEstimation | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Temporary mock function until SDK is installed
async function getBuybackStatsFromChain(connection: Connection): Promise<BuybackStats | null> {
  try {
    const BUYBACK_PROGRAM_ID = new PublicKey('EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf'); // Devnet
    const [buybackStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('buyback_state')],
      BUYBACK_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(buybackStatePDA);
    
    if (!accountInfo) {
      console.warn('Buyback state not found on-chain');
      return null;
    }

    // Decode account data (simplified - adjust based on actual struct)
    const data = accountInfo.data;
    let offset = 8 + 32 + 32 + 32; // Skip discriminator + authority + back_mint + usdc_vault
    
    // Read u64 values (8 bytes each, little-endian)
    const readU64 = (offset: number) => {
      return Number(data.readBigUInt64LE(offset));
    };
    
    const minBuybackAmount = readU64(offset);
    offset += 8;
    const totalUsdcSpent = readU64(offset);
    offset += 8;
    const totalBackBurned = readU64(offset);
    offset += 8;
    const buybackCount = readU64(offset);

    return {
      totalUsdcSpent: (totalUsdcSpent / 1e6).toFixed(2),
      totalBackBurned: (totalBackBurned / 1e9).toFixed(2),
      buybackCount: buybackCount.toString(),
      minBuybackAmount: (minBuybackAmount / 1e6).toFixed(2),
    };
  } catch (error) {
    console.error('Error reading buyback stats:', error);
    return null;
  }
}

async function estimateNextBuybackFromChain(connection: Connection): Promise<BuybackEstimation> {
  try {
    const BUYBACK_PROGRAM_ID = new PublicKey('EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf'); // Devnet
    const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('usdc_vault')],
      BUYBACK_PROGRAM_ID
    );

    const vaultInfo = await connection.getTokenAccountBalance(usdcVaultPDA);
    const usdcAvailable = vaultInfo.value.uiAmount || 0;

    // Simple estimation: 1 USDC = 250 $BACK (adjust based on market)
    const estimatedBackAmount = usdcAvailable * 250;

    return {
      usdcAvailable,
      estimatedBackAmount,
      canExecute: usdcAvailable >= 100, // Min 100 USDC
      reason: usdcAvailable < 100 ? `Need 100 USDC minimum (current: ${usdcAvailable.toFixed(2)})` : undefined,
    };
  } catch (error) {
    console.error('Error estimating buyback:', error);
    return {
      usdcAvailable: 0,
      estimatedBackAmount: 0,
      canExecute: false,
      reason: 'Failed to fetch vault balance',
    };
  }
}

/**
 * Hook personnalisé pour récupérer les stats buyback
 * Auto-refresh toutes les 30 secondes
 */
export function useBuybackStats(): UseBuybackStatsReturn {
  const { connection } = useConnection();
  const [stats, setStats] = useState<BuybackStats | null>(null);
  const [estimation, setEstimation] = useState<BuybackEstimation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!connection) {
      setError('No connection available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch buyback stats from chain
      const buybackStats = await getBuybackStatsFromChain(connection);
      
      if (buybackStats) {
        setStats(buybackStats);

        // Estimate next buyback
        const nextBuyback = await estimateNextBuybackFromChain(connection);
        setEstimation(nextBuyback);
      } else {
        setStats({
          totalUsdcSpent: '0.00',
          totalBackBurned: '0.00',
          buybackCount: '0',
          minBuybackAmount: '100.00',
        });
        setEstimation({
          usdcAvailable: 0,
          estimatedBackAmount: 0,
          canExecute: false,
          reason: 'Buyback not initialized',
        });
      }
    } catch (err) {
      console.error('Error fetching buyback stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Fallback to zeros on error
      setStats({
        totalUsdcSpent: '0.00',
        totalBackBurned: '0.00',
        buybackCount: '0',
        minBuybackAmount: '100.00',
      });
    } finally {
      setLoading(false);
    }
  }, [connection]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    stats,
    estimation,
    loading,
    error,
    refresh: fetchStats,
  };
}
