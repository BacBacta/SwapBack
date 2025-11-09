"use client";

import { useState, lazy, Suspense } from "react";
import { getNetworkLabel, isMainnet } from "@/utils/explorer";
import dynamic from "next/dynamic";

// Critical: Import wallet with ssr: false to avoid SSR recursion issues
const ClientOnlyWallet = dynamic(
  () => import("@/components/ClientOnlyWallet").then(mod => ({ default: mod.ClientOnlyWallet })),
  { ssr: false, loading: () => <div className="w-[140px] h-[40px] bg-gray-800 animate-pulse rounded" /> }
);

// Performance: Lazy load heavy components
const EnhancedSwapInterface = lazy(() => import("@/components/EnhancedSwapInterface").then(mod => ({ default: mod.EnhancedSwapInterface })));
const Dashboard = lazy(() => import("@/components/Dashboard").then(mod => ({ default: mod.Dashboard })));

// Loading fallback component
function ComponentLoader() {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="terminal-box p-8 text-center">
        <div className="animate-pulse">
          <div className="text-4xl mb-4">⚡</div>
          <div className="terminal-text text-[var(--primary)]">LOADING...</div>
          <div className="mt-4 flex justify-center gap-2">
            <span className="w-2 h-2 bg-[var(--primary)] animate-bounce"></span>
            <span className="w-2 h-2 bg-[var(--primary)] animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            <span className="w-2 h-2 bg-[var(--primary)] animate-bounce" style={{ animationDelay: '0.4s' }}></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"swap" | "dashboard">("swap");

  return (
    <main className="min-h-screen bg-black" id="main-content">
      {/* HEADER PRINCIPAL - Une seule navigation */}
      <nav className="border-b-2 border-[var(--primary)] bg-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="text-2xl font-bold terminal-text terminal-glow hover:text-[var(--accent)] transition-colors flex items-center gap-3 uppercase tracking-wider">
              <span className="text-3xl">⚡</span>
              <span>SWAPBACK</span>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-0">
              <button
                onClick={() => setActiveTab("swap")}
                className={`px-6 py-2 font-bold terminal-text uppercase tracking-wider border-r-2 border-[var(--primary)]/30 transition-all ${
                  activeTab === "swap"
                    ? "text-[var(--primary)]"
                    : "text-gray-400 hover:text-[var(--primary)]"
                }`}
              >
                [SWAP]
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-6 py-2 font-bold terminal-text uppercase tracking-wider transition-all ${
                  activeTab === "dashboard"
                    ? "text-[var(--primary)]"
                    : "text-gray-400 hover:text-[var(--primary)]"
                }`}
              >
                [DASHBOARD]
              </button>
            </div>

            {/* Wallet Button */}
            <div className="flex items-center">
              <ClientOnlyWallet />
            </div>
          </div>
        </div>
      </nav>

      {/* HERO BANNER - Clean & Professional */}
      <div className="border-b-2 border-[var(--primary)]/30 bg-black">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className={`inline-flex items-center gap-2 border-2 px-4 py-2 mb-6 ${isMainnet() ? 'border-green-500' : 'border-[var(--secondary)]'}`}>
              <span className={`w-2 h-2 animate-pulse ${isMainnet() ? 'bg-green-500' : 'bg-[var(--secondary)]'}`}></span>
              <span className="text-sm font-bold terminal-text uppercase tracking-wider">
                [LIVE_ON_SOLANA_{getNetworkLabel()}]
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold terminal-text terminal-glow mb-6 uppercase tracking-wider">
              SWAPBACK
            </h1>
            <p className="text-xl terminal-text max-w-3xl mx-auto mb-2 text-[var(--primary)]">
              THE SMART ROUTER FOR SOLANA
            </p>
            <p className="text-sm terminal-text text-[var(--muted)] max-w-3xl mx-auto mb-8">
              MAXIMIZE PROFITS • MINIMIZE FEES • EARN REBATES
            </p>
            
            {/* STATS - Clean Grid */}
            <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-8">
              <div className="terminal-box p-4">
                <div className="terminal-text terminal-number font-bold text-2xl text-[var(--primary)]">$1.2M+</div>
                <div className="terminal-text text-[var(--muted)] text-xs mt-1">VOLUME</div>
              </div>
              <div className="terminal-box p-4">
                <div className="terminal-text terminal-number font-bold text-2xl text-[var(--secondary)]">98%</div>
                <div className="terminal-text text-[var(--muted)] text-xs mt-1">SUCCESS</div>
              </div>
              <div className="terminal-box p-4">
                <div className="terminal-text terminal-number font-bold text-2xl text-[var(--accent)]">0.1s</div>
                <div className="terminal-text text-[var(--muted)] text-xs mt-1">AVG TIME</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === "swap" && (
            <div className="animate-fade-in">
              <Suspense fallback={<ComponentLoader />}>
                <EnhancedSwapInterface />
              </Suspense>
            </div>
          )}
          
          {activeTab === "dashboard" && (
            <div className="animate-fade-in">
              <Suspense fallback={<ComponentLoader />}>
                <Dashboard />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER - Terminal Style */}
      <footer className="mt-16 border-t-2 border-[var(--primary)] bg-black">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="terminal-border-top mb-4"></div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 terminal-text">
            <div className="text-sm">
              <span className="terminal-prompt"></span>
              <span className="text-[var(--muted)]">© 2025 SWAPBACK. BUILT_ON_SOLANA.</span>
            </div>
            <div className="flex gap-6 text-sm">
              <a 
                href="https://docs.swapback.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:text-[var(--accent)] transition-colors uppercase tracking-wider"
              >
                DOCS
              </a>
              <a 
                href="https://twitter.com/swapback" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:text-[var(--accent)] transition-colors uppercase tracking-wider"
              >
                TWITTER
              </a>
              <a 
                href="https://discord.gg/swapback" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:text-[var(--accent)] transition-colors uppercase tracking-wider"
              >
                DISCORD
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
