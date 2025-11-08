"use client";

import { useEffect, useState } from "react";

interface PhantomWallet {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

export const ClientOnlyWallet = () => {
  const [showModal, setShowModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      if (window.solana?.isPhantom) {
        try {
          const resp = await window.solana.connect();
          setIsConnected(true);
          setWalletAddress(resp.publicKey.toString());
        } catch {
          // Wallet pas encore connecté
        }
      }
    };
    checkConnection();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => { setIsConnected(false); setWalletAddress(null); };

    if (window.solana) {
      window.solana.on('connect', handleConnect);
      window.solana.on('disconnect', handleDisconnect);
    }

    return () => {
      if (window.solana) {
        window.solana.off('connect', handleConnect);
        window.solana.off('disconnect', handleDisconnect);
      }
    };
  }, []);

  const handleConnect = async () => {
    try {
      if (window.solana?.isPhantom) {
        const response = await window.solana.connect();
        setIsConnected(true);
        setWalletAddress(response.publicKey.toString());
        setShowModal(false);
      } else {
        window.open("https://phantom.app/", "_blank");
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (window.solana) await window.solana.disconnect();
    } catch (error) {
      console.error("Erreur déconnexion:", error);
    }
  };

  return (
    <>
      {!isConnected ? (
        <button onClick={() => setShowModal(true)} className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold px-4 py-2 rounded">
          Connect Wallet
        </button>
      ) : (
        <button onClick={handleDisconnect} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded">
          {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-black border-2 border-[var(--primary)] rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-white">Connect Wallet</h3>
            <button onClick={handleConnect} className="w-full flex items-center gap-3 p-4 bg-purple-600 hover:bg-purple-700 rounded mb-4">
              <span className="text-2xl">👻</span>
              <div className="flex-1 text-left">
                <div className="font-bold text-white">Phantom</div>
              </div>
            </button>
            <button onClick={() => setShowModal(false)} className="w-full py-2 text-gray-400 hover:text-white">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
};
