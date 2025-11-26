"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const DCAClient = dynamic(() => import("@/components/DCAClient"), { ssr: false });

export default function DCAPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 space-y-6">
      {/* Minimal Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-4"
      >
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="text-3xl">📊</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white/90">
            DCA
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Automate your token purchases
        </p>
      </motion.div>

      {/* Interface principale */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <DCAClient />
      </motion.div>
    </div>
  );
}
