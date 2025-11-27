"use client";

import dynamicImport from "next/dynamic";
import { Breadcrumb } from "@/components/BackButton";

// Lazy load EnhancedSwapInterface to avoid webpack issues on Vercel
const EnhancedSwapInterface = dynamicImport(
  () => import("@/components/EnhancedSwapInterface").then(mod => ({ default: mod.EnhancedSwapInterface })),
  { 
    ssr: false,
    loading: () => (
      <div className="swap-card">
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-[var(--primary)]">
            Chargement de l'interface de swap...
          </div>
        </div>
      </div>
    )
  }
);

export default function SwapPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto">
        <div className="mb-8">
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Swap", href: "/swap" }
            ]} 
          />
        </div>
        <div className="relative group">
          {/* Animated background glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 animate-gradient-shift"></div>
          
          {/* Main card */}
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-gray-950/95 border-2 border-emerald-500/30 rounded-2xl p-8 shadow-2xl shadow-emerald-500/20 transition-all duration-300 hover:border-emerald-400/50 hover:shadow-emerald-500/30">
            <EnhancedSwapInterface />
          </div>
        </div>
      </div>
    </div>
  );
}
