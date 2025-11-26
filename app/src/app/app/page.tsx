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
          <Link
            key={action.name}
            href={action.href}
            className="group relative"
          >
            <motion.div
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="relative overflow-hidden rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-emerald-500/50 transition-all duration-300"
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              <div className="relative">
                {/* Icon */}
                <div className="text-4xl mb-3">{action.emoji}</div>
                
                {/* Text */}
                <h3 className="text-lg font-bold text-white mb-1">
                  {action.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {action.description}
                </p>
              </div>
            </motion.div>
          </Link>
        ))}
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center py-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <SparklesIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">All trades are secured by Solana</span>
        </div>
      </motion.div>
    </div>
  );
}
