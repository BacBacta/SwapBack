"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

/**
 * Hook pour gérer les reconnexions automatiques et la stabilité des connexions
 */
export const useConnectionStability = () => {
  const { connected, connecting, publicKey, connect } = useWallet();
  const { connection } = useConnection();
  const [isHealthy, setIsHealthy] = useState(true);
  const isReconnectingRef = useRef(false);

  // Vérifier la santé de la connexion périodiquement
  const checkConnectionHealth = useCallback(async () => {
    if (!connection || !connected) return true;

    try {
      // Test simple de la connexion
      await connection.getVersion();
      return true;
    } catch (error) {
      console.warn("Connection health check failed:", error);
      return false;
    }
  }, [connection, connected]);

  // Tentative de reconnexion automatique
  const attemptReconnect = useCallback(async () => {
    if (connecting || isReconnectingRef.current) return;

    isReconnectingRef.current = true;
    try {
      await connect();
    } finally {
      isReconnectingRef.current = false;
    }
  }, [connect, connecting]);

  // Ne pas auto-reconnect: l'utilisateur doit tre explicite.
  // (Sinon certaines extensions ouvrent une popup et peuvent spammer si l'utilisateur refuse.)
  useEffect(() => {
    if (!connected) {
      setIsHealthy(true);
    }
  }, [connected]);

  // Vérification périodique de la santé de la connexion
  useEffect(() => {
    if (!connected) return;

    const intervalId = setInterval(async () => {
      const isHealthy = await checkConnectionHealth();
      setIsHealthy(isHealthy);
    }, 30000); // Vérifier toutes les 30 secondes

    return () => clearInterval(intervalId);
  }, [connected, checkConnectionHealth, attemptReconnect]);

  // Gestion des erreurs de réseau
  useEffect(() => {
    const handleOnline = () => {
      console.log("Network connection restored");
    };

    const handleOffline = () => {
      console.log("Network connection lost");
    };

    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);

    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
    };
  }, [connected, publicKey, attemptReconnect]);

  return {
    isStable: connected && !connecting && isHealthy,
    reconnect: attemptReconnect,
  };
};
