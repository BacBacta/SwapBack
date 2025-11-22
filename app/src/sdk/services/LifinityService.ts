import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import { AccountLayout, u64 } from "@solana/spl-token";
import {
  getAmountOut as lifinityGetAmountOut,
  getPoolList,
} from "@lifinity/sdk";
import { LiquiditySource, VenueName, VenueType } from "../types/smart-router";
import {
  AdapterHealthConfig,
  AdapterHealthSnapshot,
  AdapterHealthTracker,
} from "./AdapterHealthTracker";

const LIFINITY_ENABLED =
  (process.env.NEXT_PUBLIC_ENABLE_LIFINITY ?? "true").toLowerCase() !==
  "false";
const DEFAULT_SLIPPAGE_PERCENT = Number(
  process.env.NEXT_PUBLIC_LIFINITY_SLIPPAGE_PERCENT ?? 0.5
);
const DEFAULT_BALANCE_CACHE_MS = Number(
  process.env.NEXT_PUBLIC_LIFINITY_BALANCE_CACHE_MS ?? 60_000
);

type LifinityPoolMap = ReturnType<typeof getPoolList>;
type LifinityPoolInfo = LifinityPoolMap[keyof LifinityPoolMap];
type TokenAccountDescriptor = { address: string; decimals: number };

type LifinityQuoteFn = (
  connection: Connection,
  amountIn: number,
  fromMint: PublicKey,
  toMint: PublicKey,
  slippagePercent: number
) => Promise<LifinityQuote | undefined>;

type AccountInfoFetcher = (
  connection: Connection,
  addresses: PublicKey[]
) => Promise<(AccountInfo<Buffer> | null)[]>;

type BalanceResolver = (
  address: string,
  decimals: number
) => Promise<number>;

type LifinityQuote = {
  amountIn: number;
  amountOut: number;
  amountOutWithSlippage: number;
  fee: number;
  feePercent: number;
  priceImpact: number;
};

type LifinityServiceOptions = {
  enabled?: boolean;
  slippagePercent?: number;
  balanceCacheMs?: number;
  quoteFn?: LifinityQuoteFn;
  poolListProvider?: typeof getPoolList;
  accountInfoFetcher?: AccountInfoFetcher;
  balanceResolver?: BalanceResolver;
  health?: AdapterHealthConfig;
};

export class LifinityService {
  private readonly connection: Connection | null;
  private readonly enabled: boolean;
  private readonly slippagePercent: number;
  private readonly balanceCacheMs: number;
  private readonly quoteFn: LifinityQuoteFn;
  private readonly poolListProvider: typeof getPoolList;
  private readonly accountInfoFetcher: AccountInfoFetcher;
  private readonly balanceResolver: BalanceResolver | null;

  private balanceCache = new Map<string, { value: number; fetchedAt: number }>();
  private readonly healthTracker: AdapterHealthTracker;

  constructor(connection: Connection | null, options: LifinityServiceOptions = {}) {
    this.connection = connection ?? null;
    this.enabled = options.enabled ?? LIFINITY_ENABLED;
    this.slippagePercent = options.slippagePercent ?? DEFAULT_SLIPPAGE_PERCENT;
    this.balanceCacheMs = options.balanceCacheMs ?? DEFAULT_BALANCE_CACHE_MS;
    this.quoteFn = options.quoteFn ?? lifinityGetAmountOut;
    this.poolListProvider = options.poolListProvider ?? getPoolList;
    this.accountInfoFetcher =
      options.accountInfoFetcher ??
      ((conn, addresses) => conn.getMultipleAccountsInfo(addresses));
    this.balanceResolver = options.balanceResolver ?? null;
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

    const pools = this.findPools(inputMint, outputMint);
    const startedAt = Date.now();
    for (const pool of pools) {
      try {
        const source = await this.quotePool(pool, inputMint, outputMint, inputAmount);
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
        console.warn("[lifinity] pool_quote_failed", {
          pool: pool.amm,
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
    pool: LifinityPoolInfo,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const connection = this.connection;
    if (!connection) {
      return null;
    }

    const fromMint = new PublicKey(inputMint);
    const toMint = new PublicKey(outputMint);

    const quote = await this.quoteFn(
      connection,
      inputAmount,
      fromMint,
      toMint,
      this.slippagePercent
    );

    if (!quote || quote.amountOut <= 0) {
      return null;
    }

    const feeAmount = quote.fee ?? this.estimateFee(inputAmount, quote.feePercent);
    const slippagePercent = this.normalizePercent(quote.priceImpact);
    const poolReserves = await this.fetchReserves(pool);
    const orientedReserves = this.orientReserves(pool, poolReserves, inputMint);
    const depth = this.computeDepth(orientedReserves);

    return {
      venue: VenueName.LIFINITY,
      venueType: VenueType.AMM,
      tokenPair: [inputMint, outputMint],
      depth,
      reserves: orientedReserves ?? undefined,
      effectivePrice: inputAmount / quote.amountOut,
      feeAmount,
      slippagePercent,
      route: [inputMint, outputMint],
      timestamp: Date.now(),
      metadata: {
        lifinity: {
          pool: pool.amm,
          priceImpactPct: (quote.priceImpact ?? 0) / 100,
          amountOutWithSlippage: quote.amountOutWithSlippage,
        },
      },
    };
  }

  private findPools(inputMint: string, outputMint: string): LifinityPoolInfo[] {
    const poolMap = this.poolListProvider();
    return Object.values(poolMap).filter((pool) =>
      this.matchesPool(pool, inputMint, outputMint)
    );
  }

  private matchesPool(
    pool: LifinityPoolInfo,
    inputMint: string,
    outputMint: string
  ): boolean {
    return (
      (pool.poolCoinMint === inputMint && pool.poolPcMint === outputMint) ||
      (pool.poolCoinMint === outputMint && pool.poolPcMint === inputMint)
    );
  }

  private async fetchReserves(pool: LifinityPoolInfo): Promise<
    | {
        coin: number;
        pc: number;
      }
    | null
  > {
    if (!this.connection) {
      return null;
    }

    try {
      const [coin, pc] = await this.fetchTokenBalances([
        { address: pool.poolCoinTokenAccount, decimals: pool.poolCoinDecimal },
        { address: pool.poolPcTokenAccount, decimals: pool.poolPcDecimal },
      ]);

      if (!Number.isFinite(coin) || !Number.isFinite(pc)) {
        return null;
      }

      return { coin, pc };
    } catch (error) {
      console.warn("[lifinity] reserve_fetch_failed", {
        pool: pool.amm,
        error,
      });
      return null;
    }
  }

  private async fetchTokenBalances(
    descriptors: TokenAccountDescriptor[]
  ): Promise<number[]> {
    const now = Date.now();
    const results = new Array<number>(descriptors.length);
    const missing: Array<{ descriptor: TokenAccountDescriptor; index: number }>= [];

    descriptors.forEach((descriptor, index) => {
      const cached = this.balanceCache.get(descriptor.address);
      if (cached && now - cached.fetchedAt < this.balanceCacheMs) {
        results[index] = cached.value;
      } else {
        missing.push({ descriptor, index });
      }
    });

    if (!missing.length) {
      return results;
    }

    if (!this.connection) {
      throw new Error("LifinityService requires a Solana connection");
    }

    if (this.balanceResolver) {
      await Promise.all(
        missing.map(async ({ descriptor, index }) => {
          const value = await this.balanceResolver!(
            descriptor.address,
            descriptor.decimals
          );
          this.balanceCache.set(descriptor.address, {
            value,
            fetchedAt: now,
          });
          results[index] = value;
        })
      );
      return results;
    }

    const addresses = missing.map(({ descriptor }) =>
      new PublicKey(descriptor.address)
    );
    const accountInfos = await this.accountInfoFetcher(
      this.connection,
      addresses
    );

    missing.forEach(({ descriptor, index }, idx) => {
      const info = accountInfos[idx] ?? null;
      const value = this.decodeTokenBalance(info, descriptor.decimals);
      this.balanceCache.set(descriptor.address, { value, fetchedAt: now });
      results[index] = value;
    });

    return results;
  }

  private decodeTokenBalance(
    info: AccountInfo<Buffer> | null,
    decimals: number
  ): number {
    if (!info || !info.data) {
      return 0;
    }

    try {
      const decoded = AccountLayout.decode(info.data);
      const rawAmount = u64.fromBuffer(decoded.amount);
      return Number(rawAmount.toString()) / Math.pow(10, decimals);
    } catch (error) {
      console.warn("[lifinity] token_account_decode_failed", { error });
      return 0;
    }
  }

  private orientReserves(
    pool: LifinityPoolInfo,
    reserves: { coin: number; pc: number } | null,
    inputMint: string
  ): { input: number; output: number } | null {
    if (!reserves) {
      return null;
    }

    if (pool.poolCoinMint === inputMint) {
      return { input: reserves.coin, output: reserves.pc };
    }

    if (pool.poolPcMint === inputMint) {
      return { input: reserves.pc, output: reserves.coin };
    }

    return null;
  }

  private computeDepth(reserves: { input: number; output: number } | null): number {
    if (!reserves) {
      return 0;
    }
    const minSide = Math.min(reserves.input, reserves.output);
    return Number.isFinite(minSide) && minSide > 0 ? minSide * 2 : 0;
  }

  private estimateFee(amountIn: number, feePercent?: number): number {
    if (!feePercent) {
      return 0;
    }
    return amountIn * (feePercent / 100);
  }

  private normalizePercent(value?: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value! / 100;
  }

  supportsPair(inputMint: string, outputMint: string): boolean {
    const poolMap = this.poolListProvider();
    return Object.values(poolMap).some((pool) =>
      this.matchesPool(pool, inputMint, outputMint)
    );
  }

  getHealth(): AdapterHealthSnapshot {
    return this.healthTracker.getHealth();
  }
}
