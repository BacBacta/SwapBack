'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// Lazy load SimpleBuybackCard (nouvelle interface épurée)
const SimpleBuybackCard = dynamic(
  () => import('@/components/SimpleBuybackCard').then(mod => ({ default: mod.SimpleBuybackCard })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }
);

export default function BuybackPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header Minimal */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-center mb-6"
      >
        <h1 className="text-xl font-semibold text-white">Buyback & Burn</h1>
        <p className="text-sm text-gray-500 mt-1">
          Mécanisme de rachat automatique
        </p>
      </motion.div>

      {/* Interface Buyback Simplifiée */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SimpleBuybackCard />
      </motion.div>
    </div>
  );
}
