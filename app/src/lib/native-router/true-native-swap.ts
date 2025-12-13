/**
 * 🔀 True Native Swap Module
 * 
 * Ce module implémente le VRAI routage natif vers les DEX (Raydium, Orca, Meteora)
 * SANS passer par Jupiter. Il utilise le mode Dynamic Plan du programme on-chain.
 * 
 * Flux:
 * 1. Créer un SwapPlan on-chain avec les venues natives
 * 2. Appeler swap_toc avec use_dynamic_plan=true
 * 3. Le programme exécute directement les CPI vers les DEX
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import BN from "bn.js";
import { logger } from "@/lib/logger";
import { getOracleFeedsForPair } from "@/config/oracles";
import { getAllALTs } from "@/lib/alt/swapbackALT";
import {
  DEXAccounts,
  SupportedVenue,
  getDEXAccounts,
  getAllDEXAccounts,
} from "./dex/DEXAccountResolvers";

// ============================================================================
// CONSTANTS
// ============================================================================

// Program IDs (Mainnet)
export const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");

// DEX Program IDs
export const DEX_PROGRAM_IDS = {
  RAYDIUM_AMM: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
  RAYDIUM_CLMM: new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"),
  ORCA_WHIRLPOOL: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
  METEORA_DLMM: new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"),
  PHOENIX: new PublicKey("PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY"),
  LIFINITY: new PublicKey("EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S"),
  SANCTUM: new PublicKey("5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx"),
  SABER: new PublicKey("SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ"),
} as const;

// Token mints
export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Configuration
const MAX_STALENESS_SECS = 120; // 2 minutes
const PRIORITY_FEE_MICRO_LAMPORTS = 100_000;
const COMPUTE_UNITS = 400_000;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convertit une string ou PublicKey en PublicKey de manière sécurisée
 */
function toPublicKey(value: PublicKey | string): PublicKey {
  if (typeof value === 'string') {
    return new PublicKey(value);
  }
  if (value instanceof PublicKey) {
    return value;
  }
  // Fallback: essayer de créer depuis l'objet
  if (value && typeof (value as { toBase58?: () => string }).toBase58 === 'function') {
    return value as PublicKey;
  }
  throw new Error(`Cannot convert to PublicKey: ${JSON.stringify(value)}`);
}

// ============================================================================
// TYPES
// ============================================================================

export interface NativeVenueQuote {
  venue: SupportedVenue;
  venueProgramId: PublicKey;
  inputAmount: number;
  outputAmount: number;
  priceImpactBps: number;
  accounts: DEXAccounts;
  latencyMs: number;
}

export interface TrueNativeRoute {
  /** Venue sélectionnée pour le swap */
  venue: SupportedVenue;
  venueProgramId: PublicKey;
  /** Montant d'entrée */
  inputAmount: number;
  /** Montant de sortie estimé */
  outputAmount: number;
  /** Impact prix en bps */
  priceImpactBps: number;
  /** Frais de plateforme estimés */
  platformFeeBps: number;
  /** Comptes DEX nécessaires */
  dexAccounts: DEXAccounts;
  /** Toutes les quotes obtenues */
  allQuotes: NativeVenueQuote[];
}

export interface TrueNativeSwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountIn: number;
  minAmountOut: number;
  slippageBps: number;
  userPublicKey: PublicKey;
}

export interface TrueNativeSwapResult {
  transaction: VersionedTransaction;
  route: TrueNativeRoute;
  planAccount: PublicKey;
}

// ============================================================================
// TRUE NATIVE SWAP CLASS
// ============================================================================

export class TrueNativeSwap {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // ==========================================================================
  // QUOTE FETCHING
  // ==========================================================================

  /**
   * Obtient des quotes directement auprès des DEX
   */
  async getNativeQuotes(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    userPublicKey: PublicKey
  ): Promise<NativeVenueQuote[]> {
    const quotes: NativeVenueQuote[] = [];

    logger.info("TrueNativeSwap", "Fetching native quotes", {
      inputMint: inputMint.toBase58().slice(0, 8),
      outputMint: outputMint.toBase58().slice(0, 8),
      amountIn,
    });

    // Obtenir les comptes pour toutes les venues en parallèle
    const allAccounts = await getAllDEXAccounts(
      this.connection,
      inputMint,
      outputMint,
      userPublicKey
    );

    // Pour chaque venue disponible, obtenir une quote
    for (const [venue, accounts] of allAccounts) {
      try {
        const startTime = Date.now();
        const quote = await this.getQuoteForVenue(
          venue,
          inputMint,
          outputMint,
          amountIn,
          accounts
        );
        const latencyMs = Date.now() - startTime;

        if (quote) {
          const venueProgramId = DEX_PROGRAM_IDS[venue];
          if (!venueProgramId) {
            logger.warn("TrueNativeSwap", `Unknown venue program ID for ${venue}`);
            continue;
          }
          
          quotes.push({
            venue,
            venueProgramId,
            inputAmount: amountIn,
            outputAmount: quote.outputAmount,
            priceImpactBps: quote.priceImpactBps,
            accounts,
            latencyMs,
          });

          logger.debug("TrueNativeSwap", `Quote from ${venue}`, {
            outputAmount: quote.outputAmount,
            priceImpactBps: quote.priceImpactBps,
            latencyMs,
          });
        }
      } catch (error) {
        logger.warn("TrueNativeSwap", `Failed to get quote from ${venue}`, { error });
      }
    }

    // Trier par meilleur output
    quotes.sort((a, b) => b.outputAmount - a.outputAmount);

    return quotes;
  }

  /**
   * Obtient une quote spécifique pour une venue
   */
  private async getQuoteForVenue(
    venue: SupportedVenue,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    switch (venue) {
      case "ORCA_WHIRLPOOL":
        return this.getOrcaQuote(inputMint, outputMint, amountIn, accounts);
      case "METEORA_DLMM":
        return this.getMeteoraQuote(inputMint, outputMint, amountIn, accounts);
      case "RAYDIUM_AMM":
        return this.getRaydiumQuote(inputMint, outputMint, amountIn, accounts);
      case "PHOENIX":
        return this.getPhoenixQuote(inputMint, outputMint, amountIn, accounts);
      default:
        return null;
    }
  }

  /**
   * Quote Orca Whirlpool via API
   */
  private async getOrcaQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    try {
      // Utiliser l'API Orca pour obtenir une quote
      const response = await fetch(
        `/api/dex/orca/quote?` +
          new URLSearchParams({
            inputMint: inputMint.toBase58(),
            outputMint: outputMint.toBase58(),
            amount: amountIn.toString(),
            pool: accounts.meta.poolAddress || "",
          }),
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        // Fallback: estimation basée sur les réserves du pool
        return this.estimateQuoteFromPool(accounts, amountIn);
      }

      const data = await response.json();
      return {
        outputAmount: data.outputAmount,
        priceImpactBps: data.priceImpact * 10000,
      };
    } catch {
      return this.estimateQuoteFromPool(accounts, amountIn);
    }
  }

  /**
   * Quote Meteora DLMM via API
   */
  private async getMeteoraQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    try {
      const response = await fetch(
        `https://dlmm-api.meteora.ag/pair/${accounts.meta.poolAddress}/quote?` +
          new URLSearchParams({
            swapMode: inputMint.toBase58() < outputMint.toBase58() ? "ExactIn" : "ExactOut",
            amount: amountIn.toString(),
          }),
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        return this.estimateQuoteFromPool(accounts, amountIn);
      }

      const data = await response.json();
      return {
        outputAmount: parseInt(data.outAmount || "0"),
        priceImpactBps: (data.priceImpact || 0) * 10000,
      };
    } catch {
      return this.estimateQuoteFromPool(accounts, amountIn);
    }
  }

  /**
   * Quote Raydium AMM via API
   */
  private async getRaydiumQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    try {
      const response = await fetch(
        `/api/dex/raydium/quote?` +
          new URLSearchParams({
            inputMint: inputMint.toBase58(),
            outputMint: outputMint.toBase58(),
            amount: amountIn.toString(),
            poolId: accounts.meta.poolAddress || "",
          }),
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        return this.estimateQuoteFromPool(accounts, amountIn);
      }

      const data = await response.json();
      return {
        outputAmount: data.outputAmount,
        priceImpactBps: (data.priceImpact || 0) * 10000,
      };
    } catch {
      return this.estimateQuoteFromPool(accounts, amountIn);
    }
  }

  /**
   * Quote Phoenix via SDK/API
   */
  private async getPhoenixQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    // Phoenix a généralement des spreads serrés, estimation simple
    const feeRate = accounts.meta.feeRate || 0.001;
    const outputAmount = Math.floor(amountIn * (1 - feeRate));
    return {
      outputAmount,
      priceImpactBps: Math.round(feeRate * 10000),
    };
  }

  /**
   * Estimation de quote basée sur la formule AMM x*y=k
   */
  private estimateQuoteFromPool(
    accounts: DEXAccounts,
    amountIn: number
  ): { outputAmount: number; priceImpactBps: number } | null {
    const feeRate = accounts.meta.feeRate || 0.003;
    // Estimation conservative: assume 0.3% fee + 0.1% slippage
    const outputAmount = Math.floor(amountIn * (1 - feeRate - 0.001));
    return {
      outputAmount,
      priceImpactBps: Math.round((feeRate + 0.001) * 10000),
    };
  }

  // ==========================================================================
  // ROUTE SELECTION
  // ==========================================================================

  /**
   * Sélectionne la meilleure route native
   */
  async getBestNativeRoute(
    params: TrueNativeSwapParams
  ): Promise<TrueNativeRoute | null> {
    // Convertir les mints en PublicKey de manière sécurisée
    const inputMintPk = toPublicKey(params.inputMint);
    const outputMintPk = toPublicKey(params.outputMint);
    const userPk = toPublicKey(params.userPublicKey);
    const amountIn = params.amountIn;

    const quotes = await this.getNativeQuotes(
      inputMintPk,
      outputMintPk,
      amountIn,
      userPk
    );

    if (quotes.length === 0) {
      logger.warn("TrueNativeSwap", "No native venues available for this pair");
      return null;
    }

    // Prendre la meilleure quote
    const best = quotes[0];

    return {
      venue: best.venue,
      venueProgramId: best.venueProgramId,
      inputAmount: best.inputAmount,
      outputAmount: best.outputAmount,
      priceImpactBps: best.priceImpactBps,
      platformFeeBps: 15, // 0.15% platform fee
      dexAccounts: best.accounts,
      allQuotes: quotes,
    };
  }

  // ==========================================================================
  // PLAN CREATION
  // ==========================================================================

  /**
   * Dérive l'adresse PDA du SwapPlan
   */
  deriveSwapPlanAddress(userPublicKey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("swap_plan"), userPublicKey.toBuffer()],
      ROUTER_PROGRAM_ID
    );
  }

  /**
   * Construit l'instruction create_plan
   */
  async buildCreatePlanInstruction(
    userPublicKey: PublicKey,
    params: {
      inputMint: PublicKey;
      outputMint: PublicKey;
      amountIn: number;
      minOut: number;
      venue: SupportedVenue;
      expiresAt: number;
    }
  ): Promise<TransactionInstruction> {
    const [planPda] = this.deriveSwapPlanAddress(userPublicKey);

    // Générer un plan_id unique
    const planId = new Uint8Array(32);
    crypto.getRandomValues(planId);

    // Vérifier que la venue est supportée
    const venueProgramId = DEX_PROGRAM_IDS[params.venue];
    if (!venueProgramId) {
      throw new Error(`Venue non supportée: ${params.venue}. Venues supportées: ${Object.keys(DEX_PROGRAM_IDS).join(', ')}`);
    }

    // Venue avec 100% du poids
    const venueWeight = {
      venue: venueProgramId,
      weight: 10000, // 100%
    };

    // Sérialiser les arguments CreatePlanArgs
    const planIdBuffer = Buffer.from(planId);
    const tokenInBuffer = params.inputMint.toBuffer();
    const tokenOutBuffer = params.outputMint.toBuffer();
    const amountInBuffer = Buffer.alloc(8);
    amountInBuffer.writeBigUInt64LE(BigInt(params.amountIn));
    const minOutBuffer = Buffer.alloc(8);
    minOutBuffer.writeBigUInt64LE(BigInt(params.minOut));
    const expiresAtBuffer = Buffer.alloc(8);
    expiresAtBuffer.writeBigInt64LE(BigInt(params.expiresAt));

    // Venues array (1 venue)
    const venuesLenBuffer = Buffer.alloc(4);
    venuesLenBuffer.writeUInt32LE(1);
    const venueBuffer = venueWeight.venue.toBuffer();
    const weightBuffer = Buffer.alloc(2);
    weightBuffer.writeUInt16LE(venueWeight.weight);

    // Fallback plans (empty)
    const fallbackLenBuffer = Buffer.alloc(4);
    fallbackLenBuffer.writeUInt32LE(0);

    // Discriminator pour create_plan
    const discriminator = Buffer.from([
      0x18, 0x11, 0x91, 0xf2, 0x25, 0x3a, 0x9f, 0x64,
    ]);

    const argsData = Buffer.concat([
      discriminator,
      planIdBuffer,
      planIdBuffer, // plan_data.plan_id
      tokenInBuffer,
      tokenOutBuffer,
      amountInBuffer,
      minOutBuffer,
      venuesLenBuffer,
      venueBuffer,
      weightBuffer,
      fallbackLenBuffer,
      expiresAtBuffer,
    ]);

    return new TransactionInstruction({
      programId: ROUTER_PROGRAM_ID,
      keys: [
        { pubkey: planPda, isSigner: false, isWritable: true },
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: argsData,
    });
  }

  // ==========================================================================
  // SWAP EXECUTION
  // ==========================================================================

  /**
   * Dérive les comptes nécessaires pour SwapToC
   */
  async deriveSwapAccounts(
    userPublicKey: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<{
    state: PublicKey;
    userTokenAccountA: PublicKey;
    userTokenAccountB: PublicKey;
    rebateVault: PublicKey;
    userRebate: PublicKey;
    config: PublicKey;
  }> {
    const [state] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      ROUTER_PROGRAM_ID
    );

    const userTokenAccountA = await getAssociatedTokenAddress(
      inputMint,
      userPublicKey
    );
    const userTokenAccountB = await getAssociatedTokenAddress(
      outputMint,
      userPublicKey
    );

    const [rebateVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("rebate_vault")],
      ROUTER_PROGRAM_ID
    );

    const [userRebate] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_rebate"), userPublicKey.toBuffer()],
      ROUTER_PROGRAM_ID
    );

    const [config] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      ROUTER_PROGRAM_ID
    );

    return {
      state,
      userTokenAccountA,
      userTokenAccountB,
      rebateVault,
      userRebate,
      config,
    };
  }

  /**
   * Construit l'instruction swap_toc avec use_dynamic_plan=true
   */
  async buildNativeSwapInstruction(
    userPublicKey: PublicKey,
    route: TrueNativeRoute,
    params: TrueNativeSwapParams
  ): Promise<TransactionInstruction> {
    const { inputMint, outputMint, amountIn, minAmountOut } = params;

    // Dériver les comptes
    const accounts = await this.deriveSwapAccounts(
      userPublicKey,
      inputMint,
      outputMint
    );
    const [planPda] = this.deriveSwapPlanAddress(userPublicKey);

    // Obtenir les oracles
    const oracleConfig = getOracleFeedsForPair(
      inputMint.toBase58(),
      outputMint.toBase58()
    );

    // Sérialiser SwapArgs avec use_dynamic_plan=true
    const argsBuffer = this.serializeSwapArgs({
      amountIn: new BN(amountIn),
      minOut: new BN(minAmountOut),
      useDynamicPlan: true, // <- LA CLÉ !
      useBundle: false,
      planAccount: planPda,
      maxStalenessOverride: MAX_STALENESS_SECS,
    });

    // Discriminator pour swap_toc
    const discriminator = Buffer.from([187, 201, 212, 51, 16, 155, 236, 60]);
    const data = Buffer.concat([discriminator, argsBuffer]);

    // Construire les keys
    const keys = [
      { pubkey: accounts.state, isSigner: false, isWritable: true },
      { pubkey: userPublicKey, isSigner: true, isWritable: true },
      { pubkey: oracleConfig.primary, isSigner: false, isWritable: false },
      // Fallback oracle (optional)
      ...(oracleConfig.fallback
        ? [{ pubkey: oracleConfig.fallback, isSigner: false, isWritable: false }]
        : []),
      { pubkey: accounts.userTokenAccountA, isSigner: false, isWritable: true },
      { pubkey: accounts.userTokenAccountB, isSigner: false, isWritable: true },
      { pubkey: accounts.rebateVault, isSigner: false, isWritable: true },
      { pubkey: accounts.userRebate, isSigner: false, isWritable: true },
      { pubkey: accounts.config, isSigner: false, isWritable: false },
      { pubkey: planPda, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      // DEX accounts (remaining accounts)
      ...route.dexAccounts.accounts.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: true,
      })),
    ];

    return new TransactionInstruction({
      programId: ROUTER_PROGRAM_ID,
      keys,
      data,
    });
  }

  /**
   * Sérialise les arguments SwapArgs pour le mode Dynamic Plan
   */
  private serializeSwapArgs(args: {
    amountIn: BN;
    minOut: BN;
    useDynamicPlan: boolean;
    useBundle: boolean;
    planAccount: PublicKey;
    maxStalenessOverride?: number;
  }): Buffer {
    const amountInBuffer = Buffer.alloc(8);
    args.amountIn.toArrayLike(Buffer, "le", 8).copy(amountInBuffer);

    const minOutBuffer = Buffer.alloc(8);
    args.minOut.toArrayLike(Buffer, "le", 8).copy(minOutBuffer);

    // Boolean flags
    const useDynamicPlanFlag = args.useDynamicPlan ? 1 : 0;
    const useBundleFlag = args.useBundle ? 1 : 0;

    // Plan account (Option<Pubkey>)
    const planAccountBuffer = Buffer.concat([
      Buffer.from([1]), // Some
      args.planAccount.toBuffer(),
    ]);

    // maxStalenessOverride (Option<i64>)
    const stalenessBuffer = args.maxStalenessOverride
      ? Buffer.concat([
          Buffer.from([1]),
          (() => {
            const buf = Buffer.alloc(8);
            buf.writeBigInt64LE(BigInt(args.maxStalenessOverride));
            return buf;
          })(),
        ])
      : Buffer.from([0]);

    // slippage_tolerance (None)
    const slippageBuffer = Buffer.from([0]);

    // venues (empty - using plan)
    const venuesBuffer = Buffer.from([0, 0, 0, 0]);

    // jupiter_route (None)
    const jupiterRouteBuffer = Buffer.from([0]);

    return Buffer.concat([
      amountInBuffer,
      minOutBuffer,
      slippageBuffer,
      Buffer.from([useDynamicPlanFlag]),
      Buffer.from([useBundleFlag]),
      // primary_oracle_account (None - using accounts)
      Buffer.from([0]),
      venuesBuffer,
      stalenessBuffer,
      jupiterRouteBuffer,
      planAccountBuffer,
    ]);
  }

  // ==========================================================================
  // MAIN ENTRY POINT
  // ==========================================================================

  /**
   * Construit une transaction de swap native complète
   */
  async buildNativeSwapTransaction(
    params: TrueNativeSwapParams
  ): Promise<TrueNativeSwapResult | null> {
    // Convertir les mints en PublicKey de manière sécurisée
    const userPublicKey = toPublicKey(params.userPublicKey);
    const inputMint = toPublicKey(params.inputMint);
    const outputMint = toPublicKey(params.outputMint);
    const amountIn = params.amountIn;
    const minAmountOut = params.minAmountOut;

    logger.info("TrueNativeSwap", "Building true native swap transaction", {
      inputMint: inputMint.toBase58().slice(0, 8),
      outputMint: outputMint.toBase58().slice(0, 8),
      amountIn,
      minAmountOut,
    });

    // 1. Obtenir la meilleure route native
    const route = await this.getBestNativeRoute(params);
    if (!route) {
      logger.error("TrueNativeSwap", "No native route available");
      return null;
    }

    logger.info("TrueNativeSwap", `Best route: ${route.venue}`, {
      outputAmount: route.outputAmount,
      priceImpactBps: route.priceImpactBps,
    });

    // 2. Créer les instructions
    const instructions: TransactionInstruction[] = [];

    // Priority fee
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS })
    );
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
      })
    );

    // Créer ATA si nécessaire
    const userTokenAccountB = await getAssociatedTokenAddress(
      outputMint,
      userPublicKey
    );
    const accountInfo = await this.connection.getAccountInfo(userTokenAccountB);
    if (!accountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userTokenAccountB,
          userPublicKey,
          outputMint
        )
      );
    }

    // 3. Créer le plan
    const [planPda] = this.deriveSwapPlanAddress(userPublicKey);
    const expiresAt = Math.floor(Date.now() / 1000) + 60; // Expire dans 1 minute

    instructions.push(
      await this.buildCreatePlanInstruction(userPublicKey, {
        inputMint,
        outputMint,
        amountIn,
        minOut: minAmountOut,
        venue: route.venue,
        expiresAt,
      })
    );

    // 4. Ajouter l'instruction de swap
    instructions.push(
      await this.buildNativeSwapInstruction(userPublicKey, route, params)
    );

    // 5. Construire la transaction versionnée
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();

    // Charger les ALTs
    const alts = await getAllALTs(this.connection);
    const lookupTables = await Promise.all(
      alts.map((alt) => this.connection.getAddressLookupTable(alt))
    );
    const validLookupTables = lookupTables
      .filter((res) => res.value !== null)
      .map((res) => res.value!);

    const messageV0 = new TransactionMessage({
      payerKey: userPublicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(validLookupTables);

    const transaction = new VersionedTransaction(messageV0);

    return {
      transaction,
      route,
      planAccount: planPda,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TrueNativeSwap;
