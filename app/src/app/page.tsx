"use client";

import { SwapPage } from "@/components/SwapPage";
import { Dashboard } from "@/components/Dashboard";
import { Navigation } from "@/components/Navigation";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />

      <div className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 mt-12 relative">
          {/* Gradient glow effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-[var(--primary)]/20 to-[var(--secondary)]/20 blur-[100px] -z-10 rounded-full"></div>
          
          <div className="inline-block mb-4">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
              <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-gray-300">Live on Solana</span>
            </div>
          </div>
          
          <h1 className="hero-title bg-gradient-to-r from-[var(--primary)] via-[var(--primary-light)] to-[var(--secondary)] bg-clip-text text-transparent mb-6 animate-fade-in">
            SwapBack
          </h1>
          <p className="body-large text-gray-400 max-w-2xl mx-auto mb-8">
            The most advanced swap router on Solana. Maximize profits, minimize fees, earn rebates.
          </p>
          
          {/* Quick stats */}
          <div className="flex justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--secondary)] font-bold">$1.2M+</span>
              <span className="text-gray-500">Volume</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--secondary)] font-bold">98%</span>
              <span className="text-gray-500">Success Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--secondary)] font-bold">0.1s</span>
              <span className="text-gray-500">Avg Time</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          <SwapPage />
          <Dashboard />
        </div>

        {/* Features Section */}
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
              <span className="text-xs text-[var(--secondary)] font-semibold">Up to 2.5% Better</span>
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
              <span className="text-xs text-[var(--secondary)] font-semibold">Instant Rewards</span>
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
              <span className="text-xs text-[var(--secondary)] font-semibold">Deflationary</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
