"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

export const WalletConnectionGuide = () => {
  const { connected } = useWallet();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // Montrer le guide si pas connecté et que c'est la première visite
    const hasSeenGuide = localStorage.getItem('swapback-wallet-guide-seen');
    if (!connected && !hasSeenGuide) {
      setShowGuide(true);
    }
  }, [connected]);

  const handlePhantomConnect = async () => {
    try {
      // Utiliser directement l'adaptateur Phantom
      const phantomWallet = window.solana;
      if (phantomWallet && phantomWallet.isPhantom) {
        await phantomWallet.connect();
      }
      setShowGuide(false);
      localStorage.setItem('swapback-wallet-guide-seen', 'true');
    } catch (error) {
      console.error('Erreur de connexion Phantom:', error);
    }
  };

  if (!showGuide || connected) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-black border-2 border-[var(--primary)] rounded-lg p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="text-2xl">👻</div>
        <div className="flex-1">
          <h3 className="text-[var(--primary)] font-bold terminal-text mb-2">
            Connecter Phantom
          </h3>
          <p className="text-sm text-gray-300 mb-3">
            Pour utiliser SwapBack, connectez votre wallet Phantom. Assurez-vous que Devnet est activé dans vos paramètres Phantom.
          </p>
          <div className="space-y-2 text-xs text-gray-400">
            <p>🔧 <strong>Activer Devnet:</strong></p>
            <p>1. Ouvrez Phantom → Paramètres</p>
            <p>2. Developer Settings → Change Network</p>
            <p>3. Sélectionnez "Devnet"</p>
          </div>
        </div>
        <button
          onClick={() => setShowGuide(false)}
          className="text-gray-500 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handlePhantomConnect}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-bold transition-colors"
        >
          Connecter Phantom
        </button>
        <button
          onClick={() => setShowGuide(false)}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
};