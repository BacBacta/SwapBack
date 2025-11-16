"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getNetworkLabel, isMainnet } from "@/utils/explorer";
import { ClientOnlyWallet } from "./ClientOnlyWallet";

export const Navigation = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Swap" },
    { href: "/dca", label: "DCA", badge: "📊" },
    { href: "/buyback", label: "Buyback", badge: "🔥" },
    { href: "/lock", label: "Lock & Earn" },
    { href: "/stats", label: "Stats" },
    { href: "/docs", label: "Docs" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <>
      <nav className="border-b-2 border-[var(--primary)] bg-black sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <Link
                href="/"
                className="text-2xl font-bold terminal-text terminal-glow hover:text-[var(--accent)] transition-colors flex items-center gap-3 uppercase tracking-wider"
              >
                <span className="text-3xl">⚡</span>
                <span>SWAPBACK</span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex space-x-0">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 border-r-2 border-[var(--primary)]/30 transition-all font-bold terminal-text uppercase tracking-wider ${
                      isActive(link.href)
                        ? "bg-[var(--primary)] text-black"
                        : "text-[var(--primary)] hover:bg-[var(--primary)]/10"
                    }`}
                  >
                    {link.label}
                    {isActive(link.href) && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--primary)]" />
                    )}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Network indicator */}
              <div className="hidden md:flex items-center gap-2 border-2 border-[var(--secondary)] px-3 py-1.5">
                <span className="w-2 h-2 bg-[var(--secondary)] animate-pulse"></span>
                <span className="text-xs font-bold terminal-text uppercase tracking-wider">
                  SOLANA
                </span>
              </div>

              {/* Wallet button avec indicateur de réseau */}
              <div className="hidden sm:flex items-center space-x-3">
                {/* Indicateur de réseau */}
                <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded terminal-text">
                  DEVNET
                </div>

                {/* Wallet button - Client-only to avoid SSR errors */}
                <ClientOnlyWallet />
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 border-2 border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-colors terminal-text"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <button
            className="fixed inset-0 bg-black/80 z-40 md:hidden cursor-default border-0 p-0"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />

          {/* Menu Panel */}
          <div className="fixed top-[73px] right-0 bottom-0 w-72 bg-black border-l-2 border-[var(--primary)] z-50 md:hidden animate-slide-in-right">
            <div className="flex flex-col h-full p-6 terminal-scanline">
              {/* Navigation Links */}
              <div className="space-y-0 mb-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 border-b-2 transition-all duration-300 terminal-text uppercase tracking-wider ${
                      isActive(link.href)
                        ? "bg-[var(--primary)] text-black border-[var(--primary)] terminal-glow"
                        : "text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]"
                    }`}
                  >
                    {'>'} {link.label}
                  </Link>
                ))}
              </div>

              {/* Network indicator */}
              <div className={`flex items-center gap-2 px-4 py-3 border-2 mb-6 ${isMainnet() ? 'border-green-500' : 'border-orange-500'}`}>
                <span className={`w-2 h-2 animate-pulse ${isMainnet() ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                <span className="text-xs terminal-text uppercase tracking-wider">
                  [{getNetworkLabel()}{!isMainnet() ? ' - TEST NETWORK' : ''}]
                </span>
              </div>

              {/* Wallet button for mobile - Client-only to avoid SSR errors */}
              <div className="mt-auto">
                <ClientOnlyWallet />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
