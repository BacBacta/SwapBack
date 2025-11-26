"use client";

import { motion } from "framer-motion";

export default function AnalyticsPage() {
  const stats = [
    { label: "24h Volume", value: "$2.5M", change: "+12%" },
    { label: "Total Trades", value: "45K", change: "+8%" },
    { label: "Active Users", value: "1.2K", change: "+5%" },
    { label: "TVL", value: "$12.8M", change: "+16%" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-8">
      {/* Minimal Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-4"
      >
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="text-3xl">📈</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white/90">
            Analytics
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Protocol performance metrics
        </p>
      </motion.div>

      {/* Stats Grid - Minimal 2x2 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + index * 0.05 }}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-emerald-500/30 transition-all"
          >
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div className="text-xl font-bold text-white/90 mb-1">{stat.value}</div>
            <div className="text-xs text-emerald-400">{stat.change}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Chart Placeholder - Minimal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/5 border border-white/10 rounded-xl p-6"
      >
        <h3 className="text-sm font-semibold text-white/90 mb-4">Volume (7 days)</h3>
        <div className="h-48 flex items-end gap-2">
          {[65, 85, 70, 95, 80, 100, 90].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-emerald-500/50 to-emerald-500/20 rounded-t"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-xs text-gray-500">{day}</div>
          ))}
        </div>
      </motion.div>

      {/* Activity Chart - Minimal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/5 border border-white/10 rounded-xl p-6"
      >
        <h3 className="text-sm font-semibold text-white/90 mb-4">Trades (7 days)</h3>
        <div className="h-48 flex items-end gap-2">
          {[70, 90, 65, 100, 75, 95, 85].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-cyan-500/50 to-cyan-500/20 rounded-t"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-xs text-gray-500">{day}</div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
