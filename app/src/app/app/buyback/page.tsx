'use client';

import { motion } from 'framer-motion';
import { FireIcon } from '@heroicons/react/24/outline';
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
      <div className="max-w-4xl mx-auto">
        <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <FireIcon className="w-6 h-6 text-red-400" />
            <div>
              <p className="font-semibold text-red-400">Error Loading Data</p>
              <p className="text-sm text-red-400/70 mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !buybackState) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-20 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header épuré */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <FireIcon className="w-8 h-8 text-orange-400" />
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-400 to-emerald-400 bg-clip-text text-transparent">
            Buyback & Burn
          </h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base">
          Automated deflationary mechanism powered by swap fees
        </p>
      </motion.div>

      {/* Contenu principal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {/* Stats */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-xl p-4 sm:p-6">
          <BuybackStats
            totalUsdcSpent={buybackState.totalUsdcSpent}
            totalBackBurned={buybackState.totalBackBurned}
            buybackCount={buybackState.buybackCount}
          />
        </div>

        {/* Progress */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-xl p-4 sm:p-6">
          <BuybackProgressBar
            currentBalance={buybackState.vaultBalance || 0}
            threshold={buybackState.minBuybackAmount}
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
