"use client";

import { useState } from "react";
import { EnhancedSwapInterface } from "@/components/EnhancedSwapInterface";
import { RouteComparison } from "@/components/RouteComparison";
import { SwapBackDashboard } from "@/components/SwapBackDashboard";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { KeyboardShortcutsHelper } from "@/components/KeyboardShortcutsHelper";

export default function Home() {
  const [activeTab] = useState<"swap" | "dashboard">("swap");

  return (
    <main className="min-h-screen bg-[#19162F] relative">
      {/* Solana Faucet exact background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#19162F] via-[#1a1535] to-[#19162F]"></div>

      {/* Header - Exact Solana Faucet style */}
      <header className="relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Solana-style logo */}
            <div className="flex items-center gap-3">
              <svg width="36" height="36" viewBox="0 0 646 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M108.53 75.6899L90.81 94.6899C90.4267 95.1026 89.9626 95.432 89.4464 95.6573C88.9303 95.8827 88.3732 95.9994 87.81 95.9999H3.81C3.40937 95.9997 3.01749 95.8827 2.68235 95.6633C2.34722 95.444 2.08338 95.132 1.92344 94.7654C1.76349 94.3988 1.71467 93.9932 1.78311 93.5982C1.85155 93.2032 2.03406 92.8359 2.31 92.5399L20.03 73.5399C20.4133 73.1273 20.8774 72.7978 21.3936 72.5725C21.9097 72.3471 22.4668 72.2305 23.03 72.2299H107.03C107.431 72.2301 107.822 72.3471 108.158 72.5665C108.493 72.7858 108.757 73.0978 108.917 73.4644C109.077 73.831 109.125 74.2366 109.057 74.6316C108.988 75.0266 108.806 75.3939 108.53 75.6899ZM90.81 38.8099C90.4222 38.405 89.9571 38.08 89.4421 37.8541C88.9271 37.6281 88.3729 37.5057 87.81 37.4939H3.81C3.40937 37.4942 3.01749 37.6111 2.68235 37.8305C2.34722 38.0498 2.08338 38.3618 1.92344 38.7284C1.76349 39.095 1.71467 39.5006 1.78311 39.8956C1.85155 40.2906 2.03406 40.6579 2.31 40.9539L20.03 59.9539C20.4133 60.3665 20.8774 60.696 21.3936 60.9214C21.9097 61.1467 22.4668 61.2634 23.03 61.2639H107.03C107.431 61.2636 107.822 61.1467 108.158 60.9273C108.493 60.708 108.757 60.396 108.917 60.0294C109.077 59.6628 109.125 59.2572 109.057 58.8622C108.988 58.4672 108.806 58.0999 108.53 57.8039L90.81 38.8099ZM3.81 24.9999H87.81C88.3732 24.9994 88.9303 24.8827 89.4464 24.6573C89.9626 24.432 90.4267 24.1026 90.81 23.6899L108.53 4.68986C108.806 4.39391 108.988 4.02659 109.057 3.6316C109.125 3.23661 109.077 2.83103 108.917 2.46444C108.757 2.09784 108.493 1.78584 108.158 1.56652C107.822 1.34719 107.431 1.23022 107.03 1.22986H23.03C22.4668 1.23044 21.9097 1.34709 21.3936 1.57245C20.8774 1.79781 20.4133 2.12729 20.03 2.53986L2.31 21.5399C2.03406 21.8359 1.85155 22.2032 1.78311 22.5982C1.71467 22.9932 1.76349 23.3988 1.92344 23.7654C2.08338 24.132 2.34722 24.444 2.68235 24.6633C3.01749 24.8827 3.40937 24.9997 3.81 24.9999Z" fill="url(#paint0_linear)" />
                <defs>
                  <linearGradient id="paint0_linear" x1="3.8" y1="1.23" x2="109.03" y2="95.28" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#00FFA3"/>
                    <stop offset="1" stopColor="#DC1FFF"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-xl font-semibold text-[var(--primary)] ml-2">SwapBack</span>
            </div>

            {/* Wallet button - Solana style */}
            <WalletMultiButton className="!bg-white !text-[#19162F] hover:!bg-gray-100 !rounded-lg !font-medium !px-5 !py-2.5 !text-sm !transition-all !shadow-md" />
          </div>
        </div>
      </header>

      {/* Main content - Exact Solana Faucet centered card */}
      <div className="relative z-10 flex items-start justify-center px-4 pt-12 pb-20">
        <div className="w-full max-w-[500px]">
          {activeTab === "swap" && (
            <div className="space-y-8">
              {/* Main card - Pure white like Solana Faucet */}
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <EnhancedSwapInterface />
              </div>
              
              {/* Secondary card for route comparison */}
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <RouteComparison />
              </div>
            </div>
          )}
          {activeTab === "dashboard" && (
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <SwapBackDashboard />
            </div>
          )}

          {/* Features grid - Clean cards like Solana Faucet */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {/* Feature 1 */}
            <div className="bg-[var(--primary)]/5 backdrop-blur-sm rounded-2xl p-8 border border-[var(--primary)]/10 hover:bg-[var(--primary)]/10 transition-all group cursor-pointer">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-3xl">🚀</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--primary)] mb-3">Best Execution</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Intelligent routing across multiple DEXs for optimal pricing
              </p>
              <div className="mt-6 pt-4 border-t border-[var(--primary)]/10">
                <span className="text-xs font-bold text-purple-400">Up to 2.5% Better</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-[var(--primary)]/5 backdrop-blur-sm rounded-2xl p-8 border border-[var(--primary)]/10 hover:bg-[var(--primary)]/10 transition-all group cursor-pointer">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--primary)] mb-3">70-80% Cashback</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Earn instant rewards from surplus generated on your swaps
              </p>
              <div className="mt-6 pt-4 border-t border-[var(--primary)]/10">
                <span className="text-xs font-bold text-cyan-400">Instant Rewards</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-[var(--primary)]/5 backdrop-blur-sm rounded-2xl p-8 border border-[var(--primary)]/10 hover:bg-[var(--primary)]/10 transition-all group cursor-pointer">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-3xl">🔥</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--primary)] mb-3">Automatic Burn</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                20-30% of surplus automatically buys & burns $BACK tokens
              </p>
              <div className="mt-6 pt-4 border-t border-[var(--primary)]/10">
                <span className="text-xs font-bold text-green-400">Deflationary</span>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Helper */}
          <KeyboardShortcutsHelper />
        </div>
      </div>

      {/* Footer - Simple like Solana Faucet */}
      <footer className="relative z-10 py-8 border-t border-[var(--primary)]/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © 2025 SwapBack. Built on Solana.
            </p>
            <div className="flex items-center gap-6">
              <button className="text-gray-500 hover:text-[var(--primary)] transition-colors text-sm">Docs</button>
              <button className="text-gray-500 hover:text-[var(--primary)] transition-colors text-sm">GitHub</button>
              <button className="text-gray-500 hover:text-[var(--primary)] transition-colors text-sm">Discord</button>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
