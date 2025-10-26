'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import LockInterface from '@/components/LockInterface';
import UnlockInterface from '@/components/UnlockInterface';
import { useCNFT } from '@/hooks/useCNFT';
import { PageHeader } from '@/components/BackButton';

export default function LockPage() {
  const { publicKey } = useWallet();
  const { cnftData, lockData, isLoading, refresh } = useCNFT();
  const [activeTab, setActiveTab] = useState<'lock' | 'unlock'>('lock');

  // Déterminer l'onglet actif par défaut basé sur l'état du lock
  React.useEffect(() => {
    if (lockData?.isActive && cnftData?.isActive) {
      setActiveTab('unlock');
    } else {
      setActiveTab('lock');
    }
  }, [lockData, cnftData]);

  const handleSuccess = () => {
    // Rafraîchir les données après succès
    setTimeout(() => {
      refresh();
    }, 2000);
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Page Header with Back Button */}
        <PageHeader
          title="💎 LOCK & EARN"
          description="Lock your $BACK tokens to receive a cNFT and benefit from exceptional boosts on your swaps"
          breadcrumbItems={[
            { label: "Home", href: "/" },
            { label: "Lock", href: "/lock" }
          ]}
          showBackButton={true}
        />

        {/* Connexion wallet requise */}
        {!publicKey && (
          <div className="glass-effect border border-yellow-500/30 rounded-xl p-8 mb-8 text-center animate-slide-up">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 mx-auto mb-6">
              <span className="text-5xl">👛</span>
            </div>
            <h3 className="text-xl font-bold text-yellow-300 mb-3">
              Wallet Not Connected
            </h3>
            <p className="text-gray-400 mb-6">
              Please connect your Phantom wallet to continue
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-sm text-yellow-300">Waiting for connection</span>
            </div>
          </div>
        )}

        {/* Tabs de navigation améliorés */}
        {publicKey && (
          <div className="flex gap-3 mb-8 p-1 glass-effect rounded-xl animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => setActiveTab('lock')}
              disabled={lockData?.isActive && cnftData?.isActive}
              className={`flex-1 py-4 px-6 rounded-lg font-bold transition-all duration-300 relative overflow-hidden group ${
                activeTab === 'lock'
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-[var(--primary)] shadow-glow'
                  : 'text-gray-300 hover:text-[var(--primary)] hover:bg-[var(--primary)]/5'
              } ${
                lockData?.isActive && cnftData?.isActive
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {activeTab === 'lock' && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent animate-shimmer"></div>
              )}
              <span className="relative flex items-center justify-center gap-2">
                <span className="text-xl">🔒</span>
                <span>LOCK</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('unlock')}
              disabled={!lockData?.isActive || !cnftData?.isActive}
              className={`flex-1 py-4 px-6 rounded-lg font-bold transition-all duration-300 relative overflow-hidden group ${
                activeTab === 'unlock'
                  ? 'bg-gradient-to-r from-secondary to-green-400 text-gray-900 shadow-glow-green'
                  : 'text-gray-300 hover:text-[var(--primary)] hover:bg-[var(--primary)]/5'
              } ${
                !lockData?.isActive || !cnftData?.isActive
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {activeTab === 'unlock' && (
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-transparent animate-shimmer"></div>
              )}
              <span className="relative flex items-center justify-center gap-2">
                <span className="text-xl">🔓</span>
                <span>UNLOCK</span>
              </span>
            </button>
          </div>
        )}

        {/* Contenu de l'onglet actif */}
        {publicKey && (
          <div className="mb-8">
            {isLoading ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center">
                <svg
                  className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-gray-400">Loading...</p>
              </div>
            ) : activeTab === 'lock' ? (
              <LockInterface onLockSuccess={handleSuccess} />
            ) : (
              <UnlockInterface onUnlockSuccess={handleSuccess} />
            )}
          </div>
        )}

        {/* Section informative - Tiers de cNFT */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="glass-effect rounded-xl p-6 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 hover:scale-105 hover:shadow-glow-orange group animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 mb-4 group-hover:scale-110 transition-transform">
              <span className="text-4xl">🥉</span>
            </div>
            <div className="inline-flex px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 mb-3">
              <span className="text-sm font-bold text-orange-400">BRONZE</span>
            </div>
            <p className="text-gray-400 mb-4 text-sm">7-29 days</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-secondary to-green-400 bg-clip-text text-transparent">+5%</span>
              <span className="text-gray-400 text-sm">Boost</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">Ideal to start with a short-term commitment</p>
            </div>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-gray-500/20 hover:border-gray-400/40 transition-all duration-300 hover:scale-105 hover:shadow-glow-white group animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-400/20 to-gray-500/20 border border-gray-400/30 mb-4 group-hover:scale-110 transition-transform">
              <span className="text-4xl">🥈</span>
            </div>
            <div className="inline-flex px-3 py-1 rounded-full bg-gray-400/10 border border-gray-400/30 mb-3">
              <span className="text-sm font-bold text-gray-300">SILVER</span>
            </div>
            <p className="text-gray-400 mb-4 text-sm">30-89 days</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-secondary to-green-400 bg-clip-text text-transparent">+10%</span>
              <span className="text-gray-400 text-sm">Boost</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">Recommended for excellent return/duration ratio</p>
            </div>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-yellow-500/20 hover:border-yellow-400/40 transition-all duration-300 hover:scale-105 hover:shadow-glow-gold group animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 mb-4 group-hover:scale-110 transition-transform">
              <span className="text-4xl">🥇</span>
            </div>
            <div className="inline-flex px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 mb-3">
              <span className="text-sm font-bold text-yellow-400">GOLD</span>
            </div>
            <p className="text-gray-400 mb-4 text-sm">90+ days</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-secondary to-green-400 bg-clip-text text-transparent">+20%</span>
              <span className="text-gray-400 text-sm">Boost</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">Maximum rewards for long-term holders</p>
            </div>
          </div>
        </div>

        {/* FAQ avec design amélioré */}
        <div className="mt-12 glass-effect rounded-xl p-8 border border-gray-700/50 animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <span className="text-2xl">❓</span>
            </div>
            <h2 className="section-title">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-6">
            <div className="p-5 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/30 transition-colors">
              <h4 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                <span className="text-sm">💎</span>
                What is a cNFT?
              </h4>
              <p className="text-gray-400 leading-relaxed">
                A cNFT (Compressed NFT) is an optimized NFT on Solana that
                represents your $BACK token lock. It determines
                your tier (Bronze/Silver/Gold) and the boost you receive
                on your rebates.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-gradient-to-r from-secondary/5 to-transparent border border-secondary/10 hover:border-secondary/30 transition-colors">
              <h4 className="text-lg font-bold text-secondary mb-3 flex items-center gap-2">
                <span className="text-sm">🚀</span>
                How does the boost work?
              </h4>
              <p className="text-gray-400 leading-relaxed">
                The longer you lock your tokens, the higher your tier
                and the greater your boost. The boost is automatically applied
                to all your swaps and increases your rebates.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-gradient-to-r from-accent/5 to-transparent border border-accent/10 hover:border-accent/30 transition-colors">
              <h4 className="text-lg font-bold text-accent mb-3 flex items-center gap-2">
                <span className="text-sm">🔒</span>
                Can I unlock before the end of the period?
              </h4>
              <p className="text-gray-400 leading-relaxed">
                No, tokens are locked until the
                unlock date you have chosen. This guarantee is what
                allows you to benefit from the boost.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/30 transition-colors">
              <h4 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                <span className="text-sm">🔓</span>
                What happens after unlocking?
              </h4>
              <p className="text-gray-400 leading-relaxed">
                After unlocking your tokens, they return to your
                wallet and your cNFT is deactivated. You can then
                lock your tokens again at any time to get a new
                cNFT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
