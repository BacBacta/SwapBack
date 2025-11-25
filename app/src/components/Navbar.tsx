"use client";

import { ClientOnlyWallet } from "./ClientOnlyWallet";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const Navbar = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/swap", label: "Swap" },
    { href: "/dca", label: "DCA" },
    { href: "/buyback", label: "Buyback" },
  ];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0C0C0C]/90 border-b border-[#10B981]/30 shadow-[0_0_20px_rgba(0,255,0,0.15)]">
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto px-4 sm:px-6 lg:px-8">\n        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity group"
          >
            <div className="w-8 h-8 bg-[var(--primary)] rounded-sm flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(0,255,0,0.5)] transition-all">
              <span className="text-[#0C0C0C] font-bold text-lg">S</span>
            </div>
            <span className="terminal-text text-xl font-bold">
              SWAP<span className="text-[var(--primary)]">BACK</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg terminal-text transition-all ${
                    isActive
                      ? "bg-[var(--primary)] text-[#19162F] font-bold"
                      : "text-gray-300 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                  }`}
                >
                  {isActive && <span className="terminal-prefix">&gt; </span>}
                  {link.label.toUpperCase()}
                </Link>
              );
            })}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center">
            <ClientOnlyWallet />
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3 space-x-1 flex overflow-x-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded terminal-text text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[var(--primary)] text-[#19162F] font-bold"
                    : "text-gray-300 hover:bg-[var(--primary)]/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
