"use client";

import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { MobileNav } from "@/components/MobileNav";
import { CommandPalette } from "@/components/CommandPalette";
import { ClientOnlyWallet } from "@/components/ClientOnlyWallet";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Sidebar Desktop */}
      <Sidebar />

      {/* Mobile Hamburger Menu */}
      <MobileNav />

      {/* Main Content */}
      <div className="md:pl-56 lg:pl-64 flex flex-col min-h-screen">
        {/* Header with Wallet */}
        <header className="sticky top-0 z-30 bg-[#0C0C0C]/95 backdrop-blur-xl border-b border-primary/20">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Mobile: Leave space for hamburger, Tablet+: Show title */}
            <div className="flex items-center space-x-4">
              <div className="w-12 md:w-0" /> {/* Spacer for hamburger */}
              <h1 className="text-lg font-bold hidden md:block">SwapBack</h1>
            </div>
            <div className="flex items-center space-x-2 overflow-x-visible">
              <ClientOnlyWallet />
            </div>
          </div>
        </header>

        <main className="flex-1 pb-20 md:pb-0">
          <div className="py-4 px-3 sm:py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Nav Mobile */}
      <BottomNav />

      {/* Command Palette */}
      <CommandPalette />
    </>
  );
}
