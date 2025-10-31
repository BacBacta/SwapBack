/**
 * React Hook for Real-Time WebSocket Updates
 * 
 * Performance optimization: Use WebSocket instead of polling
 */

import { useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToAccount, subscribeToLogs } from '@/lib/heliusWebSocket';

/**
 * Subscribe to real-time account updates and invalidate React Query cache
 * 
 * @param accountPubkey - Account to monitor
 * @param queryKey - React Query key to invalidate on update
 */
export function useRealtimeAccount(
  accountPubkey: PublicKey | null,
  queryKey: string[]
) {
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!accountPubkey) return;
    
    const unsubscribe = subscribeToAccount(
      accountPubkey,
      () => {
        // Invalidate React Query cache to trigger refetch
        queryClient.invalidateQueries({ queryKey });
      },
      connection
    );
    
    return unsubscribe;
  }, [accountPubkey, connection, queryClient, queryKey]);
}

/**
 * Subscribe to program logs and trigger callback
 * 
 * @param programId - Program to monitor
 * @param onLog - Callback when logs received
 */
export function useRealtimeLogs(
  programId: PublicKey | null,
  onLog: (signature: string, logs: string[]) => void
) {
  const { connection } = useConnection();
  
  const handleLog = useCallback(onLog, [onLog]);
  
  useEffect(() => {
    if (!programId) return;
    
    const unsubscribe = subscribeToLogs(
      programId,
      handleLog,
      connection
    );
    
    return unsubscribe;
  }, [programId, connection, handleLog]);
}

/**
 * Subscribe to buyback vault updates in real-time
 * 
 * @param vaultPubkey - Buyback vault account
 */
export function useRealtimeBuybackVault(vaultPubkey: PublicKey | null) {
  useRealtimeAccount(vaultPubkey, ['buyback-vault', vaultPubkey?.toBase58() || '']);
}

/**
 * Subscribe to user's CNFT updates in real-time
 * 
 * @param userPubkey - User's public key
 */
export function useRealtimeUserCNFT(userPubkey: PublicKey | null) {
  useRealtimeAccount(userPubkey, ['user-cnft', userPubkey?.toBase58() || '']);
}
