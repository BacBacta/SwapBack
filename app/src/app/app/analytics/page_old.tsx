"use client";

import { motion } from "framer-motion";
import { 
  ChartBarIcon, 
  ArrowTrendingUpIcon,
  UsersIcon,
  CurrencyDollarIcon 
} from "@heroicons/react/24/outline";

export default function AnalyticsPage() {
  // Mock data for charts
  const volumeData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    volumes: [125000, 185000, 145000, 210000, 190000, 225000, 250000],
  };

  const activityData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    counts: [450, 680, 520, 780, 650, 820, 920],
  };

  const stats = [
    {
      icon: ChartBarIcon,
      label: "24h Volume",
      value: "$2.5M",
      change: "+12.5%",
      color: "text-cyan-400",
    },
    {
      icon: ArrowTrendingUpIcon,
      label: "Total Trades",
      value: "45,678",
      change: "+8.3%",
      color: "text-emerald-400",
    },
    {
      icon: UsersIcon,
      label: "Active Users",
      value: "1,234",
      change: "+5.2%",
      color: "text-blue-400",
    },
    {
      icon: CurrencyDollarIcon,
      label: "TVL",
      value: "$12.8M",
      change: "+15.7%",
      color: "text-purple-400",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-3">
          Analytics Dashboard
        </h1>
        <p className="text-gray-400 text-lg">
          Track protocol performance and trading metrics
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.05 }}
            className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
              <span className="text-xs text-emerald-400 font-medium">{stat.change}</span>
            </div>
            <div className="text-gray-400 text-sm mb-1">{stat.label}</div>
            <div className="text-2xl font-bold font-mono">{stat.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)]"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
            <ChartBarIcon className="w-5 h-5 text-cyan-400" />
            <span>Volume Chart</span>
          </h2>
          <div className="h-64 flex items-center justify-center border border-white/5 rounded-lg">
            <div className="text-center space-y-2">
              <div className="text-4xl">📊</div>
              <div className="text-sm text-gray-400">
                Volume: {volumeData.volumes.reduce((a, b) => a + b, 0).toLocaleString()} total
              </div>
              <div className="text-xs text-gray-500">Chart visualization coming soon</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-purple-500/20 rounded-xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.15)]"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-purple-400" />
            <span>Activity Chart</span>
          </h2>
          <div className="h-64 flex items-center justify-center border border-white/5 rounded-lg">
            <div className="text-center space-y-2">
              <div className="text-4xl">📈</div>
              <div className="text-sm text-gray-400">
                Trades: {activityData.counts.reduce((a, b) => a + b, 0).toLocaleString()} total
              </div>
              <div className="text-xs text-gray-500">Chart visualization coming soon</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Additional Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-emerald-500/20 rounded-xl p-6"
      >
        <h2 className="text-xl font-bold mb-4">Weekly Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border border-white/5 rounded-lg">
            <div className="text-gray-400 text-sm mb-1">Avg Daily Volume</div>
            <div className="text-2xl font-bold text-cyan-400">$357K</div>
          </div>
          <div className="text-center p-4 border border-white/5 rounded-lg">
            <div className="text-gray-400 text-sm mb-1">Avg Daily Trades</div>
            <div className="text-2xl font-bold text-purple-400">131</div>
          </div>
          <div className="text-center p-4 border border-white/5 rounded-lg">
            <div className="text-gray-400 text-sm mb-1">Growth Rate</div>
            <div className="text-2xl font-bold text-emerald-400">+18.5%</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
