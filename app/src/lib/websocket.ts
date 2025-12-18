/**
 * WebSocket Service - Real-Time Swap Updates
 * Listens to Solana transaction confirmations and price updates
 */

import { Connection } from "@solana/web3.js";

// ============================================================================
// TYPES
// ============================================================================

export type SwapEvent =
  | { type: "swap.pending"; signature: string }
  | { type: "swap.confirmed"; signature: string; confirmations: number }
  | { type: "swap.finalized"; signature: string }
  | { type: "swap.error"; signature: string; error: string }
  | { type: "price.updated"; token: string; price: number };

export type EventListener = (event: SwapEvent) => void;

// ============================================================================
// WEBSOCKET SERVICE
// ============================================================================

export class SwapWebSocketService {
  private readonly connection: Connection;
  private readonly listeners: Set<EventListener> = new Set();
  private readonly activeSignatures: Map<string, ReturnType<typeof setInterval>> = new Map(); // signature -> polling timer
  private readonly priceIntervals: Map<string, ReturnType<typeof setInterval>> =
    new Map();

  constructor(rpcUrl: string) {
    // Ensure the Connection constructor receives an HTTP/HTTPS URL.
    // Some environments may accidentally provide a websocket URL (ws:// or wss://).
    // The Solana `Connection` expects http(s) RPC endpoints; convert if necessary.
    let normalizedUrl = rpcUrl;

    try {
      if (/^wss?:\/\//i.test(rpcUrl)) {
        // convert websocket schemes to http/https
        normalizedUrl = rpcUrl
          .replace(/^wss:\/\//i, "https://")
          .replace(/^ws:\/\//i, "http://");
        console.warn(
          `SwapWebSocketService: converted websocket URL to HTTP for Connection: ${rpcUrl} -> ${normalizedUrl}`
        );
      }

      if (!/^https?:\/\//i.test(normalizedUrl)) {
        throw new Error("Invalid RPC URL: must start with http:// or https://");
      }
    } catch (err) {
      // Re-throw with clearer context for easier debugging in the browser
      throw new Error(
        `SwapWebSocketService initialization error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Connection will internally use websockets where appropriate for subscriptions.
    this.connection = new Connection(normalizedUrl, "confirmed");
  }

  /**
   * Subscribe to swap transaction updates
   */
  public subscribeToTransaction(signature: string): void {
    if (this.activeSignatures.has(signature)) {
      return; // Already subscribed
    }

    // Emit pending event
    this.emit({ type: "swap.pending", signature });

    // IMPORTANT: On utilise du polling HTTP (RPC) au lieu de `onSignature`.
    // Cela évite les problèmes ws/rpc-websockets côté navigateur ("new required" / "not a constructor").
    let hasEmittedConfirmed = false;

    const timer = setInterval(async () => {
      try {
        const status = await this.connection.getSignatureStatus(signature);
        const value = status?.value;

        if (!value) {
          return;
        }

        if (value.err) {
          this.emit({
            type: "swap.error",
            signature,
            error: JSON.stringify(value.err),
          });
          this.unsubscribeFromTransaction(signature);
          return;
        }

        const confirmationStatus = value.confirmationStatus;
        const slot = value.slot ?? 0;

        if (!hasEmittedConfirmed && (confirmationStatus === "confirmed" || confirmationStatus === "finalized")) {
          hasEmittedConfirmed = true;
          this.emit({
            type: "swap.confirmed",
            signature,
            confirmations: slot,
          });
        }

        if (confirmationStatus === "finalized") {
          this.emit({ type: "swap.finalized", signature });
          this.unsubscribeFromTransaction(signature);
        }
      } catch (error) {
        // ne pas spammer l'UI; on garde le polling
        console.error("Error polling signature status:", error);
      }
    }, 1000);

    this.activeSignatures.set(signature, timer);
  }

  /**
   * Unsubscribe from transaction
   */
  public unsubscribeFromTransaction(signature: string): void {
    const timer = this.activeSignatures.get(signature);
    if (timer) {
      clearInterval(timer);
    }
    this.activeSignatures.delete(signature);
  }

  /**
   * Subscribe to price updates for a token
   */
  public subscribeToPriceUpdates(tokenMint: string): void {
    const existingInterval = this.priceIntervals.get(tokenMint);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Poll price every 10 seconds
    const intervalId = setInterval(async () => {
      try {
        const price = await this.fetchTokenPrice(tokenMint);
        this.emit({ type: "price.updated", token: tokenMint, price });
      } catch (error) {
        console.error("Error fetching price:", error);
      }
    }, 10000);

    this.priceIntervals.set(tokenMint, intervalId);
  }

  /**
   * Fetch token price (placeholder - integrate with actual price oracle)
   */
  private async fetchTokenPrice(_tokenMint: string): Promise<number> {
    // NOTE: Price oracle integration pending - returns mock data for now
    return Math.random() * 100;
  }

  /**
   * Add event listener
   */
  public addEventListener(listener: EventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: EventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: SwapEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  /**
   * Cleanup all subscriptions
   */
  public cleanup(): void {
    // Unsubscribe from all transactions
    this.activeSignatures.forEach((timer) => {
      clearInterval(timer);
    });
    this.activeSignatures.clear();

    // Clear price update intervals
    this.priceIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.priceIntervals.clear();

    // Clear listeners
    this.listeners.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let wsInstance: SwapWebSocketService | null = null;

export function getWebSocketService(): SwapWebSocketService {
  // Only initialize on client side
  if (globalThis.window === undefined) {
    throw new TypeError(
      "WebSocket service can only be initialized on the client side"
    );
  }

  if (!wsInstance) {
    // Ensure we have a valid RPC URL
    let rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

    // Fallback to devnet if not set or invalid
    if (!rpcUrl || rpcUrl.trim() === "") {
      rpcUrl = "https://api.devnet.solana.com";
      console.warn(
        "[WebSocket] NEXT_PUBLIC_SOLANA_RPC_URL not set, using devnet fallback:",
        rpcUrl
      );
    }

    console.log(
      "[WebSocket Debug] RPC URL from env:",
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    );
    console.log("[WebSocket Debug] Final RPC URL used:", rpcUrl);

    wsInstance = new SwapWebSocketService(rpcUrl);
  }
  return wsInstance;
}

export function cleanupWebSocketService(): void {
  if (wsInstance) {
    wsInstance.cleanup();
    wsInstance = null;
  }
}
