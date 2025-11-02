'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import LockInterface from '@/components/LockInterface';
import UnlockInterface from '@/components/UnlockInterface';
import { useCNFT } from '@/hooks/useCNFT';
import { PageHeader } from '@/components/BackButton';

function LockPageClient() {
  const { publicKey } = useWallet();
  const { cnftData, lockData, isLoading } = useCNFT();
  const [activeTab, setActiveTab] = useState<'lock' | 'unlock'>('lock');

  // Déterminer l'onglet actif par défaut basé sur l'état du lock
  React.useEffect(() => {
    if (lockData?.isActive && cnftData?.isActive) {
      setActiveTab('unlock');
    } else {
      setActiveTab('lock');
    }
  }, [lockData, cnftData]);

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
            <h3 className="text-2xl font-bold text-yellow-500 mb-3">
              Wallet Connection Required
            </h3>
            <p className="text-gray-400 max-w-md mx-auto mb-6">
              Please connect your Solana wallet to access the Lock & Earn features
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              <span className="text-sm text-yellow-500 font-mono">
                Connect wallet in the top right corner
              </span>
            </div>
          </div>
        )}

        {/* Interface principale si wallet connecté */}
        {publicKey && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-8 animate-slide-up">
              <button
                onClick={() => setActiveTab('lock')}
                className={`flex-1 py-4 px-6 font-bold transition-all ${
                  activeTab === 'lock'
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">🔒</span>
                  <span className="text-lg">LOCK TOKENS</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('unlock')}
                className={`flex-1 py-4 px-6 font-bold transition-all ${
                  activeTab === 'unlock'
                    ? 'border-b-2 border-[var(--secondary)] text-[var(--secondary)] bg-[var(--secondary)]/5'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">🔓</span>
                  <span className="text-lg">UNLOCK TOKENS</span>
                </div>
              </button>
            </div>

            {/* Content */}
            <div className="animate-fade-in">
              {activeTab === 'lock' && (
                <LockInterface />
              )}
              {activeTab === 'unlock' && (
                <UnlockInterface />
              )}
            </div>

            {/* Info Cards */}
            <div className="grid md:grid-cols-2 gap-6 mt-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              {/* How it Works */}
              <div className="glass-effect border border-[var(--primary)]/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)]/20 to-[var(--secondary)]/20 border border-[var(--primary)]/30">
                    <span className="text-2xl">ℹ️</span>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--primary)]">How it Works</h3>
                </div>
                <div className="space-y-3 text-gray-300">
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--primary)] mt-1">1.</span>
                    <p className="text-sm">Lock your $BACK tokens for a chosen period (3, 6, or 12 months)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--primary)] mt-1">2.</span>
                    <p className="text-sm">Receive a unique cNFT that represents your locked position</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--primary)] mt-1">3.</span>
                    <p className="text-sm">Enjoy boosted rewards on all your swaps during the lock period</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--primary)] mt-1">4.</span>
                    <p className="text-sm">Unlock your tokens anytime after the lock period ends</p>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="glass-effect border border-[var(--secondary)]/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[var(--secondary)]/20 to-[var(--accent)]/20 border border-[var(--secondary)]/30">
                    <span className="text-2xl">🎁</span>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--secondary)]">Your Benefits</h3>
                </div>
                <div className="space-y-3 text-gray-300">
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--secondary)]">✓</span>
                    <p className="text-sm"><span className="font-bold text-[var(--secondary)]">Up to 3x</span> boost on swap rewards</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--secondary)]">✓</span>
                    <p className="text-sm"><span className="font-bold text-[var(--secondary)]">Exclusive cNFT</span> with unique artwork</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--secondary)]">✓</span>
                    <p className="text-sm"><span className="font-bold text-[var(--secondary)]">Priority access</span> to new features</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--secondary)]">✓</span>
                    <p className="text-sm"><span className="font-bold text-[var(--secondary)]">Governance rights</span> for protocol decisions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Note */}
            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-yellow-500 mb-1">Important Notice</h4>
                  <p className="text-sm text-gray-300">
                    Your tokens will be locked for the duration you choose. Make sure you won't need them during this period. 
                    Early unlock is not possible, but you can extend your lock period to benefit from higher rewards.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Loading State */}
        {publicKey && isLoading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="glass-effect border border-[var(--primary)] rounded-xl p-8 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
              <p className="text-gray-300 font-mono">Loading your lock data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { LockPageClient };
