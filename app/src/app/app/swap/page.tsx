"use client";

import dynamicImport from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

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
            Chargement...
          </div>
        </div>
      </div>
    )
  }
);

export default function SwapPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Minimal */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
          Swap
        </h1>
        <p className="text-gray-400 text-sm">
          Trade tokens with best execution
        </p>
      </motion.div>

      {/* Main Swap Interface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <EnhancedSwapInterface />
      </motion.div>
    </div>
  );
}
