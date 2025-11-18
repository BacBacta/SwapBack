"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useEffect, useMemo, useState } from "react";

export const WalletConnectionGuide = () => {
  const { connected, connecting, wallets, wallet, select } = useWallet();
  const [showGuide, setShowGuide] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    // Montrer le guide si pas connecté et que c'est la première visite
    try {
      const hasSeenGuide = localStorage.getItem("swapback-wallet-guide-seen");
      if (!connected && !hasSeenGuide) {
        setShowGuide(true);
      }
    } catch (error) {
      console.warn("Wallet guide localStorage unavailable", error);
      if (!connected) {
        setShowGuide(true);
      }
    }
  }, [connected]);

  const phantomWallet = useMemo(() => {
    return wallets.find(({ adapter }) => adapter.name.toLowerCase().includes("phantom"));
  }, [wallets]);

  const markGuideSeen = () => {
    try {
      localStorage.setItem("swapback-wallet-guide-seen", "true");
    } catch (error) {
      console.warn("Unable to persist wallet guide state", error);
    }
  };

  const handlePhantomConnect = async () => {
    setStatusMessage(null);

    try {
      if (!phantomWallet) {
        setStatusMessage("Extension Phantom introuvable");
        window.open("https://phantom.app/", "_blank", "noopener");
        return;
      }

      const isReady =
        phantomWallet.readyState === WalletReadyState.Installed ||
        phantomWallet.readyState === WalletReadyState.Loadable;

      if (!isReady) {
        setStatusMessage("Phantom n'est pas disponible dans ce navigateur");
        return;
      }

      if (wallet?.adapter.name !== phantomWallet.adapter.name) {
        select(phantomWallet.adapter.name);
      }

      await phantomWallet.adapter.connect();
      markGuideSeen();
      setShowGuide(false);
    } catch (error) {
      console.error("Phantom adapter connection error:", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Échec de la connexion à Phantom"
      );
    }
  };

  if (!showGuide || connected) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-black border-2 border-[var(--primary)] rounded-lg p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="text-2xl">👻</div>
        <div className="flex-1">
          <h3 className="font-bold text-white">
            Connect Phantom
          </h3>
          <p className="text-sm text-gray-300 mb-3">
            Pour utiliser SwapBack, connectez votre wallet Phantom sur Solana Mainnet.
          </p>
          <div className="space-y-2 text-xs text-gray-400">
            <p>🔧 <strong>Vérifier le réseau :</strong></p>
            <p>1. Open Phantom → Settings</p>
            <p>2. Developer Settings → Change Network</p>
            <p>3. Sélectionnez "Mainnet Beta"</p>
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
          disabled={connecting}
          className={`flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-bold transition-colors ${connecting ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {connecting ? "Connexion..." : "Connecter Phantom"}
        </button>
        <button
          onClick={() => setShowGuide(false)}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Plus tard
        </button>
      </div>

      {statusMessage && (
        <div className="mt-3 text-xs text-red-400">
          {statusMessage}
        </div>
      )}
    </div>
  );
};