'use client';

import { formatUSDC, formatPercent } from '@/utils/formatters';

interface BuybackProgressBarProps {
  currentBalance: number;
  threshold: number;
  progressPercent: number;
}

export default function BuybackProgressBar({
  currentBalance,
  threshold,
  progressPercent,
}: BuybackProgressBarProps) {
  const isReady = progressPercent >= 100;

  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/30 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold terminal-text uppercase tracking-wider text-[var(--primary)]">
          Progress to Next Buyback
        </h3>
        <span className={`text-sm font-bold terminal-text ${isReady ? 'text-green-400' : 'text-[var(--primary)]'}`}>
          {formatPercent(progressPercent, 1)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-black/60 border-2 border-[var(--primary)]/20 h-6 mb-3 relative overflow-hidden">
        <div
          className={`h-full transition-all duration-500 relative ${
            isReady 
              ? 'bg-gradient-to-r from-green-500 to-[var(--secondary)]' 
              : 'bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]'
          }`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
        </div>
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-bold terminal-text text-black text-sm uppercase tracking-wider">
              READY! 🔥
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between text-sm text-[var(--primary)]/70 font-mono">
        <span>Current: ${formatUSDC(currentBalance)}</span>
        <span>Threshold: ${formatUSDC(threshold)}</span>
      </div>

      {isReady ? (
        <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/50 backdrop-blur-sm">
          <p className="text-sm font-bold terminal-text uppercase tracking-wider text-green-400">
            ✅ Buyback Ready! Threshold met.
          </p>
        </div>
      ) : (
        <div className="mt-4 p-4 bg-[var(--primary)]/10 border-2 border-[var(--primary)]/30 backdrop-blur-sm">
          <p className="text-sm text-[var(--primary)] font-mono">
            ${formatUSDC(threshold - currentBalance)} USDC needed to reach threshold
          </p>
        </div>
      )}
    </div>
  );
}
