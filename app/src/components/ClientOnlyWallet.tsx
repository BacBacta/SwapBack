"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

/**
 * Client-only wallet connector avec modal personnalisé
 * Évite complètement les redirections automatiques
 */
export const ClientOnlyWallet = () => {
  const { wallets, select, connect, connected, connecting, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = async (walletName: string) => {
    try {
      console.log(`🔍 Connecting to ${walletName}`);
      select(walletName as any);
      await connect();
      setShowModal(false);
    } catch (error) {
      console.error('🔍 Connection error:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('🔍 Disconnect error:', error);
    }
  };

  if (!mounted) {
    return (
      <div className="w-32 h-10 bg-gray-700 rounded animate-pulse"></div>
    );
  }

  if (connected) {
    return (
      <button
        onClick={handleDisconnect}
        className="!bg-red-600 hover:!bg-red-700 !text-white !font-bold !rounded !px-4 !py-2 !transition-colors"
        style={{
          border: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Disconnect
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={connecting}
        className="!bg-[var(--primary)] hover:!bg-[var(--primary-hover)] disabled:opacity-50 !text-black !font-bold !rounded !px-4 !py-2 !transition-colors"
        style={{
          backgroundColor: 'var(--primary)',
          border: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-white">Connect Wallet</h3>
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.adapter.name}
                  onClick={() => handleConnect(wallet.adapter.name)}
                  className="w-full p-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center gap-3"
                >
                  <img
                    src={wallet.adapter.icon}
                    alt={wallet.adapter.name}
                    className="w-6 h-6"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {wallet.adapter.name}
                  {wallet.readyState === 'Installed' && (
                    <span className="text-green-400 text-sm">(Installed)</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full p-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};
