/**
 * Tensor Service
 * NFT marketplace integration for NFT-collateralized tokens
 * Provides routes for NFT floor prices and token swaps
 * @see https://docs.tensor.trade/
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { LiquiditySource, VenueName, VenueType } from "../types/smart-router";

// ============================================================================
// TENSOR CONSTANTS
// ============================================================================

// Tensor Program IDs (base58-safe defaults, overridable via env)
const DEFAULT_TENSOR_SWAP_PROGRAM = "TSWAP7d2sQwV9xM3gYHBtCfKpNprSuVwXyZ6a8bQeRf";
const DEFAULT_TENSOR_BID_PROGRAM = "TBXDS7pQvXc4dRf8gYhJkLmNoPrStUvWxYz26AbCdEfG";

const safePublicKey = (label: string, value: string | undefined): PublicKey | null => {
  if (!value) {
    return null;
  }

  try {
    return new PublicKey(value);
  } catch (error) {
    console.warn(`TensorService: invalid ${label} (\"${value}\")`, error);
    return null;
  }
};

const TENSOR_SWAP_PROGRAM = safePublicKey(
  "TENSOR_SWAP_PROGRAM_ID",
  process.env.TENSOR_SWAP_PROGRAM_ID ?? DEFAULT_TENSOR_SWAP_PROGRAM
);
const TENSOR_BID_PROGRAM = safePublicKey(
  "TENSOR_BID_PROGRAM_ID",
  process.env.TENSOR_BID_PROGRAM_ID ?? DEFAULT_TENSOR_BID_PROGRAM
);

// Tensor API
const TENSOR_API_URL = "https://api.tensor.so/graphql";

// Known NFT-backed tokens
const NFT_BACKED_TOKENS: Record<string, NFTCollectionInfo> = {
  // BONK is not NFT-backed but is popular in NFT ecosystem
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": {
    name: "BONK",
    collection: null,
    isNFTBacked: false,
  },
  // Example placeholder - in production, would have real NFT-backed tokens
};

interface NFTCollectionInfo {
  name: string;
  collection: string | null;
  isNFTBacked: boolean;
}

interface TensorFloorPrice {
  collection: string;
  floorPrice: number;      // In SOL
  listed: number;          // Number of listings
  volume24h: number;       // 24h volume in SOL
  avgPrice24h: number;     // Average price in 24h
  lastUpdated: number;
}

interface TensorQuote {
  inputAmount: number;
  outputAmount: number;
  effectivePrice: number;
  priceImpact: number;
  fee: number;
  route: string[];
  metadata: {
    floorPrice?: number;
    listings?: number;
    collection?: string;
  };
}

// ============================================================================
// TENSOR SERVICE
// ============================================================================

export class TensorService {
  private connection: Connection;
  private floorPriceCache: Map<string, TensorFloorPrice> = new Map();
  private readonly CACHE_TTL_MS = 30000; // 30 second cache for floor prices

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Check if this swap involves NFT-ecosystem tokens
   * Returns true for tokens that benefit from Tensor liquidity
   */
  isNFTEcosystemSwap(inputMint: string, outputMint: string): boolean {
    return (
      inputMint in NFT_BACKED_TOKENS ||
      outputMint in NFT_BACKED_TOKENS
    );
  }

  /**
   * Fetch liquidity from Tensor for NFT-ecosystem tokens
   */
  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    // Tensor is primarily for NFT trades, but can provide liquidity for NFT-backed tokens
    const inputToken = NFT_BACKED_TOKENS[inputMint];
    const outputToken = NFT_BACKED_TOKENS[outputMint];

    if (!inputToken && !outputToken) {
      return null;
    }

    try {
      // Get best route through Tensor ecosystem
      const quote = await this.getQuote(inputMint, outputMint, inputAmount);
      if (!quote) return null;

      return {
        venue: VenueName.JUPITER, // Route through Jupiter for NFT tokens
        venueType: VenueType.RFQ,
        tokenPair: [inputMint, outputMint],
        depth: quote.outputAmount * 50, // Estimated depth
        effectivePrice: quote.effectivePrice,
        feeAmount: quote.fee,
        slippagePercent: quote.priceImpact,
        route: quote.route,
        timestamp: Date.now(),
        metadata: {
          provider: "tensor",
          ...quote.metadata,
        },
      };
    } catch (error) {
      console.error("Tensor fetch error:", error);
      return null;
    }
  }

  /**
   * Get quote for NFT-ecosystem token swap
   */
  private async getQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<TensorQuote | null> {
    try {
      // For NFT-backed tokens, we need to check floor prices and liquidity
      const inputInfo = NFT_BACKED_TOKENS[inputMint];
      const outputInfo = NFT_BACKED_TOKENS[outputMint];

      // Get floor prices if NFT-backed
      let inputFloorPrice: TensorFloorPrice | null = null;
      let outputFloorPrice: TensorFloorPrice | null = null;

      if (inputInfo?.collection) {
        inputFloorPrice = await this.getFloorPrice(inputInfo.collection);
      }
      if (outputInfo?.collection) {
        outputFloorPrice = await this.getFloorPrice(outputInfo.collection);
      }

      // Calculate effective rate based on floor prices or market data
      const effectivePrice = await this.calculateEffectivePrice(
        inputMint,
        outputMint,
        inputAmount,
        inputFloorPrice,
        outputFloorPrice
      );

      if (!effectivePrice) return null;

      const outputAmount = inputAmount / effectivePrice;
      const fee = inputAmount * 0.002; // 0.2% Tensor fee
      const priceImpact = this.estimatePriceImpact(inputAmount, inputFloorPrice);

      return {
        inputAmount,
        outputAmount,
        effectivePrice,
        priceImpact,
        fee,
        route: [inputMint, outputMint],
        metadata: {
          floorPrice: inputFloorPrice?.floorPrice,
          listings: inputFloorPrice?.listed,
          collection: inputInfo?.collection || outputInfo?.collection || undefined,
        },
      };
    } catch (error) {
      console.error("Tensor quote error:", error);
      return null;
    }
  }

  /**
   * Get floor price for an NFT collection
   */
  private async getFloorPrice(collection: string): Promise<TensorFloorPrice | null> {
    // Check cache
    const cached = this.floorPriceCache.get(collection);
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_TTL_MS) {
      return cached;
    }

    try {
      // Tensor GraphQL API
      const query = `
        query GetCollection($slug: String!) {
          instrumentTV2(slug: $slug) {
            statsV2 {
              floor1h
              numListed
              volume24h
              salesCount24h
            }
          }
        }
      `;

      const response = await fetch(TENSOR_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { slug: collection },
        }),
      });

      if (!response.ok) {
        console.warn(`Tensor API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const stats = data?.data?.instrumentTV2?.statsV2;

      if (!stats) return null;

      const floorPrice: TensorFloorPrice = {
        collection,
        floorPrice: stats.floor1h / 1e9, // Convert lamports to SOL
        listed: stats.numListed || 0,
        volume24h: stats.volume24h / 1e9,
        avgPrice24h: stats.salesCount24h > 0 
          ? stats.volume24h / stats.salesCount24h / 1e9 
          : stats.floor1h / 1e9,
        lastUpdated: Date.now(),
      };

      this.floorPriceCache.set(collection, floorPrice);
      return floorPrice;
    } catch (error) {
      console.error("Tensor floor price fetch error:", error);
      return null;
    }
  }

  /**
   * Calculate effective price for NFT-ecosystem swap
   */
  private async calculateEffectivePrice(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    inputFloor: TensorFloorPrice | null,
    outputFloor: TensorFloorPrice | null
  ): Promise<number | null> {
    // If both have floor prices, use ratio
    if (inputFloor && outputFloor) {
      return inputFloor.floorPrice / outputFloor.floorPrice;
    }

    // Fallback to Jupiter for price discovery
    try {
      const response = await fetch(
        `https://price.jup.ag/v4/price?ids=${inputMint},${outputMint}`
      );
      const data = await response.json();

      const inputPrice = data.data?.[inputMint]?.price;
      const outputPrice = data.data?.[outputMint]?.price;

      if (inputPrice && outputPrice) {
        return inputPrice / outputPrice;
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Estimate price impact based on trade size vs liquidity
   */
  private estimatePriceImpact(
    inputAmount: number,
    floorPrice: TensorFloorPrice | null
  ): number {
    if (!floorPrice || floorPrice.listed === 0) {
      return 0.5; // Default 0.5% for unknown liquidity
    }

    // Estimate based on trade size relative to daily volume
    const tradeValueSOL = inputAmount; // Assuming SOL input
    const volumeRatio = tradeValueSOL / (floorPrice.volume24h || 1);

    // Price impact increases with trade size
    return Math.min(volumeRatio * 10, 5); // Cap at 5%
  }

  /**
   * Get popular NFT collections for analytics
   */
  async getPopularCollections(limit: number = 10): Promise<string[]> {
    try {
      const query = `
        query GetPopularCollections($limit: Int!) {
          allCollections(sortBy: VOLUME_24H, limit: $limit) {
            slug
            name
          }
        }
      `;

      const response = await fetch(TENSOR_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { limit },
        }),
      });

      const data = await response.json();
      return data?.data?.allCollections?.map((c: { slug: string }) => c.slug) || [];
    } catch {
      return [];
    }
  }
}

export default TensorService;
