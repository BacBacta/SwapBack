/**
 * Hook React pour utiliser le Blockchain Tracer
 */

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  BlockchainTracer,
  createBlockchainTracer,
  TracedOperation,
  OperationType,
  SwapDetails,
  LockDetails,
  UnlockDetails,
  BurnDetails
} from '@swapback/sdk';

// ID du programme SwapBack (adresse de test valide)
const SWAPBACK_PROGRAM_ID = '11111111111111111111111111111112';

export interface UseBlockchainTracerReturn {
  tracer: BlockchainTracer | null;
  operations: TracedOperation[];
  loading: boolean;
  error: string | null;
  
  // Fonctions de traçage
  traceSwap: (swapDetails: SwapDetails, metadata?: any) => Promise<TracedOperation | null>;
  traceLock: (lockDetails: LockDetails) => Promise<TracedOperation | null>;
  traceUnlock: (unlockDetails: UnlockDetails) => Promise<TracedOperation | null>;
  traceBurn: (burnDetails: BurnDetails) => Promise<TracedOperation | null>;
  
  // Fonctions de récupération
  refreshOperations: () => Promise<void>;
  getOperationBySignature: (signature: string) => Promise<TracedOperation | null>;
  
  // Statistiques
  statistics: {
    totalSwaps: number;
    totalLocks: number;
    totalUnlocks: number;
    totalVolume: number;
    totalSavings: number;
  } | null;
  
  refreshStatistics: () => Promise<void>;
}

/**
 * Hook pour tracer les opérations blockchain
 */
export function useBlockchainTracer(): UseBlockchainTracerReturn {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  
  const [tracer, setTracer] = useState<BlockchainTracer | null>(null);
  const [operations, setOperations] = useState<TracedOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  // Initialiser le tracer
  useEffect(() => {
    if (connection) {
      const newTracer = createBlockchainTracer(
        connection,
        SWAPBACK_PROGRAM_ID
      );
      setTracer(newTracer);
    }
  }, [connection]);

  // Charger les opérations au changement d'utilisateur
  useEffect(() => {
    if (publicKey && tracer) {
      refreshOperations();
      refreshStatistics();
    }
  }, [publicKey, tracer]);

  /**
   * Trace un swap
   */
  const traceSwap = useCallback(async (
    swapDetails: SwapDetails,
    metadata?: any
  ): Promise<TracedOperation | null> => {
    if (!tracer || !publicKey) {
      setError('Tracer ou wallet non initialisé');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const operation = await tracer.traceSwap(publicKey, swapDetails, metadata);
      
      // Ajouter à la liste des opérations
      setOperations(prev => [operation, ...prev]);
      
      return operation;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMsg);
      console.error('Erreur lors du traçage du swap:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tracer, publicKey]);

  /**
   * Trace un lock
   */
  const traceLock = useCallback(async (
    lockDetails: LockDetails
  ): Promise<TracedOperation | null> => {
    if (!tracer || !publicKey) {
      setError('Tracer ou wallet non initialisé');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const operation = await tracer.traceLock(publicKey, lockDetails);
      setOperations(prev => [operation, ...prev]);
      
      return operation;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMsg);
      console.error('Erreur lors du traçage du lock:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tracer, publicKey]);

  /**
   * Trace un unlock
   */
  const traceUnlock = useCallback(async (
    unlockDetails: UnlockDetails
  ): Promise<TracedOperation | null> => {
    if (!tracer || !publicKey) {
      setError('Tracer ou wallet non initialisé');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const operation = await tracer.traceUnlock(publicKey, unlockDetails);
      setOperations(prev => [operation, ...prev]);
      
      return operation;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMsg);
      console.error('Erreur lors du traçage du unlock:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tracer, publicKey]);

  /**
   * Trace un burn
   */
  const traceBurn = useCallback(async (
    burnDetails: BurnDetails
  ): Promise<TracedOperation | null> => {
    if (!tracer || !publicKey) {
      setError('Tracer ou wallet non initialisé');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const operation = await tracer.traceBurn(publicKey, burnDetails);
      setOperations(prev => [operation, ...prev]);
      
      return operation;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMsg);
      console.error('Erreur lors du traçage du burn:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tracer, publicKey]);

  /**
   * Rafraîchit la liste des opérations
   */
  const refreshOperations = useCallback(async () => {
    if (!tracer || !publicKey) return;

    try {
      setLoading(true);
      setError(null);
      
      const ops = await tracer.getOperationHistory(publicKey, {
        limit: 100
      });
      
      setOperations(ops);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMsg);
      console.error('Erreur lors du chargement des opérations:', err);
    } finally {
      setLoading(false);
    }
  }, [tracer, publicKey]);

  /**
   * Récupère une opération par signature
   */
  const getOperationBySignature = useCallback(async (
    signature: string
  ): Promise<TracedOperation | null> => {
    if (!tracer) return null;

    try {
      setLoading(true);
      setError(null);
      
      const operation = await tracer.getOperation(signature);
      return operation;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMsg);
      console.error('Erreur lors de la récupération de l\'opération:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tracer]);

  /**
   * Rafraîchit les statistiques
   */
  const refreshStatistics = useCallback(async () => {
    if (!tracer || !publicKey) return;

    try {
      const stats = await tracer.getUserStatistics(publicKey);
      setStatistics(stats);
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques:', err);
    }
  }, [tracer, publicKey]);

  return {
    tracer,
    operations,
    loading,
    error,
    traceSwap,
    traceLock,
    traceUnlock,
    traceBurn,
    refreshOperations,
    getOperationBySignature,
    statistics,
    refreshStatistics
  };
}

/**
 * Hook pour filtrer les opérations
 */
export function useFilteredOperations(
  operations: TracedOperation[],
  filters?: {
    type?: OperationType;
    startDate?: Date;
    endDate?: Date;
  }
): TracedOperation[] {
  return operations.filter(op => {
    // Filtre par type
    if (filters?.type && op.type !== filters.type) {
      return false;
    }

    // Filtre par date de début
    if (filters?.startDate && op.timestamp < filters.startDate.getTime()) {
      return false;
    }

    // Filtre par date de fin
    if (filters?.endDate && op.timestamp > filters.endDate.getTime()) {
      return false;
    }

    return true;
  });
}
