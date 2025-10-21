"use client";

import { useState } from "react";
import { EnhancedSwapInterface } from "@/components/EnhancedSwapInterface";
import { RouteComparison } from "@/components/RouteComparison";
import { SwapBackDashboard } from "@/components/SwapBackDashboard";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { KeyboardShortcutsHelper } from "@/components/KeyboardShortcutsHelper";

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
              {/* Smart Router Swap Interface */}
              <EnhancedSwapInterface />
              
              {/* Route Comparison - Shows best routes */}
              <RouteComparison />
            </div>
          )}
          {activeTab === "dashboard" && <SwapBackDashboard />}

          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="swap-card text-center group">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-4xl">🚀</span>
              </div>
              <h3 className="card-title mb-3">Best Execution</h3>
              <p className="body-regular text-gray-400 leading-relaxed">
                Intelligent routing via Metis, Juno and RFQ for the best price
              </p>
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-xs text-[var(--secondary)] font-semibold">
                  Up to 2.5% Better
                </span>
              </div>
            </div>

            <div className="swap-card text-center group">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[var(--secondary)]/20 to-[var(--secondary)]/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-4xl">💰</span>
              </div>
              <h3 className="card-title mb-3">70-80% Cashback</h3>
              <p className="body-regular text-gray-400 leading-relaxed">
                Receive up to 80% of generated surplus as rebates
              </p>
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-xs text-[var(--secondary)] font-semibold">
                  Instant Rewards
                </span>
              </div>
            </div>

            <div className="swap-card text-center group">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-4xl">🔥</span>
              </div>
              <h3 className="card-title mb-3">Automatic Burn</h3>
              <p className="body-regular text-gray-400 leading-relaxed">
                20-30% of surplus buys and burns $BACK to reduce supply
              </p>
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-xs text-[var(--secondary)] font-semibold">
                  Deflationary
                </span>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Helper - Cmd/Ctrl + K */}
          <KeyboardShortcutsHelper />
        </div>
      </div>
    </main>
  );
}
