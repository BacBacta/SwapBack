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
        <div className="text-center mb-16 mt-12">
          <h1 className="hero-title bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
            SwapBack
          </h1>
          <p className="body-large text-gray-400 max-w-2xl mx-auto">
            Optimize your Solana swaps and earn rebates with SwapBack's best execution router
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          <SwapPage />
          <Dashboard />
        </div>

        {/* Features Section */}
                {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="swap-card text-center">
            <div className="text-5xl mb-6">🚀</div>
            <h3 className="card-title mb-3">Best Execution</h3>
            <p className="body-regular text-gray-400 leading-relaxed">
              Intelligent routing via Metis, Juno and RFQ for the best price
            </p>
          </div>

          <div className="swap-card text-center">
            <div className="text-5xl mb-6">💰</div>
            <h3 className="card-title mb-3">70-80% Cashback</h3>
            <p className="body-regular text-gray-400 leading-relaxed">
              Receive up to 80% of generated surplus as rebates
            </p>
          </div>

          <div className="swap-card text-center">
            <div className="text-5xl mb-6">🔥</div>
            <h3 className="card-title mb-3">Automatic Burn</h3>
            <p className="body-regular text-gray-400 leading-relaxed">
              20-30% of surplus buys and burns $BACK to reduce supply
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
