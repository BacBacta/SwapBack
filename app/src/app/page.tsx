"use client";

import { useState } from "react";
import { SwapInterface } from "@/components/SwapInterface";
import { RouteComparison } from "@/components/RouteComparison";
import { SwapBackDashboard } from "@/components/SwapBackDashboard";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { KeyboardShortcutsHelper } from "@/components/KeyboardShortcutsHelper";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"swap" | "dashboard">("swap");

  return (
    <main className="min-h-screen bg-black">
      {/* NAVIGATION - TERMINAL HACKER THEME */}
      <nav className="bg-black border-b-2 border-[#00ff00] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              {/* LOGO */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-transparent border-2 border-[#00ff00] flex items-center justify-center">
                  <span className="text-[#00ff00] font-bold text-xl terminal-text">&gt;</span>
                </div>
                <span className="text-[#00ff00] font-bold text-2xl terminal-text">SWAPBACK_v1.0</span>
              </div>

              {/* TABS */}
              <div className="flex gap-2 bg-transparent p-1 border-2 border-[#00ff00]">
                <button
                  onClick={() => setActiveTab("swap")}
                  className={`px-6 py-2 font-bold transition-all terminal-text ${
                    activeTab === "swap"
                      ? "bg-[#00ff00]/20 border-2 border-[#00ff00] text-[#00ff00]"
                      : "text-[#006600] hover:text-[#00ff00] border-2 border-transparent"
                  }`}
                >
                  <span className="terminal-prefix">&gt;</span>[SWAP]
                </button>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`px-6 py-2 font-bold transition-all terminal-text ${
                    activeTab === "dashboard"
                      ? "bg-[#00ff00]/20 border-2 border-[#00ff00] text-[#00ff00]"
                      : "text-[#006600] hover:text-[#00ff00] border-2 border-transparent"
                  }`}
                >
                  <span className="terminal-prefix">&gt;</span>[DASHBOARD]
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
              <SwapInterface />

              {/* Route Comparison - Shows best routes */}
              <RouteComparison />
            </div>
          )}
          {activeTab === "dashboard" && <SwapBackDashboard />}

          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="swap-card text-center group">
              <div className="w-16 h-16 mx-auto mb-6 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                <span className="text-4xl terminal-text">&gt;</span>
              </div>
              <h3 className="card-title mb-3 terminal-text">
                <span className="terminal-prefix">&gt;</span> BEST_EXECUTION
              </h3>
              <p className="body-regular terminal-text leading-relaxed">
                INTELLIGENT_ROUTING: METIS + JUNO + RFQ
              </p>
              <div className="mt-4 pt-4 border-t border-[var(--primary)]">
                <span className="text-xs text-[var(--primary)] font-bold terminal-text">
                  [OPTIMIZATION: +2.5%]
                </span>
              </div>
            </div>

            <div className="swap-card text-center group">
              <div className="w-16 h-16 mx-auto mb-6 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                <span className="text-4xl terminal-text">$</span>
              </div>
              <h3 className="card-title mb-3 terminal-text">
                <span className="terminal-prefix">&gt;</span> CASHBACK_PROTOCOL
              </h3>
              <p className="body-regular terminal-text leading-relaxed">
                REBATE_RATE: 70-80% SURPLUS_DISTRIBUTION
              </p>
              <div className="mt-4 pt-4 border-t border-[var(--primary)]">
                <span className="text-xs text-[var(--primary)] font-bold terminal-text">
                  [STATUS: INSTANT_REWARDS]
                </span>
              </div>
            </div>

            <div className="swap-card text-center group">
              <div className="w-16 h-16 mx-auto mb-6 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                <span className="text-4xl terminal-text">#</span>
              </div>
              <h3 className="card-title mb-3 terminal-text">
                <span className="terminal-prefix">&gt;</span> AUTO_BURN_SYSTEM
              </h3>
              <p className="body-regular terminal-text leading-relaxed">
                BURN_RATE: 20-30% | TARGET: $BACK_SUPPLY
              </p>
              <div className="mt-4 pt-4 border-t border-[var(--primary)]">
                <span className="text-xs text-[var(--primary)] font-bold terminal-text">
                  [MODE: DEFLATIONARY]
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
