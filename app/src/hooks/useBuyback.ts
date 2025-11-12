import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { lamportsToUiSafe, bnToNumberWithFallback } from '@/lib/bnUtils';

const BUYBACK_PROGRAM_ID = new PublicKey('92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir');
const BACK_TOKEN_MINT = new PublicKey('3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

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
      
      // Parse account data
      const authority = new PublicKey(data.slice(8, 40)).toBase58();
      const backMint = new PublicKey(data.slice(40, 72)).toBase58();
      const usdcVault = new PublicKey(data.slice(72, 104)).toBase58();
      
      // Use safe conversion for large numbers
      const totalUsdcCollected = lamportsToUiSafe(new BN(data.slice(104, 112), 'le'), 6);
      const totalBackBurned = lamportsToUiSafe(new BN(data.slice(112, 120), 'le'), 9);
      const minBuybackAmount = lamportsToUiSafe(new BN(data.slice(120, 128), 'le'), 6);
      const lastBuybackTime = bnToNumberWithFallback(new BN(data.slice(128, 136), 'le'), 0);
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
    
    // Refresh every 15 seconds
    const interval = setInterval(fetchBuybackData, 15000);
    
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
