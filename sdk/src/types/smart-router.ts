/**
 * Smart Order Router (SOR) - Core Types
 * Optimizes swap execution across multiple DEXs and orderbooks
 */

// ============================================================================
// VENUE TYPES (DEX, CLOB, RFQ)
// ============================================================================

export enum VenueType {
  AMM = 'amm',           // Automated Market Maker (Orca, Raydium, etc.)
  CLOB = 'clob',         // Central Limit Order Book (Phoenix, OpenBook)
  RFQ = 'rfq',           // Request for Quote (aggregators)
}

export enum VenueName {
  // AMMs
  ORCA = 'orca',
  RAYDIUM = 'raydium',
  METEORA = 'meteora',
  LIFINITY = 'lifinity',
  
  // CLOBs
  PHOENIX = 'phoenix',
  OPENBOOK = 'openbook',
  
  // Aggregators
  JUPITER = 'jupiter',
  METIS = 'metis',
}

export interface VenueConfig {
  name: VenueName;
  type: VenueType;
  enabled: boolean;
  priority: number;        // Higher = checked first (CLOB should have priority)
  feeRate: number;         // Base fee (e.g., 0.003 = 0.3%)
  minTradeSize: number;    // Minimum trade size in USD
  maxSlippage: number;     // Maximum allowed slippage
}

// ============================================================================
// LIQUIDITY DATA
// ============================================================================

export interface LiquiditySource {
  venue: VenueName;
  venueType: VenueType;
  tokenPair: [string, string];  // [inputMint, outputMint]
  
  // Liquidity metrics
  depth: number;           // Total liquidity available (USD)
  topOfBook?: {            // For CLOBs
    bidPrice: number;
    askPrice: number;
    bidSize: number;
    askSize: number;
  };
  
  // AMM-specific
  reserves?: {
    input: number;
    output: number;
  };
  
  // Cost calculation
  effectivePrice: number;  // Including fees and slippage
  feeAmount: number;       // Absolute fee in output token
  slippagePercent: number; // Expected slippage %
  
  // Execution details
  route: string[];         // Token path (may be multi-hop)
  timestamp: number;       // When this data was fetched
  
  // Optional metadata (for debugging/analytics)
  metadata?: Record<string, any>;
}

// ============================================================================
// ROUTE OPTIMIZATION
// ============================================================================

export interface RouteCandidate {
  id: string;
  venues: VenueName[];
  
  // Route structure
  path: string[];          // Full token path (may include intermediate tokens)
  hops: number;            // Number of swaps needed
  
  // Split allocation (if using multiple venues)
  splits: RouteSplit[];
  
  // Performance metrics
  expectedOutput: number;  // Total output tokens expected
  totalCost: number;       // All costs (fees + slippage + network + MEV)
  effectiveRate: number;   // Output/Input ratio
  
  // Risk assessment
  riskScore: number;       // 0-100, lower = safer
  mevRisk: 'low' | 'medium' | 'high';
  
  // Execution
  instructions: any[];     // Solana instructions to execute
  estimatedComputeUnits: number;
}

export interface RouteSplit {
  venue: VenueName;
  percentage: number;      // % of total input (0-100)
  inputAmount: number;     // Tokens to send to this venue
  expectedOutput: number;  // Expected output from this split
  liquiditySource: LiquiditySource;
}

// ============================================================================
// ADVANCED QUOTING & ATOMIC PLAN TYPES
// ============================================================================

export interface VenueQuoteSample {
  inputAmount: number;
  outputAmount: number;
  effectivePrice: number;
  marginalPrice: number;
  slippagePercent: number;
  feeAmount: number;
  postTradeLiquidity?: number;
}

export interface VenueSimulationResult {
  venue: VenueName;
  venueType: VenueType;
  route: string[];
  samples: VenueQuoteSample[];
  bestSample: VenueQuoteSample;
  fetchedAt: number;
}

export interface AtomicSwapLeg {
  venue: VenueName;
  venueType: VenueType;
  route: string[];
  inputAmount: number;
  expectedOutput: number;
  minOutput: number;
  feeAmount: number;
  slippagePercent: number;
  quote: VenueQuoteSample;
  liquiditySource: LiquiditySource;
}

export interface AtomicSwapPlan {
  id: string;
  inputMint: string;
  outputMint: string;
  totalInput: number;
  expectedOutput: number;
  minOutput: number;
  createdAt: number;
  expiresAt: number;
  quoteValidityMs: number;
  legs: AtomicSwapLeg[];
  simulations: VenueSimulationResult[];
  baseRoute: RouteCandidate;
  fallbackPlans?: AtomicSwapPlan[];
  maxSlippageBps: number;
  driftRebalanceBps: number;
  minLiquidityRatio: number;
  maxStalenessMs: number;
  liquiditySnapshot: Record<VenueName, {
    effectivePrice: number;
    depth: number;
    timestamp: number;
  }>;
}

// ============================================================================
// OPTIMIZATION ENGINE CONFIG
// ============================================================================

export interface OptimizationConfig {
  // User preferences
  slippageTolerance: number;     // Max slippage (e.g., 0.01 = 1%)
  minOutputAmount?: number;      // Minimum acceptable output
  maxRoutes?: number;            // Max number of routes to consider (default: 3)
  
  // Venue preferences
  allowedVenues?: VenueName[];   // Restrict to specific DEXs
  excludedVenues?: VenueName[];  // Exclude specific DEXs
  prioritizeCLOB: boolean;       // Always try CLOBs first
  
  // Advanced options
  maxHops: number;               // Max number of swaps in route (default: 3)
  enableSplitRoutes: boolean;    // Allow splitting across venues
  maxSplits: number;             // Max venues to split across (default: 3)
  
  // MEV protection
  useBundling: boolean;          // Use Jito bundling
  maxPriorityFee: number;        // Max lamports for priority fee
  
  // Execution strategy
  enableTWAP: boolean;           // Time-Weighted Average Price
  twapIntervalMs?: number;       // Interval between chunks
  twapChunks?: number;           // Number of chunks to split into
  
  // Failover
  enableFallback: boolean;       // Try backup routes on failure
  maxRetries: number;            // Max retry attempts
}

// ============================================================================
// ORACLE PRICE VERIFICATION
// ============================================================================

export interface OraclePriceData {
  provider: 'pyth' | 'switchboard';
  price: number;              // Current market price
  confidence: number;         // Price confidence interval
  timestamp: number;          // Backwards-compatible timestamp (ms)
  publishTime: number;        // Precise publish time from oracle (ms)
  exponent: number;           // Price exponent
}

export interface PriceVerification {
  oraclePrice: number;
  routePrice: number;
  deviation: number;          // % deviation from oracle
  isAcceptable: boolean;      // Within acceptable range
  warning?: string;           // Warning message if risky
}

// ============================================================================
// EXECUTION & ANALYTICS
// ============================================================================

export interface SwapExecution {
  txSignature: string;
  route: RouteCandidate;
  
  // Actual results
  actualOutput: number;
  actualSlippage: number;
  totalFeesPaid: number;
  networkFeePaid: number;
  priorityFeePaid: number;
  
  // Performance
  executionTimeMs: number;
  computeUnitsUsed: number;
  
  // Status
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  
  // Timestamp
  executedAt: number;
}

export interface SwapAnalytics {
  // Route performance
  venuesUsed: VenueName[];
  routeEfficiency: number;    // Actual vs expected output %
  
  // Cost breakdown
  totalFeesUSD: number;
  networkFeesUSD: number;
  dexFeesUSD: number;
  slippageUSD: number;
  mevCostUSD: number;
  
  // Comparison
  bestPossibleOutput: number; // What perfect routing could achieve
  savingsVsWorst: number;     // How much better than worst route
  
  // Learning data for ML
  marketConditions: {
    volatility: number;
    liquidityDepth: number;
    competitorActivity: number;
  };
}

// ============================================================================
// LIQUIDITY AGGREGATION
// ============================================================================

export interface AggregatedLiquidity {
  tokenPair: [string, string];
  totalDepth: number;         // Combined liquidity across all venues
  
  // Sources ranked by cost
  sources: LiquiditySource[];
  
  // Best available
  bestSingleVenue: VenueName;
  bestCombinedRoute: RouteCandidate;
  
  // Metadata
  fetchedAt: number;
  staleness: number;          // Age in ms
}

// ============================================================================
// MEV PROTECTION (JITO)
// ============================================================================

export interface JitoBundleConfig {
  enabled: boolean;
  tipLamports: number;        // Tip to pay to Jito
  maxRetries: number;
  
  // Bundle composition
  setupInstructions?: any[];  // Pre-swap setup (e.g., create ATA)
  cleanupInstructions?: any[]; // Post-swap cleanup
}

export interface JitoBundleResult {
  bundleId: string;
  status: 'pending' | 'landed' | 'failed';
  landedSlot?: number;
  signatures: string[];
  strategy: 'jito' | 'quicknode';
  tipLamports?: number;
  priorityFeeMicroLamports?: number;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export enum RouteErrorCode {
  INSUFFICIENT_LIQUIDITY = 'insufficient_liquidity',
  SLIPPAGE_EXCEEDED = 'slippage_exceeded',
  ORACLE_MISMATCH = 'oracle_price_mismatch',
  VENUE_UNAVAILABLE = 'venue_unavailable',
  NETWORK_ERROR = 'network_error',
  MEV_DETECTED = 'mev_detected',
  SIMULATION_FAILED = 'simulation_failed',
}

export interface RouteError {
  code: RouteErrorCode;
  message: string;
  venue?: VenueName;
  retryable: boolean;
  fallbackAvailable: boolean;
}
