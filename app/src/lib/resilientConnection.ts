import { Connection, ConnectionConfig } from '@solana/web3.js';

// RPC endpoints ordered by reliability (avoid Helius - rate limited)
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana.publicnode.com',
  'https://solana-mainnet.rpc.extrnode.com',
];

// Cache for connection instance
let cachedConnection: Connection | null = null;
let currentEndpointIndex = 0;
let lastError429Time = 0;

// Rate limiting protection
const MIN_REQUEST_INTERVAL = 100; // ms between requests
let lastRequestTime = 0;

/**
 * Get a resilient connection that auto-switches on 429 errors
 */
export function getResilientConnection(): Connection {
  if (!cachedConnection) {
    cachedConnection = createConnection(RPC_ENDPOINTS[currentEndpointIndex]);
  }
  return cachedConnection;
}

/**
 * Create a new connection with proper config
 */
function createConnection(endpoint: string): Connection {
  const config: ConnectionConfig = {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false,
  };
  return new Connection(endpoint, config);
}

/**
 * Switch to next RPC endpoint (called on 429 errors)
 */
export function switchToNextEndpoint(): string {
  currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
  const newEndpoint = RPC_ENDPOINTS[currentEndpointIndex];
  cachedConnection = createConnection(newEndpoint);
  console.log(`[RPC] Switched to: ${newEndpoint}`);
  return newEndpoint;
}

/**
 * Execute an RPC call with automatic retry and fallback
 */
export async function withRpcRetry<T>(
  fn: (connection: Connection) => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Rate limiting protection
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
      }
      lastRequestTime = Date.now();
      
      const connection = getResilientConnection();
      return await fn(connection);
    } catch (error: unknown) {
      lastError = error as Error;
      const errorMessage = lastError.message || '';
      
      // Check for 429 rate limit error
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        console.warn(`[RPC] Rate limited (429), switching endpoint...`);
        lastError429Time = Date.now();
        switchToNextEndpoint();
        await sleep(delayMs * (attempt + 1)); // Exponential backoff
        continue;
      }
      
      // Other errors - retry with delay
      if (attempt < maxRetries - 1) {
        await sleep(delayMs);
      }
    }
  }
  
  throw lastError || new Error('RPC call failed after retries');
}

/**
 * Check if we recently hit a 429 error (within last 30 seconds)
 */
export function wasRecentlyRateLimited(): boolean {
  return Date.now() - lastError429Time < 30000;
}

/**
 * Get current RPC endpoint
 */
export function getCurrentEndpoint(): string {
  return RPC_ENDPOINTS[currentEndpointIndex];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
