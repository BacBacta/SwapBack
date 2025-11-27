"use client";

export default function SwapTestPage() {
  return (
    <div className="min-h-screen py-12 px-4 bg-gray-900">
      <div className="max-w-xl mx-auto">
        <div className="relative group">
          {/* Animated background glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 animate-gradient-shift"></div>
          
          {/* Main card */}
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-gray-950/95 border-2 border-emerald-500/30 rounded-2xl p-8 shadow-2xl shadow-emerald-500/20 transition-all duration-300 hover:border-emerald-400/50 hover:shadow-emerald-500/30">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-4">
              ✅ Swap UI Test
            </h1>
            <p className="text-gray-400">
              Si vous voyez ce texte avec les animations et gradients, les modifications UI fonctionnent !
            </p>
            
            <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
              <p className="text-sm text-gray-300">
                Passez la souris sur cette carte pour voir l'effet glow animé.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
