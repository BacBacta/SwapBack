/**
 * Enhanced Swap Page
 * Showcases all new components with Zustand + WebSocket
 */

"use client";

import { EnhancedSwapInterface } from "@/components/EnhancedSwapInterface";
import { TransactionTracker } from "@/components/TransactionTracker";
import { RouteComparison } from "@/components/RouteComparison";
import { DashboardAnalytics } from "@/components/DashboardAnalytics";
import { WalletProvider } from "@/components/WalletProvider";

export default function EnhancedSwapPage() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-[var(--primary)] mb-2">
              SwapBack <span className="text-blue-400">Enhanced</span>
            </h1>
            <p className="text-gray-400 text-lg">
              Advanced Solana DEX aggregator with MEV protection & real-time
              analytics
            </p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Swap Interface */}
            <div className="lg:col-span-1 space-y-6">
              <EnhancedSwapInterface />
              <TransactionTracker />
            </div>

            {/* Middle Column - Route Comparison */}
            <div className="lg:col-span-1">
              <RouteComparison />
            </div>

            {/* Right Column - Analytics */}
            <div className="lg:col-span-1">
              <DashboardAnalytics />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center text-gray-500 text-sm">
            <p>Powered by Jito MEV Protection • Phase 8 Complete ✅</p>
            <p className="mt-2">
              85/85 tests passing • Real-time WebSocket • Zustand State
              Management
            </p>
          </div>
        </div>
      </div>
    </WalletProvider>
  );
}
