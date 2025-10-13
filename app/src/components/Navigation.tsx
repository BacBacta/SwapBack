"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export const Navigation = () => {
  return (
    <nav className="border-b border-white/10 bg-gradient-to-r from-black/80 via-black/70 to-black/80 backdrop-blur-xl sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] via-[var(--primary-light)] to-[var(--secondary)] bg-clip-text text-transparent hover:scale-105 transition-transform duration-300"
            >
              <span className="flex items-center gap-2">
                <span className="text-3xl">⚡</span>
                <span>SwapBack</span>
              </span>
            </Link>
            <div className="hidden md:flex space-x-1">
              <Link
                href="/"
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-300 font-medium"
              >
                Swap
              </Link>
              <Link
                href="/lock"
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-300 font-medium"
              >
                Lock & Earn
              </Link>
              <Link
                href="/stats"
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-300 font-medium"
              >
                Stats
              </Link>
              <Link
                href="/docs"
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-300 font-medium"
              >
                Docs
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Network indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[var(--secondary)]/10 rounded-lg border border-[var(--secondary)]/20">
              <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse"></span>
              <span className="text-xs font-semibold text-[var(--secondary)]">Solana</span>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </nav>
  );
};
