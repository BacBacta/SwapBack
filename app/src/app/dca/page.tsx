"use client";

import { DCA } from "@/components/DCA";

export default function DCAPage() {
  return (
    <main className="min-h-screen terminal-scanline" id="dca-page">
      {/* TERMINAL HEADER */}
      <div className="border-b-2 border-white bg-black">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="terminal-text text-sm">
            <span className="text-[var(--muted)]">user@swapback:~$</span>{" "}
            <span className="terminal-cursor">./dca --strategy auto</span>
          </div>
        </div>
      </div>

      {/* HERO SECTION */}
      <div className="border-b-2 border-white/30 bg-black py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 border-2 border-white px-4 py-2 mb-4">
            <span className="w-2 h-2 bg-white animate-pulse"></span>
            <span className="text-xs font-bold terminal-text uppercase tracking-wider text-white">
              [DCA_STRATEGY_ACTIVE]
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold terminal-text terminal-glow mb-3 uppercase tracking-wider text-white">
            DOLLAR COST AVERAGING
          </h1>
          <p className="text-lg terminal-text text-white/70 max-w-3xl">
            <span className="terminal-prompt">›</span> Automate your token purchases with intelligent scheduling
          </p>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="py-8 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="animate-fade-in">
            <div className="border-2 border-white/20 bg-black p-8">
              <DCA />
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t-2 border-white bg-black">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 terminal-text text-white/70">
            <div className="text-sm">
              <span className="terminal-prompt">›</span>
              <span className="ml-2">© 2025 SWAPBACK. DCA_MODULE.</span>
            </div>
            <div className="flex gap-6 text-sm">
              <a
                href="https://docs.swapback.io/dca"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-white/50 transition-colors"
              >
                [DOCS]
              </a>
              <a
                href="https://discord.gg/swapback"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-white/50 transition-colors"
              >
                [SUPPORT]
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}