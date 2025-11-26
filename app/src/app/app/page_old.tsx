"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  ArrowsRightLeftIcon,
  ChartBarIcon,
  FireIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export default function AppHomePage() {
  const quickActions = [
    { 
      name: "Swap", 
      description: "Trade instantly",
      href: "/app/swap", 
      icon: ArrowsRightLeftIcon,
      gradient: "from-emerald-500 to-cyan-500",
      emoji: "⚡"
    },
    { 
      name: "DCA", 
      description: "Automate purchases",
      href: "/app/dca", 
      icon: ChartBarIcon,
      gradient: "from-cyan-500 to-blue-500",
      emoji: "📊"
    },
    { 
      name: "Buyback", 
      description: "Earn & burn",
      href: "/app/buyback", 
      icon: FireIcon,
      gradient: "from-orange-500 to-red-500",
      emoji: "🔥"
    },
  ];

  const stats = [
    { label: "Volume 24h", value: "$2.5M", change: "+12%" },
    { label: "Trades", value: "1.2K", change: "+8%" },
    { label: "TVL", value: "$12M", change: "+15%" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-8">
      {/* Minimal Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-4"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-white/90 mb-2">
          SwapBack
        </h1>
        <p className="text-sm text-gray-500">
          Trade smarter on Solana
        </p>
      </motion.div>

      {/* Stats - Horizontal minimal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center gap-8 py-4"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div className="text-lg font-semibold text-white/90">{stat.value}</div>
            <div className="text-xs text-emerald-400">{stat.change}</div>
          </div>
        ))}
      </motion.div>

      {/* Quick Actions - Card moderne */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {quickActions.map((action) => (
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
