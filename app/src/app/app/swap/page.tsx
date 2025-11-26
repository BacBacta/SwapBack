"use client";

import dynamicImport from "next/dynamic";
import { motion } from "framer-motion";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useState } from "react";

export const dynamic = "force-dynamic";

// Lazy load EnhancedSwapInterface to avoid webpack issues on Vercel
const EnhancedSwapInterface = dynamicImport(
  () => import("@/components/EnhancedSwapInterface").then(mod => ({ default: mod.EnhancedSwapInterface })),
  { 
    ssr: false,
    loading: () => (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-30 animate-pulse" />
            <div className="relative w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          </div>
          <div className="text-gray-400 font-medium animate-pulse">
            Chargement du swap...
          </div>
        </div>
      </div>
    )
  }
);

export default function SwapPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Header Minimal */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center pt-4"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            <span className="mr-2">⚡</span>Swap
          </h1>
          <p className="text-gray-400 text-sm">
            Trade tokens instantly with best rates
          </p>
        </motion.div>

        {/* Main Swap Interface */}
        <motion.div
          key={refreshKey}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <EnhancedSwapInterface />
        </motion.div>
      </div>
    </PullToRefresh>
  );
}
