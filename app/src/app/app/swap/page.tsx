"use client";

import dynamicImport from "next/dynamic";
import { motion } from "framer-motion";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useState } from "react";

export const dynamic = "force-dynamic";

// Lazy load SimpleSwapCard (nouvelle interface épurée)
const SimpleSwapCard = dynamicImport(
  () => import("@/components/SimpleSwapCard").then(mod => ({ default: mod.SimpleSwapCard })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <div className="text-gray-400 text-sm">
              Chargement...
            </div>
          </div>
        </div>
      </div>
    )
  }
);

export default function SwapPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header Minimal */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-center mb-6"
        >
          <h1 className="text-xl font-semibold text-white">
            Swap
          </h1>
        </motion.div>

        {/* Interface de Swap Simplifiée */}
        <motion.div
          key={refreshKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <SimpleSwapCard />
        </motion.div>
      </div>
    </PullToRefresh>
  );
}
