import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, ParsedTransactionWithMeta, PartiallyDecodedInstruction } from "@solana/web3.js";

export interface OnChainTransaction {
  signature: string;
  blockTime: number | null;
  slot: number;
  success: boolean;
  fee: number;
  instructions: {
    programId: string;
    type: string;
    data?: string;
  }[];
  balanceChanges: {
    account: string;
    before: number;
    after: number;
    change: number;
  }[];
  memo?: string;
}

export interface UseOnChainHistoryOptions {
  limit?: number;
  programFilter?: PublicKey;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export function useOnChainHistory(options: UseOnChainHistoryOptions = {}) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  
  const {
    limit = 10,
    programFilter,
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [transactions, setTransactions] = useState<OnChainTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!publicKey || !connected) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🔍 [useOnChainHistory] Fetching transactions...");

      // Get transaction signatures
      const targetAddress = programFilter || publicKey;
      const signatures = await connection.getSignaturesForAddress(
        targetAddress,
        { limit }
      );

      console.log(`📋 [useOnChainHistory] Found ${signatures.length} signatures`);

      // Fetch transaction details
      const txDetails: OnChainTransaction[] = [];

      for (const sig of signatures) {
        try {
          const tx = await connection.getParsedTransaction(
            sig.signature,
            {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed"
            }
          );

          if (tx && tx.transaction) {
            // Extract instructions
            const instructions = tx.transaction.message.instructions.map((ix) => {
              if ('parsed' in ix) {
                return {
                  programId: ix.programId.toString(),
                  type: ix.parsed?.type || 'unknown',
                  data: JSON.stringify(ix.parsed?.info || {})
                };
              } else {
                return {
                  programId: ix.programId.toString(),
                  type: 'raw',
                  data: (ix as PartiallyDecodedInstruction).data
                };
              }
            });

            // Calculate balance changes
            const balanceChanges: OnChainTransaction['balanceChanges'] = [];
            if (tx.meta?.preBalances && tx.meta?.postBalances) {
              tx.transaction.message.accountKeys.forEach((key, index) => {
                const before = tx.meta!.preBalances[index];
                const after = tx.meta!.postBalances[index];
                const change = after - before;
                
                if (change !== 0) {
                  balanceChanges.push({
                    account: key.pubkey.toString(),
                    before: before / 1e9,
                    after: after / 1e9,
                    change: change / 1e9
                  });
                }
              });
            }

            // Extract memo if present
            let memo: string | undefined;
            const memoInstruction = tx.transaction.message.instructions.find(
              (ix) => 'parsed' in ix && ix.programId.toString() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
            );
            if (memoInstruction && 'parsed' in memoInstruction) {
              memo = memoInstruction.parsed?.info?.memo;
            }

            txDetails.push({
              signature: sig.signature,
              blockTime: tx.blockTime,
              slot: tx.slot,
              success: !tx.meta?.err,
              fee: (tx.meta?.fee || 0) / 1e9,
              instructions,
              balanceChanges,
              memo
            });
          }
        } catch (txError) {
          console.error(`❌ [useOnChainHistory] Error fetching tx ${sig.signature}:`, txError);
        }
      }

      setTransactions(txDetails);
      console.log(`✅ [useOnChainHistory] Loaded ${txDetails.length} transactions`);
    } catch (err) {
      console.error("❌ [useOnChainHistory] Error:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connected, connection, limit, programFilter]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      console.log("🔄 [useOnChainHistory] Auto-refreshing...");
      fetchTransactions();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    refresh: fetchTransactions,
  };
}

// Helper to get program-specific transactions
export function useProgramTransactions(
  programId: string,
  options: Omit<UseOnChainHistoryOptions, 'programFilter'> = {}
) {
  return useOnChainHistory({
    ...options,
    programFilter: new PublicKey(programId)
  });
}

// Helper to filter transactions by instruction type
export function filterTransactionsByInstruction(
  transactions: OnChainTransaction[],
  programId: string,
  instructionType?: string
): OnChainTransaction[] {
  return transactions.filter(tx => {
    return tx.instructions.some(ix => {
      const matchesProgram = ix.programId === programId;
      const matchesType = !instructionType || ix.type === instructionType;
      return matchesProgram && matchesType;
    });
  });
}

// Helper to get transaction stats
export function getTransactionStats(transactions: OnChainTransaction[]) {
  const totalFees = transactions.reduce((sum, tx) => sum + tx.fee, 0);
  const successCount = transactions.filter(tx => tx.success).length;
  const failedCount = transactions.length - successCount;
  
  const programCounts: Record<string, number> = {};
  transactions.forEach(tx => {
    tx.instructions.forEach(ix => {
      programCounts[ix.programId] = (programCounts[ix.programId] || 0) + 1;
    });
  });

  return {
    total: transactions.length,
    success: successCount,
    failed: failedCount,
    totalFees,
    averageFee: transactions.length > 0 ? totalFees / transactions.length : 0,
    programCounts,
  };
}
