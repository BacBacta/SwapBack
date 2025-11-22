import { Connection, PublicKey } from "@solana/web3.js";
import { getRaydiumPool } from "../config/raydium-pools";
import {
  LiquiditySource,
  VenueName,
  VenueType,
} from "../types/smart-router";

const DEFAULT_CACHE_MS = Number(
  process.env.NEXT_PUBLIC_RAYDIUM_VAULT_CACHE_MS ?? 5000
);

export type RaydiumServiceOptions = {
  enabled?: boolean;
  cacheTtlMs?: number;
};

type CachedBalance = {
  amount: number;
  decimals: number;
  fetchedAt: number;
};

export class RaydiumService {
  private readonly connection: Connection | null;
  private readonly enabled: boolean;
  private readonly cacheTtlMs: number;
  private readonly balanceCache = new Map<string, CachedBalance>();

  constructor(connection: Connection | null, options: RaydiumServiceOptions = {}) {
    this.connection = connection ?? null;
    this.enabled = options.enabled ?? true;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_MS;
  }

  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    if (!this.enabled || !this.connection || inputAmount <= 0) {
      return null;
    }

    const pool = getRaydiumPool(
      new PublicKey(inputMint),
      new PublicKey(outputMint)
    );

    if (!pool) {
      return null;
    }

    try {
      const [coinVault, pcVault] = await Promise.all([
        this.getCachedBalance(pool.poolCoinTokenAccount),
        this.getCachedBalance(pool.poolPcTokenAccount),
      ]);

      if (coinVault.amount <= 0 || pcVault.amount <= 0) {
        return null;
      }

      const spotPriceRaw = pcVault.amount / coinVault.amount;
      const isInputCoin = pool.tokenMintA.toBase58() === inputMint;
      const inputReserve = isInputCoin ? coinVault.amount : pcVault.amount;
      const outputReserve = isInputCoin ? pcVault.amount : coinVault.amount;
      const spotPrice = isInputCoin
        ? spotPriceRaw
        : spotPriceRaw > 0
        ? 1 / spotPriceRaw
        : 0;
      const feeRate = pool.feeBps / 10000;
      const inputWithFee = inputAmount * (1 - feeRate);
      const outputAmount =
        (outputReserve * inputWithFee) / (inputReserve + inputWithFee);

      if (!Number.isFinite(outputAmount) || outputAmount <= 0) {
        return null;
      }

      const effectivePrice = outputAmount / inputAmount;
      const slippagePercent =
        spotPrice > 0
          ? Math.abs(effectivePrice - spotPrice) / spotPrice
          : 0;
      const feeAmount = inputAmount * feeRate;
      const reserves = {
        input: inputReserve,
        output: outputReserve,
      };
      const depth =
        Math.min(coinVault.amount * spotPriceRaw, pcVault.amount) * 2;

      return {
        venue: VenueName.RAYDIUM,
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth,
        reserves,
        effectivePrice,
        feeAmount,
        slippagePercent,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        metadata: {
          raydium: {
            ammAddress: pool.ammAddress.toBase58(),
            coinVault: pool.poolCoinTokenAccount.toBase58(),
            pcVault: pool.poolPcTokenAccount.toBase58(),
            feeBps: pool.feeBps,
            cacheAgeMs: this.getCacheAge(pool.poolCoinTokenAccount.toBase58()),
          },
        },
      };
    } catch (error) {
      console.warn("[raydium] quote_failed", {
        inputMint,
        outputMint,
        error,
      });
      return null;
    }
  }

  private async getCachedBalance(address: PublicKey): Promise<CachedBalance> {
    const key = address.toBase58();
    const cached = this.balanceCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached;
    }

    const balance = await this.connection!.getTokenAccountBalance(address);
    if (!balance.value) {
      throw new Error("Raydium vault balance unavailable");
    }

    const decimals = balance.value.decimals;
    const amount = parseFloat(
      balance.value.uiAmountString ?? `${balance.value.uiAmount ?? 0}`
    );
    const next: CachedBalance = {
      amount,
      decimals,
      fetchedAt: Date.now(),
    };
    this.balanceCache.set(key, next);
    return next;
  }

  private getCacheAge(key: string): number | null {
    const cached = this.balanceCache.get(key);
    if (!cached) {
      return null;
    }
    return Date.now() - cached.fetchedAt;
  }
}
