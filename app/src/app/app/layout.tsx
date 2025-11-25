"use client";

import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { CommandPalette } from "@/components/CommandPalette";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Sidebar Desktop */}
      <Sidebar />

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
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
