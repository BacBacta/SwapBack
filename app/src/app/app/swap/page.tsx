"use client";

import dynamicImport from "next/dynamic";
import { motion } from "framer-motion";
import {
  ArrowsRightLeftIcon,
  BoltIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

// Lazy load EnhancedSwapInterface to avoid webpack issues on Vercel
const EnhancedSwapInterface = dynamicImport(
  () => import("@/components/EnhancedSwapInterface").then(mod => ({ default: mod.EnhancedSwapInterface })),
  { 
    ssr: false,
    loading: () => (
      <div className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-cyan-500/20 rounded-2xl p-12 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl opacity-50 animate-pulse" />
            <ArrowsRightLeftIcon className="relative w-12 h-12 text-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="text-cyan-400 font-medium animate-pulse">
            Chargement de l'interface de swap...
          </div>
        </div>
      </div>
    )
  }
);

export default function SwapPage() {
  const features = [
    {
      icon: BoltIcon,
      title: "Best Execution",
      description: "Optimal routing across multiple DEXs for best prices",
      gradient: "from-cyan-500 to-blue-500",
    },
    {
      icon: ShieldCheckIcon,
      title: "Secure & Reliable",
      description: "Audited smart contracts with slippage protection",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      icon: CurrencyDollarIcon,
      title: "Low Fees",
      description: "Competitive fees with buyback rewards for holders",
      gradient: "from-blue-500 to-indigo-500",
    },
  ];

  const stats = [
    {
      icon: ChartBarIcon,
      label: "Smart Routing",
      value: "Multi-DEX aggregation",
      color: "text-cyan-400",
    },
    {
      icon: SparklesIcon,
      label: "Slippage Control",
      value: "Customizable tolerance",
      color: "text-emerald-400",
    },
    {
      icon: CheckBadgeIcon,
      label: "Token Support",
      value: "SPL & Token-2022",
      color: "text-blue-400",
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
        <div className="relative">
          {/* Gradient Glow Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-blue-500/20 rounded-3xl blur-3xl opacity-50" />
          
          <div className="relative backdrop-blur-xl bg-[#0C0C0C]/60 border border-cyan-500/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(6,182,212,0.2)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-emerald-400 to-blue-400 bg-clip-text text-transparent mb-3">
                  Token Swap
                </h1>
                <p className="text-gray-400 text-lg max-w-3xl">
                  Trade tokens on Solana with intelligent routing and best execution. 
                  Get optimal prices across multiple DEXs in a single transaction.
                </p>
              </div>
              
              {/* Decorative Icon */}
              <div className="hidden lg:block ml-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative backdrop-blur-xl bg-[#0C0C0C]/80 border border-cyan-500/30 rounded-full p-6">
                    <ArrowsRightLeftIcon className="w-12 h-12 text-cyan-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  className="flex items-center space-x-3 backdrop-blur-sm bg-white/5 rounded-lg p-3 border border-white/10"
                >
                  <stat.icon className={`w-5 h-5 ${stat.color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 font-medium">{stat.label}</div>
                    <div className="text-sm text-white font-semibold truncate">{stat.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + 0.1 * index }}
            className="group relative"
          >
            {/* Hover Glow */}
            <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
            
            {/* Card Content */}
            <div className="relative backdrop-blur-xl bg-[#0C0C0C]/60 border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-500/40 transition-all duration-300 h-full">
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.gradient} mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2">
                {feature.title}
              </h3>
              
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Swap Interface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="relative"
      >
        {/* Subtle Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl blur-2xl" />
        
        {/* Content */}
        <div className="relative">
          <EnhancedSwapInterface />
        </div>
      </motion.div>
    </div>
  );
}
