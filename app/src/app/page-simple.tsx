"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"swap" | "dashboard">("swap");

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      {/* NAVIGATION */}
      <nav className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              {/* LOGO */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">S</span>
                </div>
                <span className="text-white font-bold text-2xl">SwapBack</span>
              </div>

              {/* TABS */}
              <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab("swap")}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    activeTab === "swap"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  🔄 Swap
                </button>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    activeTab === "dashboard"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  📊 Dashboard
                </button>
              </div>
            </div>

            {/* WALLET BUTTON */}
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === "swap" && (
            <div className="space-y-8">
              {/* Swap Interface Card */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Smart Router Swap</h2>
                <p className="text-gray-300 mb-4">
                  ✨ Application is loading... The Smart Router interface will appear here.
                </p>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    🔄 Initializing Enhanced Swap Interface and Route Comparison...
                  </p>
                </div>
              </div>

              {/* Route Comparison Card */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
                <h3 className="text-xl font-bold text-white mb-4">Route Comparison</h3>
                <p className="text-gray-300">
                  📊 Best routes comparison will be displayed here
                </p>
              </div>
            </div>
          )}
          {activeTab === "dashboard" && (
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
              <p className="text-gray-300">Dashboard content loading...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
