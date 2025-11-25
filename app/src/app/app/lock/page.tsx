"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const LockInterface = dynamic(() => import("@/components/LockInterface"), { ssr: false });
const UnlockInterface = dynamic(() => import("@/components/UnlockInterface"), { ssr: false });

export default function LockPage() {
  const [activeTab, setActiveTab] = useState<"lock" | "unlock">("lock");

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-bold mb-2">Lock & Unlock</h1>
        <p className="text-gray-400">Lock your tokens to earn rewards or unlock them when needed</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setActiveTab("lock")}
          className={`
            px-6 py-3 rounded-lg font-medium transition-all
            ${activeTab === "lock"
              ? "bg-primary text-black"
              : "bg-primary/10 text-gray-300 hover:bg-primary/20"
            }
          `}
        >
          🔒 Lock Tokens
        </button>
        <button
          onClick={() => setActiveTab("unlock")}
          className={`
            px-6 py-3 rounded-lg font-medium transition-all
            ${activeTab === "unlock"
              ? "bg-primary text-black"
              : "bg-primary/10 text-gray-300 hover:bg-primary/20"
            }
          `}
        >
          🔓 Unlock Tokens
        </button>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "lock" ? <LockInterface /> : <UnlockInterface />}
      </motion.div>
    </div>
  );
}
