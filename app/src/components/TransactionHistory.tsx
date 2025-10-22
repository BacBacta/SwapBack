"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Transaction {
  id: string;
  signature: string;
  timestamp: number;
  type: "swap" | "lock" | "unlock";
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
  const [filter, setFilter] = useState<"all" | "swap" | "lock" | "unlock">(
    "all"
  );

  // Charger l'historique depuis localStorage
  useEffect(() => {
    if (connected && publicKey) {
      const storageKey = `swapback_history_${publicKey.toString()}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTransactions(parsed);
        } catch (e) {
          console.error("Erreur lors du chargement de l'historique:", e);
        }
      }
    }
  }, [connected, publicKey]);

  // Fonction pour ajouter une transaction (exportée via context ou props)
  const addTransaction = (tx: Omit<Transaction, "id" | "timestamp">) => {
    const newTx: Transaction = {
      ...tx,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const updated = [newTx, ...transactions].slice(0, 50); // Garder les 50 dernières
    setTransactions(updated);

    // Sauvegarder dans localStorage
    if (publicKey) {
      const storageKey = `swapback_history_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  };

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
              {(["all", "swap", "lock", "unlock"] as const).map((f) => (
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
                            [{tx.type.toUpperCase()}]
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
                                  href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1 text-xs border-2 border-[var(--primary)] terminal-text hover:bg-[var(--primary)]/20"
                                >
                                  [SOLANA_EXPLORER]
                                </a>
                                <a
                                  href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1 text-xs border-2 border-[var(--primary)] terminal-text hover:bg-[var(--primary)]/20"
                                >
                                  [SOLSCAN]
                                </a>
                                <a
                                  href={`https://xray.helius.xyz/tx/${tx.signature}?network=devnet`}
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
                                  DEVNET
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

// Hook pour utiliser addTransaction dans d'autres composants
export const useTransactionHistory = () => {
  const [addTxCallback, setAddTxCallback] = useState<
    ((tx: Omit<Transaction, "id" | "timestamp">) => void) | null
  >(null);

  return { addTransaction: addTxCallback };
};
