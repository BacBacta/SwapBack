import { ImprovedSwapInterface } from "@/components/ImprovedSwapInterface";

export default function SwapImprovedPreviewPage() {
  return (
    <div className="min-h-screen bg-[#060913] py-12 px-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-[#00d4ff]/10 to-[#7b2cbf]/10 border border-[#00d4ff]/30 rounded-2xl p-6">
          <h1 className="text-3xl font-bold text-white mb-3">
            ✨ Improved Swap Interface Preview
          </h1>
          <p className="text-gray-300 mb-4">
            This preview showcases UX improvements based on best practices for DEX interfaces.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-[#0a0b14] rounded-lg p-4">
              <div className="text-[#00d4ff] font-semibold mb-2">✅ Implemented Improvements</div>
              <ul className="space-y-1 text-gray-400">
                <li>• Skeleton loader during route search</li>
                <li>• Router confidence scores (98% / 95%)</li>
                <li>• Enhanced token search with filters</li>
                <li>• Amount presets (25% / 50% / 75% / 100%)</li>
                <li>• Interactive tooltips for NPI terms</li>
                <li>• WCAG-compliant color contrasts</li>
                <li>• Error state with clear messaging</li>
                <li>• ARIA labels for screen readers</li>
              </ul>
            </div>
            
            <div className="bg-[#0a0b14] rounded-lg p-4">
              <div className="text-[#00d4ff] font-semibold mb-2">🎯 Key Features</div>
              <ul className="space-y-1 text-gray-400">
                <li>• Real-time balance percentage display</li>
                <li>• Favorite tokens & liquidity sorting</li>
                <li>• Progressive button states</li>
                <li>• Contextual help icons with hover</li>
                <li>• Smooth transitions & animations</li>
                <li>• Mobile-responsive design</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <ImprovedSwapInterface />

      {/* Footer Notes */}
      <div className="max-w-4xl mx-auto mt-8">
        <div className="bg-[#0a0b14] border border-[#1a1b2e] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">📝 UX Improvements Checklist</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
            <div>
              <div className="text-white font-semibold mb-2">1. Transparency</div>
              <div>Route info with skeleton loader shows search progress</div>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">2. Confidence</div>
              <div>Router scores help users choose with certainty</div>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">3. Token Selection</div>
              <div>Search, favorites, and liquidity filters reduce friction</div>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">4. Accessibility</div>
              <div>Tooltips explain NPI, rebates, and burn mechanisms</div>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">5. Resilience</div>
              <div>WCAG colors + ARIA labels + clear error messages</div>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">6. Input Optimization</div>
              <div>Presets (25-100%) + percentage display for speed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
