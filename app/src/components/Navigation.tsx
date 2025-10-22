"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const Navigation = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const navLinks = [
    { href: "/", label: "Swap" },
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
      <nav className="border-b-2 border-[#00ff00] bg-black sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <Link
                href="/"
                className="text-2xl font-bold transition-all duration-300 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-transparent border-2 border-[#00ff00] flex items-center justify-center">
                  <span className="text-[#00ff00] font-bold text-xl terminal-text">&gt;</span>
                </div>
                <span className="terminal-text text-[#00ff00]">
                  SWAPBACK_v1.0
                </span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex space-x-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 transition-all duration-300 font-bold terminal-text relative ${
                      isActive(link.href)
                        ? "text-[#00ff00] bg-[#00ff00]/10 border-2 border-[#00ff00]"
                        : "text-[#006600] hover:text-[#00ff00] border-2 border-transparent hover:border-[#00ff00]/50"
                    }`}
                  >
                    <span className="terminal-prefix">&gt;</span>{link.label.toUpperCase()}
                    {isActive(link.href) && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] rounded-full shadow-[0_0_8px_var(--primary)]" />
                    )}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Network indicator */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[var(--secondary)]/10 rounded-lg border border-[var(--secondary)]/20">
                <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse"></span>
                <span className="text-xs font-semibold text-[var(--secondary)]">
                  Solana
                </span>
              </div>

              {/* Wallet button - hidden on mobile to save space */}
              <div className="hidden sm:block">
                {isMounted ? <WalletMultiButton /> : null}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg
                    className="w-6 h-6 text-white"
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
                    className="w-6 h-6 text-white"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden cursor-default border-0 p-0"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />

          {/* Menu Panel */}
          <div className="fixed top-[73px] right-0 bottom-0 w-72 bg-[var(--glass-bg)] backdrop-blur-xl border-l border-white/10 z-50 md:hidden animate-slide-in-right shadow-2xl">
            <div className="flex flex-col h-full p-6">
              {/* Navigation Links */}
              <div className="space-y-2 mb-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-lg transition-all duration-300 font-medium ${
                      isActive(link.href)
                        ? "text-white bg-white/10 border-l-2 border-[var(--primary)] shadow-[0_0_20px_rgba(153,69,255,0.3)]"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Network indicator */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--secondary)]/10 rounded-lg border border-[var(--secondary)]/20 mb-6">
                <span className="w-2 h-2 bg-[var(--secondary)] rounded-full animate-pulse"></span>
                <span className="text-xs font-semibold text-[var(--secondary)]">
                  Solana Network
                </span>
              </div>

              {/* Wallet button for mobile */}
              <div className="mt-auto">
                {isMounted ? <WalletMultiButton className="!w-full" /> : null}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
