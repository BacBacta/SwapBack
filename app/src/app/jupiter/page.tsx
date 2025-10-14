'use client';

import { JupiterSwapWidget } from '@/components/JupiterSwapWidget';
import { Navigation } from '@/components/Navigation';

export default function JupiterPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Navigation />

      <div className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 mt-12">
          <div className="inline-block mb-4">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-gray-300">Jupiter V6 Integration</span>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">
            Jupiter Swap
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-4">
            Swap tokens on Solana with the best prices powered by Jupiter aggregator
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            ⚠️ Cette page utilise l&apos;API Jupiter V6 réelle. Assurez-vous d&apos;avoir un accès réseau pour obtenir des quotes.
          </p>
        </div>

        {/* Main Content - Swap Widget */}
        <div className="max-w-2xl mx-auto mb-16">
          <JupiterSwapWidget />
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-lg font-semibold text-white mb-2">Meilleur Prix</h3>
            <p className="text-sm text-gray-400">
              Jupiter agrège plusieurs DEX pour trouver la meilleure route et le meilleur prix
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="text-lg font-semibold text-white mb-2">Sécurisé</h3>
            <p className="text-sm text-gray-400">
              Transactions signées dans votre wallet. Vos clés privées restent toujours privées
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="text-lg font-semibold text-white mb-2">Slippage Contrôlé</h3>
            <p className="text-sm text-gray-400">
              Configurez votre tolérance au slippage pour une exécution optimale
            </p>
          </div>
        </div>

        {/* Technical Info */}
        <div className="max-w-5xl mx-auto mt-12">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl p-6 border border-blue-500/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>ℹ️</span> Informations Techniques
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div>
                <strong className="text-blue-400">API:</strong> Jupiter V6 API (https://quote-api.jup.ag/v6)
              </div>
              <div>
                <strong className="text-blue-400">Réseau:</strong> Solana Devnet
              </div>
              <div>
                <strong className="text-blue-400">Slippage par défaut:</strong> 0.5% (50 basis points)
              </div>
              <div>
                <strong className="text-blue-400">Actualisation:</strong> Auto-refresh toutes les 30s
              </div>
              <div className="md:col-span-2">
                <strong className="text-blue-400">Fonctionnalités:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                  <li>Obtention de quotes en temps réel</li>
                  <li>Affichage détaillé des routes et AMMs utilisés</li>
                  <li>Calcul du price impact</li>
                  <li>Exécution de swaps avec signature wallet</li>
                  <li>Lien vers l&apos;explorateur de transactions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Documentation Link */}
        <div className="text-center mt-12">
          <a
            href="https://station.jup.ag/docs/apis/swap-api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>📚 Documentation Jupiter API</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </main>
  );
}
