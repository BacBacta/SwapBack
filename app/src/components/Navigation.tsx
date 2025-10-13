"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export const Navigation = () => {
  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent"
            >
              SwapBack
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link
                href="/"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Swap
              </Link>
              <Link
                href="/lock"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Lock & Earn
              </Link>
              <Link
                href="/stats"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Stats
              </Link>
              <Link
                href="/docs"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Docs
              </Link>
            </div>
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
};
