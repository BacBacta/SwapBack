"use client";

import { useState } from "react";
import { useGlobalState } from "@/hooks/useGlobalState";
import dynamic from "next/dynamic";

const SimpleSwapCard = dynamic(
  () => import("@/components/SimpleSwapCard").then(mod => ({ default: mod.SimpleSwapCard })),
  { ssr: false }
);

export default function Option2ProductFirst() {
  const { globalState } = useGlobalState();
  const [isSticky, setIsSticky] = useState(false);

  // Simulate scroll detection
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", () => {
      setIsSticky(window.scrollY > 100);
    });
  }

  return (
    <div className="bg-black min-h-screen">
      {/* HERO MINIMAL */}
      <div className="max-w-7xl mx-auto px-6 py-16 border-b-2 border-[var(--primary)]/30">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: Messaging */}
          <div>
            <div className="inline-block terminal-box border border-[var(--secondary)] px-3 py-1 mb-6">
              <span className="terminal-text text-xs tracking-wider text-[var(--secondary)]">
                v2.0_PRODUCTION_READY
              </span>
            </div>
            
            <h1 className="text-6xl font-bold terminal-text terminal-glow mb-6 uppercase leading-tight">
              TRADE SMARTER.
              <br />
              <span className="text-[var(--primary)]">EARN MORE.</span>
            </h1>
            
            <p className="text-xl terminal-text text-[var(--muted)] mb-8 leading-relaxed">
              The only Solana router that{" "}
              <span className="text-[var(--accent)]">pays you back</span>.
              Execute at best prices, earn rebates, boost your returns.
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="terminal-box p-4 border border-[var(--primary)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-1">EXECUTION SPEED</div>
                <div className="terminal-text text-2xl font-bold text-[var(--primary)]">&lt;0.15s</div>
              </div>
              <div className="terminal-box p-4 border border-[var(--primary)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-1">SUCCESS RATE</div>
                <div className="terminal-text text-2xl font-bold text-[var(--secondary)]">98.7%</div>
              </div>
              <div className="terminal-box p-4 border border-[var(--primary)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-1">AVG SAVINGS</div>
                <div className="terminal-text text-2xl font-bold text-[var(--accent)]">+2.3%</div>
              </div>
              <div className="terminal-box p-4 border border-[var(--primary)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-1">REBATE SHARE</div>
                <div className="terminal-text text-2xl font-bold text-[var(--primary)]">70%</div>
              </div>
            </div>

            <div className="flex gap-4">
              <button className="terminal-box border-2 border-[var(--primary)] bg-[var(--primary)] text-black px-6 py-3 font-bold terminal-text uppercase tracking-wider hover:bg-transparent hover:text-[var(--primary)] transition-all text-sm">
                [READ_DOCS]
              </button>
              <button className="terminal-box border-2 border-[var(--primary)] px-6 py-3 font-bold terminal-text uppercase tracking-wider text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all text-sm">
                [VIEW_GITHUB]
              </button>
            </div>
          </div>

          {/* Right: Live Swap Interface */}
          <div className="terminal-box border-2 border-[var(--primary)] p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--primary)]/30">
              <span className="terminal-text text-sm tracking-wider text-[var(--muted)]">LIVE_INTERFACE</span>
              <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse"></span>
            </div>
            <SimpleSwapCard />
          </div>
        </div>
      </div>

      {/* STICKY METRICS BAR */}
      <div 
        className={`${
          isSticky ? "fixed top-0 left-0 right-0 z-50 shadow-lg" : ""
        } bg-black border-b-2 border-[var(--primary)]/30 transition-all`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="terminal-text text-xs text-[var(--muted)] mb-1">TVL</div>
              <div className="terminal-text terminal-number font-bold text-[var(--primary)]">
                ${globalState?.totalValueLocked.toFixed(0) || "0"}
              </div>
            </div>
            <div>
              <div className="terminal-text text-xs text-[var(--muted)] mb-1">24H_VOLUME</div>
              <div className="terminal-text terminal-number font-bold text-[var(--secondary)]">
                ${globalState?.totalSwapVolume.toFixed(0) || "0"}
              </div>
            </div>
            <div>
              <div className="terminal-text text-xs text-[var(--muted)] mb-1">ACTIVE_LOCKS</div>
              <div className="terminal-text terminal-number font-bold text-[var(--accent)]">
                {globalState?.activeLocksCount || 0}
              </div>
            </div>
            <div>
              <div className="terminal-text text-xs text-[var(--muted)] mb-1">COMMUNITY_BOOST</div>
              <div className="terminal-text terminal-number font-bold text-[var(--primary)]">
                {globalState ? `${(globalState.totalCommunityBoost / 100).toFixed(2)}%` : "0%"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-STEP PROCESS */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl terminal-text font-bold mb-12 uppercase text-center">
          [HOW_IT_WORKS]
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="terminal-box border-2 border-[var(--primary)] p-8 relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-[var(--primary)] flex items-center justify-center terminal-text font-bold text-black">
              1
            </div>
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-2xl terminal-text font-bold mb-4 uppercase">SWAP</h3>
            <p className="terminal-text text-[var(--muted)] mb-6">
              Execute trades at optimal prices across multiple DEXs with split routing
            </p>
            <div className="terminal-box bg-black p-3 border border-[var(--primary)]/30">
              <div className="terminal-text text-xs">
                <span className="text-[var(--muted)]">&gt; input:</span>{" "}
                <span className="text-[var(--primary)]">100_SOL</span>
              </div>
              <div className="terminal-text text-xs mt-1">
                <span className="text-[var(--muted)]">&gt; output:</span>{" "}
                <span className="text-[var(--accent)]">20,450_USDC</span>
              </div>
              <div className="terminal-text text-xs mt-1">
                <span className="text-[var(--muted)]">&gt; savings:</span>{" "}
                <span className="text-[var(--secondary)]">+$47.23</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="terminal-box border-2 border-[var(--secondary)] p-8 relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-[var(--secondary)] flex items-center justify-center terminal-text font-bold text-black">
              2
            </div>
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-2xl terminal-text font-bold mb-4 uppercase">LOCK</h3>
            <p className="terminal-text text-[var(--muted)] mb-6">
              Lock $BACK tokens to increase your tier and boost multiplier
            </p>
            <div className="terminal-box bg-black p-3 border border-[var(--secondary)]/30">
              <div className="terminal-text text-xs">
                <span className="text-[var(--muted)]">&gt; amount:</span>{" "}
                <span className="text-[var(--secondary)]">10,000_BACK</span>
              </div>
              <div className="terminal-text text-xs mt-1">
                <span className="text-[var(--muted)]">&gt; duration:</span>{" "}
                <span className="text-white">180_DAYS</span>
              </div>
              <div className="terminal-text text-xs mt-1">
                <span className="text-[var(--muted)]">&gt; tier:</span>{" "}
                <span className="text-[var(--accent)]">GOLD</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="terminal-box border-2 border-[var(--accent)] p-8 relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-[var(--accent)] flex items-center justify-center terminal-text font-bold text-black">
              3
            </div>
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-2xl terminal-text font-bold mb-4 uppercase">EARN</h3>
            <p className="terminal-text text-[var(--muted)] mb-6">
              Receive boosted NPI rebates automatically on every swap
            </p>
            <div className="terminal-box bg-black p-3 border border-[var(--accent)]/30">
              <div className="terminal-text text-xs">
                <span className="text-[var(--muted)]">&gt; base_npi:</span>{" "}
                <span className="text-white">$45.23</span>
              </div>
              <div className="terminal-text text-xs mt-1">
                <span className="text-[var(--muted)]">&gt; boost:</span>{" "}
                <span className="text-[var(--accent)]">+5.2%</span>
              </div>
              <div className="terminal-text text-xs mt-1">
                <span className="text-[var(--muted)]">&gt; total:</span>{" "}
                <span className="text-[var(--primary)]">$47.58</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMPARISON TABLE */}
      <div className="max-w-7xl mx-auto px-6 py-20 border-t-2 border-[var(--primary)]/30">
        <h2 className="text-4xl terminal-text font-bold mb-12 uppercase text-center">
          [WHY_SWAPBACK]
        </h2>
        <div className="terminal-box border-2 border-[var(--primary)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[var(--primary)]">
                <th className="terminal-text text-left p-4 bg-black/50">FEATURE</th>
                <th className="terminal-text text-center p-4 bg-[var(--primary)]/10">SWAPBACK</th>
                <th className="terminal-text text-center p-4 bg-black/50">JUPITER</th>
                <th className="terminal-text text-center p-4 bg-black/50">RAYDIUM</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--primary)]/30">
                <td className="terminal-text text-[var(--muted)] p-4">Platform_Fees</td>
                <td className="terminal-text text-center p-4 text-[var(--primary)]">0.30%</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">0.00%</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">0.25%</td>
              </tr>
              <tr className="border-b border-[var(--primary)]/30">
                <td className="terminal-text text-[var(--muted)] p-4">User_Rebates</td>
                <td className="terminal-text text-center p-4 text-[var(--accent)]">✓ 70% NPI</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">✗</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">✗</td>
              </tr>
              <tr className="border-b border-[var(--primary)]/30">
                <td className="terminal-text text-[var(--muted)] p-4">Boost_System</td>
                <td className="terminal-text text-center p-4 text-[var(--accent)]">✓ Up to +10%</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">✗</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">✗</td>
              </tr>
              <tr className="border-b border-[var(--primary)]/30">
                <td className="terminal-text text-[var(--muted)] p-4">Multi-Hop</td>
                <td className="terminal-text text-center p-4 text-[var(--accent)]">✓</td>
                <td className="terminal-text text-center p-4 text-[var(--accent)]">✓</td>
                <td className="terminal-text text-center p-4 text-[var(--accent)]">✓</td>
              </tr>
              <tr>
                <td className="terminal-text text-[var(--muted)] p-4">Avg_Execution</td>
                <td className="terminal-text text-center p-4 text-[var(--primary)]">&lt;0.15s</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">~0.20s</td>
                <td className="terminal-text text-center p-4 text-[var(--muted)]">~0.18s</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PROTOCOL STATS GRID */}
      <div className="max-w-7xl mx-auto px-6 py-20 border-t-2 border-[var(--primary)]/30">
        <h2 className="text-4xl terminal-text font-bold mb-12 uppercase text-center">
          [PROTOCOL_METRICS]
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Swap Fees */}
          <div className="terminal-box border-2 border-[var(--primary)] p-6">
            <h3 className="terminal-text text-xl font-bold mb-6 uppercase">
              Swap Fees (85/15 Split)
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 terminal-box bg-black border border-[var(--primary)]/30">
                <span className="terminal-text text-[var(--muted)] text-sm">Total_Collected</span>
                <span className="terminal-text font-bold text-[var(--primary)]">
                  ${globalState?.totalSwapFeesCollected.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 terminal-box bg-black border border-[var(--secondary)]/30">
                <span className="terminal-text text-[var(--muted)] text-sm">Treasury (85%)</span>
                <span className="terminal-text font-bold text-[var(--secondary)]">
                  ${globalState?.swapTreasuryAccrued.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 terminal-box bg-black border border-[var(--accent)]/30">
                <span className="terminal-text text-[var(--muted)] text-sm">Buyback (15%)</span>
                <span className="terminal-text font-bold text-[var(--accent)]">
                  ${globalState?.swapBuybackAccrued.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </div>

          {/* NPI Distribution */}
          <div className="terminal-box border-2 border-[var(--secondary)] p-6">
            <h3 className="terminal-text text-xl font-bold mb-6 uppercase">
              NPI Distribution (70/20/10)
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 terminal-box bg-black border border-[var(--primary)]/30">
                <span className="terminal-text text-[var(--muted)] text-sm">Users (70%+boost)</span>
                <span className="terminal-text font-bold text-[var(--primary)]">
                  ${globalState?.npiUserDistributed.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 terminal-box bg-black border border-[var(--secondary)]/30">
                <span className="terminal-text text-[var(--muted)] text-sm">Treasury (20%)</span>
                <span className="terminal-text font-bold text-[var(--secondary)]">
                  ${globalState?.npiTreasuryAccrued.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 terminal-box bg-black border border-[var(--accent)]/30">
                <span className="terminal-text text-[var(--muted)] text-sm">Boost_Vault (10%)</span>
                <span className="terminal-text font-bold text-[var(--accent)]">
                  ${globalState?.npiBoostVaultAccrued.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 terminal-box bg-black border border-[var(--accent)]/20">
                <span className="terminal-text text-[var(--muted)] text-sm">Boost_Distributed (live)</span>
                <span className="terminal-text font-bold text-[var(--accent)]">
                  ${globalState?.npiBoostVaultDistributed.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="max-w-7xl mx-auto px-6 py-20 text-center border-t-2 border-[var(--primary)]/30">
        <h2 className="text-5xl terminal-text font-bold mb-6 uppercase">
          READY TO START?
        </h2>
        <p className="text-xl terminal-text text-[var(--muted)] mb-8">
          Join thousands of traders earning on every swap
        </p>
        <button className="terminal-box border-2 border-[var(--primary)] bg-[var(--primary)] text-black px-12 py-6 font-bold terminal-text text-xl uppercase tracking-wider hover:bg-transparent hover:text-[var(--primary)] transition-all">
          [LAUNCH_APP]
        </button>
      </div>
    </div>
  );
}
