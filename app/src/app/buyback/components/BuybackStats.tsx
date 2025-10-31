'use client';

import { formatUSDC, formatCompactNumber } from '@/utils/formatters';

interface BuybackStatsProps {
  totalUsdcSpent: number;
  totalBackBurned: number;
  buybackCount: number;
}

export default function BuybackStats({
  totalUsdcSpent,
  totalBackBurned,
  buybackCount,
}: BuybackStatsProps) {
  return (
    <>
      {/* Total USDC Spent */}
      <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/30 p-6 hover:border-[var(--primary)] transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
              Total USDC Spent
            </p>
            <p className="text-3xl font-bold terminal-text text-[var(--primary)] mt-2 terminal-glow">
              ${formatUSDC(totalUsdcSpent)}
            </p>
            <p className="text-xs text-[var(--primary)]/50 mt-1 uppercase tracking-wider">
              Used for buybacks
            </p>
          </div>
          <div className="bg-[var(--primary)]/20 p-4 border-2 border-[var(--primary)]/50">
            <span className="text-3xl">💰</span>
          </div>
        </div>
      </div>

      {/* Total $BACK Burned */}
      <div className="bg-black/40 backdrop-blur-sm border-2 border-orange-500/30 p-6 hover:border-orange-500 transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold terminal-text uppercase tracking-wider text-orange-400/70">
              Total $BACK Burned
            </p>
            <p className="text-3xl font-bold terminal-text text-orange-400 mt-2 terminal-glow">
              🔥 {formatCompactNumber(totalBackBurned)}
            </p>
            <p className="text-xs text-orange-400/50 mt-1 uppercase tracking-wider">
              Deflationary impact
            </p>
          </div>
          <div className="bg-orange-500/20 p-4 border-2 border-orange-500/50">
            <span className="text-3xl">🔥</span>
          </div>
        </div>
      </div>

      {/* Buyback Count */}
      <div className="bg-black/40 backdrop-blur-sm border-2 border-green-500/30 p-6 hover:border-green-500 transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold terminal-text uppercase tracking-wider text-green-400/70">
              Total Buybacks
            </p>
            <p className="text-3xl font-bold terminal-text text-green-400 mt-2 terminal-glow">
              {buybackCount}
            </p>
            <p className="text-xs text-green-400/50 mt-1 uppercase tracking-wider">
              Successful executions
            </p>
          </div>
          <div className="bg-green-500/20 p-4 border-2 border-green-500/50">
            <span className="text-3xl">✅</span>
          </div>
        </div>
      </div>
    </>
  );
}
