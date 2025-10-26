"use client";

import { SwapInterfaceModern } from "@/components/SwapInterfaceModern";
import { PageHeader } from "@/components/BackButton";

export default function SwapModernPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="⚡ Swap - Modern UI"
          description="Interface de swap améliorée avec design moderne inspiré des meilleures applications DeFi"
          breadcrumbItems={[
            { label: "Accueil", href: "/" },
            { label: "Swap Modern", href: "/swap-modern" }
          ]}
          showBackButton={true}
        />
        
        <SwapInterfaceModern />
        
        {/* Feature highlights */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-black/40 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="text-lg font-bold terminal-text uppercase tracking-wider mb-2 text-[var(--primary)]">
              Design Moderne
            </h3>
            <p className="text-sm text-gray-400">
              Interface inspirée de Uniswap V3, 1inch et Jupiter avec glassmorphism et animations fluides
            </p>
          </div>
          
          <div className="p-6 bg-black/40 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-lg font-bold terminal-text uppercase tracking-wider mb-2 text-[var(--primary)]">
              Performance
            </h3>
            <p className="text-sm text-gray-400">
              Calcul en temps réel avec debounce, animations optimisées et transitions GPU-accelerated
            </p>
          </div>
          
          <div className="p-6 bg-black/40 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all">
            <div className="text-3xl mb-3">📱</div>
            <h3 className="text-lg font-bold terminal-text uppercase tracking-wider mb-2 text-[var(--primary)]">
              Responsive
            </h3>
            <p className="text-sm text-gray-400">
              Design optimisé mobile-first avec touch gestures et layout adaptatif
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
