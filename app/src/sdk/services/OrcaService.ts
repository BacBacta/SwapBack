import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Percentage } from "@orca-so/common-sdk";
import {
  PriceMath,
  UseFallbackTickArray,
  Whirlpool,
  WhirlpoolAccountFetcherInterface,
  WhirlpoolClient,
  WhirlpoolContext,
  buildWhirlpoolClient,
  swapQuoteByInputToken,
} from "@orca-so/whirlpools-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  getOrcaWhirlpool,
  ORCA_WHIRLPOOL_PROGRAM_ID,
} from "../config/orca-pools";
import {
  LiquiditySource,
  VenueName,
  VenueType,
} from "../types/smart-router";

const DEFAULT_ORCA_SLIPPAGE_BPS = Number(
  process.env.NEXT_PUBLIC_ORCA_SLIPPAGE_BPS ?? 50
);

class ReadonlyWallet implements Wallet {
  publicKey: PublicKey;

  constructor(keypair: Keypair = Keypair.generate()) {
    this.publicKey = keypair.publicKey;
  }

  async signTransaction<T extends Transaction>(tx: T): Promise<T> {
    return tx;
  }

  async signAllTransactions<T extends Transaction[]>(txs: T): Promise<T> {
    return txs;
  }
}

export type OrcaServiceOptions = {
  enabled?: boolean;
  slippageBps?: number;
  programId?: PublicKey;
  wallet?: Wallet;
};

export class OrcaService {
  private readonly connection: Connection | null;
  private readonly enabled: boolean;
  private readonly slippageBps: number;
  private readonly programId: PublicKey;
  private readonly wallet: Wallet;
  private readonly poolCache = new Map<string, Promise<Whirlpool>>();
  private client?: WhirlpoolClient;
  private fetcher?: WhirlpoolAccountFetcherInterface;

  constructor(connection: Connection | null, options: OrcaServiceOptions = {}) {
    this.connection = connection ?? null;
    this.enabled = options.enabled ?? true;
    this.slippageBps = options.slippageBps ?? DEFAULT_ORCA_SLIPPAGE_BPS;
    this.programId = options.programId ?? ORCA_WHIRLPOOL_PROGRAM_ID;
    this.wallet = options.wallet ?? new ReadonlyWallet();

    if (this.connection && this.enabled) {
      const provider = new AnchorProvider(
        this.connection,
        this.wallet,
        AnchorProvider.defaultOptions()
      );
      const context = WhirlpoolContext.withProvider(
        provider,
        this.programId
      );
      this.fetcher = context.fetcher;
      this.client = buildWhirlpoolClient(context);
    }
  }

  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    if (
      !this.enabled ||
      !this.connection ||
      !this.client ||
      !this.fetcher ||
      inputAmount <= 0
    ) {
      return null;
    }

    try {
      const poolAddress = getOrcaWhirlpool(
        new PublicKey(inputMint),
        new PublicKey(outputMint)
      );

      if (!poolAddress) {
        return null;
      }

      const pool = await this.getPool(poolAddress.toBase58());
      await pool.refreshData();

      const tokenAInfo = pool.getTokenAInfo();
      const tokenBInfo = pool.getTokenBInfo();
      const inputMintPk = new PublicKey(inputMint);
      const outputMintPk = new PublicKey(outputMint);

      const aToB =
        tokenAInfo.mint.equals(inputMintPk) &&
        tokenBInfo.mint.equals(outputMintPk);
      const bToA =
        tokenBInfo.mint.equals(inputMintPk) &&
        tokenAInfo.mint.equals(outputMintPk);

      if (!aToB && !bToA) {
        return null;
      }

      const inputInfo = aToB ? tokenAInfo : tokenBInfo;
      const outputInfo = aToB ? tokenBInfo : tokenAInfo;
      const tokenAmount = this.toLamports(inputAmount, inputInfo.decimals);

      if (tokenAmount.lte(new BN(0))) {
        return null;
      }

      const slippage = Percentage.fromFraction(
        this.slippageBps,
        10000
      );

      const quote = await swapQuoteByInputToken(
        pool,
        inputInfo.mint,
        tokenAmount,
        slippage,
        this.programId,
        this.fetcher,
        undefined,
        UseFallbackTickArray.Situational
      );

      const estimatedInput = this.fromLamports(
        quote.estimatedAmountIn,
        inputInfo.decimals
      );
      const estimatedOutput = this.fromLamports(
        quote.estimatedAmountOut,
        outputInfo.decimals
      );

      if (estimatedInput <= 0 || estimatedOutput <= 0) {
        return null;
      }

      const feeAmount = this.fromLamports(
        quote.estimatedFeeAmount,
        inputInfo.decimals
      );
      const effectivePrice = estimatedOutput / estimatedInput;
      const spotPriceAB = PriceMath.sqrtPriceX64ToPrice(
        pool.getData().sqrtPrice,
        tokenAInfo.decimals,
        tokenBInfo.decimals
      ).toNumber();
      const spotPrice = aToB
        ? spotPriceAB
        : spotPriceAB > 0
        ? 1 / spotPriceAB
        : 0;
      const slippagePercent =
        spotPrice > 0
          ? Math.abs(effectivePrice - spotPrice) / spotPrice
          : 0;

      const tokenVaultA = pool.getTokenVaultAInfo();
      const tokenVaultB = pool.getTokenVaultBInfo();
      const reserveInput = this.fromLamports(
        aToB ? tokenVaultA.amount : tokenVaultB.amount,
        inputInfo.decimals
      );
      const reserveOutput = this.fromLamports(
        aToB ? tokenVaultB.amount : tokenVaultA.amount,
        outputInfo.decimals
      );
      const depth = Math.min(reserveInput, reserveOutput) * 2;

      return {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth,
        reserves: {
          input: reserveInput,
          output: reserveOutput,
        },
        effectivePrice,
        feeAmount,
        slippagePercent,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        metadata: {
          orca: {
            poolAddress: poolAddress.toBase58(),
            tickSpacing: pool.getData().tickSpacing,
            sqrtPriceX64: pool.getData().sqrtPrice.toString(),
            inputDecimals: inputInfo.decimals,
            outputDecimals: outputInfo.decimals,
          },
        },
      };
    } catch (error) {
      console.warn("[orca] quote_failed", {
        inputMint,
        outputMint,
        error,
      });
      return null;
    }
  }

  private async getPool(address: string): Promise<Whirlpool> {
    let cached = this.poolCache.get(address);
    if (!cached) {
      cached = this.client!.getPool(new PublicKey(address));
      this.poolCache.set(address, cached);
    }
    return cached;
  }

  private toLamports(amount: number, decimals: number): BN {
    const scale = Math.pow(10, decimals);
    const scaled = Math.trunc(amount * scale);
    return new BN(Math.max(scaled, 0));
  }

  private fromLamports(amount: BN, decimals: number): number {
    const scale = Math.pow(10, decimals);
    return Number(amount.toString()) / scale;
  }
}
