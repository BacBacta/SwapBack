import BN from "bn.js";
import { Connection, PublicKey } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import { LiquiditySource, VenueName, VenueType } from "../types/smart-router";
import {
  AdapterHealthConfig,
  AdapterHealthSnapshot,
  AdapterHealthTracker,
} from "./AdapterHealthTracker";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type DlmmInstance = InstanceType<typeof DLMM>;
type DlmmFactory = (
  address: string,
  connection: Connection
) => Promise<DlmmInstance>;

type MeteoraPoolEntry = {
  address: string;
  name?: string;
  mint_x: string;
  mint_y: string;
  reserve_x_amount?: number;
  reserve_y_amount?: number;
  bin_step?: number;
  liquidity?: string | number;
  trade_volume_24h?: string | number;
};

type MeteoraServiceOptions = {
  enabled?: boolean;
  registryUrl?: string;
  slippageBps?: number;
  registryTtlMs?: number;
  fetcher?: FetchLike;
  dlmmFactory?: DlmmFactory;
  health?: AdapterHealthConfig;
};

const DEFAULT_REGISTRY_URL =
  process.env.NEXT_PUBLIC_METEORA_POOL_REGISTRY_URL ??
  "https://dlmm-api.meteora.ag/pair/all";
const METEORA_ENABLED =
  (process.env.NEXT_PUBLIC_ENABLE_METEORA ?? "true").toLowerCase() !==
  "false";
const DEFAULT_SLIPPAGE_BPS = Number(
  process.env.NEXT_PUBLIC_METEORA_SLIPPAGE_BPS ?? 50
);
const DEFAULT_REGISTRY_TTL_MS = Number(
  process.env.NEXT_PUBLIC_METEORA_POOL_CACHE_MS ?? 5 * 60 * 1000
);

export class MeteoraService {
  private readonly connection: Connection | null;
  private readonly enabled: boolean;
  private readonly registryUrl: string;
  private readonly slippageBps: number;
  private readonly registryTtlMs: number;
  private readonly fetcher: FetchLike;
  private readonly dlmmFactory: DlmmFactory;
  private readonly healthTracker: AdapterHealthTracker;

  private registryPromise?: Promise<MeteoraPoolEntry[]>;
  private registryFetchedAt = 0;
  private registryCache: MeteoraPoolEntry[] | null = null;
  private dlmmCache = new Map<string, Promise<DlmmInstance>>();
  private readonly zero = new BN(0);

  constructor(
    connection: Connection | null,
    options: MeteoraServiceOptions = {}
  ) {
    this.connection = connection ?? null;
    this.enabled = options.enabled ?? METEORA_ENABLED;
    this.registryUrl = (options.registryUrl ?? DEFAULT_REGISTRY_URL).replace(
      /\/$/,
      ""
    );
    this.slippageBps = options.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
    this.registryTtlMs = options.registryTtlMs ?? DEFAULT_REGISTRY_TTL_MS;
    this.fetcher =
      options.fetcher ??
      ((input, init) => {
        if (typeof fetch !== "function") {
          throw new Error("global fetch is not available");
        }
        return fetch(input, init);
      });
    this.dlmmFactory =
      options.dlmmFactory ??
      ((address, connectionCtx) => {
        if (!connectionCtx) {
          return Promise.reject(
            new Error("MeteoraService requires a Solana connection")
          );
        }
        return DLMM.create(connectionCtx, new PublicKey(address));
      });
    this.healthTracker = new AdapterHealthTracker(options.health);
  }

  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    if (
      !this.enabled ||
      !this.connection ||
      inputAmount <= 0 ||
      !this.healthTracker.canAttempt()
    ) {
      return null;
    }

    const pools = await this.findCandidatePools(inputMint, outputMint);
    const startedAt = Date.now();

    for (const pool of pools) {
      try {
        const source = await this.quotePool(
          pool,
          inputMint,
          outputMint,
          inputAmount
        );
        if (source) {
          this.healthTracker.markSuccess(Date.now() - startedAt);
          const health = this.healthTracker.getHealth();
          return {
            ...source,
            metadata: {
              ...(source.metadata ?? {}),
              health: health.status,
              latencyMs: health.lastLatencyMs,
            },
          };
        }
      } catch (error) {
        console.warn("[meteora] pool_quote_failed", {
          pool: pool.address,
          error,
        });
        this.healthTracker.markFailure(error);
      }
    }

    if (pools.length) {
      this.healthTracker.markFailure("no_pool_produced_quote");
    }

    return null;
  }

  private async quotePool(
    pool: MeteoraPoolEntry,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const direction = this.resolveDirection(pool, inputMint, outputMint);
    if (!direction) {
      return null;
    }

    const dlmm = await this.getDlmm(pool.address);
    const swapForY = direction === "xToY";
    const inputDecimals = swapForY
      ? dlmm.tokenX.mint.decimals
      : dlmm.tokenY.mint.decimals;
    const outputDecimals = swapForY
      ? dlmm.tokenY.mint.decimals
      : dlmm.tokenX.mint.decimals;
    const lamportsIn = this.toLamports(inputAmount, inputDecimals);

    if (lamportsIn.lte(this.zero)) {
      return null;
    }

    const binArrays = await dlmm.getBinArrayForSwap(swapForY);
    const quote = await dlmm.swapQuote(
      lamportsIn,
      swapForY,
      new BN(this.slippageBps),
      binArrays
    );

    const normalizedInput = this.bnToNumber(
      quote.consumedInAmount ?? lamportsIn,
      inputDecimals
    );
    const normalizedOutput = this.bnToNumber(quote.outAmount, outputDecimals);

    if (normalizedInput <= 0 || normalizedOutput <= 0) {
      return null;
    }

    const feeAmount = this.bnToNumber(quote.fee ?? this.zero, inputDecimals);
    const slippagePercent = this.normalizePercent(quote.priceImpact);
    const reserves = this.extractReserves(dlmm, swapForY);
    const depth = this.estimateDepth(reserves, pool, swapForY);

    return {
      venue: VenueName.METEORA,
      venueType: VenueType.AMM,
      tokenPair: [inputMint, outputMint],
      depth,
      reserves: reserves ?? undefined,
      effectivePrice: normalizedInput / normalizedOutput,
      feeAmount,
      slippagePercent,
      route: [inputMint, outputMint],
      timestamp: Date.now(),
      metadata: {
        meteora: {
          pool: pool.address,
          swapForY,
          registryLiquidity: this.toNumber(pool.liquidity),
          priceImpactPct: slippagePercent * 100,
          binStep: dlmm.lbPair.binStep,
        },
      },
    };
  }

  private resolveDirection(
    pool: MeteoraPoolEntry,
    inputMint: string,
    outputMint: string
  ): "xToY" | "yToX" | null {
    if (pool.mint_x === inputMint && pool.mint_y === outputMint) {
      return "xToY";
    }

    if (pool.mint_y === inputMint && pool.mint_x === outputMint) {
      return "yToX";
    }

    return null;
  }

  private async findCandidatePools(
    inputMint: string,
    outputMint: string
  ): Promise<MeteoraPoolEntry[]> {
    const registry = await this.loadRegistry();
    this.registryCache = registry;
    return registry
      .filter((pool) => this.resolveDirection(pool, inputMint, outputMint))
      .sort((a, b) => this.toNumber(b.liquidity) - this.toNumber(a.liquidity));
  }

  private async loadRegistry(): Promise<MeteoraPoolEntry[]> {
    const now = Date.now();
    const shouldRefresh =
      !this.registryPromise || now - this.registryFetchedAt > this.registryTtlMs;

    if (!shouldRefresh) {
      return this.registryPromise!;
    }

    this.registryFetchedAt = now;
    this.registryPromise = this.downloadRegistry()
      .then((registry) => {
        this.registryCache = registry;
        return registry;
      })
      .catch((error) => {
        this.registryPromise = undefined;
        throw error;
      });

    return this.registryPromise;
  }

  private async downloadRegistry(): Promise<MeteoraPoolEntry[]> {
    const response = await this.fetcher(this.registryUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Unable to refresh Meteora registry (${response.status})`
      );
    }

    const payload = (await response.json()) as
      | MeteoraPoolEntry[]
      | { data?: MeteoraPoolEntry[] };

    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.data)) {
      return payload.data;
    }

    return [];
  }

  private async getDlmm(address: string): Promise<DlmmInstance> {
    let cached = this.dlmmCache.get(address);
    if (!cached) {
      if (!this.connection) {
        throw new Error("MeteoraService requires a Solana connection");
      }

      cached = this.dlmmFactory(address, this.connection).catch((error) => {
        this.dlmmCache.delete(address);
        throw error;
      });

      this.dlmmCache.set(address, cached);
    }

    return cached;
  }

  private estimateDepth(
    reserves: { input: number; output: number } | null,
    pool: MeteoraPoolEntry,
    swapForY: boolean
  ): number {
    if (reserves) {
      const minSide = Math.min(reserves.input, reserves.output);
      return Number.isFinite(minSide) && minSide > 0 ? minSide * 2 : 0;
    }

    const registryInput = swapForY
      ? this.toNumber(pool.reserve_x_amount)
      : this.toNumber(pool.reserve_y_amount);
    const registryOutput = swapForY
      ? this.toNumber(pool.reserve_y_amount)
      : this.toNumber(pool.reserve_x_amount);

    if (!registryInput || !registryOutput) {
      return 0;
    }

    return Math.min(registryInput, registryOutput);
  }

  private extractReserves(
    dlmm: DlmmInstance,
    swapForY: boolean
  ): { input: number; output: number } | null {
    const reserveX = this.bigintToNumber(
      dlmm.tokenX.amount,
      dlmm.tokenX.mint.decimals
    );
    const reserveY = this.bigintToNumber(
      dlmm.tokenY.amount,
      dlmm.tokenY.mint.decimals
    );

    if (!Number.isFinite(reserveX) || !Number.isFinite(reserveY)) {
      return null;
    }

    return swapForY
      ? { input: reserveX, output: reserveY }
      : { input: reserveY, output: reserveX };
  }

  private toLamports(amount: number, decimals: number): BN {
    const multiplier = Math.pow(10, decimals);
    const lamports = Math.max(0, Math.floor(amount * multiplier));
    return new BN(lamports.toString());
  }

  private bnToNumber(value: BN | undefined, decimals: number): number {
    if (!value) {
      return 0;
    }

    const raw = Number(value.toString(10));
    return raw / Math.pow(10, decimals);
  }

  private bigintToNumber(value: bigint, decimals: number): number {
    const raw = Number(value);
    return raw / Math.pow(10, decimals);
  }

  private normalizePercent(value: unknown): number {
    const numeric = this.toNumber(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return numeric / 100;
  }

  private toNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      "toNumber" in value &&
      typeof (value as { toNumber: () => number }).toNumber === "function"
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }

    if (
      typeof value === "object" &&
      value !== null &&
      "toString" in value &&
      typeof (value as { toString: () => string }).toString === "function"
    ) {
      const parsed = Number(
        (value as { toString: () => string }).toString()
      );
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    return 0;
  }

  supportsPair(inputMint: string, outputMint: string): boolean {
    if (!this.registryCache || this.registryCache.length === 0) {
      return true;
    }

    return this.registryCache.some(
      (pool) => this.resolveDirection(pool, inputMint, outputMint) !== null
    );
  }

  getHealth(): AdapterHealthSnapshot {
    return this.healthTracker.getHealth();
  }
}
