"use client";

import { Navigation } from "@/components/Navigation";
import { EnhancedSwapInterface } from "@/components/EnhancedSwapInterface";

export default function Home() {
  return (
    <main className="min-h-screen terminal-scanline" id="main-content">
      {/* NAVIGATION - Using existing Navigation component */}
      <Navigation />

      {/* TERMINAL HEADER */}
      <div className="border-b-2 border-[var(--primary)] bg-black">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="terminal-text text-sm">
            <span className="text-[var(--muted)]">user@swapback:~$</span>{" "}
            <span className="terminal-cursor">./swap --interactive</span>
          </div>
        </div>
      </div>

      {/* HERO BANNER - Terminal Style */}
      <div className="border-b-2 border-[var(--primary)]/30 bg-black">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 border-2 border-[var(--secondary)] px-4 py-2 mb-4">
              <span className="w-2 h-2 bg-[var(--secondary)] animate-pulse"></span>
              <span className="text-sm font-bold terminal-text uppercase tracking-wider">
                [LIVE_ON_SOLANA_DEVNET]
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold terminal-text terminal-glow mb-4 uppercase tracking-wider">
              ╔═══════════════════╗
              <br />
              ║ SWAPBACK v2.0.1 ║<br />
              ╚═══════════════════╝
            </h1>
            <p className="text-lg terminal-text max-w-3xl mx-auto mb-4">
              <span className="terminal-prompt"></span>THE SMART ROUTER FOR
              SOLANA
            </p>
            <p className="text-sm terminal-text text-[var(--muted)] max-w-3xl mx-auto">
              MAXIMIZE_PROFITS | MINIMIZE_FEES | EARN_REBATES
            </p>

            {/* STATS - Terminal Style */}
            <div className="flex justify-center gap-8 mt-6 text-sm">
              <div className="terminal-box px-4 py-2">
                <span className="terminal-text terminal-number font-bold text-lg">
                  $1.2M+
                </span>
                <span className="terminal-text text-[var(--muted)] ml-2">
                  VOLUME
                </span>
              </div>
              <div className="terminal-box px-4 py-2">
                <span className="terminal-text terminal-number font-bold text-lg">
                  98%
                </span>
                <span className="terminal-text text-[var(--muted)] ml-2">
                  SUCCESS
                </span>
              </div>
              <div className="terminal-box px-4 py-2">
                <span className="terminal-text terminal-number font-bold text-lg">
                  0.1s
                </span>
                <span className="terminal-text text-[var(--muted)] ml-2">
                  AVG_TIME
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-fade-in">
            <EnhancedSwapInterface />
          </div>
        </div>
      </div>

      {/* FOOTER - Terminal Style */}
      <footer className="mt-16 border-t-2 border-[var(--primary)] bg-black">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="terminal-border-top mb-4"></div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 terminal-text">
            <div className="text-sm">
              <span className="terminal-prompt"></span>
              <span className="text-[var(--muted)]">
                © 2025 SWAPBACK. BUILT_ON_SOLANA.
              </span>
            </div>
            <div className="flex gap-6 text-sm">
              <a
                href="https://docs.swapback.io"
                target="_blank"
                rel="noopener noreferrer"
                className="terminal-brackets hover:text-[var(--accent)] transition-colors"
              >
                DOCS
              </a>
              <a
                href="https://twitter.com/swapback"
                target="_blank"
                rel="noopener noreferrer"
                className="terminal-brackets hover:text-[var(--accent)] transition-colors"
              >
                TWITTER
              </a>
              <a
                href="https://discord.gg/swapback"
                target="_blank"
                rel="noopener noreferrer"
                className="terminal-brackets hover:text-[var(--accent)] transition-colors"
              >
                DISCORD
              </a>
            </div>
          </div>
          <div className="terminal-border-bottom mt-4"></div>
          <div className="text-center mt-4 terminal-text text-xs text-[var(--muted)]">
            <span className="terminal-prompt"></span>TYPE 'HELP' FOR COMMANDS |
            PRESS CTRL+C TO EXIT
          </div>
        </div>
      </footer>
    </main>
  );
}
