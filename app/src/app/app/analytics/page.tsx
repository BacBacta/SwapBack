"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const VolumeChart = dynamic(() => import("@/components/Charts").then(mod => ({ default: mod.VolumeChart })), { ssr: false });
const ActivityChart = dynamic(() => import("@/components/Charts").then(mod => ({ default: mod.ActivityChart })), { ssr: false });

export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-gray-400">Track protocol performance and trading metrics</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <div className="stat-card">
          <div className="text-gray-400 text-sm mb-2">24h Volume</div>
          <div className="text-2xl font-bold font-mono">$2.5M</div>
          <div className="text-xs text-primary mt-1">+12.5%</div>
        </div>
        <div className="stat-card">
          <div className="text-gray-400 text-sm mb-2">Total Trades</div>
          <div className="text-2xl font-bold font-mono">45,678</div>
          <div className="text-xs text-primary mt-1">+8.3%</div>
        </div>
        <div className="stat-card">
          <div className="text-gray-400 text-sm mb-2">Active Users</div>
          <div className="text-2xl font-bold font-mono">1,234</div>
          <div className="text-xs text-primary mt-1">+5.2%</div>
        </div>
        <div className="stat-card">
          <div className="text-gray-400 text-sm mb-2">TVL</div>
          <div className="text-2xl font-bold font-mono">$12.8M</div>
          <div className="text-xs text-primary mt-1">+15.7%</div>
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="swap-card"
        >
          <h2 className="text-xl font-bold mb-4">Volume Chart</h2>
          <VolumeChart />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="swap-card"
        >
          <h2 className="text-xl font-bold mb-4">Activity Chart</h2>
          <ActivityChart />
        </motion.div>
      </div>
    </div>
  );
}
