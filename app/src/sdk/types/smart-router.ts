/**
 * Smart Order Router (SOR) - Core Types
 * Optimizes swap execution across multiple DEXs and orderbooks
 */

// ============================================================================
// VENUE TYPES (DEX, CLOB, RFQ)
// ============================================================================

export enum VenueType {
  AMM = "amm", // Automated Market Maker (Orca, Raydium, etc.)
  CLOB = "clob", // Central Limit Order Book (Phoenix, OpenBook)
  RFQ = "rfq", // Request for Quote (aggregators)
}

export enum VenueName {
  // AMMs
  ORCA = "orca",
  RAYDIUM = "raydium",
  METEORA = "meteora",
  LIFINITY = "lifinity",
  GOOSEFX = "goosefx", // GooseFX CLMM pools

  // Stable/Multi-token AMMs
  SABER = "saber", // Stablecoin specialist
  MERCURIAL = "mercurial", // Multi-token stable pools

  // CLMM/Concentrated Liquidity
  KAMINO = "kamino", // Concentrated liquidity management
  CROPPER = "cropper", // Cropper Finance CLMM

  // LST Specialists
  SANCTUM = "sanctum", // LST swaps (mSOL, stSOL, jitoSOL, etc.)
  MARINADE = "marinade", // Direct mSOL staking/unstaking

  // NFT Marketplaces
  TENSOR = "tensor", // NFT marketplace for NFT-collateralized tokens

  // CLOBs
  PHOENIX = "phoenix",
  OPENBOOK = "openbook",

  // Aggregators
  JUPITER = "jupiter",
  METIS = "metis",
}

export interface VenueConfig {
  name: VenueName;
  type: VenueType;
  enabled: boolean;
  priority: number; // Higher = checked first (CLOB should have priority)
  feeRate: number; // Base fee (e.g., 0.003 = 0.3%)
  minTradeSize: number; // Minimum trade size in USD
  maxSlippage: number; // Maximum allowed slippage
  makerFeeBps?: number;
  takerFeeBps?: number;
  priorityFeeLamports?: number;
  latencyTargetMs?: number;
  featureFlag?: string;
  minTopOfBookCoverage?: number; // Fraction (0-1) of requested size that best level must satisfy
}

export interface OrderbookSnapshot {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  bestBid: number;
  bestAsk: number;
  spreadBps: number;
  depthUsd: number;
  lastUpdated: number;
  latencyMs: number;
}

// ============================================================================
// LIQUIDITY DATA
// ============================================================================

export interface LiquiditySource {
  venue: VenueName;
  venueType: VenueType;
  tokenPair: [string, string]; // [inputMint, outputMint]

  // Liquidity metrics
  depth: number; // Total liquidity available (USD)
  topOfBook?: {
    // For CLOBs
    bidPrice: number;
    askPrice: number;
    bidSize: number;
    askSize: number;
  };
  orderbook?: OrderbookSnapshot; // Detailed orderbook snapshot for analytics

  // AMM-specific
  reserves?: {
    input: number;
    output: number;
  };

  // Cost calculation
  effectivePrice: number; // Including fees and slippage
  feeAmount: number; // Absolute fee in output token
  slippagePercent: number; // Expected slippage %
  venueFeeBps?: number;
  priorityFeeLamports?: number;
  mevProtectionCost?: number;
  dataFreshnessMs?: number;

  // Execution details
  route: string[]; // Token path (may be multi-hop)
  timestamp: number; // When this data was fetched

  // Optional metadata (for debugging/analytics)
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ROUTE OPTIMIZATION
// ============================================================================

export interface RouteCandidate {
  id: string;
  venues: VenueName[];

  // Route structure
  path: string[]; // Full token path (may include intermediate tokens)
  hops: number; // Number of swaps needed

  // Split allocation (if using multiple venues)
  splits: RouteSplit[];

  // Performance metrics
  expectedOutput: number; // Total output tokens expected
  totalCost: number; // All costs (fees + slippage + network + MEV)
  effectiveRate: number; // Output/Input ratio

  // Risk assessment
  riskScore: number; // 0-100, lower = safer
  mevRisk: "low" | "medium" | "high";

  // Execution
  instructions: unknown[]; // Solana instructions to execute
  estimatedComputeUnits: number;
  strategy?: RoutingStrategyMetadata;
}

export interface RouteSplit {
  venue: VenueName;
  weight: number; // Weight of total input (0-100, must sum to 100)
  inputAmount: number; // Tokens to send to this venue
  expectedOutput: number; // Expected output from this split
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

export interface TwapRecommendation {
  recommended: boolean;
  triggerRatio?: number;
  slices?: number;
  intervalMs?: number;
  reason?: string;
  footprintRatio?: number;
}

export interface RoutingStrategyMetadata {
  profile: "single-venue" | "split" | "twap-assisted";
  splitsEnabled: boolean;
  splitVenues: VenueName[];
  fallbackEnabled: boolean;
  fallbackCount: number;
  twap?: TwapRecommendation;
  notes?: string[];
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
  liquiditySnapshot: Record<
    VenueName,
    {
      effectivePrice: number;
      depth: number;
      timestamp: number;
    }
  >;
  strategy: RoutingStrategyMetadata;
}

// ============================================================================
// OPTIMIZATION ENGINE CONFIG
// ============================================================================

export interface OptimizationConfig {
  // User preferences
  slippageTolerance: number; // Max slippage (e.g., 0.01 = 1%)
  minOutputAmount?: number; // Minimum acceptable output
  maxRoutes?: number; // Max number of routes to consider (default: 3)

  // Venue preferences
  allowedVenues?: VenueName[]; // Restrict to specific DEXs
  excludedVenues?: VenueName[]; // Exclude specific DEXs
  prioritizeCLOB: boolean; // Always try CLOBs first

  // Advanced options
  maxHops: number; // Max number of swaps in route (default: 3)
  enableSplitRoutes: boolean; // Allow splitting across venues
  maxSplits: number; // Max venues to split across (default: 3)

  // MEV protection
  useBundling: boolean; // Use Jito bundling
  maxPriorityFee: number; // Max lamports for priority fee

  // Execution strategy
  enableTWAP: boolean; // Time-Weighted Average Price
  twapIntervalMs?: number; // Interval between chunks
  twapChunks?: number; // Number of chunks to split into

  // Failover
  enableFallback: boolean; // Try backup routes on failure
  maxRetries: number; // Max retry attempts
}

// ============================================================================
// ORACLE PRICE VERIFICATION
// ============================================================================

export type OraclePriceSource =
  | "pyth-account"
  | "pyth-hermes"
  | "switchboard";

export interface OraclePriceData {
  provider: "pyth" | "switchboard";
  source?: OraclePriceSource;
  price: number; // Current market price
  confidence: number; // Price confidence interval
  timestamp: number; // Backwards-compatible timestamp (ms)
  publishTime: number; // Precise publish time from oracle (ms)
  exponent: number; // Price exponent
}

export interface OracleVerificationDetail {
  providerUsed: "pyth" | "switchboard";
  price: number;
  confidence: number;
  divergencePercent?: number;
  fallbackUsed: boolean;
  sources: {
    pyth?: OraclePriceData;
    switchboard?: OraclePriceData;
  };
}

export interface PriceVerification {
  oraclePrice: number;
  routePrice: number;
  deviation: number; // % deviation from oracle
  isAcceptable: boolean; // Within acceptable range
  warning?: string; // Warning message if risky
  metadata?: {
    input?: OracleVerificationDetail;
    output?: OracleVerificationDetail;
  };
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
  status: "success" | "failed" | "partial";
  errorMessage?: string;

  // Timestamp
  executedAt: number;
}

export interface SwapAnalytics {
  // Route performance
  venuesUsed: VenueName[];
  routeEfficiency: number; // Actual vs expected output %

  // Cost breakdown
  totalFeesUSD: number;
  networkFeesUSD: number;
  dexFeesUSD: number;
  slippageUSD: number;
  mevCostUSD: number;

  // Comparison
  bestPossibleOutput: number; // What perfect routing could achieve
  savingsVsWorst: number; // How much better than worst route

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
  totalDepth: number; // Combined liquidity across all venues

  // Sources ranked by cost
  sources: LiquiditySource[];

  // Best available
  bestSingleVenue: VenueName;
  bestCombinedRoute: RouteCandidate | null;

  // Metadata
  fetchedAt: number;
  staleness: number; // Age in ms
}

// ============================================================================
// MEV PROTECTION (JITO)
// ============================================================================

export interface JitoBundleConfig {
  enabled: boolean;
  tipLamports: number; // Tip to pay to Jito
  maxRetries: number;

  // Bundle composition
  setupInstructions?: unknown[]; // Pre-swap setup (e.g., create ATA)
  cleanupInstructions?: unknown[]; // Post-swap cleanup
}

export interface JitoBundleResult {
  bundleId: string;
  status: "pending" | "landed" | "failed";
  landedSlot?: number;
  signatures: string[];
  strategy: "jito" | "quicknode";
  tipLamports?: number;
  priorityFeeMicroLamports?: number;
}

export interface BundleEligibilityConfig {
  minTradeValueUSD: number; // 10000 USD default
  minTradeValueSOL: number; // 10 SOL default
  forceForHighRisk: boolean; // true - always bundle high risk
  forceForAMMOnly: boolean; // true - always bundle AMM-only routes
  forceForLargeTrades: boolean; // true - always bundle large trades
  forceForHighSlippage: boolean; // true - always bundle high slippage
}

export interface BundleEligibilityFactors {
  meetsValueThreshold: boolean; // USD or SOL threshold
  hasHighMEVRisk: boolean; // medium/high MEV risk
  isAMMOnly: boolean; // AMM-only route
  hasHighSlippage: boolean; // >1% slippage
  isLargeTrade: boolean; // >10k USD or >10 SOL
}

export interface BundleEligibilityResult {
  eligible: boolean;
  reason: string;
  eligibilityFactors: BundleEligibilityFactors;
  recommendedTipLamports: number;
  riskLevel: "low" | "medium" | "high";
}

export interface BundleMetrics {
  // Eligibility stats
  totalSwaps: number;
  bundledSwaps: number;
  directSwaps: number;
  bundleRate: number; // percentage (0-100)
  eligibleSwaps?: number; // Optional: swaps eligible for bundling
  ineligibleSwaps?: number; // Optional: swaps not eligible
  eligibilityRate?: number; // Optional: percentage (0-100)

  // Performance
  avgBundleLandingTimeMs: number;
  avgTipPaidLamports: number;
  totalTipsPaidLamports: number;

  // Savings
  totalMEVSavingsUSD: number;
  avgMEVSavingsPercent: number;

  // Success rates (0-100)
  jitoSuccessRate: number;
  quicknodeSuccessRate: number;
  directSuccessRate: number;

  // Failures
  jitoFailures: number;
  quicknodeFailures: number;
  timeouts: number;

  // Timestamps
  firstSwapAt: number;
  lastSwapAt: number;
  periodMs: number;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export enum RouteErrorCode {
  INSUFFICIENT_LIQUIDITY = "insufficient_liquidity",
  SLIPPAGE_EXCEEDED = "slippage_exceeded",
  ORACLE_MISMATCH = "oracle_price_mismatch",
  VENUE_UNAVAILABLE = "venue_unavailable",
  NETWORK_ERROR = "network_error",
  MEV_DETECTED = "mev_detected",
  SIMULATION_FAILED = "simulation_failed",
}

export interface RouteError {
  code: RouteErrorCode;
  message: string;
  venue?: VenueName;
  retryable: boolean;
  fallbackAvailable: boolean;
}
