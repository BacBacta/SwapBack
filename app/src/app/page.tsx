'use client';

import { SwapInterface } from "@/components/SwapInterface";
import { Dashboard } from "@/components/Dashboard";
import { Navigation } from "@/components/Navigation";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 mt-8">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
            SwapBack
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Le routeur d'exécution optimisé pour Solana. 
            Maximisez vos profits, minimisez vos frais, gagnez des remises.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <SwapInterface />
          <Dashboard />
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="swap-card text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-2">Best Execution</h3>
            <p className="text-gray-400">
              Routage intelligent via Metis, Juno et RFQ privés pour le meilleur prix
            </p>
          </div>
          
          <div className="swap-card text-center">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold mb-2">Cashback 70-80%</h3>
            <p className="text-gray-400">
              Recevez jusqu'à 80% du surplus généré sous forme de remises
            </p>
          </div>
          
          <div className="swap-card text-center">
            <div className="text-4xl mb-4">🔥</div>
            <h3 className="text-xl font-bold mb-2">Burn Automatique</h3>
            <p className="text-gray-400">
              20-30% du surplus rachète et brûle $BACK pour réduire l'offre
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
