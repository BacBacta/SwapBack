'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import LockInterface from '@/components/LockInterface';
import UnlockInterface from '@/components/UnlockInterface';
import { useCNFT } from '@/hooks/useCNFT';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            💎 Verrouillage $BACK
          </h1>
          <p className="text-gray-300 text-lg">
            Verrouillez vos tokens $BACK pour recevoir un cNFT et bénéficier de
            boosts sur vos swaps
          </p>
        </div>

        {/* Connexion wallet requise */}
        {!publicKey && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-6 mb-8 text-center">
            <div className="text-5xl mb-4">👛</div>
            <h3 className="text-xl font-bold text-yellow-300 mb-2">
              Wallet non connecté
            </h3>
            <p className="text-yellow-200">
              Veuillez connecter votre wallet Phantom pour continuer
            </p>
          </div>
        )}

        {/* Tabs de navigation */}
        {publicKey && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('lock')}
              disabled={lockData?.isActive && cnftData?.isActive}
              className={`flex-1 py-3 px-6 rounded-lg font-bold transition ${
                activeTab === 'lock'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${
                lockData?.isActive && cnftData?.isActive
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              🔒 Verrouiller
            </button>
            <button
              onClick={() => setActiveTab('unlock')}
              disabled={!lockData?.isActive || !cnftData?.isActive}
              className={`flex-1 py-3 px-6 rounded-lg font-bold transition ${
                activeTab === 'unlock'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${
                !lockData?.isActive || !cnftData?.isActive
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              🔓 Déverrouiller
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
                <p className="text-gray-400">Chargement...</p>
              </div>
            ) : activeTab === 'lock' ? (
              <LockInterface onLockSuccess={handleSuccess} />
            ) : (
              <UnlockInterface onUnlockSuccess={handleSuccess} />
            )}
          </div>
        )}

        {/* Section informative */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <div className="text-4xl mb-4">🥉</div>
            <h3 className="text-xl font-bold text-orange-400 mb-2">Bronze</h3>
            <p className="text-gray-400 mb-3">7-29 jours</p>
            <div className="text-green-400 font-bold text-lg">+5% Boost</div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <div className="text-4xl mb-4">🥈</div>
            <h3 className="text-xl font-bold text-gray-300 mb-2">Silver</h3>
            <p className="text-gray-400 mb-3">30-89 jours</p>
            <div className="text-green-400 font-bold text-lg">+10% Boost</div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <div className="text-4xl mb-4">🥇</div>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">Gold</h3>
            <p className="text-gray-400 mb-3">90+ jours</p>
            <div className="text-green-400 font-bold text-lg">+20% Boost</div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">
            ❓ Questions fréquentes
          </h2>

          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-bold text-blue-400 mb-2">
                Qu&apos;est-ce qu&apos;un cNFT ?
              </h4>
              <p className="text-gray-400">
                Un cNFT (Compressed NFT) est un NFT optimisé sur Solana qui
                représente votre verrouillage de tokens $BACK. Il détermine
                votre niveau (Bronze/Silver/Gold) et le boost que vous recevez
                sur vos rebates.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-bold text-blue-400 mb-2">
                Comment fonctionne le boost ?
              </h4>
              <p className="text-gray-400">
                Plus vous verrouillez vos tokens longtemps, plus votre niveau
                est élevé et plus votre boost est important. Le boost s&apos;applique
                automatiquement à tous vos swaps et augmente vos rebates.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-bold text-blue-400 mb-2">
                Puis-je déverrouiller avant la fin de la période ?
              </h4>
              <p className="text-gray-400">
                Non, les tokens sont verrouillés jusqu&apos;à la date de
                déverrouillage que vous avez choisie. C&apos;est cette garantie qui
                vous permet de bénéficier du boost.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-bold text-blue-400 mb-2">
                Que se passe-t-il après le déverrouillage ?
              </h4>
              <p className="text-gray-400">
                Après avoir déverrouillé vos tokens, ils retournent dans votre
                wallet et votre cNFT est désactivé. Vous pouvez ensuite
                reverrouiller vos tokens à tout moment pour obtenir un nouveau
                cNFT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
