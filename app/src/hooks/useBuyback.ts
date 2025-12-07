import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { lamportsToUiSafe, bnToNumberWithFallback } from '@/lib/bnUtils';
import { getBackTokenMint, TOKEN_DECIMALS } from '@/config/constants';

const BUYBACK_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || '746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6'
);
const BACK_TOKEN_MINT = getBackTokenMint();
const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || 'BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR'
);

export interface BuybackData {
  authority: string;
  backMint: string;
  usdcVault: string;
  totalUsdcCollected: number;
  totalBackBurned: number;
  minBuybackAmount: number;
  lastBuybackTime: number;
  bump: number;
  vaultBalance: number;
  canExecute: boolean;
}

export interface BuybackHistory {
  signature: string;
  timestamp: number;
  usdcAmount: number;
  backAmount: number;
  executor: string;
}

export function useBuyback() {
  const { connection } = useConnection();
  const [buybackData, setBuybackData] = useState<BuybackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDAs
  const [buybackStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('buyback_state')],
    BUYBACK_PROGRAM_ID
  );

  const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('usdc_vault')],
    BUYBACK_PROGRAM_ID
  );

  const fetchBuybackData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch buyback state account
      const accountInfo = await connection.getAccountInfo(buybackStatePDA);
      
      if (!accountInfo) {
        throw new Error('Buyback state not initialized');
      }

      const data = accountInfo.data;
      const minLength = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
      if (data.length < minLength) {
        throw new Error(`Invalid buyback account data: expected ${minLength} bytes, got ${data.length}`);
      }

      const readU64ToBN = (offset: number) => {
        if (offset + 8 > data.length) {
          throw new Error(`Invalid buffer read at offset ${offset}`);
        }
        return new BN(data.readBigUInt64LE(offset).toString());
      };
      
      const authority = new PublicKey(data.slice(8, 40)).toBase58();
      const backMint = new PublicKey(data.slice(40, 72)).toBase58();
      const usdcVault = new PublicKey(data.slice(72, 104)).toBase58();
      
      const totalUsdcCollected = lamportsToUiSafe(readU64ToBN(104), 6);
      const totalBackBurned = lamportsToUiSafe(readU64ToBN(112), TOKEN_DECIMALS);
      const minBuybackAmount = lamportsToUiSafe(readU64ToBN(120), 6);
      const lastBuybackTime = bnToNumberWithFallback(readU64ToBN(128), 0);
      const bump = data[136];

      // Fetch vault balance
      const vaultInfo = await connection.getTokenAccountBalance(usdcVaultPDA);
      const vaultBalance = parseFloat(vaultInfo.value.uiAmount?.toString() || '0');

      const buybackData: BuybackData = {
        authority,
        backMint,
        usdcVault,
        totalUsdcCollected,
        totalBackBurned,
        minBuybackAmount,
        lastBuybackTime,
        bump,
        vaultBalance,
        canExecute: vaultBalance >= minBuybackAmount,
      };

      setBuybackData(buybackData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch buyback data';
      console.error('Error fetching buyback data:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [connection, buybackStatePDA, usdcVaultPDA]);

  useEffect(() => {
    fetchBuybackData();
    
    // Refresh every 60 seconds (reduced from 15s to avoid rate limiting)
    const interval = setInterval(fetchBuybackData, 60000);
    
    return () => clearInterval(interval);
  }, [fetchBuybackData]);

  return {
    buybackData,
    loading,
    error,
    refresh: fetchBuybackData,
    programId: BUYBACK_PROGRAM_ID,
    buybackStatePDA,
    usdcVaultPDA,
    BACK_TOKEN_MINT,
    USDC_MINT,
  };
}

export function useBuybackHistory(limit: number = 20) {
  const { connection } = useConnection();
  const [history, setHistory] = useState<BuybackHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        
        // Fetch signatures for the buyback program
        const signatures = await connection.getSignaturesForAddress(
          BUYBACK_PROGRAM_ID,
          { limit }
        );

        const historyData: BuybackHistory[] = [];

        for (const sig of signatures) {
          try {
            const tx = await connection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            });

            if (tx && tx.meta && !tx.meta.err) {
              // Parse transaction logs to extract buyback info
              const logs = tx.meta.logMessages || [];
              const isBuyback = logs.some(log => log.includes('Instruction: ExecuteBuyback'));

              if (isBuyback) {
                // Get account keys from versioned message
                const accountKeys = tx.transaction.message.getAccountKeys();
                const executor = accountKeys.get(0)?.toBase58() || '';
                
                historyData.push({
                  signature: sig.signature,
                  timestamp: sig.blockTime || 0,
                  usdcAmount: 0, // Parse from logs or instruction data
                  backAmount: 0, // Parse from logs or instruction data
                  executor,
                });
              }
            }
          } catch (err) {
            console.error('Error parsing transaction:', err);
          }
        }

        setHistory(historyData);
      } catch (err) {
        console.error('Error fetching buyback history:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [connection, limit]);

  return { history, loading };
}
