/**
 * Composant pour afficher les statistiques du buyback-burn
 */

'use client';

import { useBuybackStats } from '../hooks/useBuybackStats';
import { useState } from 'react';

export const BuybackStatsCard = () => {
  const { stats, estimation, loading, error, refresh } = useBuybackStats();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (error) {
    return (
      <div className="swap-card border-2 border-red-500/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold terminal-text terminal-glow uppercase tracking-wider text-red-400">
            [BUYBACK ERROR]
          </h3>
        </div>
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 border-2 border-red-500 text-red-400 hover:bg-red-500/10 transition-colors uppercase tracking-wider text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="swap-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold terminal-text terminal-glow uppercase tracking-wider">
          🔥 BUYBACK & BURN
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 border-2 border-[var(--accent)]">
            <span
              className={`w-2 h-2 bg-[var(--accent)] ${
                loading || isRefreshing ? 'animate-pulse' : ''
              }`}
              aria-hidden="true"
            ></span>
            <span className="text-xs terminal-text uppercase tracking-wider">
              {loading || isRefreshing ? '[UPDATING]' : '[LIVE]'}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="p-2 border-2 border-[var(--secondary)] hover:bg-[var(--secondary)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Refresh buyback stats"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total USDC Spent */}
        <div className="stat-card text-center group hover:scale-105 transition-transform">
          <div className="text-xs terminal-text opacity-70 mb-2 uppercase tracking-wider">
            [USDC SPENT]
          </div>
          <div className="text-2xl font-bold terminal-text terminal-glow">
            ${loading ? '...' : stats?.totalUsdcSpent || '0.00'}
          </div>
          <div className="text-xs terminal-text opacity-60 mt-1">
            💰 For buybacks
          </div>
        </div>

        {/* Total BACK Burned */}
        <div className="stat-card text-center group hover:scale-105 transition-transform">
          <div className="text-xs terminal-text opacity-70 mb-2 uppercase tracking-wider">
            [$BACK BURNED]
          </div>
          <div className="text-2xl font-bold text-[var(--accent)] terminal-glow">
            {loading ? '...' : stats?.totalBackBurned || '0.00'}
          </div>
          <div className="text-xs terminal-text opacity-60 mt-1">
            🔥 Deflationary
          </div>
        </div>

        {/* Buyback Count */}
        <div className="stat-card text-center group hover:scale-105 transition-transform">
          <div className="text-xs terminal-text opacity-70 mb-2 uppercase tracking-wider">
            [BUYBACKS EXECUTED]
          </div>
          <div className="text-2xl font-bold terminal-text terminal-glow">
            {loading ? '...' : stats?.buybackCount || '0'}
          </div>
          <div className="text-xs terminal-text opacity-60 mt-1">
            ⚡ Transactions
          </div>
        </div>

        {/* USDC Available */}
        <div className="stat-card text-center group hover:scale-105 transition-transform">
          <div className="text-xs terminal-text opacity-70 mb-2 uppercase tracking-wider">
            [VAULT BALANCE]
          </div>
          <div className="text-2xl font-bold text-[var(--secondary)] terminal-glow">
            ${loading ? '...' : estimation?.usdcAvailable.toFixed(2) || '0.00'}
          </div>
          <div className="text-xs terminal-text opacity-60 mt-1">
            📊 Ready for burn
          </div>
        </div>
      </div>

      {/* Next Buyback Estimation */}
      {estimation && (
        <div className="mt-6 p-4 border-2 border-[var(--accent)]/30 bg-[var(--accent)]/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm terminal-text uppercase tracking-wider">
              [NEXT BUYBACK ESTIMATE]
            </div>
            <div
              className={`px-2 py-1 text-xs border ${
                estimation.canExecute
                  ? 'border-green-500 text-green-400'
                  : 'border-yellow-500 text-yellow-400'
              }`}
            >
              {estimation.canExecute ? '✓ READY' : '○ PENDING'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Available:</span>
              <span className="ml-2 terminal-text font-mono">
                ${estimation.usdcAvailable.toFixed(2)} USDC
              </span>
            </div>
            <div>
              <span className="text-gray-400">Estimated $BACK:</span>
              <span className="ml-2 terminal-text font-sans text-[var(--accent)]">
                {estimation.estimatedBackAmount.toFixed(0)}
              </span>
            </div>
          </div>

          {!estimation.canExecute && estimation.reason && (
            <div className="mt-3 text-xs text-yellow-400 terminal-text">
              ⚠ {estimation.reason}
            </div>
          )}

          {estimation.canExecute && (
            <div className="mt-3 text-xs text-green-400 terminal-text">
              ✓ Buyback can be executed by admin
            </div>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700/50">
        <div className="text-xs terminal-text opacity-60 text-center">
          💡 40% of platform fees + 40% of routing profits are used for automatic buyback & burn
        </div>
      </div>
    </div>
  );
};
