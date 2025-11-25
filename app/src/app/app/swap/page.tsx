import dynamicImport from "next/dynamic";

export const dynamic = "force-dynamic";

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
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Swap</h1>
        <p className="text-gray-400">Trade tokens on Solana with best execution</p>
      </div>
      <EnhancedSwapInterface />
    </div>
  );
}
