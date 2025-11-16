"use client";

import { useState, useEffect } from "react";
import { useGlobalState } from "@/hooks/useGlobalState";

export default function Option1HeroDriven() {
  const { globalState } = useGlobalState();
  const [animatedVolume, setAnimatedVolume] = useState(0);
  const [recentSwaps, setRecentSwaps] = useState([
    { user: "0x42...a3f", amount: "$1,234", token: "SOL → USDC", npi: "$24.68" },
    { user: "0x7f...b91", amount: "$567", token: "USDT → SOL", npi: "$11.34" },
    { user: "0xa2...c4e", amount: "$890", token: "BONK → USDC", npi: "$17.80" },
  ]);

  useEffect(() => {
    const target = globalState?.totalSwapVolume || 1234567;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimatedVolume(target);
        clearInterval(timer);
      } else {
        setAnimatedVolume(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [globalState]);

  // Simulate new swaps
  useEffect(() => {
    const interval = setInterval(() => {
      const newSwap = {
        user: `0x${Math.random().toString(16).slice(2, 4)}...${Math.random().toString(16).slice(2, 5)}`,
        amount: `$${Math.floor(Math.random() * 5000 + 100)}`,
        token: ["SOL → USDC", "USDT → SOL", "BONK → USDC", "RAY → USDC"][Math.floor(Math.random() * 4)],
        npi: `$${(Math.random() * 100).toFixed(2)}`,
      };
      setRecentSwaps(prev => [newSwap, ...prev.slice(0, 4)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black min-h-screen">
      {/* HERO SECTION - Full Viewport */}
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden border-b-2 border-[var(--primary)]">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(var(--primary) 1px, transparent 1px),
              linear-gradient(90deg, var(--primary) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'grid-shift 20s linear infinite'
          }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          {/* Live Indicator */}
          <div className="inline-flex items-center gap-2 border-2 border-[var(--secondary)] px-4 py-2 mb-8 terminal-box">
            <span className="w-2 h-2 bg-[var(--secondary)] animate-pulse rounded-full"></span>
            <span className="terminal-text text-sm tracking-wider">LIVE_ON_SOLANA_DEVNET</span>
          </div>

          {/* Main Heading with Glitch Effect */}
          <h1 className="text-7xl md:text-8xl font-bold terminal-text terminal-glow mb-6 uppercase tracking-wider">
            TRADE SMARTER
            <br />
            <span className="text-[var(--primary)]">EARN MORE</span>
          </h1>

          <p className="text-2xl terminal-text text-[var(--muted)] mb-12 max-w-3xl mx-auto">
            The only Solana router that <span className="text-[var(--accent)]">pays you back</span>
          </p>

          {/* Real-time Metrics - Animated */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
            <div className="terminal-box p-6 border-2 border-[var(--primary)] hover:scale-105 transition-transform">
              <div className="text-sm terminal-text text-[var(--muted)] mb-2">TOTAL VOLUME</div>
              <div className="text-4xl font-bold terminal-text terminal-number text-[var(--primary)]">
                ${animatedVolume.toLocaleString()}
              </div>
              <div className="text-xs terminal-text text-[var(--muted)] mt-2">+12.5% (24h)</div>
            </div>

            <div className="terminal-box p-6 border-2 border-[var(--secondary)] hover:scale-105 transition-transform">
              <div className="text-sm terminal-text text-[var(--muted)] mb-2">ACTIVE LOCKS</div>
              <div className="text-4xl font-bold terminal-text terminal-number text-[var(--secondary)]">
                {globalState?.activeLocksCount || 0}
              </div>
              <div className="text-xs terminal-text text-[var(--muted)] mt-2">
                {globalState ? `${(globalState.totalCommunityBoost / 100).toFixed(2)}% boost` : "Loading..."}
              </div>
            </div>

            <div className="terminal-box p-6 border-2 border-[var(--accent)] hover:scale-105 transition-transform">
              <div className="text-sm terminal-text text-[var(--muted)] mb-2">AVG EXECUTION</div>
              <div className="text-4xl font-bold terminal-text terminal-number text-[var(--accent)]">
                0.12s
              </div>
              <div className="text-xs terminal-text text-[var(--muted)] mt-2">98.7% success rate</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button className="terminal-box border-2 border-[var(--primary)] bg-[var(--primary)] text-black px-8 py-4 font-bold terminal-text uppercase tracking-wider hover:bg-transparent hover:text-[var(--primary)] transition-all">
              [START_TRADING]
            </button>
            <button className="terminal-box border-2 border-[var(--primary)] px-8 py-4 font-bold terminal-text uppercase tracking-wider text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all">
              [VIEW_ANALYTICS]
            </button>
          </div>

          {/* Trusted By */}
          <div className="text-center">
            <div className="text-sm terminal-text text-[var(--muted)] mb-4 tracking-wider">INTEGRATED_WITH</div>
            <div className="flex flex-wrap justify-center gap-6 items-center opacity-60">
              {['RAYDIUM', 'ORCA', 'PHOENIX', 'METEORA', 'LIFINITY'].map(dex => (
                <div key={dex} className="terminal-text text-lg font-bold tracking-wider hover:text-[var(--primary)] transition-colors">
                  [{dex}]
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES GRID */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="terminal-box border-2 border-[var(--primary)] p-8 hover:border-[var(--accent)] transition-all group">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-2xl terminal-text font-bold mb-4 uppercase">BEST EXECUTION</h3>
            <p className="terminal-text text-[var(--muted)] leading-relaxed mb-6">
              Split routing across multiple DEXs to get the best price every time
            </p>
            <div className="terminal-box bg-black p-4 text-xs terminal-text">
              <div className="flex justify-between mb-2">
                <span className="text-[var(--muted)]">&gt; Route:</span>
                <span className="text-[var(--primary)]">OPTIMIZED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">&gt; Savings:</span>
                <span className="text-[var(--accent)]">+2.3%</span>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="terminal-box border-2 border-[var(--secondary)] p-8 hover:border-[var(--accent)] transition-all group">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-2xl terminal-text font-bold mb-4 uppercase">EARN REBATES</h3>
            <p className="terminal-text text-[var(--muted)] leading-relaxed mb-6">
              Get paid back on every swap. 70% of protocol revenue goes to users
            </p>
            <div className="terminal-box bg-black p-4 text-xs terminal-text">
              <div className="flex justify-between mb-2">
                <span className="text-[var(--muted)]">&gt; Your NPI:</span>
                <span className="text-[var(--secondary)]">$45.23</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">&gt; Claimable:</span>
                <span className="text-[var(--accent)]">NOW</span>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="terminal-box border-2 border-[var(--accent)] p-8 hover:border-[var(--primary)] transition-all group">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-2xl terminal-text font-bold mb-4 uppercase">LOCK & BOOST</h3>
            <p className="terminal-text text-[var(--muted)] leading-relaxed mb-6">
              Lock $BACK tokens to boost your NPI earnings by up to +10%
            </p>
            <div className="terminal-box bg-black p-4 text-xs terminal-text">
              <div className="flex justify-between mb-2">
                <span className="text-[var(--muted)]">&gt; Current Boost:</span>
                <span className="text-[var(--accent)]">+5.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">&gt; Tier:</span>
                <span className="text-[var(--primary)]">GOLD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE ACTIVITY FEED */}
      <div className="max-w-6xl mx-auto px-6 py-20 border-t-2 border-[var(--primary)]/30">
        <h2 className="text-4xl terminal-text font-bold mb-8 uppercase text-center">
          [LIVE_ACTIVITY]
        </h2>
        <div className="terminal-box border-2 border-[var(--primary)] p-6 max-w-3xl mx-auto">
          <div className="space-y-3">
            {recentSwaps.map((swap, idx) => (
              <div 
                key={idx} 
                className="flex justify-between items-center border-b border-[var(--primary)]/20 pb-3 last:border-0 animate-fade-in"
              >
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse"></span>
                  <span className="terminal-text text-[var(--muted)] text-sm">{swap.user}</span>
                  <span className="terminal-text text-sm">{swap.token}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="terminal-text font-bold">{swap.amount}</span>
                  <span className="terminal-text text-[var(--accent)] text-sm">+{swap.npi} NPI</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="max-w-6xl mx-auto px-6 py-20 text-center border-t-2 border-[var(--primary)]/30">
        <h2 className="text-5xl terminal-text font-bold mb-6 uppercase">
          JOIN <span className="text-[var(--primary)]">10,000+</span> SMART TRADERS
        </h2>
        <p className="text-xl terminal-text text-[var(--muted)] mb-8">
          Start earning rebates on every trade today
        </p>
        <button className="terminal-box border-2 border-[var(--primary)] bg-[var(--primary)] text-black px-12 py-6 font-bold terminal-text text-xl uppercase tracking-wider hover:bg-transparent hover:text-[var(--primary)] transition-all">
          [LAUNCH_APP]
        </button>
      </div>

      <style jsx>{`
        @keyframes grid-shift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
