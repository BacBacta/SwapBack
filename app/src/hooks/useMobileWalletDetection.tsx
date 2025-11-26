'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * Hook pour détecter si l'utilisateur est sur mobile et si un wallet est disponible
 */
export function useMobileWalletDetection() {
  const { wallets, select } = useWallet();
  const [isMobile, setIsMobile] = useState(false);
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);

  useEffect(() => {
    // Détecter si on est sur mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    };
    
    setIsMobile(checkMobile());

    // Détecter si un wallet est injecté (Phantom, Solflare, etc.)
    const checkInjectedWallet = () => {
      // @ts-ignore
      return !!(window.solana || window.phantom?.solana || window.solflare);
    };

    setHasInjectedWallet(checkInjectedWallet());

    // Si un wallet est détecté et qu'on est sur mobile, essayer de le sélectionner automatiquement
    if (checkMobile() && checkInjectedWallet() && wallets.length > 0) {
      // Trouver le wallet injecté
      const injectedWallet = wallets.find(wallet => {
        // @ts-ignore
        if (window.phantom?.solana && wallet.adapter.name === 'Phantom') return true;
        // @ts-ignore
        if (window.solflare && wallet.adapter.name === 'Solflare') return true;
        // @ts-ignore
        if (window.solana && !window.phantom && !window.solflare) return true;
        return false;
      });

      if (injectedWallet) {
        console.log('Mobile wallet detected:', injectedWallet.adapter.name);
        // Auto-sélectionner le wallet détecté
        select(injectedWallet.adapter.name);
      }
    }
  }, [wallets, select]);

  return {
    isMobile,
    hasInjectedWallet,
    needsWalletApp: isMobile && !hasInjectedWallet,
  };
}

/**
 * Composant pour afficher des instructions si l'utilisateur est sur mobile sans wallet
 */
export function MobileWalletGuide() {
  const { needsWalletApp } = useMobileWalletDetection();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // Afficher le guide seulement après un délai pour éviter le flash
    const timer = setTimeout(() => {
      setShowGuide(needsWalletApp);
    }, 1000);

    return () => clearTimeout(timer);
  }, [needsWalletApp]);

  if (!showGuide) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 md:hidden">
      <div className="backdrop-blur-xl bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📱</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-400 mb-2">
              Wallet mobile requis
            </p>
            <p className="text-xs text-yellow-300/80 mb-3">
              Pour utiliser SwapBack sur mobile, ouvrez cette page dans le navigateur de votre wallet Solana :
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 hover:bg-purple-500/30 active:scale-95 transition-all"
              >
                <span>👻</span>
                <span>Télécharger Phantom</span>
              </a>
              <a
                href="https://solflare.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-xs text-orange-300 hover:bg-orange-500/30 active:scale-95 transition-all"
              >
                <span>🔥</span>
                <span>Télécharger Solflare</span>
              </a>
            </div>
          </div>
          <button
            onClick={() => setShowGuide(false)}
            className="text-yellow-400/60 hover:text-yellow-400"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
