"use client";

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnectionStability } from '../hooks/useConnectionStability';

export const ConnectionStatus = () => {
  const { connected, connecting } = useWallet();
  const { isStable, reconnect } = useConnectionStability();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await reconnect();
    } catch (error) {
      console.error('Reconnection failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  if (connected && isStable) {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span>Connecté</span>
      </div>
    );
  }

  if (connecting || isReconnecting) {
    return (
      <div className="flex items-center gap-2 text-yellow-400 text-sm">
        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-spin"></div>
        <span>Reconnexion...</span>
      </div>
    );
  }

  if (connected && !isStable) {
    return (
      <div className="flex items-center gap-2 text-orange-400 text-sm">
        <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
        <span>Connexion instable</span>
        <button
          onClick={handleReconnect}
          className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded transition-colors"
          disabled={isReconnecting}
        >
          {isReconnecting ? 'Reconnexion...' : 'Reconnecter'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-red-400 text-sm">
      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
      <span>Déconnecté</span>
    </div>
  );
};