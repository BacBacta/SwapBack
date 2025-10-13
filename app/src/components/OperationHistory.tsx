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
          <h2 className="text-2xl font-bold">🔍 Operation History</h2>
          <button
            onClick={refreshOperations}
            disabled={loading}
            className="px-4 py-2 bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30 rounded-lg transition-colors"
          >
            {loading ? "⏳" : "🔄"} Refresh
          </button>
        </div>

        {/* Statistiques */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 p-4 rounded-lg border border-blue-500/20">
              <div className="text-sm text-gray-400 mb-1">Total Swaps</div>
              <div className="text-2xl font-bold text-blue-400">{statistics.totalSwaps}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 p-4 rounded-lg border border-green-500/20">
              <div className="text-sm text-gray-400 mb-1">Total Locks</div>
              <div className="text-2xl font-bold text-green-400">{statistics.totalLocks}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 p-4 rounded-lg border border-purple-500/20">
              <div className="text-sm text-gray-400 mb-1">Volume Total</div>
              <div className="text-2xl font-bold text-purple-400">
                ${formatAmount(statistics.totalVolume)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-[var(--primary)]/10 to-[var(--primary)]/20 p-4 rounded-lg border border-[var(--primary)]/30">
              <div className="text-sm text-gray-400 mb-1">Économies</div>
              <div className="text-2xl font-bold text-[var(--primary)]">
                ${formatAmount(statistics.totalSavings)}
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => setFilterType(undefined)}
            className={`px-4 py-2 rounded-lg transition-all ${
              !filterType
                ? "bg-white/10 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            All
          </button>
          {Object.values(OperationType).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg transition-all ${
                filterType === type
                  ? "bg-white/10 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {getOperationIcon(type)} {type}
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
        <div className="text-center py-12">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Chargement des opérations...</p>
        </div>
      ) : filteredOps.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-gray-400">
            {filterType
              ? `Aucune opération de type ${filterType}`
              : "Aucune opération trouvée"}
          </p>
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
