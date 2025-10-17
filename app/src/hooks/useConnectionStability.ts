"use client";

import { useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

/**
 * Hook pour gérer les reconnexions automatiques et la stabilité des connexions
 */
export const useConnectionStability = () => {
  const { connected, connecting, publicKey, connect } = useWallet();
  const { connection } = useConnection();

  // Vérifier la santé de la connexion périodiquement
  const checkConnectionHealth = useCallback(async () => {
    if (!connection || !connected) return true;

    try {
      // Test simple de la connexion
      await connection.getVersion();
      return true;
    } catch (error) {
      console.warn('Connection health check failed:', error);
      return false;
    }
  }, [connection, connected]);

  // Tentative de reconnexion automatique
  const attemptReconnect = useCallback(async () => {
    if (connecting) return; // Éviter les tentatives multiples

    try {
      console.log('Attempting to reconnect wallet...');
      await connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
      // Attendre avant de réessayer
      setTimeout(attemptReconnect, 5000);
    }
  }, [connect, connecting]);

  // Gestionnaire de déconnexion inattendue
  useEffect(() => {
    if (!connected && !connecting && publicKey) {
      console.log('Wallet disconnected unexpectedly, attempting reconnect...');
      // Petite attente avant de tenter la reconnexion
      const timeoutId = setTimeout(attemptReconnect, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [connected, connecting, publicKey, attemptReconnect]);

  // Vérification périodique de la santé de la connexion
  useEffect(() => {
    if (!connected) return;

    const intervalId = setInterval(async () => {
      const isHealthy = await checkConnectionHealth();
      if (!isHealthy && connected) {
        console.log('Connection unhealthy, attempting to refresh...');
        // Forcer une reconnexion si la connexion est défaillante
        attemptReconnect();
      }
    }, 30000); // Vérifier toutes les 30 secondes

    return () => clearInterval(intervalId);
  }, [connected, checkConnectionHealth, attemptReconnect]);

  // Gestion des erreurs de réseau
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      if (!connected && publicKey) {
        attemptReconnect();
      }
    };

    const handleOffline = () => {
      console.log('Network connection lost');
    };

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);

    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
    };
  }, [connected, publicKey, attemptReconnect]);

  return {
    isStable: connected && !connecting,
    reconnect: attemptReconnect,
  };
};