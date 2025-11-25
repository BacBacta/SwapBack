"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  ArrowTrendingUpIcon, 
  FireIcon, 
  ChartBarIcon,
  ClockIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

export default function AppHomePage() {
  const stats = [
    { label: "Total Volume", value: "$12.5M", change: "+12.5%", trend: "up" },
    { label: "Active Users", value: "1,234", change: "+5.2%", trend: "up" },
    { label: "Total Swaps", value: "45.6K", change: "+8.1%", trend: "up" },
    { label: "Buyback Pool", value: "$450K", change: "+15.3%", trend: "up" },
  ];

  const quickActions = [
    { 
      name: "Quick Swap", 
      description: "Swap tokens instantly",
      href: "/app/swap", 
      icon: ArrowsRightLeftIcon,
      color: "from-primary to-emerald-400"
    },
    { 
      name: "Create DCA", 
      description: "Dollar-cost averaging",
      href: "/app/dca", 
      icon: ChartBarIcon,
      color: "from-secondary to-cyan-400"
    },
    { 
      name: "Buyback & Burn", 
      description: "Claim your rewards",
      href: "/app/buyback", 
      icon: FireIcon,
      color: "from-amber-500 to-orange-400"
    },
  ];

  const recentActivity = [
    { type: "swap", token: "SOL → USDC", amount: "100 SOL", time: "2 min ago" },
    { type: "dca", token: "USDC → SOL", amount: "50 USDC", time: "15 min ago" },
    { type: "buyback", token: "Claimed", amount: "25 BACK", time: "1 hour ago" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2">
          Welcome to <span className="text-primary">SwapBack</span>
        </h1>
        <p className="text-gray-400 text-lg">
          Your dashboard for decentralized trading on Solana
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">{stat.label}</span>
              <span className="text-xs text-primary font-mono">{stat.change}</span>
            </div>
            <div className="text-2xl font-bold font-mono">{stat.value}</div>
          </div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <ArrowTrendingUpIcon className="h-6 w-6 mr-2 text-primary" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                href={action.href}
                className="group swap-card hover:scale-105 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">
                  {action.name}
                </h3>
                <p className="text-sm text-gray-400">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center">
            <ClockIcon className="h-6 w-6 mr-2 text-primary" />
            Recent Activity
          </h2>
          <Link
            href="/app/history"
            className="text-sm text-primary hover:text-primary-light transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="swap-card">
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-primary/10 last:border-0"
              >
                <div className="flex items-center space-x-3">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${activity.type === 'swap' ? 'bg-primary/10 text-primary' : ''}
                    ${activity.type === 'dca' ? 'bg-secondary/10 text-secondary' : ''}
                    ${activity.type === 'buyback' ? 'bg-amber-500/10 text-amber-500' : ''}
                  `}>
                    {activity.type === 'swap' && <ArrowsRightLeftIcon className="h-5 w-5" />}
                    {activity.type === 'dca' && <ChartBarIcon className="h-5 w-5" />}
                    {activity.type === 'buyback' && <FireIcon className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="font-medium">{activity.token}</div>
                    <div className="text-sm text-gray-400 font-mono">{activity.amount}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Command Palette Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center"
      >
        <p className="text-sm text-gray-500">
          💡 Pro tip: Press{" "}
          <kbd className="px-2 py-1 text-xs font-mono bg-gray-800/50 rounded border border-gray-700">
            ⌘K
          </kbd>{" "}
          or{" "}
          <kbd className="px-2 py-1 text-xs font-mono bg-gray-800/50 rounded border border-gray-700">
            Ctrl+K
          </kbd>{" "}
          for quick navigation
        </p>
      </motion.div>
    </div>
  );
}
