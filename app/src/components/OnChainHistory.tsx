"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, ParsedTransactionWithMeta, PartiallyDecodedInstruction } from "@solana/web3.js";
import { getExplorerTxUrl, getSolscanTxUrl, getXrayTxUrl } from "@/utils/explorer";

interface OnChainTransaction {
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
}

export default function OnChainHistory() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  
  const [transactions, setTransactions] = useState<OnChainTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const [selectedTx, setSelectedTx] = useState<OnChainTransaction | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!publicKey || !connected) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🔍 Fetching on-chain transactions for:", publicKey.toString());

      // Récupérer les signatures de transactions
      const signatures = await connection.getSignaturesForAddress(
        publicKey,
        { limit }
      );

      console.log(`📋 Found ${signatures.length} signatures`);

      // Récupérer les détails de chaque transaction
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
            // Extraire les instructions
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

            // Calculer les changements de balance
            const balanceChanges: OnChainTransaction['balanceChanges'] = [];
            if (tx.meta?.preBalances && tx.meta?.postBalances) {
              tx.transaction.message.accountKeys.forEach((key, index) => {
                const before = tx.meta!.preBalances[index];
                const after = tx.meta!.postBalances[index];
                const change = after - before;
                
                if (change !== 0) {
                  balanceChanges.push({
                    account: key.pubkey.toString(),
                    before: before / 1e9, // Convert lamports to SOL
                    after: after / 1e9,
                    change: change / 1e9
                  });
                }
              });
            }

            txDetails.push({
              signature: sig.signature,
              blockTime: tx.blockTime,
              slot: tx.slot,
              success: !tx.meta?.err,
              fee: (tx.meta?.fee || 0) / 1e9,
              instructions,
              balanceChanges
            });
          }
        } catch (txError) {
          console.error(`Error fetching tx ${sig.signature}:`, txError);
        }
      }

      setTransactions(txDetails);
      console.log(`✅ Loaded ${txDetails.length} transactions`);
    } catch (err) {
      console.error("❌ Error fetching on-chain history:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connected, connection, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getProgramName = (programId: string): string => {
    const knownPrograms: Record<string, string> = {
      "11111111111111111111111111111111": "System Program",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token Program",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": "Associated Token",
      "ComputeBudget111111111111111111111111111111": "Compute Budget",
      [process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "AaN2BwpGWbvDo7NHfpyC6zGYxsbg2xtcikToW9xYy4Xq"]: "SwapBack cNFT",
      [process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || "H3Wz4RrhtMNPJf7e3ztGPuMkA7XsQcjvSpzEbPnb6hPL"]: "SwapBack Buyback",
    };
    
    return knownPrograms[programId] || `${programId.slice(0, 4)}...${programId.slice(-4)}`;
  };

  if (!connected) {
    return (
      <div className="glass-effect rounded-xl p-8 border border-gray-700/50">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🔌</span>
          <h3 className="text-xl font-bold mb-2">Wallet Not Connected</h3>
          <p className="text-gray-400">
            Please connect your wallet to view on-chain transaction history
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-effect rounded-xl p-6 border border-gray-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold terminal-text mb-2">
            <span className="terminal-prefix">&gt;</span> ON_CHAIN_HISTORY
          </h2>
          <p className="text-sm text-gray-400">
            Blockchain verified transactions for {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-4 py-2 glass-effect border border-gray-700 rounded-lg text-sm"
          >
            <option value={10}>Last 10</option>
            <option value={25}>Last 25</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
          </select>
          <button
            onClick={fetchTransactions}
            disabled={isLoading}
            className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "⏳ Loading..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading transactions from blockchain...</p>
        </div>
      )}

      {/* Transactions List */}
      {!isLoading && transactions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <span className="text-4xl mb-4 block">📭</span>
          <p>No transactions found for this wallet</p>
        </div>
      )}

      {!isLoading && transactions.length > 0 && (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.signature}
              className={`p-4 glass-effect border rounded-lg cursor-pointer transition-all ${
                selectedTx?.signature === tx.signature
                  ? "border-primary bg-primary/5"
                  : "border-gray-700/50 hover:border-gray-600"
              }`}
              onClick={() => setSelectedTx(selectedTx?.signature === tx.signature ? null : tx)}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Main Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xl ${
                        tx.success ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {tx.success ? "✅" : "❌"}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      #{tx.slot}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(tx.blockTime)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 font-mono mb-2">
                    {tx.signature.slice(0, 16)}...{tx.signature.slice(-16)}
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-400">
                      <span className="text-primary">Fee:</span> {tx.fee.toFixed(6)} SOL
                    </span>
                    <span className="text-gray-400">
                      <span className="text-primary">Instructions:</span> {tx.instructions.length}
                    </span>
                    {tx.balanceChanges.length > 0 && (
                      <span className="text-gray-400">
                        <span className="text-primary">Balance Changes:</span> {tx.balanceChanges.length}
                      </span>
                    )}
                  </div>

                  {/* Programs */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Array.from(new Set(tx.instructions.map(ix => ix.programId))).map(programId => (
                      <span
                        key={programId}
                        className="px-2 py-1 text-xs bg-secondary/10 border border-secondary/30 rounded text-secondary"
                      >
                        {getProgramName(programId)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <a
                    href={getSolscanTxUrl(tx.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1 text-xs bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/20"
                  >
                    Solscan ↗
                  </a>
                  <a
                    href={getXrayTxUrl(tx.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1 text-xs bg-purple-500/10 border border-purple-500/30 rounded text-purple-400 hover:bg-purple-500/20"
                  >
                    Xray ↗
                  </a>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedTx?.signature === tx.signature && (
                <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
                  {/* Full Signature */}
                  <div className="p-3 bg-black/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-2 font-bold">FULL SIGNATURE</div>
                    <div className="text-xs font-mono text-gray-300 break-all">{tx.signature}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(tx.signature);
                      }}
                      className="mt-2 px-3 py-1 text-xs bg-primary/10 border border-primary/30 rounded text-primary hover:bg-primary/20"
                    >
                      📋 Copy
                    </button>
                  </div>

                  {/* Balance Changes */}
                  {tx.balanceChanges.length > 0 && (
                    <div className="p-3 bg-black/30 rounded-lg">
                      <div className="text-xs text-gray-400 mb-2 font-bold">BALANCE CHANGES</div>
                      <div className="space-y-2">
                        {tx.balanceChanges.map((change, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-gray-400">
                              {change.account === publicKey?.toString() 
                                ? "Your Wallet" 
                                : `${change.account.slice(0, 4)}...${change.account.slice(-4)}`}
                            </span>
                            <span
                              className={`font-bold ${
                                change.change > 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {change.change > 0 ? "+" : ""}{change.change.toFixed(6)} SOL
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="p-3 bg-black/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-2 font-bold">
                      INSTRUCTIONS ({tx.instructions.length})
                    </div>
                    <div className="space-y-2">
                      {tx.instructions.map((ix, idx) => (
                        <div key={idx} className="p-2 bg-black/50 rounded text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-primary">#{idx + 1}</span>
                            <span className="text-secondary">{getProgramName(ix.programId)}</span>
                          </div>
                          <div className="text-gray-400">Type: {ix.type}</div>
                          {ix.data && ix.data.length < 200 && (
                            <div className="text-gray-500 mt-1 font-mono text-[10px] break-all">
                              {ix.data}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* More Explorer Links */}
                  <div className="flex gap-2">
                    <a
                      href={getExplorerTxUrl(tx.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    >
                      Solana Explorer ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {transactions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-400">
              Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-green-400">
                ✅ {transactions.filter(tx => tx.success).length} Success
              </span>
              {transactions.filter(tx => !tx.success).length > 0 && (
                <span className="text-red-400">
                  ❌ {transactions.filter(tx => !tx.success).length} Failed
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
