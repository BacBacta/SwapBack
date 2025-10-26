/**
 * Real-time Liquidity Data Collector
 * Fetches current state from DEXs, CLOBs, and aggregators
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { Client as PhoenixClient } from "@ellipsis-labs/phoenix-sdk";
import {
  VenueName,
  VenueType,
  LiquiditySource,
  AggregatedLiquidity,
  VenueConfig,
} from "../types/smart-router";
import { getPhoenixMarket } from "../config/phoenix-markets";
import { getOrcaWhirlpool } from "../config/orca-pools";
import { getRaydiumPool } from "../config/raydium-pools";

// ============================================================================
// CONFIGURATION
// ============================================================================

const VENUE_CONFIGS: Record<VenueName, VenueConfig> = {
  // CLOBs - Highest priority (best execution)
  [VenueName.PHOENIX]: {
    name: VenueName.PHOENIX,
    type: VenueType.CLOB,
    enabled: true,
    priority: 100,
    feeRate: 0.0005, // 0.05% taker fee
    minTradeSize: 10,
    maxSlippage: 0.001,
  },
  [VenueName.OPENBOOK]: {
    name: VenueName.OPENBOOK,
    type: VenueType.CLOB,
    enabled: true,
    priority: 95,
    feeRate: 0.0004,
    minTradeSize: 10,
    maxSlippage: 0.001,
  },

  // AMMs - Medium priority
  [VenueName.ORCA]: {
    name: VenueName.ORCA,
    type: VenueType.AMM,
    enabled: true,
    priority: 80,
    feeRate: 0.003, // 0.3%
    minTradeSize: 1,
    maxSlippage: 0.01,
  },
  [VenueName.RAYDIUM]: {
    name: VenueName.RAYDIUM,
    type: VenueType.AMM,
    enabled: true,
    priority: 75,
    feeRate: 0.0025,
    minTradeSize: 1,
    maxSlippage: 0.01,
  },
  [VenueName.METEORA]: {
    name: VenueName.METEORA,
    type: VenueType.AMM,
    enabled: true,
    priority: 70,
    feeRate: 0.002,
    minTradeSize: 1,
    maxSlippage: 0.01,
  },
  [VenueName.LIFINITY]: {
    name: VenueName.LIFINITY,
    type: VenueType.AMM,
    enabled: true,
    priority: 65,
    feeRate: 0.001, // Variable fee
    minTradeSize: 1,
    maxSlippage: 0.02,
  },

  // Aggregators - Lower priority (use as fallback)
  [VenueName.JUPITER]: {
    name: VenueName.JUPITER,
    type: VenueType.RFQ,
    enabled: true,
    priority: 50,
    feeRate: 0.0,
    minTradeSize: 1,
    maxSlippage: 0.02,
  },
  [VenueName.METIS]: {
    name: VenueName.METIS,
    type: VenueType.RFQ,
    enabled: true,
    priority: 45,
    feeRate: 0.0,
    minTradeSize: 1,
    maxSlippage: 0.02,
  },
};

// ============================================================================
// LIQUIDITY DATA COLLECTOR
// ============================================================================

export class LiquidityDataCollector {
  private connection: Connection;
  private cache: Map<string, AggregatedLiquidity>;
  private cacheExpiryMs: number;

  constructor(connection: Connection, cacheExpiryMs = 10000) {
    this.connection = connection;
    this.cache = new Map();
    this.cacheExpiryMs = cacheExpiryMs;
  }

  /**
   * Fetch aggregated liquidity for a token pair from all venues
   */
  async fetchAggregatedLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    enabledVenues?: VenueName[]
  ): Promise<AggregatedLiquidity> {
    const cacheKey = `${inputMint}-${outputMint}-${inputAmount}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.cacheExpiryMs) {
      return {
        ...cached,
        staleness: Date.now() - cached.fetchedAt,
      };
    }

    // Fetch from all enabled venues in parallel
    const venuePromises = Object.values(VenueName)
      .filter((venue) => {
        const config = VENUE_CONFIGS[venue];
        if (!config.enabled) return false;
        if (enabledVenues && !enabledVenues.includes(venue)) return false;
        return true;
      })
      .map((venue) =>
        this.fetchVenueLiquidity(venue, inputMint, outputMint, inputAmount)
      );

    const sources = (await Promise.allSettled(venuePromises))
      .filter(
        (result): result is PromiseFulfilledResult<LiquiditySource> =>
          result.status === "fulfilled" && result.value !== null
      )
      .map((result) => result.value)
      .sort((a, b) => a.effectivePrice - b.effectivePrice); // Sort by best price

    // Calculate total depth
    const totalDepth = sources.reduce((sum, s) => sum + s.depth, 0);

    // Find best single venue
    const bestSingleVenue = sources[0]?.venue || VenueName.ORCA;

    const aggregated: AggregatedLiquidity = {
      tokenPair: [inputMint, outputMint],
      totalDepth,
      sources,
      bestSingleVenue,
      bestCombinedRoute: null as any, // Will be calculated by optimizer
      fetchedAt: Date.now(),
      staleness: 0,
    };

    // Cache result
    this.cache.set(cacheKey, aggregated);

    return aggregated;
  }

  /**
   * Fetch liquidity data from a specific venue
   */
  private async fetchVenueLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const config = VENUE_CONFIGS[venue];

    try {
      switch (config.type) {
        case VenueType.CLOB:
          return await this.fetchCLOBLiquidity(
            venue,
            inputMint,
            outputMint,
            inputAmount
          );

        case VenueType.AMM:
          return await this.fetchAMMLiquidity(
            venue,
            inputMint,
            outputMint,
            inputAmount
          );

        case VenueType.RFQ:
          return await this.fetchRFQLiquidity(
            venue,
            inputMint,
            outputMint,
            inputAmount
          );

        default:
          return null;
      }
    } catch (error) {
      console.warn(`Failed to fetch liquidity from ${venue}:`, error);
      return null;
    }
  }

  /**
   * Fetch CLOB (Phoenix, OpenBook) liquidity
   * Check top-of-book for immediate execution
   */
  private async fetchCLOBLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const config = VENUE_CONFIGS[venue];

    // Phoenix integration
    if (venue === VenueName.PHOENIX) {
      try {
        return await this.fetchPhoenixOrderbook(
          new PublicKey(inputMint),
          new PublicKey(outputMint)
        );
      } catch (error) {
        console.error("Phoenix orderbook fetch error:", error);
        return null;
      }
    }

    // OpenBook and other CLOBs not yet implemented
    // TODO: Implement OpenBook integration
    console.warn(`CLOB venue ${venue} not yet implemented`);
    return null;
  }

    /**
   * Fetch real-time orderbook from Phoenix CLOB
   */
  private async fetchPhoenixOrderbook(
    _inputMint: PublicKey,
    _outputMint: PublicKey
  ): Promise<LiquiditySource | null> {
    try {
      // TODO: Fix Phoenix integration types
      console.warn("Phoenix orderbook fetch temporarily disabled");
      return null;
      
      /* TEMPORARILY DISABLED
      const marketAddress = getPhoenixMarket(inputMint.toBase58(), outputMint.toBase58());
      if (!marketAddress) {
        return null;
      }

      // Check if Client.create exists (handles Vitest import issues)
      if (typeof PhoenixClient.create !== 'function') {
        console.warn("Phoenix Client.create not available - skipping Phoenix liquidity");
        return null;
      }

      const phoenixClient = await PhoenixClient.create(
        this.connection,
        false  // Don't skip initial fetch
      );
      
      // Add market to the client
      await phoenixClient.addMarket(marketAddress);

      const ladder = phoenixClient.getUiLadder(marketAddress);

      return {
        venue: VenueName.PHOENIX,
        venueType: VenueType.CLOB,
        price: ladder.bids[0]?.price || 0,
        liquidity: 0, // TODO: Calculate from ladder
        timestamp: Date.now(),
      };
      */
    } catch (error) {
      console.error("Phoenix orderbook fetch error:", error);
      return null;
    }
  }

  /**
   * Fetch AMM (Orca, Raydium) liquidity
   * Calculate based on xy=k formula with fees
   */
  private async fetchAMMLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const config = VENUE_CONFIGS[venue];

    // Orca Whirlpools integration
    if (venue === VenueName.ORCA) {
      try {
        return await this.fetchOrcaWhirlpool(
          inputMint,
          outputMint,
          inputAmount
        );
      } catch (error) {
        console.error("Orca whirlpool fetch error:", error);
        return null;
      }
    }

    // Raydium AMM integration
    if (venue === VenueName.RAYDIUM) {
      try {
        return await this.fetchRaydiumAmm(inputMint, outputMint, inputAmount);
      } catch (error) {
        console.error("Raydium AMM fetch error:", error);
        return null;
      }
    }

    // Fallback mock data for other AMMs
    const reserves = {
      input: 1000000,
      output: 500000,
    };

    const inputWithFee = inputAmount * (1 - config.feeRate);
    const outputAmount =
      (reserves.output * inputWithFee) / (reserves.input + inputWithFee);

    const spotPrice = reserves.output / reserves.input;
    const effectivePrice = inputAmount / outputAmount;
    const slippagePercent = (effectivePrice - spotPrice) / spotPrice;

    const feeAmount = inputAmount * config.feeRate;
    const depth = Math.min(reserves.input, reserves.output) * 2;

    return {
      venue,
      venueType: VenueType.AMM,
      tokenPair: [inputMint, outputMint],
      depth,
      reserves,
      effectivePrice,
      feeAmount,
      slippagePercent,
      route: [inputMint, outputMint],
      timestamp: Date.now(),
    };
  }

  /**
   * Fetch liquidity from Orca Whirlpools
   * Uses concentrated liquidity (tick-based pricing similar to Uniswap V3)
   */
  private async fetchOrcaWhirlpool(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    try {
      // Get Orca whirlpool for this pair
      const whirlpoolAddress = getOrcaWhirlpool(
        new PublicKey(inputMint),
        new PublicKey(outputMint)
      );

      if (!whirlpoolAddress) {
        console.warn(`No Orca whirlpool for ${inputMint}/${outputMint}`);
        return null;
      }

      // Fetch whirlpool account data
      const whirlpoolAccount =
        await this.connection.getAccountInfo(whirlpoolAddress);

      if (!whirlpoolAccount) {
        console.warn(
          `Orca whirlpool account not found: ${whirlpoolAddress.toBase58()}`
        );
        return null;
      }

      // Parse whirlpool data (concentrated liquidity model)
      // Note: Orca Whirlpools use tick-based pricing, similar to Uniswap V3
      // Full SDK integration would require WhirlpoolContext and Wallet
      // For real-time quotes, we parse the account data directly

      const data = whirlpoolAccount.data;

      // Whirlpool account layout (simplified - actual layout is more complex):
      // - liquidity: u128 at offset 65 (16 bytes)
      // - sqrtPrice: u128 at offset 81 (16 bytes)
      // - tickCurrentIndex: i32 at offset 97 (4 bytes)
      // - feeRate: u16 at offset 101 (2 bytes)

      // Read current tick price (concentrated liquidity)
      const sqrtPriceBuf = data.slice(81, 97); // Read 16 bytes for u128
      const sqrtPriceX64 = sqrtPriceBuf.readBigUInt64LE(0); // Lower 64 bits

      // Convert sqrt price to regular price
      // price = (sqrtPrice / 2^64)^2
      const sqrtPrice = Number(sqrtPriceX64) / Math.pow(2, 64);
      const currentPrice = Math.pow(sqrtPrice, 2);

      // Read liquidity
      const liquidityBuf = data.slice(65, 81);
      const liquidity = Number(liquidityBuf.readBigUInt64LE(0));

      // Read fee rate (basis points)
      const rawFeeRate = data.readUInt16LE(101);
      const feeRate = Math.min(rawFeeRate / 10000, 0.01); // Convert bps to decimal, cap at 1%

      console.log(
        `Orca Whirlpool: rawFeeRate=${rawFeeRate}, feeRate=${feeRate}`
      );

      // Calculate output amount with concentrated liquidity formula
      // For small trades, we can approximate with constant product
      const inputWithFee = inputAmount * (1 - feeRate);
      const outputAmount = inputWithFee * currentPrice;

      // Calculate price impact
      const effectivePrice = outputAmount / inputAmount;
      const slippagePercent =
        Math.abs(effectivePrice - currentPrice) / currentPrice;

      // Estimate depth (TVL in the pool) - use a more reasonable estimate for concentrated liquidity
      const depth = Math.min((liquidity * currentPrice * 2) / 1e12, 100000000); // Cap at 100M tokens, scale down

      const feeAmount = inputAmount * feeRate;

      return {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth,
        reserves: {
          input: liquidity,
          output: liquidity * currentPrice,
        },
        effectivePrice,
        feeAmount,
        slippagePercent,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        metadata: {
          orca: {
            whirlpoolAddress: whirlpoolAddress.toBase58(),
            sqrtPrice: sqrtPrice,
            currentPrice,
            liquidity,
            feeRate,
          },
        },
      };
    } catch (error) {
      console.error("Orca whirlpool fetch error:", error);
      return null;
    }
  }

  /**
   * Fetch liquidity from Raydium AMM
   * Uses constant product AMM (xy=k) similar to Uniswap V2
   */
  private async fetchRaydiumAmm(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    try {
      // Get Raydium pool for this pair
      const poolConfig = getRaydiumPool(
        new PublicKey(inputMint),
        new PublicKey(outputMint)
      );

      if (!poolConfig) {
        console.warn(`No Raydium pool for ${inputMint}/${outputMint}`);
        return null;
      }

      // Fetch AMM account data
      const ammAccount = await this.connection.getAccountInfo(
        poolConfig.ammAddress
      );

      if (!ammAccount) {
        console.warn(
          `Raydium AMM account not found: ${poolConfig.ammAddress.toBase58()}`
        );
        return null;
      }

      // Parse Raydium AMM account data
      // Raydium AMM account layout (simplified):
      // - status: u64 at offset 0
      // - nonce: u64 at offset 8
      // - orderNum: u64 at offset 16
      // - depth: u64 at offset 24
      // - coinDecimals: u64 at offset 32
      // - pcDecimals: u64 at offset 40
      // - state: u64 at offset 48
      // - resetFlag: u64 at offset 56
      // - minSize: u64 at offset 64
      // - volMaxCutRatio: u64 at offset 72
      // - amountWaveRatio: u64 at offset 80
      // - coinLotSize: u64 at offset 88
      // - pcLotSize: u64 at offset 96
      // - minPriceMultiplier: u64 at offset 104
      // - maxPriceMultiplier: u64 at offset 112
      // - systemDecimalValue: u64 at offset 120
      // - minSeparateNumerator: u64 at offset 128
      // - minSeparateDenominator: u64 at offset 136
      // - tradeFeeNumerator: u64 at offset 144
      // - tradeFeeDenominator: u64 at offset 152
      // - pnlNumerator: u64 at offset 160
      // - pnlDenominator: u64 at offset 168
      // - swapFeeNumerator: u64 at offset 176
      // - swapFeeDenominator: u64 at offset 184
      // - needTakePnlCoin: u64 at offset 192
      // - needTakePnlPc: u64 at offset 200
      // - totalPnlPc: u64 at offset 208
      // - totalPnlCoin: u64 at offset 216
      // - poolCoinTokenAccount: Pubkey at offset 224 (32 bytes)
      // - poolPcTokenAccount: Pubkey at offset 256 (32 bytes)
      // - coinMintAddress: Pubkey at offset 288 (32 bytes)
      // - pcMintAddress: Pubkey at offset 320 (32 bytes)
      // - lpMintAddress: Pubkey at offset 352 (32 bytes)
      // - ammOpenOrders: Pubkey at offset 384 (32 bytes)
      // - serumMarket: Pubkey at offset 416 (32 bytes)
      // - serumProgramId: Pubkey at offset 448 (32 bytes)
      // - ammTargetOrders: Pubkey at offset 480 (32 bytes)
      // - ammQuantities: Pubkey at offset 512 (32 bytes)
      // - poolWithdrawQueue: Pubkey at offset 544 (32 bytes)
      // - poolTempLpTokenAccount: Pubkey at offset 576 (32 bytes)
      // - ammOwner: Pubkey at offset 608 (32 bytes)
      // - poolLpTokenAccount: Pubkey at offset 640 (32 bytes)

      const data = ammAccount.data;

      // Read coin vault balance (token A)
      const coinVaultAccount = await this.connection.getTokenAccountBalance(
        poolConfig.poolCoinTokenAccount
      );
      const pcVaultAccount = await this.connection.getTokenAccountBalance(
        poolConfig.poolPcTokenAccount
      );

      if (!coinVaultAccount.value || !pcVaultAccount.value) {
        console.warn("Failed to fetch Raydium vault balances");
        return null;
      }

      const coinBalance = Number(coinVaultAccount.value.amount);
      const pcBalance = Number(pcVaultAccount.value.amount);
      const coinDecimals = coinVaultAccount.value.decimals;
      const pcDecimals = pcVaultAccount.value.decimals;

      // Convert to common decimal representation
      const coinAmount = coinBalance / Math.pow(10, coinDecimals);
      const pcAmount = pcBalance / Math.pow(10, pcDecimals);

      // Calculate spot price: pcAmount / coinAmount
      const spotPrice = pcAmount / coinAmount;

      // Determine if input is coin (tokenA) or pc (tokenB)
      const isInputCoin = poolConfig.tokenMintA.toBase58() === inputMint;
      const inputReserve = isInputCoin ? coinAmount : pcAmount;
      const outputReserve = isInputCoin ? pcAmount : coinAmount;

      // Calculate output amount using constant product formula
      const feeRate = poolConfig.feeBps / 10000; // Convert bps to decimal
      const inputWithFee = inputAmount * (1 - feeRate);
      const outputAmount =
        (outputReserve * inputWithFee) / (inputReserve + inputWithFee);

      // Calculate effective price and slippage
      const effectivePrice = outputAmount / inputAmount; // Price in output units per input unit
      const slippagePercent = Math.abs(effectivePrice - spotPrice) / spotPrice;

      console.log(
        `Raydium AMM: inputAmount=${inputAmount}, outputAmount=${outputAmount}, effectivePrice=${effectivePrice}, spotPrice=${spotPrice}`
      );

      const feeAmount = inputAmount * feeRate;
      const depth = Math.min(coinAmount, pcAmount) * spotPrice * 2; // TVL estimate

      return {
        venue: VenueName.RAYDIUM,
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth,
        reserves: {
          input: inputReserve,
          output: outputReserve,
        },
        effectivePrice,
        feeAmount,
        slippagePercent,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        metadata: {
          ammAddress: poolConfig.ammAddress.toBase58(),
          spotPrice,
          feeRate,
          coinBalance,
          pcBalance,
          coinDecimals,
          pcDecimals,
        },
      };
    } catch (error) {
      console.error("Raydium AMM fetch error:", error);
      return null;
    }
  }

  /**
   * Fetch RFQ (Jupiter, Metis) quote
   * These are aggregators that already do routing
   */
  private async fetchRFQLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const config = VENUE_CONFIGS[venue];

    // Jupiter v6 API integration
    if (venue === VenueName.JUPITER) {
      try {
        return await this.fetchJupiterQuote(inputMint, outputMint, inputAmount);
      } catch (error) {
        console.error("Jupiter API error:", error);
        return null;
      }
    }

    // For other RFQ venues (Metis, etc), return null for now
    // TODO: Implement Metis and other aggregator APIs
    console.warn(`RFQ venue ${venue} not yet implemented`);
    return null;
  }

  /**
   * Fetch quote from Jupiter v6 API
   * @see https://station.jup.ag/docs/apis/swap-api
   */
  private async fetchJupiterQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    try {
      // Convert amount to lamports/smallest unit (assuming 9 decimals for SOL)
      // In production, look up actual token decimals
      const amountInSmallestUnit = Math.floor(inputAmount * 1e9);

      // Jupiter v6 Quote API
      const url = new URL("https://quote-api.jup.ag/v6/quote");
      url.searchParams.append("inputMint", inputMint);
      url.searchParams.append("outputMint", outputMint);
      url.searchParams.append("amount", amountInSmallestUnit.toString());
      url.searchParams.append("slippageBps", "50"); // 0.5% slippage
      url.searchParams.append("onlyDirectRoutes", "false"); // Allow multi-hop

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.warn(
          `Jupiter API returned ${response.status}: ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();

      if (!data || !data.outAmount) {
        console.warn("Invalid Jupiter quote response:", data);
        return null;
      }

      // Parse Jupiter response
      const outputAmount = Number(data.outAmount) / 1e9; // Convert back to UI units
      const priceImpactPct = Number(data.priceImpactPct || 0);
      const routePlan = data.routePlan || [];

      // Extract route from Jupiter's route plan
      const route: string[] = [inputMint];
      for (const step of routePlan) {
        if (step.swapInfo?.outputMint) {
          route.push(step.swapInfo.outputMint);
        }
      }
      if (route[route.length - 1] !== outputMint) {
        route.push(outputMint);
      }

      // Calculate effective price
      const effectivePrice = inputAmount / outputAmount;

      // Jupiter fees are included in the quote
      const spotPrice = effectivePrice / (1 + priceImpactPct / 100);
      const feeAmount = inputAmount - inputAmount / effectivePrice;

      return {
        venue: VenueName.JUPITER,
        venueType: VenueType.RFQ,
        tokenPair: [inputMint, outputMint],
        depth: outputAmount * 10, // Jupiter has deep aggregated liquidity
        effectivePrice,
        feeAmount,
        slippagePercent: priceImpactPct / 100,
        route,
        timestamp: Date.now(),
        // Store raw Jupiter data for reference
        metadata: {
          jupiterQuote: {
            inAmount: data.inAmount,
            outAmount: data.outAmount,
            priceImpactPct: data.priceImpactPct,
            marketInfos: data.routePlan
              ?.map((r: any) => r.swapInfo?.label)
              .filter(Boolean),
          },
        },
      };
    } catch (error) {
      console.error("Jupiter quote fetch error:", error);
      return null;
    }
  }

  /**
   * Clear cache (useful for forcing refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get venue configuration
   */
  getVenueConfig(venue: VenueName): VenueConfig {
    return VENUE_CONFIGS[venue];
  }

  /**
   * Get all enabled venues sorted by priority
   */
  getEnabledVenues(): VenueName[] {
    return Object.values(VenueName)
      .filter((venue) => VENUE_CONFIGS[venue].enabled)
      .sort((a, b) => VENUE_CONFIGS[b].priority - VENUE_CONFIGS[a].priority);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate price impact for AMM swap
 */
export function calculatePriceImpact(
  inputAmount: number,
  reserveIn: number,
  reserveOut: number,
  feeRate: number
): number {
  const spotPrice = reserveOut / reserveIn;
  const inputWithFee = inputAmount * (1 - feeRate);
  const outputAmount = (reserveOut * inputWithFee) / (reserveIn + inputWithFee);
  const effectivePrice = inputAmount / outputAmount;

  return (effectivePrice - spotPrice) / spotPrice;
}

/**
 * Estimate output amount for AMM swap
 */
export function estimateAMMOutput(
  inputAmount: number,
  reserveIn: number,
  reserveOut: number,
  feeRate: number
): number {
  const inputWithFee = inputAmount * (1 - feeRate);
  return (reserveOut * inputWithFee) / (reserveIn + inputWithFee);
}

/**
 * Check if liquidity source is stale
 */
export function isLiquidityStale(
  source: LiquiditySource,
  maxAgeMs = 10000
): boolean {
  return Date.now() - source.timestamp > maxAgeMs;
}
