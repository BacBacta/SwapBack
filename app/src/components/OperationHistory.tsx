"use client";

import { useState } from "react";
import { useBlockchainTracer, useFilteredOperations } from "../hooks/useBlockchainTracer";
import { OperationType } from "@swapback/sdk";

export const OperationHistory = () => {
  const {
    operations,
    loading,
    error,
    refreshOperations,
    statistics
  } = useBlockchainTracer();

  const [filterType, setFilterType] = useState<OperationType | undefined>(undefined);
  const [showExportModal, setShowExportModal] = useState(false);

  const filteredOps = useFilteredOperations(operations, {
    type: filterType
  });

  const getOperationIcon = (type: OperationType): string => {
    switch (type) {
      case OperationType.SWAP:
        return "🔄";
      case OperationType.LOCK:
        return "🔒";
      case OperationType.UNLOCK:
        return "🔓";
      case OperationType.STAKE:
        return "📈";
      case OperationType.UNSTAKE:
        return "📉";
      case OperationType.CLAIM_REWARD:
        return "💰";
      case OperationType.BURN:
        return "🔥";
      default:
        return "📝";
    }
  };

  const getOperationColor = (type: OperationType): string => {
    switch (type) {
      case OperationType.SWAP:
        return "text-blue-400";
      case OperationType.LOCK:
      case OperationType.STAKE:
        return "text-green-400";
      case OperationType.UNLOCK:
      case OperationType.UNSTAKE:
        return "text-yellow-400";
      case OperationType.CLAIM_REWARD:
        return "text-purple-400";
      case OperationType.BURN:
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number | undefined): string => {
    if (!amount) return "-";
    return amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  return (
    <div className="swap-card">
      {/* Header avec statistiques */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Operation History</h2>
            <p className="text-sm text-gray-400">Track all your blockchain transactions</p>
          </div>
          <button
            onClick={refreshOperations}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-[var(--primary)]/20 to-[var(--secondary)]/20 hover:from-[var(--primary)]/30 hover:to-[var(--secondary)]/30 rounded-lg transition-all duration-300 font-semibold border border-[var(--primary)]/30 hover:border-[var(--primary)]/50 hover:scale-105"
          >
            <span className="flex items-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Refresh</span>
                </>
              )}
            </span>
          </button>
        </div>

        {/* Statistiques */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="stat-card group cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🔄</span>
                </div>
                <span className="text-xs text-blue-400 font-semibold">+12%</span>
              </div>
              <div className="text-sm text-gray-400 mb-1">Total Swaps</div>
              <div className="text-2xl font-bold text-white">{statistics.totalSwaps}</div>
            </div>
            
            <div className="stat-card group cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--secondary)]/20 to-[var(--secondary)]/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🔒</span>
                </div>
                <span className="text-xs text-[var(--secondary)] font-semibold">+8%</span>
              </div>
              <div className="text-sm text-gray-400 mb-1">Total Locks</div>
              <div className="text-2xl font-bold text-white">{statistics.totalLocks}</div>
            </div>
            
            <div className="stat-card group cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">💎</span>
                </div>
                <span className="text-xs text-[var(--primary)] font-semibold">+25%</span>
              </div>
              <div className="text-sm text-gray-400 mb-1">Total Volume</div>
              <div className="text-2xl font-bold text-white">
                ${formatAmount(statistics.totalVolume)}
              </div>
            </div>
            
            <div className="stat-card group cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">💰</span>
                </div>
                <span className="text-xs text-[var(--accent)] font-semibold">+18%</span>
              </div>
              <div className="text-sm text-gray-400 mb-1">Total Savings</div>
              <div className="text-2xl font-bold text-white">
                ${formatAmount(statistics.totalSavings)}
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => setFilterType(undefined)}
            className={`px-4 py-2 rounded-lg transition-all duration-300 font-semibold ${
              !filterType
                ? "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-lg shadow-[var(--primary)]/30"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>🎯</span>
              <span>All</span>
            </span>
          </button>
          {Object.values(OperationType).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg transition-all duration-300 font-semibold ${
                filterType === type
                  ? "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-lg shadow-[var(--primary)]/30"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>{getOperationIcon(type)}</span>
                <span>{type}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      )}

      {/* Liste des opérations */}
      {loading && operations.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 rounded-2xl flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-[var(--primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-400 font-medium">Loading operations...</p>
          <p className="text-xs text-gray-500 mt-2">Fetching from blockchain</p>
        </div>
      ) : filteredOps.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-500/20 to-gray-500/5 rounded-2xl flex items-center justify-center">
            <span className="text-4xl">📭</span>
          </div>
          <p className="text-gray-400 font-medium mb-2">
            {filterType
              ? `No ${filterType} operations found`
              : "No operations yet"}
          </p>
          <p className="text-xs text-gray-500">Start trading to see your history here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOps.map((op) => (
            <div
              key={op.id}
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-[var(--primary)]/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getOperationIcon(op.type)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${getOperationColor(op.type)}`}>
                        {op.type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          op.status === "SUCCESS"
                            ? "bg-green-500/20 text-green-400"
                            : op.status === "FAILED"
                            ? "bg-red-500/20 text-red-400"
                            : op.status === "PENDING"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {op.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{formatDate(op.timestamp)}</p>
                  </div>
                </div>
                <a
                  href={`https://explorer.solana.com/tx/${op.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:text-[var(--primary)]/80 text-sm"
                >
                  🔗 Explorer
                </a>
              </div>

              {/* Détails spécifiques */}
              {op.type === OperationType.SWAP && op.details && 'inputAmount' in op.details && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Entrée:</span>{" "}
                    <span className="text-white font-medium">
                      {formatAmount(op.details.inputAmount)} {op.details.inputToken}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Sortie:</span>{" "}
                    <span className="text-white font-medium">
                      {formatAmount(op.details.outputAmount)} {op.details.outputToken}
                    </span>
                  </div>
                  {op.details.route && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Route:</span>{" "}
                      <span className="text-white font-medium">
                        {op.details.route.join(" → ")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {op.type === OperationType.LOCK && op.details && 'amount' in op.details && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Montant:</span>{" "}
                    <span className="text-white font-medium">
                      {formatAmount(op.details.amount)} {op.details.token}
                    </span>
                  </div>
                  {'duration' in op.details && (
                    <div>
                      <span className="text-gray-400">Durée:</span>{" "}
                      <span className="text-white font-medium">{op.details.duration} jours</span>
                    </div>
                  )}
                </div>
              )}

              {/* Métadonnées */}
              <div className="mt-3 pt-3 border-t border-gray-700 flex gap-4 text-xs text-gray-400">
                {op.npi && (
                  <div>
                    <span className="text-blue-400">💎 NPI:</span> {formatAmount(op.npi)}
                  </div>
                )}
                {op.rebate && (
                  <div>
                    <span className="text-green-400">💰 Rebate:</span> {formatAmount(op.rebate)}
                  </div>
                )}
                {op.burn && (
                  <div>
                    <span className="text-red-400">🔥 Burn:</span> {formatAmount(op.burn)}
                  </div>
                )}
              </div>

              {/* Signature (tronquée) */}
              <div className="mt-2 font-mono text-xs text-gray-500">
                {op.signature.substring(0, 20)}...{op.signature.substring(op.signature.length - 20)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
