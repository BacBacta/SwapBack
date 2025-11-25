"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { 
  ClockIcon, 
  ChartBarIcon, 
  ShieldCheckIcon,
  CalendarIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon
} from "@heroicons/react/24/outline";

const DCAClient = dynamic(() => import("@/components/DCAClient"), { ssr: false });

export default function DCAPage() {
  const features = [
    {
      icon: ChartBarIcon,
      title: "Risk Reduction",
      description: "Smooth your purchases over time and minimize volatility impact",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      icon: ClockIcon,
      title: "Full Automation",
      description: "Set it and forget it - execute trades on your schedule",
      gradient: "from-cyan-500 to-blue-500",
    },
    {
      icon: ShieldCheckIcon,
      title: "Disciplined Trading",
      description: "Remove emotions and stick to your investment strategy",
      gradient: "from-blue-500 to-indigo-500",
    },
  ];

  const stats = [
    {
      icon: CalendarIcon,
      label: "Frequencies",
      value: "Hourly • Daily • Weekly • Monthly",
      color: "text-emerald-400",
    },
    {
      icon: ArrowTrendingDownIcon,
      label: "Slippage Protection",
      value: "1% Default Tolerance",
      color: "text-cyan-400",
    },
    {
      icon: CurrencyDollarIcon,
      label: "Min Investment",
      value: "As low as 0.01 SOL",
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
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 rounded-3xl blur-3xl opacity-50" />
          
          <div className="relative backdrop-blur-xl bg-[#0C0C0C]/60 border border-emerald-500/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-3">
                  Dollar-Cost Averaging
                </h1>
                <p className="text-gray-400 text-lg max-w-3xl">
                  Automate your token purchases over time and build your portfolio with confidence. 
                  DCA helps you invest systematically regardless of market conditions.
                </p>
              </div>
              
              {/* Decorative Icon */}
              <div className="hidden lg:block ml-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative backdrop-blur-xl bg-[#0C0C0C]/80 border border-emerald-500/30 rounded-full p-6">
                    <ChartBarIcon className="w-12 h-12 text-emerald-400" />
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
            <div className="relative backdrop-blur-xl bg-[#0C0C0C]/60 border border-emerald-500/20 rounded-xl p-6 hover:border-emerald-500/40 transition-all duration-300 h-full">
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

      {/* Main DCA Interface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="relative"
      >
        {/* Subtle Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-2xl blur-2xl" />
        
        {/* Content */}
        <div className="relative">
          <DCAClient />
        </div>
      </motion.div>
    </div>
  );
}
