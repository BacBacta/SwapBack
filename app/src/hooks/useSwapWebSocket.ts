/**
 * useSwapWebSocket Hook
 * Connects WebSocket service to Zustand store
 */

import { useEffect } from 'react';
import { useSwapStore } from '@/store/swapStore';
import { getWebSocketService, SwapEvent } from '@/lib/websocket';

export function useSwapWebSocket() {
  const {
    setTransactionStatus,
    incrementConfirmations,
    setTransactionError,
    transaction,
  } = useSwapStore();

  useEffect(() => {
    const wsService = getWebSocketService();

    const handleEvent = (event: SwapEvent) => {
      switch (event.type) {
        case 'swap.pending':
          setTransactionStatus('sending');
          break;

        case 'swap.confirmed':
          setTransactionStatus('confirming');
          incrementConfirmations();
          break;

        case 'swap.finalized':
          setTransactionStatus('confirmed');
          break;

        case 'swap.error':
          setTransactionError(event.error);
          break;

        case 'price.updated':
          // Could update token prices in store if needed
          break;
      }
    };

    wsService.addEventListener(handleEvent);

    return () => {
      wsService.removeEventListener(handleEvent);
    };
  }, [setTransactionStatus, incrementConfirmations, setTransactionError]);

  // Subscribe to transaction when signature changes
  useEffect(() => {
    if (transaction.signature && transaction.status === 'sending') {
      const wsService = getWebSocketService();
      wsService.subscribeToTransaction(transaction.signature);

      return () => {
        wsService.unsubscribeFromTransaction(transaction.signature!);
      };
    }
  }, [transaction.signature, transaction.status]);
}
