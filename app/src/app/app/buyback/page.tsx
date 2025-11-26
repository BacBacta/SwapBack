'use client';

import { motion } from 'framer-motion';
import { useBuybackState } from '@/hooks/useBuybackState';
import BuybackStats from './components/BuybackStats';
import BuybackProgressBar from './components/BuybackProgressBar';
import ExecuteBuybackButton from './components/ExecuteBuybackButton';
import BuybackChart from './components/BuybackChart';
import RecentBuybacks from './components/RecentBuybacks';

export default function BuybackPage() {
  const { buybackState, isLoading, error } = useBuybackState();

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <p className="text-red-400 text-sm">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !buybackState) {
    return (
      <div className="max-w-3xl mx-auto px-4 space-y-4 animate-pulse">
        <div className="h-20 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 space-y-6">
      {/* Minimal Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-4"
      >
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="text-3xl">🔥</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white/90">
            Buyback
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Automated token burn mechanism
        </p>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {/* Stats */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
          <BuybackStats
            totalUsdcSpent={buybackState.totalUsdcSpent}
            totalBackBurned={buybackState.totalBackBurned}
            buybackCount={buybackState.buybackCount}
          />
        </div>

        {/* Progress */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
          <BuybackProgressBar
            currentBalance={buybackState.vaultBalance || 0}
            threshold={buybackState.minBuybackAmount}
            progressPercent={buybackState.progressPercent || 0}
          />
        </div>

        {/* Execute Button */}
        {buybackState.canExecute && (
          <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4 sm:p-6">
            <ExecuteBuybackButton />
          </div>
        )}

        {/* Chart */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
          <BuybackChart />
        </div>

        {/* Recent */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
          <RecentBuybacks />
        </div>
      </motion.div>
    </div>
  );
}
            progressPercent={buybackState.progressPercent || 0}
          />
        </div>

        {/* Execute Button */}
        {buybackState.canExecute && (
          <div className="backdrop-blur-xl bg-gradient-to-r from-orange-500/20 to-emerald-500/20 border border-orange-500/30 rounded-xl p-4 sm:p-6">
            <ExecuteBuybackButton />
          </div>
        )}

        {/* Chart */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-xl p-4 sm:p-6">
          <BuybackChart />
        </div>

        {/* Recent */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-xl p-4 sm:p-6">
          <RecentBuybacks />
        </div>
      </motion.div>
    </div>
  );
}
