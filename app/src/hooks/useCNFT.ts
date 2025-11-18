import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useCallback } from 'react';
import { fetchUserCNFT, LockLevel } from '@/lib/cnft';

const LAMPORTS_PER_BACK = 1_000_000_000; // BACK has 9 decimals

export interface CNFTData {
  exists: boolean;
  level: LockLevel | null;
  levelIndex: number | null;
  boostBps: number;
  lockedAmountLamports: number;
  lockedAmount: number;
  lockDuration: number;
  mintTime: number;
  unlockTime: number;
  isActive: boolean;
}

export interface LockData {
  amount: number;
  boost: number;
  unlockTime: number;
  isActive: boolean;
}

export function useCNFT() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [cnftData, setCnftData] = useState<CNFTData | null>(null);
  const [lockData, setLockData] = useState<LockData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load cNFT data from blockchain
  const fetchCNFTData = useCallback(async () => {
    if (!publicKey || !connection) {
      setCnftData(null);
      setLockData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const account = await fetchUserCNFT(connection, publicKey);

      if (!account) {
        setCnftData({
          exists: false,
          level: null,
          levelIndex: null,
          boostBps: 0,
          lockedAmountLamports: 0,
          lockedAmount: 0,
          lockDuration: 0,
          mintTime: 0,
          unlockTime: 0,
          isActive: false,
        });
        setLockData(null);
        return;
      }

      const lockedAmount = account.amountLocked / LAMPORTS_PER_BACK;

      setCnftData({
        exists: true,
        level: account.level,
        levelIndex: account.levelIndex,
        boostBps: account.boostBps,
        lockedAmountLamports: account.amountLocked,
        lockedAmount,
        lockDuration: account.lockDuration,
        mintTime: account.mintTime,
        unlockTime: account.unlockTime,
        isActive: account.isActive,
      });

      setLockData({
        amount: lockedAmount, // FIX: Use converted amount, not lamports
        boost: account.boostBps,
        unlockTime: account.unlockTime,
        isActive: account.isActive,
      });
    } catch (err) {
      console.error('Error fetching cNFT data:', err);
      setError(err as Error);
      setCnftData(null);
      setLockData(null);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection]);

  // Auto-refresh quand le wallet change
  useEffect(() => {
    fetchCNFTData();
  }, [fetchCNFTData]);

  // Fonction pour rafraîchir manuellement
  const refresh = async () => {
    await fetchCNFTData();
  };

  // Calculer le niveau textuel
  const getLevelName = (): LockLevel | null => {
    if (!cnftData?.exists) return null;
    return cnftData.level ?? null;
  };

  // Calculer le temps restant en jours
  const getDaysRemaining = (): number | null => {
    if (!cnftData || !cnftData.exists || !cnftData.isActive) return null;

    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = cnftData.unlockTime - now;

    if (remainingSeconds <= 0) {
      return 0;
    }

    return Math.ceil(remainingSeconds / (60 * 60 * 24));
  };

  return {
    // Données
    cnftData,
    lockData,
    
    // États
    isLoading,
    error,
    isConnected: !!publicKey,
    hasCNFT: cnftData?.exists ?? false,
    
    // Helpers
    levelName: getLevelName(),
    daysRemaining: getDaysRemaining(),
    
    // Actions
    refresh,
  };
}
