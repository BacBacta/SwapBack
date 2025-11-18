"use client";

import { useState } from "react";
import { useOnChainHistory, getTransactionStats } from "@/hooks/useOnChainHistory";
import { getSolscanTxUrl } from "@/utils/explorer";
import Link from "next/link";

interface OnChainHistoryWidgetProps {
  limit?: number;
  compact?: boolean;
}

export default function OnChainHistoryWidget({ 
  limit = 5, 
  compact = true 
}: OnChainHistoryWidgetProps) {
  const { transactions, isLoading, error, refresh } = useOnChainHistory({ limit });
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading) {
    return (
      <div className="glass-effect rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin text-3xl">⏳</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-effect rounded-xl p-6 border border-red-500/30">
        <div className="text-center text-red-400">
          <span className="text-2xl block mb-2">⚠️</span>
          <p className="text-sm">Error loading transactions</p>
        </div>
      </div>
    );
  }

  const stats = getTransactionStats(transactions);

  return (
    <div className="glass-effect rounded-xl p-6 border border-gray-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold terminal-text">
            <span className="terminal-prefix">&gt;</span> Recent Transactions
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Last {transactions.length} on-chain transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
          </button>
          <Link
            href="/history"
            className="px-3 py-1 text-xs bg-primary/10 border border-primary/30 rounded text-primary hover:bg-primary/20"
          >
            View All →
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      {!compact && transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-black/30 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Success Rate</div>
            <div className="text-lg font-bold text-green-400">
              {((stats.success / stats.total) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="p-3 bg-black/30 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Avg Fee</div>
            <div className="text-lg font-bold text-blue-400">
              {stats.averageFee.toFixed(6)} SOL
            </div>
          </div>
          <div className="p-3 bg-black/30 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Total</div>
            <div className="text-lg font-bold text-primary">
              {stats.total}
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <span className="text-3xl block mb-2">📭</span>
          <p className="text-sm">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.signature}
              className="p-3 bg-black/30 rounded-lg hover:bg-black/50 transition-colors cursor-pointer"
              onClick={() => setShowDetails(!showDetails)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={tx.success ? "text-green-400" : "text-red-400"}>
                      {tx.success ? "✅" : "❌"}
                    </span>
                    <span className="text-xs font-mono text-gray-400 truncate">
                      {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>
                      {tx.blockTime
                        ? new Date(tx.blockTime * 1000).toLocaleDateString()
                        : "Pending"}
                    </span>
                    <span>{tx.instructions.length} instructions</span>
                    <span>{tx.fee.toFixed(6)} SOL</span>
                  </div>
                </div>
                <a
                  href={getSolscanTxUrl(tx.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="px-2 py-1 text-xs bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/20 whitespace-nowrap"
                >
                  View ↗
                </a>
              </div>

              {/* Expanded Details */}
              {showDetails && tx.balanceChanges.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-2 font-bold">Balance Changes:</div>
                  <div className="space-y-1">
                    {tx.balanceChanges.slice(0, 3).map((change, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 truncate max-w-[200px]">
                          {change.account.slice(0, 4)}...{change.account.slice(-4)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
