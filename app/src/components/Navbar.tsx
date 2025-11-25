"use client";

import { ClientOnlyWallet } from "./ClientOnlyWallet";
import Link from "next/link";
import Image from "next/image";

export const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0C0C0C]/90 border-b border-[#10B981]/30 shadow-[0_0_20px_rgba(0,255,0,0.15)]">
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity group"
          >
            <Image
              src="/icons/icon_swapback.svg"
              alt="SwapBack Logo"
              width={32}
              height={32}
              className="transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              priority
            />
            <span className="text-xl font-bold font-sans">
              SWAP<span className="text-primary">BACK</span>
            </span>
          </Link>

          {/* Wallet Button */}
          <div className="flex items-center">
            <ClientOnlyWallet />
          </div>
        </div>
      </div>
    </nav>
  );
};
