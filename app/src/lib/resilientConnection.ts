import { Connection, ConnectionConfig } from '@solana/web3.js';

// RPC endpoints ordered by reliability
// Priority: User-configured > Free public RPCs with good limits
const RPC_ENDPOINTS = [
  // User-configured RPC (from env) - highest priority
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  // Reliable free RPCs (December 2025)
  'https://solana-mainnet.g.alchemy.com/v2/demo', // Alchemy demo (limited but works)
  'https://rpc.helius.xyz/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff', // Helius free tier
  'https://mainnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff',
  'https://solana.publicnode.com',
  'https://api.mainnet-beta.solana.com', // Official (heavily rate-limited)
].filter(Boolean) as string[]; // Remove undefined entries

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
  const endpointsTried = new Set<number>();
  
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
      
      // Check for rate limit or access forbidden errors
      const isRateLimited = errorMessage.includes('429') || errorMessage.includes('Too Many Requests');
      const isForbidden = errorMessage.includes('403') || errorMessage.includes('Access forbidden') || errorMessage.includes('Forbidden');
      
      if (isRateLimited || isForbidden) {
        console.warn(`[RPC] ${isRateLimited ? 'Rate limited (429)' : 'Forbidden (403)'}, switching endpoint...`);
        endpointsTried.add(currentEndpointIndex);
        lastError429Time = Date.now();
        switchToNextEndpoint();
        
        // If we've tried all endpoints, wait longer before cycling
        if (endpointsTried.size >= RPC_ENDPOINTS.length) {
          console.warn(`[RPC] All endpoints tried, waiting before retry...`);
          await sleep(delayMs * 3);
          endpointsTried.clear();
        } else {
          await sleep(delayMs * (attempt + 1)); // Exponential backoff
        }
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
