"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";

// Lazy load SimpleDCACard (nouvelle interface épurée)
const SimpleDCACard = dynamic(
  () => import("@/components/SimpleDCACard").then(mod => ({ default: mod.SimpleDCACard })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }
);

export default function DCAPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header Minimal */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-center mb-6"
      >
        <h1 className="text-xl font-semibold text-white">DCA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Automatisez vos achats
        </p>
      </motion.div>

      {/* Interface DCA Simplifiée */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SimpleDCACard />
      </motion.div>
    </div>
  );
}
