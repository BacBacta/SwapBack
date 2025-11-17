"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Brand from "@/components/Brand";
import { useGlobalState } from "@/hooks/useGlobalState";

// Import wallet with ssr: false
const ClientOnlyWallet = dynamic(
  () => import("@/components/ClientOnlyWallet").then(mod => ({ default: mod.ClientOnlyWallet })),
  { ssr: false, loading: () => <div className="w-[140px] h-[40px] bg-gray-800 animate-pulse rounded" /> }
);

export default function Option3Scrollytelling() {
  const router = useRouter();
  const { globalState } = useGlobalState();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleSections, setVisibleSections] = useState<number[]>([]);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress((scrolled / docHeight) * 100);

      // Check which sections are visible
      sectionsRef.current.forEach((section, idx) => {
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.8 && rect.bottom > 0) {
            setVisibleSections(prev => prev.includes(idx) ? prev : [...prev, idx]);
          }
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="bg-black min-h-screen relative">
      {/* Fixed Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-b-2 border-[var(--primary)]/30 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Brand 
              size={32}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="terminal-glow"
            />

            {/* Navigation Links */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/swap')}
                className="terminal-text px-4 py-2 border-2 border-[var(--primary)]/30 text-[var(--primary)] hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all uppercase tracking-wider"
              >
                SWAP
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="terminal-text px-4 py-2 border-2 border-[var(--secondary)]/30 text-[var(--secondary)] hover:border-[var(--secondary)] hover:bg-[var(--secondary)] hover:text-black transition-all uppercase tracking-wider"
              >
                DASHBOARD
              </button>
              <ClientOnlyWallet />
            </div>
          </div>
        </div>
        
        {/* Scroll Progress Bar */}
        <div className="h-1 bg-black">
          <div 
            className="h-full bg-[var(--primary)] transition-all duration-100"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-[73px]"></div>

      {/* SECTION 1: HERO WITH ANIMATION */}
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Animated Grid Background */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, var(--primary) 0px, var(--primary) 1px, transparent 1px, transparent 50px),
                repeating-linear-gradient(90deg, var(--primary) 0px, var(--primary) 1px, transparent 1px, transparent 50px)
              `,
              transform: `scale(${1 + scrollProgress / 200})`,
              transition: 'transform 0.1s linear'
            }}
          />
        </div>

        {/* Floating Particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-[var(--primary)] rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 10}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-4xl px-6">
          <div className="terminal-text text-[var(--muted)] mb-4 tracking-widest animate-fade-in">
            [INITIATING_SEQUENCE]
          </div>
          <h1 className="text-7xl md:text-8xl font-bold terminal-text terminal-glow mb-8 uppercase tracking-wider animate-glitch">
            STOP LOSING
            <br />
            <span className="text-[var(--primary)]">MONEY ON SWAPS</span>
          </h1>
          <div className="terminal-text text-xl text-[var(--muted)] mb-12 animate-fade-in-delay">
            [SCROLL_TO_DISCOVER]
          </div>
          <div className="flex justify-center">
            <div className="w-6 h-10 border-2 border-[var(--primary)] rounded-full flex justify-center p-2 animate-bounce">
              <div className="w-1 h-3 bg-[var(--primary)] rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: THE PROBLEM */}
      <div 
        ref={el => sectionsRef.current[0] = el}
        className={`min-h-screen flex items-center justify-center border-t-2 border-[var(--primary)]/30 transition-all duration-1000 ${
          visibleSections.includes(0) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: Problem Statement */}
            <div>
              <div className="terminal-text text-sm text-[var(--muted)] mb-4 tracking-widest">
                [PROBLEM_DETECTED]
              </div>
              <h2 className="text-5xl font-bold terminal-text terminal-glow mb-6 uppercase">
                TRADERS LOSE
                <br />
                <span className="text-[var(--accent)]">$2.3M DAILY</span>
              </h2>
              <p className="terminal-text text-xl text-[var(--muted)] leading-relaxed mb-8">
                Due to suboptimal routing, high slippage, and zero rebates on traditional DEXs
              </p>
              <div className="space-y-4">
                {[
                  { label: "Poor_Execution", value: "-1.2%" },
                  { label: "Hidden_Fees", value: "-0.8%" },
                  { label: "No_Rebates", value: "-0.3%" }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center terminal-box p-4 border border-[var(--accent)]/30">
                    <span className="terminal-text text-[var(--muted)]">{item.label}</span>
                    <span className="terminal-text font-bold text-[var(--accent)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visual */}
            <div className="terminal-box border-2 border-[var(--accent)] p-8">
              <div className="mb-6">
                <div className="terminal-text text-xs text-[var(--muted)] mb-2">TRADITIONAL_DEX_ROUTE</div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="terminal-box p-3 border border-[var(--muted)] flex-1 text-center">
                    <div className="terminal-text text-sm">100_SOL</div>
                  </div>
                  <span className="text-[var(--muted)]">→</span>
                  <div className="terminal-box p-3 border border-[var(--muted)] flex-1 text-center">
                    <div className="terminal-text text-sm">POOL_A</div>
                  </div>
                  <span className="text-[var(--muted)]">→</span>
                  <div className="terminal-box p-3 border border-[var(--accent)] flex-1 text-center">
                    <div className="terminal-text text-sm text-[var(--accent)]">19,850</div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-[var(--accent)]/30 pt-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="terminal-text text-[var(--muted)]">Output:</span>
                  <span className="terminal-text font-bold">19,850_USDC</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="terminal-text text-[var(--muted)]">Slippage:</span>
                  <span className="terminal-text font-bold text-[var(--accent)]">-2.3%</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="terminal-text text-[var(--muted)]">Rebates:</span>
                  <span className="terminal-text font-bold text-[var(--accent)]">$0.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: THE SOLUTION */}
      <div 
        ref={el => sectionsRef.current[1] = el}
        className={`min-h-screen flex items-center justify-center border-t-2 border-[var(--primary)]/30 transition-all duration-1000 ${
          visibleSections.includes(1) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="terminal-text text-sm text-[var(--muted)] mb-4 tracking-widest">
              [SOLUTION_DEPLOYED]
            </div>
            <h2 className="text-5xl font-bold terminal-text terminal-glow uppercase mb-6">
              SWAPBACK <span className="text-[var(--primary)]">OPTIMIZES</span>
              <br />
              EVERY TRADE
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Traditional Route */}
            <div className="terminal-box border-2 border-[var(--muted)]/30 p-6">
              <div className="terminal-text text-xs text-[var(--muted)] mb-4 text-center">
                TRADITIONAL_ROUTING
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="terminal-box p-3 bg-gray-900 flex-1 text-center">
                    <div className="terminal-text text-xs">100_SOL</div>
                  </div>
                </div>
                <div className="text-center text-[var(--muted)]">↓</div>
                <div className="terminal-box p-3 bg-gray-900 text-center">
                  <div className="terminal-text text-xs">SINGLE_POOL</div>
                </div>
                <div className="text-center text-[var(--muted)]">↓</div>
                <div className="terminal-box p-3 border border-[var(--accent)] text-center">
                  <div className="terminal-text font-bold text-[var(--accent)]">19,850_USDC</div>
                  <div className="terminal-text text-xs text-[var(--accent)] mt-1">-2.3% slippage</div>
                </div>
              </div>
            </div>

            {/* SwapBack Route */}
            <div className="terminal-box border-2 border-[var(--primary)] p-6 relative">
              <div className="absolute top-2 right-2">
                <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse inline-block"></span>
              </div>
              <div className="terminal-text text-xs text-[var(--primary)] mb-4 text-center font-bold">
                SWAPBACK_ROUTING
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="terminal-box p-3 bg-black border border-[var(--primary)] flex-1 text-center">
                    <div className="terminal-text text-xs text-[var(--primary)]">100_SOL</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-center text-[var(--primary)] text-xs mb-1">40%</div>
                    <div className="terminal-box p-2 bg-black border border-[var(--primary)]/50 text-center">
                      <div className="terminal-text text-xs">POOL_A</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-center text-[var(--primary)] text-xs mb-1">35%</div>
                    <div className="terminal-box p-2 bg-black border border-[var(--primary)]/50 text-center">
                      <div className="terminal-text text-xs">POOL_B</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-center text-[var(--primary)] text-xs mb-1">25%</div>
                    <div className="terminal-box p-2 bg-black border border-[var(--primary)]/50 text-center">
                      <div className="terminal-text text-xs">POOL_C</div>
                    </div>
                  </div>
                </div>
                <div className="text-center text-[var(--primary)]">↓</div>
                <div className="terminal-box p-3 border-2 border-[var(--primary)] bg-[var(--primary)]/10 text-center">
                  <div className="terminal-text font-bold text-[var(--primary)]">20,315_USDC</div>
                  <div className="terminal-text text-xs text-[var(--secondary)] mt-1">+2.3% savings</div>
                  <div className="terminal-text text-xs text-[var(--accent)] mt-1">+$40 NPI rebate</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-block terminal-box border-2 border-[var(--accent)] bg-[var(--accent)]/10 px-8 py-4">
              <div className="terminal-text text-2xl font-bold text-[var(--accent)]">
                NET_GAIN: <span className="text-[var(--primary)]">+$505</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: THE REWARDS */}
      <div 
        ref={el => sectionsRef.current[2] = el}
        className={`min-h-screen flex items-center justify-center border-t-2 border-[var(--primary)]/30 transition-all duration-1000 ${
          visibleSections.includes(2) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="terminal-text text-sm text-[var(--muted)] mb-4 tracking-widest">
              [REWARDS_SYSTEM]
            </div>
            <h2 className="text-5xl font-bold terminal-text terminal-glow uppercase mb-6">
              EARN ON <span className="text-[var(--primary)]">EVERY SWAP</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div 
              className="terminal-box border-2 border-[var(--primary)] p-8 transform hover:scale-105 transition-all"
              style={{
                animationDelay: '0.1s'
              }}
            >
              <div className="text-5xl mb-6 text-center">💰</div>
              <h3 className="terminal-text text-2xl font-bold mb-4 uppercase text-center text-[var(--primary)]">
                70% NPI
              </h3>
              <p className="terminal-text text-[var(--muted)] text-center leading-relaxed">
                Majority of protocol revenue goes directly to users
              </p>
              <div className="mt-6 terminal-box bg-black p-4 border border-[var(--primary)]/30">
                <div className="flex justify-between text-xs terminal-text mb-2">
                  <span className="text-[var(--muted)]">Your_Share:</span>
                  <span className="text-[var(--primary)]">70%</span>
                </div>
                <div className="flex justify-between text-xs terminal-text">
                  <span className="text-[var(--muted)]">Monthly:</span>
                  <span className="text-[var(--accent)]">~$340</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div 
              className="terminal-box border-2 border-[var(--secondary)] p-8 transform hover:scale-105 transition-all"
              style={{
                animationDelay: '0.2s'
              }}
            >
              <div className="text-5xl mb-6 text-center">🚀</div>
              <h3 className="terminal-text text-2xl font-bold mb-4 uppercase text-center text-[var(--secondary)]">
                +10% BOOST
              </h3>
              <p className="terminal-text text-[var(--muted)] text-center leading-relaxed">
                Lock $BACK tokens to multiply your earnings
              </p>
              <div className="mt-6 terminal-box bg-black p-4 border border-[var(--secondary)]/30">
                <div className="flex justify-between text-xs terminal-text mb-2">
                  <span className="text-[var(--muted)]">Lock:</span>
                  <span className="text-[var(--secondary)]">100K_BACK</span>
                </div>
                <div className="flex justify-between text-xs terminal-text">
                  <span className="text-[var(--muted)]">Boost:</span>
                  <span className="text-[var(--accent)]">+10.0%</span>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div 
              className="terminal-box border-2 border-[var(--accent)] p-8 transform hover:scale-105 transition-all"
              style={{
                animationDelay: '0.3s'
              }}
            >
              <div className="text-5xl mb-6 text-center">🔥</div>
              <h3 className="terminal-text text-2xl font-bold mb-4 uppercase text-center text-[var(--accent)]">
                DEFLATIONARY
              </h3>
              <p className="terminal-text text-[var(--muted)] text-center leading-relaxed">
                20% of fees fund buyback & burn program
              </p>
              <div className="mt-6 terminal-box bg-black p-4 border border-[var(--accent)]/30">
                <div className="flex justify-between text-xs terminal-text mb-2">
                  <span className="text-[var(--muted)]">Burned:</span>
                  <span className="text-[var(--accent)]">{globalState?.swapBuybackAccrued.toFixed(0) || "0"}_BACK</span>
                </div>
                <div className="flex justify-between text-xs terminal-text">
                  <span className="text-[var(--muted)]">Supply:</span>
                  <span className="text-[var(--primary)]">↓ -0.8%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: LIVE DASHBOARD PREVIEW */}
      <div 
        ref={el => sectionsRef.current[3] = el}
        className={`min-h-screen flex items-center justify-center border-t-2 border-[var(--primary)]/30 transition-all duration-1000 ${
          visibleSections.includes(3) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="terminal-text text-sm text-[var(--muted)] mb-4 tracking-widest">
              [REAL_TIME_DATA]
            </div>
            <h2 className="text-5xl font-bold terminal-text terminal-glow uppercase mb-6">
              FULL <span className="text-[var(--primary)]">TRANSPARENCY</span>
            </h2>
            <p className="terminal-text text-xl text-[var(--muted)]">
              All metrics verified on-chain
            </p>
          </div>

          {/* Mock Dashboard Preview */}
          <div className="terminal-box border-2 border-[var(--primary)] p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="terminal-box bg-black p-4 border border-[var(--primary)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-2">TVL</div>
                <div className="terminal-text text-lg font-bold text-[var(--primary)]">
                  ${globalState?.totalValueLocked.toFixed(0) || "0"}
                </div>
              </div>
              <div className="terminal-box bg-black p-4 border border-[var(--secondary)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-2">24H_Volume</div>
                <div className="terminal-text text-lg font-bold text-[var(--secondary)]">
                  ${globalState?.totalSwapVolume.toFixed(0) || "0"}
                </div>
              </div>
              <div className="terminal-box bg-black p-4 border border-[var(--accent)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-2">Active_Locks</div>
                <div className="terminal-text text-lg font-bold text-[var(--accent)]">
                  {globalState?.activeLocksCount || 0}
                </div>
              </div>
              <div className="terminal-box bg-black p-4 border border-[var(--primary)]/30">
                <div className="terminal-text text-xs text-[var(--muted)] mb-2">Boost</div>
                <div className="terminal-text text-lg font-bold text-[var(--primary)]">
                  {globalState ? `${(globalState.totalCommunityBoost / 100).toFixed(2)}%` : "0%"}
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center mt-6">
              <button
                onClick={() => router.push('/swap')}
                className="terminal-text text-sm text-[var(--primary)] hover:text-[var(--accent)] transition-colors cursor-pointer uppercase tracking-wider underline"
              >
                [START_TRADING]
              </button>
              <span className="terminal-text text-sm text-[var(--muted)]">•</span>
              <button
                onClick={() => router.push('/dashboard')}
                className="terminal-text text-sm text-[var(--secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer uppercase tracking-wider underline"
              >
                [VIEW_FULL_DASHBOARD]
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="min-h-screen flex items-center justify-center border-t-2 border-[var(--primary)]/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-6xl md:text-7xl font-bold terminal-text terminal-glow uppercase mb-8">
            JOIN <span className="text-[var(--primary)]">10,000+</span>
            <br />
            SMART TRADERS
          </h2>
          <p className="terminal-text text-2xl text-[var(--muted)] mb-12">
            Start earning on every swap today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <button 
              onClick={() => router.push('/swap')}
              className="terminal-box border-2 border-[var(--primary)] bg-[var(--primary)] text-black px-12 py-6 font-bold terminal-text text-xl uppercase tracking-wider hover:bg-transparent hover:text-[var(--primary)] transition-all hover:scale-105 cursor-pointer"
            >
              [START_TRADING]
            </button>
            <button 
              onClick={() => router.push('/dashboard')}
              className="terminal-box border-2 border-[var(--secondary)] bg-transparent text-[var(--secondary)] px-12 py-6 font-bold terminal-text text-xl uppercase tracking-wider hover:bg-[var(--secondary)] hover:text-black transition-all hover:scale-105 cursor-pointer"
            >
              [VIEW_DASHBOARD]
            </button>
          </div>
          <div className="terminal-text text-sm text-[var(--muted)] mt-8">
            No account required • Connect wallet & start trading
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); opacity: 0.3; }
          50% { transform: translateY(-20px); opacity: 1; }
        }
        @keyframes glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
        }
        .animate-float {
          animation: float linear infinite;
        }
        .animate-glitch {
          animation: glitch 0.5s ease-in-out 2;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        .animate-fade-in-delay {
          animation: fade-in 1s ease-out 0.5s both;
        }
      `}</style>
    </div>
  );
}
