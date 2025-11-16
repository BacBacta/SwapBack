"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnectionStability } from "../hooks/useConnectionStability";

export const ConnectionStatus = () => {
  const { connected, connecting } = useWallet();
  const { isStable, reconnect } = useConnectionStability();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await reconnect();
    } catch (error) {
      console.error("Reconnection failed:", error);
    } finally {
      setIsReconnecting(false);
    }
  };

  if (connected && isStable) {
    return (
      <div className="flex items-center gap-2 terminal-text text-sm uppercase tracking-wider">
        <div className="w-2 h-2 bg-[var(--secondary)] animate-pulse"></div>
        <span>[CONNECTÉ]</span>
      </div>
    );
  }

  if (connecting || isReconnecting) {
    return (
      <div className="flex items-center gap-2 text-[var(--accent)] text-sm uppercase tracking-wider">
        <div className="w-2 h-2 bg-[var(--accent)] animate-spin"></div>
        <span>[RECONNEXION...]</span>
      </div>
    );
  }

  if (connected && !isStable) {
    return (
      <div className="flex items-center gap-2 text-[var(--accent)] text-sm uppercase tracking-wider">
        <div className="w-2 h-2 bg-[var(--accent)]"></div>
        <span>[CONNEXION INSTABLE]</span>
        <button
          onClick={handleReconnect}
          className="px-2 py-1 border-2 border-[var(--accent)] hover:bg-[var(--accent)] hover:text-black text-[var(--accent)] text-xs uppercase tracking-wider transition-colors"
          disabled={isReconnecting}
        >
          {isReconnecting ? "[RECONNECTING...]" : "[RECONNECT]"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-red-400 text-sm uppercase tracking-wider">
      <div className="w-2 h-2 bg-red-400"></div>
      <span>[DÉCONNECTÉ]</span>
    </div>
  );
};
