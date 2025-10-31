/**
 * Helius WebSocket Integration for Real-Time Updates
 * 
 * Performance optimization: WebSocket connection for live transaction monitoring
 * instead of polling Helius API repeatedly.
 */

import { Connection, PublicKey } from '@solana/web3.js';

export type WebSocketCallback = (signature: string, data: unknown) => void;

interface WebSocketManager {
  connection: Connection | null;
  subscriptionId: number | null;
  callbacks: Set<WebSocketCallback>;
}

const wsManagers = new Map<string, WebSocketManager>();

/**
 * Subscribe to real-time account updates via WebSocket
 * 
 * @param accountPubkey - Account to monitor
 * @param callback - Called when account data changes
 * @param connection - Solana RPC connection
 * @returns Unsubscribe function
 */
export function subscribeToAccount(
  accountPubkey: PublicKey,
  callback: WebSocketCallback,
  connection: Connection
): () => void {
  const key = accountPubkey.toBase58();
  
  let manager = wsManagers.get(key);
  
  if (!manager) {
    manager = {
      connection,
      subscriptionId: null,
      callbacks: new Set(),
    };
    wsManagers.set(key, manager);
    
    // Create WebSocket subscription
    manager.subscriptionId = connection.onAccountChange(
      accountPubkey,
      (accountInfo, context) => {
        // Notify all callbacks
        manager?.callbacks.forEach(cb => {
          cb('', { accountInfo, context });
        });
      },
      'confirmed'
    );
  }
  
  // Add callback
  manager.callbacks.add(callback);
  
  // Return unsubscribe function
  return () => {
    const mgr = wsManagers.get(key);
    if (!mgr) return;
    
    mgr.callbacks.delete(callback);
    
    // If no more callbacks, close WebSocket
    if (mgr.callbacks.size === 0 && mgr.subscriptionId !== null) {
      mgr.connection?.removeAccountChangeListener(mgr.subscriptionId);
      wsManagers.delete(key);
    }
  };
}

/**
 * Subscribe to transaction logs via WebSocket
 * 
 * @param programId - Program to monitor
 * @param callback - Called when transaction occurs
 * @param connection - Solana RPC connection
 * @returns Unsubscribe function
 */
export function subscribeToLogs(
  programId: PublicKey,
  callback: (signature: string, logs: string[]) => void,
  connection: Connection
): () => void {
  const subscriptionId = connection.onLogs(
    programId,
    (logs) => {
      callback(logs.signature, logs.logs);
    },
    'confirmed'
  );
  
  return () => {
    connection.removeOnLogsListener(subscriptionId);
  };
}

/**
 * Subscribe to program account changes (multiple accounts)
 * 
 * @param programId - Program ID to monitor
 * @param callback - Called when any program account changes
 * @param connection - Solana RPC connection
 * @returns Unsubscribe function
 */
export function subscribeToProgramAccounts(
  programId: PublicKey,
  callback: (pubkey: PublicKey, accountInfo: unknown) => void,
  connection: Connection
): () => void {
  const subscriptionId = connection.onProgramAccountChange(
    programId,
    (keyedAccountInfo) => {
      callback(keyedAccountInfo.accountId, keyedAccountInfo.accountInfo);
    },
    'confirmed'
  );
  
  return () => {
    connection.removeProgramAccountChangeListener(subscriptionId);
  };
}

/**
 * Cleanup all WebSocket connections
 * Call this on app unmount or when switching RPC
 */
export function cleanupAllWebSockets(connection: Connection): void {
  wsManagers.forEach((manager) => {
    if (manager.subscriptionId !== null) {
      connection.removeAccountChangeListener(manager.subscriptionId);
    }
  });
  wsManagers.clear();
}
