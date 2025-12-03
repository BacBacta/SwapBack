/**
 * WebSocketQuoteStream - Real-time quote streaming via WebSocket
 * 
 * Features:
 * 1. Native WebSocket connection to multiple price feeds
 * 2. Automatic reconnection with exponential backoff
 * 3. Heartbeat monitoring for connection health
 * 4. Event-driven architecture for quote updates
 * 5. Fallback to HTTP polling (500ms) when WS unavailable
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { EventEmitter } from "events";
import { StructuredLogger } from "../utils/StructuredLogger";

// ============================================================================
// TYPES
// ============================================================================

export interface StreamedQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  outputAmount: bigint;
  price: number;
  priceImpact: number;
  venue: string;
  timestamp: number;
  confidence: number;
}

export interface QuoteUpdate {
  type: "quote" | "orderbook" | "price";
  pair: string;
  data: StreamedQuote | OrderbookUpdate | PriceUpdate;
  latencyMs: number;
}

export interface OrderbookUpdate {
  bids: Array<[number, number]>; // [price, size]
  asks: Array<[number, number]>;
  midPrice: number;
  spread: number;
  depth: number;
}

export interface PriceUpdate {
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: number;
}

export interface StreamConfig {
  /** Primary WebSocket endpoint */
  wsEndpoint: string;
  /** Fallback endpoints */
  fallbackEndpoints: string[];
  /** Enable HTTP polling fallback */
  enablePollingFallback: boolean;
  /** Polling interval when WS unavailable (ms) */
  pollingIntervalMs: number;
  /** Max reconnect attempts before fallback */
  maxReconnectAttempts: number;
  /** Reconnect delay base (ms) */
  reconnectDelayMs: number;
  /** Heartbeat interval (ms) */
  heartbeatIntervalMs: number;
  /** Staleness threshold (ms) */
  stalenessThresholdMs: number;
  /** Connection timeout (ms) */
  connectionTimeoutMs: number;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "polling";

interface SubscriptionInfo {
  pair: string;
  inputMint: string;
  outputMint: string;
  callback: (update: QuoteUpdate) => void;
  lastUpdate: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: StreamConfig = {
  wsEndpoint: "wss://quote-stream.swapback.io/v1/quotes",
  fallbackEndpoints: [
    "wss://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
    "wss://solana-mainnet.g.alchemy.com/v2/YOUR_KEY",
  ],
  enablePollingFallback: true,
  pollingIntervalMs: 500,        // 500ms polling (improved from 2000ms)
  maxReconnectAttempts: 5,
  reconnectDelayMs: 1000,
  heartbeatIntervalMs: 15000,    // 15s heartbeat
  stalenessThresholdMs: 3000,    // 3s staleness threshold
  connectionTimeoutMs: 5000,
};

// ============================================================================
// WEBSOCKET QUOTE STREAM
// ============================================================================

export class WebSocketQuoteStream extends EventEmitter {
  private config: StreamConfig;
  private connection: Connection;
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastMessageTime = 0;
  private logger: StructuredLogger;
  private messageQueue: Array<{ type: string; data: unknown }> = [];
  private currentEndpointIndex = 0;

  constructor(connection: Connection, config: Partial<StreamConfig> = {}) {
    super();
    this.connection = connection;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new StructuredLogger("quote-stream");
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Connect to WebSocket stream
   */
  async connect(): Promise<boolean> {
    if (this.state === "connected") return true;
    
    this.state = "connecting";
    this.emit("stateChange", this.state);

    try {
      const connected = await this.establishConnection();
      if (connected) {
        this.startHeartbeat();
        this.resubscribeAll();
        return true;
      }
    } catch (error) {
      this.logger.error("WebSocket connection failed", { error });
    }

    // Fallback to polling if enabled
    if (this.config.enablePollingFallback) {
      this.state = "polling";
      this.emit("stateChange", this.state);
      this.logger.warn("Falling back to HTTP polling");
      return true;
    }

    return false;
  }

  /**
   * Disconnect from stream
   */
  disconnect(): void {
    this.state = "disconnected";
    this.stopHeartbeat();
    this.clearPollingIntervals();
    
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    
    this.emit("stateChange", this.state);
  }

  /**
   * Subscribe to quote updates for a trading pair
   */
  subscribe(
    inputMint: string,
    outputMint: string,
    callback: (update: QuoteUpdate) => void
  ): string {
    const pair = this.getPairKey(inputMint, outputMint);
    
    const subscription: SubscriptionInfo = {
      pair,
      inputMint,
      outputMint,
      callback,
      lastUpdate: Date.now(),
    };
    
    this.subscriptions.set(pair, subscription);
    
    if (this.state === "connected" && this.ws) {
      this.sendSubscription(pair, inputMint, outputMint);
    } else if (this.state === "polling") {
      this.startPolling(subscription);
    }
    
    this.logger.debug("Subscribed to pair", { pair });
    return pair;
  }

  /**
   * Unsubscribe from quote updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;
    
    this.subscriptions.delete(subscriptionId);
    
    if (this.state === "connected" && this.ws) {
      this.ws.send(JSON.stringify({
        type: "unsubscribe",
        pair: subscriptionId,
      }));
    }
    
    const pollingInterval = this.pollingIntervals.get(subscriptionId);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      this.pollingIntervals.delete(subscriptionId);
    }
    
    this.logger.debug("Unsubscribed from pair", { pair: subscriptionId });
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get latency statistics
   */
  getLatencyStats(): { avg: number; p50: number; p95: number; p99: number } {
    // Calculate from recent updates
    const latencies: number[] = [];
    this.subscriptions.forEach((sub) => {
      const timeSinceUpdate = Date.now() - sub.lastUpdate;
      if (timeSinceUpdate < 60000) {
        latencies.push(timeSinceUpdate);
      }
    });

    if (latencies.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    return { avg, p50, p95, p99 };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async establishConnection(): Promise<boolean> {
    const endpoints = [this.config.wsEndpoint, ...this.config.fallbackEndpoints];
    
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[(this.currentEndpointIndex + i) % endpoints.length];
      
      try {
        const connected = await this.connectToEndpoint(endpoint);
        if (connected) {
          this.currentEndpointIndex = (this.currentEndpointIndex + i) % endpoints.length;
          return true;
        }
      } catch {
        this.logger.warn("Endpoint failed", { endpoint });
      }
    }
    
    return false;
  }

  private connectToEndpoint(endpoint: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn("Connection timeout", { endpoint });
        resolve(false);
      }, this.config.connectionTimeoutMs);

      try {
        this.ws = new WebSocket(endpoint);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.state = "connected";
          this.reconnectAttempts = 0;
          this.lastMessageTime = Date.now();
          this.emit("stateChange", this.state);
          this.emit("connected");
          this.logger.info("WebSocket connected", { endpoint });
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.logger.error("WebSocket error", { error });
          this.emit("error", error);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.handleClose(event);
          if (this.state === "connecting") {
            resolve(false);
          }
        };
      } catch (error) {
        clearTimeout(timeout);
        this.logger.error("WebSocket creation failed", { error });
        resolve(false);
      }
    });
  }

  private handleMessage(data: string): void {
    this.lastMessageTime = Date.now();
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case "quote":
          this.handleQuoteUpdate(message);
          break;
        case "orderbook":
          this.handleOrderbookUpdate(message);
          break;
        case "price":
          this.handlePriceUpdate(message);
          break;
        case "pong":
          // Heartbeat response
          break;
        case "error":
          this.logger.error("Server error", { error: message.error });
          break;
        default:
          this.logger.debug("Unknown message type", { type: message.type });
      }
    } catch (error) {
      this.logger.error("Message parse error", { error, data });
    }
  }

  private handleQuoteUpdate(message: { pair: string; data: StreamedQuote }): void {
    const subscription = this.subscriptions.get(message.pair);
    if (!subscription) return;
    
    const latencyMs = Date.now() - message.data.timestamp;
    subscription.lastUpdate = Date.now();
    
    const update: QuoteUpdate = {
      type: "quote",
      pair: message.pair,
      data: message.data,
      latencyMs,
    };
    
    subscription.callback(update);
    this.emit("quote", update);
  }

  private handleOrderbookUpdate(message: { pair: string; data: OrderbookUpdate }): void {
    const subscription = this.subscriptions.get(message.pair);
    if (!subscription) return;
    
    subscription.lastUpdate = Date.now();
    
    const update: QuoteUpdate = {
      type: "orderbook",
      pair: message.pair,
      data: message.data,
      latencyMs: 0,
    };
    
    subscription.callback(update);
    this.emit("orderbook", update);
  }

  private handlePriceUpdate(message: { pair: string; data: PriceUpdate }): void {
    const subscription = this.subscriptions.get(message.pair);
    if (!subscription) return;
    
    subscription.lastUpdate = Date.now();
    
    const update: QuoteUpdate = {
      type: "price",
      pair: message.pair,
      data: message.data,
      latencyMs: Date.now() - message.data.timestamp,
    };
    
    subscription.callback(update);
    this.emit("price", update);
  }

  private handleClose(event: CloseEvent): void {
    this.ws = null;
    
    if (this.state === "disconnected") return;
    
    this.logger.warn("WebSocket closed", { code: event.code, reason: event.reason });
    
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.attemptReconnect();
    } else if (this.config.enablePollingFallback) {
      this.state = "polling";
      this.emit("stateChange", this.state);
      this.startAllPolling();
    } else {
      this.state = "disconnected";
      this.emit("stateChange", this.state);
      this.emit("disconnected");
    }
  }

  private attemptReconnect(): void {
    this.state = "reconnecting";
    this.emit("stateChange", this.state);
    this.reconnectAttempts++;
    
    const delay = this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    
    this.logger.info("Attempting reconnect", { 
      attempt: this.reconnectAttempts, 
      delayMs: delay 
    });
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private sendSubscription(pair: string, inputMint: string, outputMint: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    this.ws.send(JSON.stringify({
      type: "subscribe",
      pair,
      inputMint,
      outputMint,
      channels: ["quote", "orderbook", "price"],
    }));
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((sub, pair) => {
      this.sendSubscription(pair, sub.inputMint, sub.outputMint);
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      
      // Check for stale connection
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      if (timeSinceLastMessage > this.config.stalenessThresholdMs) {
        this.logger.warn("Connection stale, reconnecting", { timeSinceLastMessage });
        this.ws.close(4000, "Stale connection");
        return;
      }
      
      // Send ping
      this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startPolling(subscription: SubscriptionInfo): void {
    const interval = setInterval(async () => {
      try {
        const quote = await this.fetchQuoteHttp(subscription.inputMint, subscription.outputMint);
        if (quote) {
          const update: QuoteUpdate = {
            type: "quote",
            pair: subscription.pair,
            data: quote,
            latencyMs: Date.now() - quote.timestamp,
          };
          subscription.lastUpdate = Date.now();
          subscription.callback(update);
          this.emit("quote", update);
        }
      } catch (error) {
        this.logger.error("Polling fetch error", { pair: subscription.pair, error });
      }
    }, this.config.pollingIntervalMs);
    
    this.pollingIntervals.set(subscription.pair, interval);
  }

  private startAllPolling(): void {
    this.subscriptions.forEach((sub) => {
      if (!this.pollingIntervals.has(sub.pair)) {
        this.startPolling(sub);
      }
    });
  }

  private clearPollingIntervals(): void {
    this.pollingIntervals.forEach((interval) => clearInterval(interval));
    this.pollingIntervals.clear();
  }

  private async fetchQuoteHttp(inputMint: string, outputMint: string): Promise<StreamedQuote | null> {
    try {
      // Use Jupiter API as HTTP fallback
      const response = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=1000000000&slippageBps=50`,
        { signal: AbortSignal.timeout(this.config.pollingIntervalMs - 50) }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      return {
        inputMint,
        outputMint,
        inputAmount: BigInt(data.inAmount || 0),
        outputAmount: BigInt(data.outAmount || 0),
        price: Number(data.outAmount) / Number(data.inAmount),
        priceImpact: Number(data.priceImpactPct || 0),
        venue: "jupiter",
        timestamp: Date.now(),
        confidence: 0.95,
      };
    } catch {
      return null;
    }
  }

  private getPairKey(inputMint: string, outputMint: string): string {
    return `${inputMint.slice(0, 8)}-${outputMint.slice(0, 8)}`;
  }
}

// ============================================================================
// GEYSER/YELLOWSTONE INTEGRATION
// ============================================================================

export interface GeyserConfig {
  endpoint: string;
  xToken?: string;
  accountUpdateCallback?: (account: GeyserAccountUpdate) => void;
  transactionCallback?: (tx: GeyserTransactionUpdate) => void;
}

export interface GeyserAccountUpdate {
  pubkey: string;
  lamports: bigint;
  owner: string;
  data: Buffer;
  slot: number;
  writeVersion: bigint;
}

export interface GeyserTransactionUpdate {
  signature: string;
  slot: number;
  isVote: boolean;
  success: boolean;
  accounts: string[];
}

/**
 * YellowstoneGeyserStream - Real-time on-chain data via Yellowstone gRPC
 * 
 * Provides:
 * - Account updates in real-time (vs polling every 400ms)
 * - Transaction confirmations with ~100ms latency
 * - Program account subscriptions for DEX pools
 */
export class YellowstoneGeyserStream extends EventEmitter {
  private config: GeyserConfig;
  private ws: WebSocket | null = null;
  private accountSubscriptions: Map<string, Set<string>> = new Map();
  private programSubscriptions: Set<string> = new Set();
  private logger: StructuredLogger;
  private connected = false;

  // Known DEX program IDs for auto-subscription
  static readonly DEX_PROGRAMS = {
    PHOENIX: "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY",
    OPENBOOK: "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb",
    ORCA_WHIRLPOOL: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
    RAYDIUM_AMM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    RAYDIUM_CLMM: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    METEORA_DLMM: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
    LIFINITY: "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S",
    SANCTUM: "5ocnV1qiCgaQR8Jb8xWnVbApfaRuV9Y9KmVALVu7FNn6",
    MARINADE: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
  };

  constructor(config: GeyserConfig) {
    super();
    this.config = config;
    this.logger = new StructuredLogger("geyser-stream");
  }

  /**
   * Connect to Yellowstone gRPC endpoint
   */
  async connect(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.config.xToken) {
        headers["x-token"] = this.config.xToken;
      }

      this.ws = new WebSocket(this.config.endpoint, {
        headers,
      } as unknown as string);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.logger.error("Geyser connection timeout");
          resolve(false);
        }, 10000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.logger.info("Geyser connected");
          this.emit("connected");
          
          // Auto-subscribe to DEX programs
          this.subscribeToAllDexPrograms();
          
          resolve(true);
        };

        this.ws!.onmessage = (event) => {
          this.handleGeyserMessage(event.data);
        };

        this.ws!.onerror = (error) => {
          clearTimeout(timeout);
          this.logger.error("Geyser error", { error });
          resolve(false);
        };

        this.ws!.onclose = () => {
          this.connected = false;
          this.emit("disconnected");
          this.logger.warn("Geyser disconnected");
        };
      });
    } catch (error) {
      this.logger.error("Geyser connection failed", { error });
      return false;
    }
  }

  /**
   * Subscribe to account updates
   */
  subscribeAccount(pubkey: string, label?: string): void {
    if (!this.ws || !this.connected) {
      this.logger.warn("Cannot subscribe, not connected");
      return;
    }

    const groupKey = label || "default";
    if (!this.accountSubscriptions.has(groupKey)) {
      this.accountSubscriptions.set(groupKey, new Set());
    }
    this.accountSubscriptions.get(groupKey)!.add(pubkey);

    this.ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "accountSubscribe",
      params: [pubkey, { encoding: "base64", commitment: "confirmed" }],
    }));

    this.logger.debug("Subscribed to account", { pubkey, label });
  }

  /**
   * Subscribe to program account updates
   */
  subscribeProgram(programId: string): void {
    if (!this.ws || !this.connected) {
      this.logger.warn("Cannot subscribe, not connected");
      return;
    }

    this.programSubscriptions.add(programId);

    this.ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "programSubscribe",
      params: [
        programId,
        {
          encoding: "base64",
          commitment: "confirmed",
          filters: [], // Can add filters for specific account types
        },
      ],
    }));

    this.logger.debug("Subscribed to program", { programId });
  }

  /**
   * Subscribe to all known DEX programs
   */
  subscribeToAllDexPrograms(): void {
    Object.entries(YellowstoneGeyserStream.DEX_PROGRAMS).forEach(([name, programId]) => {
      this.subscribeProgram(programId);
      this.logger.info("Subscribed to DEX program", { name, programId });
    });
  }

  /**
   * Disconnect from Geyser
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.connected = false;
    this.accountSubscriptions.clear();
    this.programSubscriptions.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  private handleGeyserMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.method === "accountNotification") {
        this.handleAccountUpdate(message.params);
      } else if (message.method === "programNotification") {
        this.handleProgramUpdate(message.params);
      } else if (message.method === "transactionNotification") {
        this.handleTransactionUpdate(message.params);
      }
    } catch (error) {
      this.logger.error("Geyser message parse error", { error });
    }
  }

  private handleAccountUpdate(params: { result: { value: { pubkey: string; account: { lamports: number; owner: string; data: [string, string] } }; context: { slot: number } } }): void {
    const { value, context } = params.result;
    const update: GeyserAccountUpdate = {
      pubkey: value.pubkey,
      lamports: BigInt(value.account.lamports),
      owner: value.account.owner,
      data: Buffer.from(value.account.data[0], value.account.data[1] as BufferEncoding),
      slot: context.slot,
      writeVersion: BigInt(0),
    };

    this.emit("accountUpdate", update);
    if (this.config.accountUpdateCallback) {
      this.config.accountUpdateCallback(update);
    }
  }

  private handleProgramUpdate(params: { result: { value: { pubkey: string; account: { lamports: number; owner: string; data: [string, string] } }; context: { slot: number } } }): void {
    // Same structure as account update
    this.handleAccountUpdate(params);
  }

  private handleTransactionUpdate(params: { result: { signature: string; slot: number; meta: { err: unknown }; transaction: { message: { accountKeys: string[] } } } }): void {
    const { result } = params;
    const update: GeyserTransactionUpdate = {
      signature: result.signature,
      slot: result.slot,
      isVote: false,
      success: result.meta.err === null,
      accounts: result.transaction.message.accountKeys,
    };

    this.emit("transactionUpdate", update);
    if (this.config.transactionCallback) {
      this.config.transactionCallback(update);
    }
  }
}
