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
        <div className="backdrop-blur-xl bg-[#00FFFF]/5 border-2 border-[#00FFFF]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,255,0.2)] transition-all hover:border-[#00FFFF]/50">
          <EnhancedSwapInterface />
        </div>
      </div>
    </div>
  );
}
