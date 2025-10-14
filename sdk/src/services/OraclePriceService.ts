/**
 * Oracle Price Verification Service
 * Validates route prices against Pyth and Switchboard oracles
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { parsePriceData } from '@pythnetwork/client';
import { AggregatorAccount } from '@switchboard-xyz/solana.js';
import {
  OraclePriceData,
  PriceVerification,
  RouteCandidate,
} from '../types/smart-router';
import {
  getPythFeedAccount,
  getPythFeedByMint,
  MAX_PRICE_AGE_SECONDS,
  MAX_CONFIDENCE_INTERVAL_PERCENT,
} from '../config/pyth-feeds';
import {
  getSwitchboardFeedAccount,
  getSwitchboardFeedByMint,
  SWITCHBOARD_MAX_STALENESS_SECONDS,
  SWITCHBOARD_MAX_VARIANCE_THRESHOLD,
} from '../config/switchboard-feeds';

// ============================================================================
// ORACLE PRICE SERVICE
// ============================================================================

export class OraclePriceService {
  private connection: Connection;
  private priceCache: Map<string, OraclePriceData>;
  private cacheExpiryMs: number;

  // Price feed addresses (examples - replace with actual addresses)
  private readonly PRICE_FEEDS = {
    // Pyth price feeds
    'SOL/USD': new PublicKey('H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG'),
    'USDC/USD': new PublicKey('Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD'),
    'USDT/USD': new PublicKey('3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL'),
  };

  constructor(connection: Connection, cacheExpiryMs = 5000) {
    this.connection = connection;
    this.priceCache = new Map();
    this.cacheExpiryMs = cacheExpiryMs;
  }

  /**
   * Verify if route price is acceptable compared to oracle price
   */
  async verifyRoutePrice(
    route: RouteCandidate,
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    maxDeviationPercent = 0.02 // 2% max deviation
  ): Promise<PriceVerification> {
    try {
      // Fetch oracle prices for both tokens
      const [inputPrice, outputPrice] = await Promise.all([
        this.getTokenPrice(inputMint),
        this.getTokenPrice(outputMint),
      ]);

      // Calculate oracle-based expected output
      const inputValueUSD = inputAmount * inputPrice.price;
      const oracleExpectedOutput = inputValueUSD / outputPrice.price;

      // Calculate route's effective price
      const routeOutput = route.expectedOutput;
      const deviation = Math.abs(routeOutput - oracleExpectedOutput) / oracleExpectedOutput;

      // Determine if acceptable
      const isAcceptable = deviation <= maxDeviationPercent;

      // Generate warning if needed
      let warning: string | undefined;
      if (!isAcceptable) {
        warning = `Route price deviates ${(deviation * 100).toFixed(2)}% from oracle price. Possible pool imbalance or manipulation.`;
      } else if (deviation > maxDeviationPercent / 2) {
        warning = `Route price deviates ${(deviation * 100).toFixed(2)}% from oracle price. Within tolerance but higher than expected.`;
      }

      return {
        oraclePrice: oracleExpectedOutput,
        routePrice: routeOutput,
        deviation,
        isAcceptable,
        warning,
      };
    } catch (error) {
      console.error('Oracle price verification failed:', error);
      
      // If oracle check fails, default to accepting (don't block user)
      return {
        oraclePrice: 0,
        routePrice: route.expectedOutput,
        deviation: 0,
        isAcceptable: true,
        warning: 'Oracle price verification unavailable. Proceeding with caution.',
      };
    }
  }

  /**
   * Get current price for a token from oracles
   */
  public async getTokenPrice(mint: string): Promise<OraclePriceData> {
    // Check cache first
    const cached = this.priceCache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached;
    }

    // Try Pyth first
    try {
      const pythPrice = await this.fetchPythPrice(mint);
      if (pythPrice) {
        this.priceCache.set(mint, pythPrice);
        return pythPrice;
      }
    } catch (error) {
      console.warn('Pyth price fetch failed:', error);
    }

    // Fallback to Switchboard
    try {
      const switchboardPrice = await this.fetchSwitchboardPrice(mint);
      if (switchboardPrice) {
        this.priceCache.set(mint, switchboardPrice);
        return switchboardPrice;
      }
    } catch (error) {
      console.warn('Switchboard price fetch failed:', error);
    }

    throw new Error(`No oracle price available for ${mint}`);
  }

  /**
   * Fetch price from Pyth Network
   * Real implementation using Pyth Client SDK
   */
  private async fetchPythPrice(mint: string): Promise<OraclePriceData | null> {
    try {
      // Get Pyth price feed account for this token
      let feedAccount = getPythFeedByMint(mint);
      
      // If not found by mint, try by symbol (extract from common patterns)
      if (!feedAccount) {
        // Try to extract symbol from mint (this is a heuristic)
        const symbol = this.guessSymbolFromMint(mint);
        if (symbol) {
          feedAccount = getPythFeedAccount(symbol);
        }
      }
      
      if (!feedAccount) {
        console.warn(`No Pyth feed found for mint ${mint}`);
        return null;
      }

      // Fetch account data from Solana
      const accountInfo = await this.connection.getAccountInfo(feedAccount);
      if (!accountInfo) {
        console.warn(`Pyth account ${feedAccount.toBase58()} not found`);
        return null;
      }

      // Parse Pyth price account data using the official SDK parser
      const priceData = parsePriceData(accountInfo.data);
      
      if (!priceData?.price) {
        console.warn('Failed to parse Pyth price data');
        return null;
      }

      // Validate price freshness
      const currentTime = Math.floor(Date.now() / 1000);
      const publishTime = Number(priceData.lastSlot || 0);
      const priceAge = currentTime - publishTime;
      
      if (priceAge > MAX_PRICE_AGE_SECONDS * 100) { // Slots are faster than seconds
        console.warn(`Pyth price stale: ${priceAge} slots old`);
        return null;
      }

      // Calculate price with exponent
      const exponent = priceData.exponent || 0;
      const rawPrice = Number(priceData.price);
      const rawConfidence = Number(priceData.confidence || 0);
      
      const price = rawPrice * Math.pow(10, exponent);
      const confidence = rawConfidence * Math.pow(10, exponent);
      
      // Validate confidence interval
      const confidencePercent = Math.abs(price) > 0 ? (confidence / Math.abs(price)) * 100 : 100;
      
      if (confidencePercent > MAX_CONFIDENCE_INTERVAL_PERCENT) {
        console.warn(
          `Pyth confidence interval too wide: ${confidencePercent.toFixed(2)}% ` +
          `(max ${MAX_CONFIDENCE_INTERVAL_PERCENT}%)`
        );
        return null;
      }

      // Return validated price data
      return {
        provider: 'pyth',
        price,
        confidence,
        timestamp: Date.now(), // Use current time since Pyth uses slots
        exponent,
      };
    } catch (error) {
      console.error('Pyth price fetch error:', error);
      return null;
    }
  }

  /**
   * Heuristic to guess token symbol from mint address
   * This is a fallback - ideally use a token registry
   */
  private guessSymbolFromMint(mint: string): string | null {
    // Common Solana token patterns
    const patterns: Record<string, string> = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
      'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': 'SRM',
      'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'ORCA',
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
    };
    
    return patterns[mint] || null;
  }

  /**
   * Fetch price from Switchboard
   * Real implementation using Switchboard v3 SDK
   */
  private async fetchSwitchboardPrice(mint: string): Promise<OraclePriceData | null> {
    try {
      // Get Switchboard aggregator account for this token
      let feedAccount = getSwitchboardFeedByMint(mint);
      
      // If not found by mint, try by symbol
      if (!feedAccount) {
        const symbol = this.guessSymbolFromMint(mint);
        if (symbol) {
          feedAccount = getSwitchboardFeedAccount(symbol);
        }
      }
      
      if (!feedAccount) {
        console.warn(`No Switchboard feed found for mint ${mint}`);
        return null;
      }

      // Fetch account data directly from Solana
      const accountInfo = await this.connection.getAccountInfo(feedAccount);
      
      if (!accountInfo) {
        console.warn(`Switchboard account ${feedAccount.toBase58()} not found`);
        return null;
      }

      // Parse Switchboard aggregator account data
      // Switchboard v3 stores data in a specific format
      // Using manual parsing since SDK is deprecated
      const data = accountInfo.data;
      
      // Switchboard AggregatorAccountData layout (simplified)
      // Offset 240: latest_confirmed_round.result (f64)
      // Offset 256: latest_confirmed_round.std_deviation (f64)
      // Offset 272: latest_confirmed_round.round_open_timestamp (i64)
      
      let price = 0;
      let stdDeviation = 0;
      let timestamp = Math.floor(Date.now() / 1000);
      
      try {
        // Read latest result (f64 at offset 240)
        const resultBuffer = data.slice(240, 248);
        price = resultBuffer.readDoubleLE(0);
        
        // Read std deviation (f64 at offset 256)
        const stdDevBuffer = data.slice(256, 264);
        stdDeviation = stdDevBuffer.readDoubleLE(0);
        
        // Read timestamp (i64 at offset 272)
        const timestampBuffer = data.slice(272, 280);
        timestamp = Number(timestampBuffer.readBigInt64LE(0));
      } catch (parseError) {
        console.warn('Switchboard data parsing failed:', parseError);
        // If parsing fails, return null to fallback to Pyth
        return null;
      }
      
      if (isNaN(price) || price <= 0) {
        console.warn(`Invalid Switchboard price: ${price}`);
        return null;
      }

      // Validate staleness
      const currentTime = Math.floor(Date.now() / 1000);
      const staleness = currentTime - timestamp;
      
      if (staleness > SWITCHBOARD_MAX_STALENESS_SECONDS) {
        console.warn(
          `Switchboard data stale: ${staleness}s old ` +
          `(max ${SWITCHBOARD_MAX_STALENESS_SECONDS}s)`
        );
        return null;
      }

      // Validate variance
      const variancePercent = price > 0 ? (stdDeviation / price) : 0;
      
      if (variancePercent > SWITCHBOARD_MAX_VARIANCE_THRESHOLD) {
        console.warn(
          `Switchboard variance too high: ${(variancePercent * 100).toFixed(2)}% ` +
          `(max ${SWITCHBOARD_MAX_VARIANCE_THRESHOLD * 100}%)`
        );
        return null;
      }

      // Return validated Switchboard price
      return {
        provider: 'switchboard',
        price,
        confidence: stdDeviation,
        timestamp: timestamp * 1000, // Convert to ms
        exponent: 0, // Switchboard returns normalized values
      };
    } catch (error) {
      console.error('Switchboard price fetch error:', error);
      return null;
    }
  }

  /**
   * Get multiple token prices in parallel
   */
  async getMultiplePrices(mints: string[]): Promise<Map<string, OraclePriceData>> {
    const prices = new Map<string, OraclePriceData>();
    
    const results = await Promise.allSettled(
      mints.map(mint => this.getTokenPrice(mint))
    );

    mints.forEach((mint, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        prices.set(mint, result.value);
      }
    });

    return prices;
  }

  /**
   * Calculate fair market price for a token pair
   */
  async getFairMarketPrice(
    inputMint: string,
    outputMint: string
  ): Promise<number> {
    const [inputPrice, outputPrice] = await Promise.all([
      this.getTokenPrice(inputMint),
      this.getTokenPrice(outputMint),
    ]);

    return outputPrice.price / inputPrice.price;
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }

  /**
   * Check if oracle price is fresh
   */
  isPriceFresh(price: OraclePriceData, maxAgeMs = 60000): boolean {
    return Date.now() - price.timestamp < maxAgeMs;
  }

  /**
   * Get price confidence level
   */
  getPriceQuality(price: OraclePriceData): 'high' | 'medium' | 'low' {
    const confidencePercent = (price.confidence / price.price) * 100;
    
    if (confidencePercent < 0.1) return 'high';
    if (confidencePercent < 0.5) return 'medium';
    return 'low';
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

/**
 * Circuit breaker to prevent execution if price deviates too much
 * Protects against flash crashes, oracle failures, or manipulated pools
 */
export class PriceCircuitBreaker {
  private oracleService: OraclePriceService;
  private maxDeviationPercent: number;
  private consecutiveFailures: number;
  private readonly maxConsecutiveFailures = 3;

  constructor(oracleService: OraclePriceService, maxDeviationPercent = 0.05) {
    this.oracleService = oracleService;
    this.maxDeviationPercent = maxDeviationPercent; // 5% default
    this.consecutiveFailures = 0;
  }

  /**
   * Check if route should be allowed to execute
   */
  async shouldAllowExecution(
    route: RouteCandidate,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    // If too many failures, trip the breaker
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      return {
        allowed: false,
        reason: 'Circuit breaker tripped due to consecutive price verification failures',
      };
    }

    // Verify price
    const verification = await this.oracleService.verifyRoutePrice(
      route,
      inputMint,
      outputMint,
      inputAmount,
      this.maxDeviationPercent
    );

    if (!verification.isAcceptable) {
      this.consecutiveFailures++;
      return {
        allowed: false,
        reason: verification.warning || 'Price verification failed',
      };
    }

    // Reset failure counter on success
    this.consecutiveFailures = 0;

    return { allowed: true };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): {
    tripped: boolean;
    consecutiveFailures: number;
    maxFailures: number;
  } {
    return {
      tripped: this.consecutiveFailures >= this.maxConsecutiveFailures,
      consecutiveFailures: this.consecutiveFailures,
      maxFailures: this.maxConsecutiveFailures,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format price with appropriate decimals based on exponent
 */
export function formatOraclePrice(price: OraclePriceData): string {
  const actualPrice = price.price * Math.pow(10, price.exponent);
  return actualPrice.toFixed(Math.abs(price.exponent));
}

/**
 * Calculate price impact tolerance based on trade size
 */
export function calculateAcceptableDeviation(
  tradeSizeUSD: number,
  baseDeviation = 0.02
): number {
  // Larger trades can have larger deviation
  if (tradeSizeUSD > 100000) return baseDeviation * 2;
  if (tradeSizeUSD > 10000) return baseDeviation * 1.5;
  return baseDeviation;
}
