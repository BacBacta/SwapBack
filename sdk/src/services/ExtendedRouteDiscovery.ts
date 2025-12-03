/**
 * Extended Route Discovery - Multi-hop with 15+ intermediate tokens
 * Implements intelligent path finding with liquidity clustering
 */

import { PublicKey } from "@solana/web3.js";
import { VenueName, LiquiditySource, VenueType } from "../types/smart-router";

// ============================================================================
// EXTENDED INTERMEDIATE TOKENS (15+ high-liquidity tokens)
// ============================================================================

export const INTERMEDIATE_TOKENS = {
  // Stablecoins (highest liquidity)
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  
  // Native SOL
  SOL: "So11111111111111111111111111111111111111112",
  
  // Liquid Staking Tokens (LSTs)
  mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  stSOL: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
  jitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  bSOL: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
  INF: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
  
  // Wrapped tokens
  wBTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  wETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  
  // Popular DeFi tokens
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  SRM: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt",
  
  // Meme tokens (high volume)
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  
  // Governance tokens
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
};

// Token metadata for intelligent routing
export const TOKEN_METADATA: Record<string, TokenInfo> = {
  [INTERMEDIATE_TOKENS.USDC]: { 
    symbol: "USDC", 
    decimals: 6, 
    liquidity: "very_high", 
    category: "stablecoin",
    routePriority: 100,
  },
  [INTERMEDIATE_TOKENS.USDT]: { 
    symbol: "USDT", 
    decimals: 6, 
    liquidity: "very_high", 
    category: "stablecoin",
    routePriority: 95,
  },
  [INTERMEDIATE_TOKENS.SOL]: { 
    symbol: "SOL", 
    decimals: 9, 
    liquidity: "very_high", 
    category: "native",
    routePriority: 100,
  },
  [INTERMEDIATE_TOKENS.mSOL]: { 
    symbol: "mSOL", 
    decimals: 9, 
    liquidity: "high", 
    category: "lst",
    routePriority: 85,
  },
  [INTERMEDIATE_TOKENS.stSOL]: { 
    symbol: "stSOL", 
    decimals: 9, 
    liquidity: "high", 
    category: "lst",
    routePriority: 80,
  },
  [INTERMEDIATE_TOKENS.jitoSOL]: { 
    symbol: "jitoSOL", 
    decimals: 9, 
    liquidity: "high", 
    category: "lst",
    routePriority: 82,
  },
  [INTERMEDIATE_TOKENS.bSOL]: { 
    symbol: "bSOL", 
    decimals: 9, 
    liquidity: "medium", 
    category: "lst",
    routePriority: 70,
  },
  [INTERMEDIATE_TOKENS.INF]: { 
    symbol: "INF", 
    decimals: 9, 
    liquidity: "medium", 
    category: "lst",
    routePriority: 65,
  },
  [INTERMEDIATE_TOKENS.wBTC]: { 
    symbol: "wBTC", 
    decimals: 8, 
    liquidity: "high", 
    category: "wrapped",
    routePriority: 75,
  },
  [INTERMEDIATE_TOKENS.wETH]: { 
    symbol: "wETH", 
    decimals: 8, 
    liquidity: "high", 
    category: "wrapped",
    routePriority: 75,
  },
  [INTERMEDIATE_TOKENS.RAY]: { 
    symbol: "RAY", 
    decimals: 6, 
    liquidity: "medium", 
    category: "defi",
    routePriority: 60,
  },
  [INTERMEDIATE_TOKENS.SRM]: { 
    symbol: "SRM", 
    decimals: 6, 
    liquidity: "medium", 
    category: "defi",
    routePriority: 55,
  },
  [INTERMEDIATE_TOKENS.BONK]: { 
    symbol: "BONK", 
    decimals: 5, 
    liquidity: "high", 
    category: "meme",
    routePriority: 70,
  },
  [INTERMEDIATE_TOKENS.WIF]: { 
    symbol: "WIF", 
    decimals: 6, 
    liquidity: "high", 
    category: "meme",
    routePriority: 68,
  },
  [INTERMEDIATE_TOKENS.JUP]: { 
    symbol: "JUP", 
    decimals: 6, 
    liquidity: "high", 
    category: "governance",
    routePriority: 75,
  },
  [INTERMEDIATE_TOKENS.ORCA]: { 
    symbol: "ORCA", 
    decimals: 6, 
    liquidity: "medium", 
    category: "governance",
    routePriority: 65,
  },
};

interface TokenInfo {
  symbol: string;
  decimals: number;
  liquidity: "very_high" | "high" | "medium" | "low";
  category: "stablecoin" | "native" | "lst" | "wrapped" | "defi" | "meme" | "governance";
  routePriority: number;
}

// ============================================================================
// LIQUIDITY CLUSTERS
// ============================================================================

/**
 * Liquidity clusters group tokens that have deep liquidity between them
 * This enables intelligent path finding by preferring intra-cluster routes
 */
export const LIQUIDITY_CLUSTERS: LiquidityCluster[] = [
  {
    name: "Stablecoin Core",
    tokens: [INTERMEDIATE_TOKENS.USDC, INTERMEDIATE_TOKENS.USDT],
    avgDepthUSD: 50_000_000,
    avgSpreadBps: 1,
  },
  {
    name: "SOL Ecosystem",
    tokens: [
      INTERMEDIATE_TOKENS.SOL,
      INTERMEDIATE_TOKENS.mSOL,
      INTERMEDIATE_TOKENS.stSOL,
      INTERMEDIATE_TOKENS.jitoSOL,
      INTERMEDIATE_TOKENS.bSOL,
    ],
    avgDepthUSD: 20_000_000,
    avgSpreadBps: 5,
  },
  {
    name: "Major Pairs",
    tokens: [
      INTERMEDIATE_TOKENS.SOL,
      INTERMEDIATE_TOKENS.USDC,
      INTERMEDIATE_TOKENS.wBTC,
      INTERMEDIATE_TOKENS.wETH,
    ],
    avgDepthUSD: 30_000_000,
    avgSpreadBps: 10,
  },
  {
    name: "Meme Tokens",
    tokens: [
      INTERMEDIATE_TOKENS.SOL,
      INTERMEDIATE_TOKENS.BONK,
      INTERMEDIATE_TOKENS.WIF,
    ],
    avgDepthUSD: 5_000_000,
    avgSpreadBps: 20,
  },
  {
    name: "DeFi Governance",
    tokens: [
      INTERMEDIATE_TOKENS.SOL,
      INTERMEDIATE_TOKENS.RAY,
      INTERMEDIATE_TOKENS.JUP,
      INTERMEDIATE_TOKENS.ORCA,
    ],
    avgDepthUSD: 10_000_000,
    avgSpreadBps: 15,
  },
];

interface LiquidityCluster {
  name: string;
  tokens: string[];
  avgDepthUSD: number;
  avgSpreadBps: number;
}

// ============================================================================
// EXTENDED ROUTE DISCOVERY
// ============================================================================

export interface MultiHopRoute {
  path: string[];           // Token mints in order
  hops: number;             // Number of swaps
  legs: RouteLeg[];         // Individual swap legs
  totalOutputEstimate: number;
  totalSlippageEstimate: number;
  totalFeeEstimate: number;
  score: number;            // Combined quality score
  cluster?: string;         // If route uses a liquidity cluster
}

export interface RouteLeg {
  inputMint: string;
  outputMint: string;
  venue: VenueName;
  inputAmount: number;
  outputAmount: number;
  slippagePercent: number;
  feeAmount: number;
}

export class ExtendedRouteDiscovery {
  private readonly maxHops: number;
  private readonly maxRoutesPerPath: number;

  constructor(options?: { maxHops?: number; maxRoutesPerPath?: number }) {
    this.maxHops = options?.maxHops ?? 3;
    this.maxRoutesPerPath = options?.maxRoutesPerPath ?? 5;
  }

  /**
   * Discover all viable multi-hop routes between two tokens
   */
  async discoverRoutes(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    fetchLiquidity: (input: string, output: string, amount: number) => Promise<LiquiditySource | null>
  ): Promise<MultiHopRoute[]> {
    const routes: MultiHopRoute[] = [];
    const intermediates = this.selectIntermediates(inputMint, outputMint);

    console.log(`🔍 Discovering routes with ${intermediates.length} intermediate tokens`);

    // 1. Direct route (1 hop)
    const directLiquidity = await fetchLiquidity(inputMint, outputMint, inputAmount);
    if (directLiquidity) {
      routes.push(this.createRoute(
        [inputMint, outputMint],
        [this.liquidityToLeg(directLiquidity, inputAmount)]
      ));
    }

    // 2. Two-hop routes (A → X → B)
    const twoHopPromises = intermediates.map(async (intermediate) => {
      try {
        const leg1 = await fetchLiquidity(inputMint, intermediate.mint, inputAmount);
        if (!leg1) return null;

        const leg1Output = inputAmount / leg1.effectivePrice;
        const leg2 = await fetchLiquidity(intermediate.mint, outputMint, leg1Output);
        if (!leg2) return null;

        return this.createRoute(
          [inputMint, intermediate.mint, outputMint],
          [
            this.liquidityToLeg(leg1, inputAmount),
            this.liquidityToLeg(leg2, leg1Output),
          ],
          this.findCluster(intermediate.mint)
        );
      } catch {
        return null;
      }
    });

    const twoHopResults = await Promise.all(twoHopPromises);
    routes.push(...twoHopResults.filter((r): r is MultiHopRoute => r !== null));

    // 3. Three-hop routes (A → X → Y → B) - only for high-value trades
    if (inputAmount > 10000 && this.maxHops >= 3) {
      const threeHopRoutes = await this.discoverThreeHopRoutes(
        inputMint,
        outputMint,
        inputAmount,
        intermediates,
        fetchLiquidity
      );
      routes.push(...threeHopRoutes);
    }

    // Sort by score (best first) and limit
    routes.sort((a, b) => b.score - a.score);
    return routes.slice(0, this.maxRoutesPerPath);
  }

  /**
   * Discover three-hop routes for complex swaps
   */
  private async discoverThreeHopRoutes(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    intermediates: Array<{ mint: string; priority: number }>,
    fetchLiquidity: (input: string, output: string, amount: number) => Promise<LiquiditySource | null>
  ): Promise<MultiHopRoute[]> {
    const routes: MultiHopRoute[] = [];

    // Only use top 5 intermediates for three-hop to limit complexity
    const topIntermediates = intermediates.slice(0, 5);

    for (const int1 of topIntermediates) {
      for (const int2 of topIntermediates) {
        if (int1.mint === int2.mint) continue;

        try {
          const leg1 = await fetchLiquidity(inputMint, int1.mint, inputAmount);
          if (!leg1) continue;

          const leg1Output = inputAmount / leg1.effectivePrice;
          const leg2 = await fetchLiquidity(int1.mint, int2.mint, leg1Output);
          if (!leg2) continue;

          const leg2Output = leg1Output / leg2.effectivePrice;
          const leg3 = await fetchLiquidity(int2.mint, outputMint, leg2Output);
          if (!leg3) continue;

          const route = this.createRoute(
            [inputMint, int1.mint, int2.mint, outputMint],
            [
              this.liquidityToLeg(leg1, inputAmount),
              this.liquidityToLeg(leg2, leg1Output),
              this.liquidityToLeg(leg3, leg2Output),
            ]
          );

          // Apply penalty for 3-hop routes (more gas, more risk)
          route.score *= 0.9;
          routes.push(route);
        } catch {
          // Continue to next combination
        }
      }
    }

    return routes;
  }

  /**
   * Select best intermediate tokens based on input/output characteristics
   */
  private selectIntermediates(
    inputMint: string,
    outputMint: string
  ): Array<{ mint: string; priority: number }> {
    const intermediates: Array<{ mint: string; priority: number }> = [];

    for (const [mint, info] of Object.entries(TOKEN_METADATA)) {
      // Skip if input or output
      if (mint === inputMint || mint === outputMint) continue;

      let priority = info.routePriority;

      // Boost priority for tokens in same cluster as input or output
      const inputCluster = this.findCluster(inputMint);
      const outputCluster = this.findCluster(outputMint);
      const tokenCluster = this.findCluster(mint);

      if (tokenCluster && (tokenCluster === inputCluster || tokenCluster === outputCluster)) {
        priority += 20;
      }

      // Boost stablecoins for cross-category swaps
      if (info.category === "stablecoin") {
        priority += 10;
      }

      // Boost SOL as universal bridge
      if (info.symbol === "SOL") {
        priority += 15;
      }

      intermediates.push({ mint, priority });
    }

    // Sort by priority (highest first)
    intermediates.sort((a, b) => b.priority - a.priority);

    return intermediates;
  }

  /**
   * Find which liquidity cluster a token belongs to
   */
  private findCluster(mint: string): string | undefined {
    for (const cluster of LIQUIDITY_CLUSTERS) {
      if (cluster.tokens.includes(mint)) {
        return cluster.name;
      }
    }
    return undefined;
  }

  /**
   * Convert liquidity source to route leg
   */
  private liquidityToLeg(source: LiquiditySource, inputAmount: number): RouteLeg {
    const outputAmount = inputAmount / source.effectivePrice;
    return {
      inputMint: source.tokenPair[0],
      outputMint: source.tokenPair[1],
      venue: source.venue,
      inputAmount,
      outputAmount,
      slippagePercent: source.slippagePercent,
      feeAmount: source.feeAmount,
    };
  }

  /**
   * Create a multi-hop route from legs
   */
  private createRoute(
    path: string[],
    legs: RouteLeg[],
    cluster?: string
  ): MultiHopRoute {
    const totalOutput = legs[legs.length - 1].outputAmount;
    const totalSlippage = legs.reduce((sum, leg) => sum + leg.slippagePercent, 0);
    const totalFees = legs.reduce((sum, leg) => sum + leg.feeAmount, 0);

    // Score calculation:
    // - Higher output is better
    // - Lower slippage is better
    // - Fewer hops is better
    // - In-cluster routes get bonus
    let score = totalOutput * 100;
    score -= totalSlippage * 1000; // Penalize slippage
    score -= legs.length * 50;     // Penalize extra hops
    if (cluster) score += 100;      // Bonus for cluster routes

    return {
      path,
      hops: legs.length,
      legs,
      totalOutputEstimate: totalOutput,
      totalSlippageEstimate: totalSlippage,
      totalFeeEstimate: totalFees,
      score,
      cluster,
    };
  }

  /**
   * Get all intermediate token addresses
   */
  getIntermediateTokens(): string[] {
    return Object.values(INTERMEDIATE_TOKENS);
  }

  /**
   * Get token info
   */
  getTokenInfo(mint: string): TokenInfo | undefined {
    return TOKEN_METADATA[mint];
  }
}

export default ExtendedRouteDiscovery;
