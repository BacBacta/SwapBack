'use client';

import { motion } from 'framer-motion';
import { ChartPieIcon } from '@heroicons/react/24/outline';

export default function PortfolioPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <ChartPieIcon className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Portfolio
          </h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base">
          Track your assets and performance
        </p>
      </motion.div>

      {/* Coming Soon */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-xl p-8 text-center"
      >
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-white mb-2">Coming Soon</h2>
        <p className="text-gray-400">
          Portfolio tracking and analytics are under development
        </p>
      </motion.div>
    </div>
  );
}
