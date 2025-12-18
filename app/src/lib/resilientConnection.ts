import { Connection, ConnectionConfig } from '@solana/web3.js';

const BROWSER_RPC_ENDPOINT = '/api/solana-rpc';

// Upstreams ordered by reliability (server-side only). Le navigateur doit passer par BROWSER_RPC_ENDPOINT.
const SERVER_RPC_ENDPOINTS = [
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
    cachedConnection = createConnection(getRpcEndpoints()[currentEndpointIndex]);
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

function getRpcEndpoints(): string[] {
  // Client: same-origin proxy pour éviter CORS/429 des RPC tiers.
  if (typeof window !== 'undefined') {
    return [BROWSER_RPC_ENDPOINT];
  }

  // Server: possibilité d'override via env.
  const envRpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const endpoints = [envRpc, ...SERVER_RPC_ENDPOINTS].filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0
  );

  // Filtrer les URLs non HTTP(S)
  const normalized = endpoints.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
  return [...new Set(normalized)];
}

/**
 * Switch to next RPC endpoint (called on 429 errors)
 */
export function switchToNextEndpoint(): string {
  const endpoints = getRpcEndpoints();
  currentEndpointIndex = (currentEndpointIndex + 1) % endpoints.length;
  const newEndpoint = endpoints[currentEndpointIndex];
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
  return getRpcEndpoints()[currentEndpointIndex] || BROWSER_RPC_ENDPOINT;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
