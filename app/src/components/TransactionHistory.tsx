"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getExplorerTxUrl, getSolscanTxUrl, getXrayTxUrl, getNetworkLabel } from "@/utils/explorer";

interface Transaction {
  id: string;
  signature: string;
  timestamp: number;
  type: "swap" | "lock" | "unlock" | "dca";
  router: "swapback" | "jupiter";
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  npi?: number;
  rebate?: number;
  burn?: number;
  status: "success" | "pending" | "failed";
  explorerUrl: string;
  // DCA-specific fields
  dcaInterval?: number; // In days
  dcaSwapsExecuted?: number;
  dcaTotalSwaps?: number;
  // Champs spécifiques pour Lock/Unlock
  lockDuration?: number; // En jours
  lockLevel?: string; // Bronze/Silver/Gold
  lockBoost?: number; // Pourcentage
}

interface TransactionHistoryProps {
  onClose?: () => void;
}

export const TransactionHistory = ({
  onClose,
}: TransactionHistoryProps = {}) => {
  const { connected, publicKey } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<
    "all" | "swap" | "lock" | "unlock" | "dca"
  >("all");

  // Load history from localStorage
  useEffect(() => {
    if (connected && publicKey) {
      const storageKey = `swapback_history_${publicKey.toString()}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTransactions(parsed);
        } catch (e) {
          console.error("Error loading history:", e);
        }
      }
    }
  }, [connected, publicKey]);

  const filteredTransactions = transactions.filter(
    (tx) => filter === "all" || tx.type === filter
  );

  const clearHistory = () => {
    if (confirm("Êtes-vous sûr de vouloir effacer tout l'historique ?")) {
      setTransactions([]);
      if (publicKey) {
        const storageKey = `swapback_history_${publicKey.toString()}`;
        localStorage.removeItem(storageKey);
      }
    }
  };

  if (!connected) {
    return null;
  }

  // Le composant est maintenant contrôlé par le parent via isOpen
  console.log(
    "📜 TransactionHistory rendered, isOpen:",
    isOpen,
    "transactions:",
    transactions.length
  );

  return (
    <>
      {/* Panel de l'historique */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="swap-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[var(--primary)]">
              <div>
                <h2 className="text-2xl font-bold terminal-text mb-2">
                  <span className="terminal-prefix">&gt;</span>{" "}
                  TRANSACTION_HISTORY
                </h2>
                <p className="text-sm terminal-text opacity-70">
                  [{transactions.length} RECORDS] | BLOCKCHAIN_EXPLORER
                </p>
              </div>
              <button
                onClick={() => {
                  console.log("❌ Closing transaction history");
                  setIsOpen(false);
                  onClose?.();
                }}
                className="px-4 py-2 border-2 border-[var(--primary)] terminal-text font-bold hover:bg-[var(--primary)]/20 transition-all"
              >
                [X]
              </button>
            </div>

            {/* Filtres */}
            <div className="flex gap-2 mb-4">
              {(["all", "swap", "lock", "unlock", "dca"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 font-bold terminal-text transition-all ${
                    filter === f
                      ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
                      : "border-2 border-transparent hover:border-[var(--primary)]/50"
                  }`}
                >
                  <span className="terminal-prefix">&gt;</span>[
                  {f.toUpperCase()}]
                </button>
              ))}
              {transactions.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="ml-auto px-4 py-2 border-2 border-red-500 text-red-500 font-bold terminal-text hover:bg-red-500/20 transition-all"
                >
                  [CLEAR_ALL]
                </button>
              )}
            </div>

            {/* Liste des transactions */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 terminal-text opacity-50">
                  <span className="terminal-prefix">&gt;</span>{" "}
                  NO_TRANSACTIONS_FOUND
                  <div className="mt-2 text-sm">[DATABASE_EMPTY]</div>
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={`stat-card p-4 transition-all cursor-pointer ${
                      selectedTx?.id === tx.id
                        ? "border-2 border-[var(--primary)] bg-[var(--primary)]/10"
                        : "hover:bg-[var(--primary)]/5"
                    }`}
                    onClick={() =>
                      setSelectedTx(selectedTx?.id === tx.id ? null : tx)
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Info principale */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          \n{" "}
                          <span
                            className={`px-2 py-1 text-xs font-bold border-2 ${
                              tx.status === "success"
                                ? "border-[var(--primary)] text-[var(--primary)]"
                                : tx.status === "pending"
                                  ? "border-yellow-500 text-yellow-500"
                                  : "border-red-500 text-red-500"
                            }`}
                          >
                            [{tx.status.toUpperCase()}]
                          </span>
                          <span className="px-2 py-1 text-xs font-bold border-2 border-[var(--primary)] text-[var(--primary)]">
                            {tx.type === "swap" && "🔄 "}
                            {tx.type === "lock" && "🔒 "}
                            {tx.type === "unlock" && "🔓 "}
                            {tx.type === "dca" && "📊 "}[{tx.type.toUpperCase()}
                            ]
                          </span>
                          <span className="px-2 py-1 text-xs font-bold border-2 border-[var(--primary)] text-[var(--primary)]">
                            [{tx.router.toUpperCase()}]
                          </span>
                        </div>

                        <div className="terminal-text text-sm mb-2">
                          <span className="terminal-prefix">&gt;</span>{" "}
                          {tx.inputAmount} {tx.inputToken} → {tx.outputAmount}{" "}
                          {tx.outputToken}
                        </div>

                        {/* Détails financiers */}
                        {(tx.npi || tx.rebate || tx.burn) && (
                          <div className="flex gap-4 text-xs terminal-text opacity-70">
                            {tx.npi && <span>NPI: +${tx.npi.toFixed(2)}</span>}
                            {tx.rebate && (
                              <span>REBATE: ${tx.rebate.toFixed(4)}</span>
                            )}
                            {tx.burn && (
                              <span>BURN: ${tx.burn.toFixed(4)}</span>
                            )}
                          </div>
                        )}

                        {/* Détails Lock/Unlock */}
                        {(tx.type === "lock" || tx.type === "unlock") && (
                          <div className="flex gap-4 text-xs terminal-text opacity-70 mt-2">
                            {tx.lockLevel && (
                              <span className="text-[var(--primary)]">
                                LEVEL: {tx.lockLevel}
                              </span>
                            )}
                            {tx.lockDuration && (
                              <span>DURATION: {tx.lockDuration} days</span>
                            )}
                            {tx.lockBoost && (
                              <span>BOOST: +{tx.lockBoost}%</span>
                            )}
                          </div>
                        )}

                        {/* DCA Details */}
                        {tx.type === "dca" && (
                          <div className="flex gap-4 text-xs terminal-text opacity-70 mt-2">
                            {tx.dcaInterval && (
                              <span>INTERVAL: Every {tx.dcaInterval} days</span>
                            )}
                            {tx.dcaSwapsExecuted !== undefined &&
                              tx.dcaTotalSwaps && (
                                <span className="text-[var(--primary)]">
                                  PROGRESS: {tx.dcaSwapsExecuted}/
                                  {tx.dcaTotalSwaps} swaps
                                </span>
                              )}
                          </div>
                        )}

                        {/* Signature */}
                        <div className="mt-2 text-xs terminal-text opacity-50 font-mono">
                          SIG: {tx.signature.substring(0, 20)}...
                          {tx.signature.substring(tx.signature.length - 20)}
                        </div>

                        {/* Détails étendus quand sélectionné */}
                        {selectedTx?.id === tx.id && (
                          <div className="mt-4 pt-4 border-t-2 border-[var(--primary)] space-y-3">
                            {/* Signature complète */}
                            <div className="stat-card p-3">
                              <div className="text-xs terminal-text opacity-70 mb-2">
                                <span className="terminal-prefix">&gt;</span>{" "}
                                FULL_SIGNATURE
                              </div>
                              <div className="text-xs terminal-text font-mono break-all">
                                {tx.signature}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(tx.signature);
                                }}
                                className="mt-2 px-3 py-1 text-xs border-2 border-[var(--primary)] terminal-text hover:bg-[var(--primary)]/20"
                              >
                                [COPY]
                              </button>
                            </div>

                            {/* Blockchain Explorer Links */}
                            <div className="stat-card p-3">
                              <div className="text-xs terminal-text opacity-70 mb-2">
                                <span className="terminal-prefix">&gt;</span>{" "}
                                BLOCKCHAIN_EXPLORERS
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <a
                                  href={getExplorerTxUrl(tx.signature)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1 text-xs border-2 border-[var(--primary)] terminal-text hover:bg-[var(--primary)]/20"
                                >
                                  [SOLANA_EXPLORER]
                                </a>
                                <a
                                  href={getSolscanTxUrl(tx.signature)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1 text-xs border-2 border-[var(--primary)] terminal-text hover:bg-[var(--primary)]/20"
                                >
                                  [SOLSCAN]
                                </a>
                                <a
                                  href={getXrayTxUrl(tx.signature)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1 text-xs border-2 border-[var(--primary)] terminal-text hover:bg-[var(--primary)]/20"
                                >
                                  [HELIUS_XRAY]
                                </a>
                              </div>
                            </div>

                            {/* Blockchain Data */}
                            <div className="stat-card p-3">
                              <div className="text-xs terminal-text opacity-70 mb-2">
                                <span className="terminal-prefix">&gt;</span>{" "}
                                ON_CHAIN_DATA
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs terminal-text">
                                <div>
                                  <span className="opacity-70">NETWORK:</span>{" "}
                                  {getNetworkLabel()}
                                </div>
                                <div>
                                  <span className="opacity-70">TIMESTAMP:</span>{" "}
                                  {new Date(tx.timestamp).toISOString()}
                                </div>
                                <div className="col-span-2">
                                  <span className="opacity-70">WALLET:</span>{" "}
                                  <span className="font-mono text-[10px]">
                                    {publicKey?.toString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Timestamp et action */}
                      <div className="text-right">
                        <div className="text-xs terminal-text opacity-70 mb-2">
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(tx.explorerUrl, "_blank");
                          }}
                          className="text-xs terminal-text border border-[var(--primary)] px-2 py-1 hover:bg-[var(--primary)]/20"
                        >
                          [VIEW_ON_CHAIN]
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer avec stats */}
            {transactions.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-[var(--primary)] grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs terminal-text opacity-70 mb-1">
                    TOTAL_TX
                  </div>
                  <div className="text-lg font-bold terminal-text">
                    {transactions.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs terminal-text opacity-70 mb-1">
                    SUCCESS_RATE
                  </div>
                  <div className="text-lg font-bold terminal-text">
                    {(
                      (transactions.filter((tx) => tx.status === "success")
                        .length /
                        transactions.length) *
                      100
                    ).toFixed(0)}
                    %
                  </div>
                </div>
                <div>
                  <div className="text-xs terminal-text opacity-70 mb-1">
                    TOTAL_NPI
                  </div>
                  <div className="text-lg font-bold terminal-text">
                    $
                    {transactions
                      .reduce((sum, tx) => sum + (tx.npi || 0), 0)
                      .toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// Helper functions to add transactions to history
export const addTransactionToHistory = (
  walletAddress: string,
  tx: Omit<Transaction, "id" | "timestamp">
) => {
  const storageKey = `swapback_history_${walletAddress}`;
  const stored = localStorage.getItem(storageKey);
  const existing: Transaction[] = stored ? JSON.parse(stored) : [];

  const newTx: Transaction = {
    ...tx,
    id: Date.now().toString(),
    timestamp: Date.now(),
  };

  const updated = [newTx, ...existing].slice(0, 100); // Garder les 100 dernières
  localStorage.setItem(storageKey, JSON.stringify(updated));
};

// Helper spécifique pour Lock
export const addLockTransaction = (
  walletAddress: string,
  params: {
    signature: string;
    inputAmount: number;
    lockDuration: number;
    lockLevel: string;
    lockBoost: number;
    status?: "success" | "pending" | "failed";
  }
) => {
  addTransactionToHistory(walletAddress, {
    signature: params.signature,
    type: "lock",
    router: "swapback",
    inputToken: "$BACK",
    outputToken: "cNFT",
    inputAmount: params.inputAmount,
    outputAmount: 1, // 1 cNFT
    lockDuration: params.lockDuration,
    lockLevel: params.lockLevel,
    lockBoost: params.lockBoost,
    status: params.status || "success",
    explorerUrl: getSolscanTxUrl(params.signature),
  });
};

// Helper spécifique pour Unlock
export const addUnlockTransaction = (
  walletAddress: string,
  params: {
    signature: string;
    outputAmount: number;
    lockLevel: string;
    status?: "success" | "pending" | "failed";
  }
) => {
  addTransactionToHistory(walletAddress, {
    signature: params.signature,
    type: "unlock",
    router: "swapback",
    inputToken: "cNFT",
    outputToken: "$BACK",
    inputAmount: 1, // 1 cNFT
    outputAmount: params.outputAmount,
    lockLevel: params.lockLevel,
    status: params.status || "success",
    explorerUrl: getSolscanTxUrl(params.signature),
  });
};

// DCA-specific helper
export const addDCATransaction = (
  walletAddress: string,
  params: {
    signature: string;
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    outputAmount: number;
    dcaInterval: number;
    dcaSwapsExecuted: number;
    dcaTotalSwaps: number;
    status?: "success" | "pending" | "failed";
  }
) => {
  addTransactionToHistory(walletAddress, {
    signature: params.signature,
    type: "dca",
    router: "swapback",
    inputToken: params.inputToken,
    outputToken: params.outputToken,
    inputAmount: params.inputAmount,
    outputAmount: params.outputAmount,
    dcaInterval: params.dcaInterval,
    dcaSwapsExecuted: params.dcaSwapsExecuted,
    dcaTotalSwaps: params.dcaTotalSwaps,
    status: params.status || "success",
    explorerUrl: getSolscanTxUrl(params.signature),
  });
};
