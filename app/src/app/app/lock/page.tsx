"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { LockClosedIcon, LockOpenIcon, SparklesIcon, ClockIcon, TrophyIcon } from "@heroicons/react/24/outline";

const LockInterface = dynamic(() => import("@/components/LockInterface"), { ssr: false });
const UnlockInterface = dynamic(() => import("@/components/UnlockInterface"), { ssr: false });

export default function LockPage() {
  const [activeTab, setActiveTab] = useState<"lock" | "unlock">("lock");

  const tabs = [
    {
      id: "lock",
      label: "Lock Tokens",
      icon: LockClosedIcon,
      description: "Secure your tokens and earn rewards",
      gradient: "from-emerald-500 to-cyan-500",
    },
    {
      id: "unlock",
      label: "Unlock Tokens",
      icon: LockOpenIcon,
      description: "Release your locked tokens",
      gradient: "from-cyan-500 to-blue-500",
    },
  ];

  const features = [
    {
      icon: SparklesIcon,
      title: "Dynamic APY",
      description: "Earn up to 20% boost based on amount & duration",
    },
    {
      icon: ClockIcon,
      title: "Flexible Duration",
      description: "Lock from 7 days to 365+ days",
    },
    {
      icon: TrophyIcon,
      title: "Tiered Rewards",
      description: "Bronze to Diamond levels with increasing benefits",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              Lock & Earn
            </h1>
            <p className="text-gray-400 text-lg">
              Lock your BACK tokens to earn rewards and boost your trading benefits
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative backdrop-blur-xl bg-[#0C0C0C]/60 border border-emerald-500/20 rounded-xl p-4 hover:border-emerald-500/40 transition-all duration-300">
                <feature.icon className="w-8 h-8 text-emerald-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-400">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative"
      >
        {/* Glassmorphism Container */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-2xl p-2 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
          <div className="flex space-x-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "lock" | "unlock")}
                  className="relative flex-1 group"
                >
                  {/* Active Background */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} rounded-xl`}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  {/* Tab Content */}
                  <div className={`
                    relative px-6 py-4 rounded-xl transition-all duration-300
                    ${isActive 
                      ? "text-white" 
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                    }
                  `}>
                    <div className="flex items-center justify-center space-x-3">
                      <Icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
                      <div className="text-left">
                        <div className="font-semibold text-sm">{tab.label}</div>
                        {isActive && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs opacity-90 mt-0.5"
                          >
                            {tab.description}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hover Glow */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -20, scale: 0.95 }}
          transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
          className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.15)]"
        >
          {activeTab === "lock" ? <LockInterface /> : <UnlockInterface />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
