"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ClockIcon } from "@heroicons/react/24/outline";

const DCAClient = dynamic(() => import("@/components/DCAClient"), { ssr: false });

export default function DCAPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4">
      {/* Header épuré */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <ClockIcon className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Dollar-Cost Averaging
          </h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base">
          Automate your token purchases over time
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
