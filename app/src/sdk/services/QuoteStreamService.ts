/**
 * QuoteStreamService - Real-time quote streaming via WebSocket
 * 
 * Provides real-time price updates for token pairs, enabling:
 * - Live price feeds for UI updates
 * - Automatic route recalculation on significant price changes
 * - Reduced latency compared to polling
 */

import { StructuredLogger } from "../utils/StructuredLogger";
import { VenueName } from "../types/smart-router";

// ============================================================================
// TYPES
// ============================================================================

export interface QuoteUpdate {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  effectivePrice: number;
  priceImpact: number;
  venue: VenueName;
  timestamp: number;
  staleness: number;
}

export interface QuoteSubscription {
  id: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  callback: (quote: QuoteUpdate) => void;
}

export interface QuoteStreamConfig {
  /** WebSocket endpoint URL */
  wsEndpoint?: string;
  /** Fallback to polling if WS unavailable */
  enablePollingFallback: boolean;
  /** Polling interval in ms (if fallback) */
  pollingIntervalMs: number;
  /** Reconnection attempts */
  maxReconnectAttempts: number;
  /** Reconnection delay in ms */
  reconnectDelayMs: number;
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number;
  /** Quote staleness threshold in ms */
  stalenessThresholdMs: number;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: QuoteStreamConfig = {
  wsEndpoint: process.env.NEXT_PUBLIC_QUOTE_WS_ENDPOINT,
  enablePollingFallback: true,
  pollingIntervalMs: 2000,
  maxReconnectAttempts: 5,
  reconnectDelayMs: 1000,
  heartbeatIntervalMs: 30000,
  stalenessThresholdMs: 5000,
};

// ============================================================================
// QUOTE STREAM SERVICE
// ============================================================================

export class QuoteStreamService {
  private readonly config: QuoteStreamConfig;
  private readonly logger: StructuredLogger;
  private readonly subscriptions: Map<string, QuoteSubscription>;
  private readonly latestQuotes: Map<string, QuoteUpdate>;
  
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();

  // Jupiter API for polling fallback
  private readonly jupiterApiUrl = "https://quote-api.jup.ag/v6";

  constructor(config?: Partial<QuoteStreamConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new StructuredLogger("quote-stream");
    this.subscriptions = new Map();
    this.latestQuotes = new Map();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Subscribe to real-time quotes for a token pair
   * Returns an unsubscribe function
   */
  subscribe(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    callback: (quote: QuoteUpdate) => void
  ): () => void {
    const subscriptionId = this.generateSubscriptionId(inputMint, outputMint, inputAmount);

    const subscription: QuoteSubscription = {
      id: subscriptionId,
      inputMint,
      outputMint,
      inputAmount,
      callback,
    };

    this.subscriptions.set(subscriptionId, subscription);

    this.logger.info("quote_subscription_added", {
      subscriptionId,
      inputMint,
      outputMint,
      inputAmount,
    });

    // Ensure connection is established
    this.ensureConnection();

    // Send subscription message to WebSocket
    this.sendSubscribeMessage(subscription);

    // Return unsubscribe function
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Unsubscribe from quote updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    this.subscriptions.delete(subscriptionId);
    this.latestQuotes.delete(subscriptionId);

    // Clear polling timer if exists
    const pollingTimer = this.pollingTimers.get(subscriptionId);
    if (pollingTimer) {
      clearInterval(pollingTimer);
      this.pollingTimers.delete(subscriptionId);
    }

    // Send unsubscribe message to WebSocket
    this.sendUnsubscribeMessage(subscription);

    this.logger.info("quote_subscription_removed", { subscriptionId });

    // Close connection if no subscriptions
    if (this.subscriptions.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Get latest cached quote for a pair
   */
  getLatestQuote(inputMint: string, outputMint: string, inputAmount: number): QuoteUpdate | null {
    const key = this.generateSubscriptionId(inputMint, outputMint, inputAmount);
    return this.latestQuotes.get(key) ?? null;
  }

  /**
   * Check if quote is stale
   */
  isQuoteStale(quote: QuoteUpdate): boolean {
    return quote.staleness > this.config.stalenessThresholdMs;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    this.disconnect();
    this.ensureConnection();
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Clear all polling timers
    for (const timer of this.pollingTimers.values()) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();

    this.connectionState = "disconnected";
    this.reconnectAttempts = 0;

    this.logger.info("quote_stream_disconnected");
  }

  // ============================================================================
  // WEBSOCKET MANAGEMENT
  // ============================================================================

  private ensureConnection(): void {
    if (this.connectionState === "connected" || this.connectionState === "connecting") {
      return;
    }

    if (this.config.wsEndpoint) {
      this.connectWebSocket();
    } else if (this.config.enablePollingFallback) {
      this.startPollingFallback();
    }
  }

  private connectWebSocket(): void {
    if (!this.config.wsEndpoint) return;

    this.connectionState = "connecting";

    try {
      this.ws = new WebSocket(this.config.wsEndpoint);

      this.ws.onopen = () => {
        this.connectionState = "connected";
        this.reconnectAttempts = 0;
        this.logger.info("websocket_connected");

        // Resubscribe all existing subscriptions
        for (const subscription of this.subscriptions.values()) {
          this.sendSubscribeMessage(subscription);
        }

        // Start heartbeat
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.ws.onerror = (error) => {
        this.logger.error("websocket_error", { error: String(error) });
      };

      this.ws.onclose = () => {
        this.connectionState = "disconnected";
        this.logger.warn("websocket_closed");
        this.attemptReconnect();
      };
    } catch (error) {
      this.logger.error("websocket_connection_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      
      if (this.config.enablePollingFallback) {
        this.startPollingFallback();
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.warn("max_reconnect_attempts_reached", {
        attempts: this.reconnectAttempts,
      });

      if (this.config.enablePollingFallback) {
        this.startPollingFallback();
      }
      return;
    }

    this.connectionState = "reconnecting";
    this.reconnectAttempts++;

    const delay = this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.info("websocket_reconnecting", {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, this.config.heartbeatIntervalMs);
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "quote":
          this.handleQuoteMessage(message);
          break;
        case "pong":
          // Heartbeat response
          break;
        case "error":
          this.logger.error("ws_server_error", { error: message.error });
          break;
        default:
          this.logger.warn("unknown_ws_message_type", { type: message.type });
      }
    } catch (error) {
      this.logger.error("ws_message_parse_error", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private handleQuoteMessage(message: {
    inputMint: string;
    outputMint: string;
    inputAmount: number;
    outputAmount: number;
    effectivePrice: number;
    priceImpact: number;
    venue: VenueName;
    timestamp: number;
  }): void {
    const subscriptionId = this.generateSubscriptionId(
      message.inputMint,
      message.outputMint,
      message.inputAmount
    );

    const quote: QuoteUpdate = {
      ...message,
      staleness: Date.now() - message.timestamp,
    };

    // Update cache
    this.latestQuotes.set(subscriptionId, quote);

    // Notify subscriber
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.callback(quote);
    }
  }

  private sendSubscribeMessage(subscription: QuoteSubscription): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: "subscribe",
      inputMint: subscription.inputMint,
      outputMint: subscription.outputMint,
      inputAmount: subscription.inputAmount,
    }));
  }

  private sendUnsubscribeMessage(subscription: QuoteSubscription): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: "unsubscribe",
      inputMint: subscription.inputMint,
      outputMint: subscription.outputMint,
    }));
  }

  // ============================================================================
  // POLLING FALLBACK
  // ============================================================================

  private startPollingFallback(): void {
    this.logger.info("starting_polling_fallback");

    for (const subscription of this.subscriptions.values()) {
      this.startPollingForSubscription(subscription);
    }
  }

  private startPollingForSubscription(subscription: QuoteSubscription): void {
    // Clear existing timer if any
    const existingTimer = this.pollingTimers.get(subscription.id);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Fetch immediately
    void this.fetchQuoteFromJupiter(subscription);

    // Set up polling interval
    const timer = setInterval(() => {
      void this.fetchQuoteFromJupiter(subscription);
    }, this.config.pollingIntervalMs);

    this.pollingTimers.set(subscription.id, timer);
  }

  private async fetchQuoteFromJupiter(subscription: QuoteSubscription): Promise<void> {
    try {
      const url = new URL(`${this.jupiterApiUrl}/quote`);
      url.searchParams.set("inputMint", subscription.inputMint);
      url.searchParams.set("outputMint", subscription.outputMint);
      url.searchParams.set("amount", String(Math.floor(subscription.inputAmount * 1e6))); // Assuming 6 decimals
      url.searchParams.set("slippageBps", "50");

      const response = await fetch(url.toString(), {
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const data = await response.json();

      const quote: QuoteUpdate = {
        inputMint: subscription.inputMint,
        outputMint: subscription.outputMint,
        inputAmount: subscription.inputAmount,
        outputAmount: Number(data.outAmount) / 1e6, // Assuming 6 decimals
        effectivePrice: Number(data.outAmount) / Number(data.inAmount),
        priceImpact: Number(data.priceImpactPct || 0),
        venue: VenueName.JUPITER,
        timestamp: Date.now(),
        staleness: 0,
      };

      // Update cache
      this.latestQuotes.set(subscription.id, quote);

      // Notify subscriber
      subscription.callback(quote);

    } catch (error) {
      this.logger.error("jupiter_quote_fetch_failed", {
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateSubscriptionId(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): string {
    return `${inputMint}-${outputMint}-${inputAmount}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let quoteStreamInstance: QuoteStreamService | null = null;

export function getQuoteStreamService(config?: Partial<QuoteStreamConfig>): QuoteStreamService {
  if (!quoteStreamInstance) {
    quoteStreamInstance = new QuoteStreamService(config);
  }
  return quoteStreamInstance;
}

export default QuoteStreamService;
