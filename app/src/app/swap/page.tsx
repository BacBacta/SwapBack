import dynamicImport from "next/dynamic";
import { Breadcrumb } from "@/components/BackButton";

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
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Swap", href: "/swap" }
            ]} 
          />
        </div>
        <EnhancedSwapInterface />
      </div>
    </div>
  );
}
