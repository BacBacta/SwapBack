"use client";

import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { EnhancedSwapInterface } from "@/components/EnhancedSwapInterface";
import { Dashboard } from "@/components/Dashboard";
import { DCA } from "@/components/DCA";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"swap" | "dashboard" | "dca">("swap");

  return (
    <main className="min-h-screen" id="main-content">
      {/* NAVIGATION - Using existing Navigation component */}
      <Navigation />

      {/* HERO BANNER */}
      <div className="bg-gradient-to-r from-[var(--primary)]/10 via-[var(--secondary)]/10 to-[var(--accent)]/10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-[var(--secondary)]/10 px-4 py-2 rounded-full border border-[var(--secondary)]/20 mb-4">
              <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse"></span>
              <span className="text-sm font-semibold text-[var(--secondary)]">Live on Solana Devnet</span>
            </div>
            <h1 className="hero-title bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] bg-clip-text text-transparent mb-4">
              The Smart Router for Solana
            </h1>
            <p className="body-large text-gray-300 max-w-3xl mx-auto">
              Maximize profits, minimize fees, earn rebates. Best execution guaranteed across all Solana DEXs.
            </p>
            
            {/* STATS */}
            <div className="flex justify-center gap-8 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[var(--secondary)] font-bold text-lg">$1.2M+</span>
                <span className="text-gray-400">Volume</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--secondary)] font-bold text-lg">98%</span>
                <span className="text-gray-400">Success Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--secondary)] font-bold text-lg">0.1s</span>
                <span className="text-gray-400">Avg Time</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="border-b border-white/10 bg-[var(--glass-bg)] backdrop-blur-md sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("swap")}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === "swap"
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              aria-label="Swap tab"
            >
              🔄 Swap
              {activeTab === "swap" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("dca")}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === "dca"
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              aria-label="DCA tab"
            >
              📈 DCA
              {activeTab === "dca" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === "dashboard"
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              aria-label="Dashboard tab"
            >
              📊 Dashboard
              {activeTab === "dashboard" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === "swap" && (
            <div className="animate-fade-in">
              <EnhancedSwapInterface />
            </div>
          )}
          
          {activeTab === "dca" && (
            <div className="animate-fade-in">
              <DCA />
            </div>
          )}
          
          {activeTab === "dashboard" && (
            <div className="animate-fade-in">
              <Dashboard />
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-white/10 bg-[var(--glass-bg)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-400 text-sm">
              © 2025 SwapBack. Built on Solana.
            </div>
            <div className="flex gap-6 text-sm">
              <a 
                href="https://docs.swapback.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[var(--primary)] transition-colors"
              >
                Docs
              </a>
              <a 
                href="https://twitter.com/swapback" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[var(--primary)] transition-colors"
              >
                Twitter
              </a>
              <a 
                href="https://discord.gg/swapback" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[var(--primary)] transition-colors"
              >
                Discord
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
