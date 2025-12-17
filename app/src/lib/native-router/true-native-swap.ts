/**
 * 🔀 True Native Swap Module
 *
 * Implémente le swap natif vers les DEX (Raydium, Orca, Meteora, etc.)
 * SANS passer par Jupiter.
 *
 * V1 (best-venue, single CPI):
 * - Sélectionne la meilleure venue off-chain
 * - Appelle `swap_toc` avec `direct_dex_venue` (use_dynamic_plan=false)
 * - AUCUN write on-chain (pas de SwapPlan) pour le chemin direct
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
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getMint,
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
import { toPublicKey, toBase58Safe } from "./utils/publicKeyUtils";

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

// Phoenix (CLOB) requiert une quote orderbook (phoenix-sdk). Tant que ce n'est
// pas implémenté côté client, on l'exclut du best-route pour éviter les IOC
// failures (custom program error 0xF) dues à un minOut irréaliste.
const DISABLED_BEST_ROUTE_VENUES = new Set<SupportedVenue>(["PHOENIX"]);

// ============================================================================
// HELPERS - Using centralized publicKeyUtils
// ============================================================================

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
  blockhash: string;
  lastValidBlockHeight: number;
}

// ============================================================================
// TRUE NATIVE SWAP CLASS
// ============================================================================

export class TrueNativeSwap {
  private connection: Connection;
  private mintDecimalsCache = new Map<string, number>();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  private async getMintDecimals(mint: PublicKey): Promise<number> {
    const key = mint.toBase58();
    const cached = this.mintDecimalsCache.get(key);
    if (cached !== undefined) return cached;

    const mintInfo = await getMint(this.connection, mint);
    this.mintDecimalsCache.set(key, mintInfo.decimals);
    return mintInfo.decimals;
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
    const safeInputMint = toPublicKey(inputMint);
    const safeOutputMint = toPublicKey(outputMint);
    const safeUser = toPublicKey(userPublicKey);

    const quotes: NativeVenueQuote[] = [];

    logger.info("TrueNativeSwap", "Fetching native quotes", {
      inputMint: safeInputMint.toBase58().slice(0, 8),
      outputMint: safeOutputMint.toBase58().slice(0, 8),
      amountIn,
    });

    // Obtenir les comptes pour toutes les venues en parallèle
    const allAccounts = await getAllDEXAccounts(
      this.connection,
      safeInputMint,
      safeOutputMint,
      safeUser
    );

    // Pour chaque venue disponible, obtenir une quote
    for (const [venue, accounts] of allAccounts) {
      if (DISABLED_BEST_ROUTE_VENUES.has(venue)) {
        logger.warn("TrueNativeSwap", `Skipping disabled venue in best-route: ${venue}`);
        continue;
      }
      try {
        const startTime = Date.now();
        const quote = await this.getQuoteForVenue(
          venue,
          safeInputMint,
          safeOutputMint,
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
    void inputMint;
    void outputMint;
    void amountIn;
    void accounts;

    // Phoenix (CLOB) requiert une quote basée sur l'orderbook pour éviter
    // les IOC failures (custom error 0xF) quand minOut est irréaliste.
    // Tant qu'une quote orderbook fiable via phoenix-sdk n'est pas implémentée,
    // on désactive Phoenix au niveau quote pour éviter de sélectionner cette venue.
    logger.warn("TrueNativeSwap", "Phoenix quote disabled (orderbook quote not implemented)");
    return null;
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

    // Prendre la meilleure quote non désactivée (défense en profondeur)
    const best = quotes.find((q) => !DISABLED_BEST_ROUTE_VENUES.has(q.venue));

    if (!best) {
      logger.warn("TrueNativeSwap", "No eligible native venues (all disabled)");
      return null;
    }

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
    const userPk = toPublicKey(userPublicKey);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("swap_plan"), userPk.toBuffer()],
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
    const safeUser = toPublicKey(userPublicKey);
    const safeInput = toPublicKey(params.inputMint);
    const safeOutput = toPublicKey(params.outputMint);
    const [planPda] = this.deriveSwapPlanAddress(safeUser);

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
    const tokenInBuffer = safeInput.toBuffer();
    const tokenOutBuffer = safeOutput.toBuffer();
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

    // Discriminator pour create_plan - from IDL: [77, 43, 141, 254, 212, 118, 41, 186]
    const discriminator = Buffer.from([77, 43, 141, 254, 212, 118, 41, 186]);

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
        { pubkey: safeUser, isSigner: true, isWritable: true },
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
    oracleCache: PublicKey;
    venueScore: PublicKey;
  }> {
    const [state] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      ROUTER_PROGRAM_ID
    );

    const safeUser = toPublicKey(userPublicKey);
    const safeInput = toPublicKey(inputMint);
    const safeOutput = toPublicKey(outputMint);

    const userTokenAccountA = await getAssociatedTokenAddress(
      safeInput,
      safeUser
    );
    const userTokenAccountB = await getAssociatedTokenAddress(
      safeOutput,
      safeUser
    );

    // Note: vault_token_account_a/b sont les vaults du DEX pool, pas des PDAs du router
    // Ils sont fournis par les DEX resolvers (getOrcaWhirlpoolAccounts, etc.)

    // Rebate vault PDA - seeds: ["rebate_vault", state]
    const [rebateVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("rebate_vault"), state.toBuffer()],
      ROUTER_PROGRAM_ID
    );

    const [userRebate] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_rebate"), safeUser.toBuffer()],
      ROUTER_PROGRAM_ID
    );

    // Config PDA - seed: "router_config"
    const [config] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_config")],
      ROUTER_PROGRAM_ID
    );

    return {
      state,
      userTokenAccountA,
      userTokenAccountB,
      rebateVault,
      userRebate,
      config,
      // oracleCache and venueScore are computed per-oracle, returned as defaults
      oracleCache: PublicKey.default,
      venueScore: PublicKey.default,
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
    const safeUser = toPublicKey(userPublicKey);
    const inputMint = toPublicKey(params.inputMint);
    const outputMint = toPublicKey(params.outputMint);
    const amountIn = params.amountIn;
    const minAmountOut = params.minAmountOut;

    // Phoenix (CLOB) n'est pas exécutable sans quote orderbook fiable.
    // Empêche toute construction d'instruction menant à un IOC 0xF.
    if (DISABLED_BEST_ROUTE_VENUES.has(route.venue)) {
      throw new Error(
        `Venue native temporairement désactivée: ${route.venue}. ` +
          `Phoenix requiert une quote orderbook pour éviter les IOC failures (0xF).`
      );
    }

    // Dériver les comptes
    const accounts = await this.deriveSwapAccounts(
      safeUser,
      inputMint,
      outputMint
    );

    const normalizedDexAccounts = route.dexAccounts.accounts.map((pubkey, index) => {
      try {
        return toPublicKey(pubkey);
      } catch (error) {
        logger.error("TrueNativeSwap", "Invalid DEX account key", {
          venue: route.venue,
          index,
          account: pubkey,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error instanceof Error
          ? error
          : new Error(`Invalid DEX account at index ${index}`);
      }
    });

    // IMPORTANT: plusieurs CPI on-chain utilisent `invoke(&instruction, account_slice)`.
    // Dans ce cas, le runtime exige que le compte programme (exécutable) soit inclus
    // dans la liste des comptes passée à l'invocation.
    // Pour ne pas casser les indices stricts utilisés par les CPIs, on l'ajoute en fin.
    if (route.venueProgramId && !normalizedDexAccounts.some((k) => k.equals(route.venueProgramId))) {
      normalizedDexAccounts.push(route.venueProgramId);
    }

    // Obtenir les oracles
    const oracleConfig = getOracleFeedsForPair(
      inputMint.toBase58(),
      outputMint.toBase58()
    );

    const [tokenADecimals, tokenBDecimals] = await Promise.all([
      this.getMintDecimals(inputMint),
      this.getMintDecimals(outputMint),
    ]);

    logger.debug("TrueNativeSwap", "Native swap oracle + params", {
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      amountIn,
      slippageBps: params.slippageBps,
      primaryOracle: oracleConfig.primary.toBase58(),
      fallbackOracle: oracleConfig.fallback?.toBase58() ?? null,
      maxStalenessSecs: MAX_STALENESS_SECS,
      rpcEndpoint: (this.connection as any)?.rpcEndpoint ?? undefined,
      tokenADecimals,
      tokenBDecimals,
    });

    // Sérialiser SwapArgs avec direct_dex_venue pour native swap
    const argsBuffer = this.serializeSwapArgs({
      amountIn: new BN(amountIn),
      minOut: new BN(minAmountOut),
      useDynamicPlan: false, // Not using dynamic plan - direct DEX swap
      useBundle: false,
      // NOTE: plan_account n'est utilisé que si useDynamicPlan=true.
      // On passe un placeholder ici pour éviter de dériver/embarquer un PDA inutile.
      planAccount: ROUTER_PROGRAM_ID,
      primaryOracleAccount: oracleConfig.primary,
      directDexVenue: route.venueProgramId, // <-- THE KEY for native swap!
      maxStalenessOverride: MAX_STALENESS_SECS,
      tokenADecimals,
      tokenBDecimals,
    });

    // Discriminator pour swap_toc
    const discriminator = Buffer.from([187, 201, 212, 51, 16, 155, 236, 60]);
    const data = Buffer.concat([discriminator, argsBuffer]);

    // IMPORTANT (taille de tx): oracle_cache / venue_score sont optionnels.
    // Ne pas les dériver / inclure par défaut pour rester sous la limite de taille des tx.
    const oracleCacheKey = ROUTER_PROGRAM_ID;
    const venueScoreKey = ROUTER_PROGRAM_ID;

    /**
     * Construire les keys dans l'ordre EXACT de l'IDL:
     * 
     * 1.  state (writable)
     * 2.  user (signer, writable)
     * 3.  primary_oracle
     * 4.  fallback_oracle (optional)
     * 5.  user_token_account_a (writable)
     * 6.  user_token_account_b (writable)
     * 7.  vault_token_account_a (writable) - DEX pool vault, NOT a router PDA
     * 8.  vault_token_account_b (writable) - DEX pool vault, NOT a router PDA
     * 9.  plan (optional)
     * 10. user_nft (optional, PDA)
     * 11. buyback_program (optional)
     * 12. buyback_usdc_vault (optional, writable)
     * 13. buyback_state (optional, writable)
     * 14. user_rebate_account (optional, writable)
     * 15. user_rebate (optional, PDA)
     * 16. rebate_vault (writable, PDA)
     * 17. oracle_cache (optional, PDA)
     * 18. venue_score (optional, PDA)
     * 19. token_program
     * 20. system_program
     * 
     * Note: vault_token_account_a/b sont les vaults du DEX pool (Orca/Meteora/etc),
     * PAS des PDAs du router. Ils sont extraits des dexAccounts lors de la résolution.
     */
    
    // En mode direct DEX, vault_token_account_a/b ne sont pas utilisés par le CPI (les comptes DEX sont en remaining_accounts).
    // Pour éviter d'embarquer des vaults de pool (souvent uniques) et gonfler la taille de la transaction,
    // on pointe vers les ATAs user.
    const vaultTokenAccountA = accounts.userTokenAccountA;
    const vaultTokenAccountB = accounts.userTokenAccountB;

    // user_rebate est optionnel : placeholder par défaut pour limiter la taille.
    const userRebateKey = ROUTER_PROGRAM_ID;

    // Construire les metas des remaining accounts DEX avec les bons flags.
    // IMPORTANT:
    // - Les programmes (exécutables) doivent rester readonly.
    // - Certains CPIs exigent explicitement que l'utilisateur soit signer dans la slice (ex Raydium user_owner).
    const remainingDexKeys = normalizedDexAccounts.map((pubkey, index) => {
      let isSigner = false;
      let isWritable = true;

      // Program accounts (exécutables) doivent être readonly.
      if (
        pubkey.equals(TOKEN_PROGRAM_ID) ||
        pubkey.equals(TOKEN_2022_PROGRAM_ID) ||
        pubkey.equals(DEX_PROGRAM_IDS.RAYDIUM_AMM) ||
        pubkey.equals(DEX_PROGRAM_IDS.RAYDIUM_CLMM) ||
        pubkey.equals(DEX_PROGRAM_IDS.ORCA_WHIRLPOOL) ||
        pubkey.equals(DEX_PROGRAM_IDS.METEORA_DLMM) ||
        pubkey.equals(DEX_PROGRAM_IDS.PHOENIX) ||
        pubkey.equals(DEX_PROGRAM_IDS.LIFINITY) ||
        pubkey.equals(DEX_PROGRAM_IDS.SANCTUM) ||
        pubkey.equals(DEX_PROGRAM_IDS.SABER)
      ) {
        isWritable = false;
      }

      // L'utilisateur (owner/authority) doit être signer dans certaines slices.
      if (pubkey.equals(safeUser)) {
        isSigner = true;
        isWritable = false;
      }

      // Ajustements par venue (alignés avec les CPI on-chain)
      if (route.venue === "RAYDIUM_AMM") {
        // cpi_raydium.rs: indices readonly: 0,2,6,13 ; signer readonly: 16
        if (index === 0 || index === 2 || index === 6 || index === 13) {
          isWritable = false;
        }
        if (index === 16) {
          isSigner = true;
          isWritable = false;
        }
        // Le compte programme Raydium est inclus en extra pour satisfaire `invoke`
        if (index === 17) {
          isWritable = false;
        }
      }

      if (route.venue === "ORCA_WHIRLPOOL") {
        // cpi_orca.rs: token_program readonly (0), token_authority signer readonly (1)
        if (index === 0) {
          isWritable = false;
        }
        if (index === 1) {
          isSigner = true;
          isWritable = false;
        }
        // Le compte programme Orca est inclus en extra pour satisfaire `invoke`
        if (index === 11) {
          isWritable = false;
        }
      }

      if (route.venue === "METEORA_DLMM") {
        // cpi_meteora.rs: user signer readonly (10), token programs readonly (11,12), program readonly (14)
        if (index === 10) {
          isSigner = true;
          isWritable = false;
        }
        if (index === 11 || index === 12 || index === 14) {
          isWritable = false;
        }
      }

      if (route.venue === "PHOENIX") {
        // cpi_phoenix.rs: programme readonly (0), log_authority readonly (1), trader signer readonly (3), token_program readonly (9)
        if (index === 0 || index === 1 || index === 9) {
          isWritable = false;
        }
      }

      if (route.venue === "LIFINITY") {
        // cpi_lifinity.rs: userTransferAuthority signer (2). token program readonly (9). programme readonly (extra).
        // Note: certains flags exacts (writable/readonly) sont imposés côté programme on-chain.
        if (index === 2) {
          isSigner = true;
          isWritable = false;
        }
        if (index === 9) {
          isWritable = false;
        }
        // Lifinity Anchor exige configAccount mut; éviter toute escalade impossible en CPI.
        if (index === 12) {
          isWritable = true;
        }
        // Le compte programme Lifinity est inclus en extra pour satisfaire `invoke`
        if (pubkey.equals(DEX_PROGRAM_IDS.LIFINITY)) {
          isWritable = false;
        }
      }

      if (route.venue === "SABER") {
        // cpi_saber.rs: swap_info readonly (0), swap_authority readonly (1), user signer readonly (2), token program readonly (8), clock readonly (9)
        if (index === 0 || index === 1 || index === 8 || index === 9) {
          isWritable = false;
        }
        if (index === 2) {
          isSigner = true;
          isWritable = false;
        }
        // Le compte programme Saber est inclus en extra pour satisfaire `invoke`
        if (pubkey.equals(DEX_PROGRAM_IDS.SABER)) {
          isWritable = false;
        }
      }

      if (route.venue === "SANCTUM") {
        // cpi_sanctum.rs: user signer (1), token programs readonly (6,7), instructions sysvar readonly (8)
        if (index === 1) {
          isSigner = true;
          isWritable = false;
        }
        if (index === 6 || index === 7 || index === 8) {
          isWritable = false;
        }
        if (pubkey.equals(DEX_PROGRAM_IDS.SANCTUM)) {
          isWritable = false;
        }
      }

      if (route.venue === "RAYDIUM_CLMM") {
        // cpi_raydium_clmm.rs: payer signer (0), token program readonly (8), program readonly (extra)
        if (index === 0) {
          isSigner = true;
          isWritable = false;
        }
        if (index === 8) {
          isWritable = false;
        }
        if (pubkey.equals(DEX_PROGRAM_IDS.RAYDIUM_CLMM)) {
          isWritable = false;
        }
      }

      return { pubkey, isSigner, isWritable };
    });
    
    const keys = [
      // 1. state
      { pubkey: accounts.state, isSigner: false, isWritable: true },
      // 2. user
      { pubkey: safeUser, isSigner: true, isWritable: true },
      // 3. primary_oracle
      { pubkey: oracleConfig.primary, isSigner: false, isWritable: false },
      // 4. fallback_oracle (optional) - pass primary as placeholder if none
      { 
        pubkey: oracleConfig.fallback ?? oracleConfig.primary, 
        isSigner: false, 
        isWritable: false 
      },
      // 5. user_token_account_a
      { pubkey: accounts.userTokenAccountA, isSigner: false, isWritable: true },
      // 6. user_token_account_b
      { pubkey: accounts.userTokenAccountB, isSigner: false, isWritable: true },
      // 7. vault_token_account_a - DEX pool vault
      { pubkey: vaultTokenAccountA, isSigner: false, isWritable: true },
      // 8. vault_token_account_b - DEX pool vault
      { pubkey: vaultTokenAccountB, isSigner: false, isWritable: true },
      // 9. plan (optional) - placeholder (direct DEX swap: useDynamicPlan=false)
      { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
      // 10. user_nft (optional) - use a placeholder, program will handle None
      { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
      // 11. buyback_program (optional)
      { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
      // 12. buyback_usdc_vault (optional)
      { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
      // 13. buyback_state (optional)
      { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
      // 14. user_rebate_account (optional)
      { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
      // 15. user_rebate (optional, PDA) - use placeholder if not initialized
      { pubkey: userRebateKey, isSigner: false, isWritable: false },
      // 16. rebate_vault (writable, PDA)
      { pubkey: accounts.rebateVault, isSigner: false, isWritable: true },
      // 17. oracle_cache (optional, PDA)
      { pubkey: oracleCacheKey, isSigner: false, isWritable: false },
      // 18. venue_score (optional, PDA)
      { pubkey: venueScoreKey, isSigner: false, isWritable: false },
      // 19. token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // 20. system_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // DEX accounts (remaining accounts)
      ...remainingDexKeys,
    ];

    return new TransactionInstruction({
      programId: ROUTER_PROGRAM_ID,
      keys,
      data,
    });
  }

  /**
   * Sérialise les arguments SwapArgs pour le mode Dynamic Plan
   * 
   * DOIT correspondre EXACTEMENT à la structure dans l'IDL déployée:
   * 
   * Référence: target/idl/swapback_router.json - SwapArgs (lignes 3293-3420)
   * 
   * Champs (dans l'ordre):
   * 1.  amount_in: u64
   * 2.  min_out: u64
   * 3.  slippage_tolerance: Option<u16>
   * 4.  twap_slices: Option<u8>
   * 5.  use_dynamic_plan: bool
   * 6.  plan_account: Option<Pubkey>
   * 7.  use_bundle: bool
   * 8.  primary_oracle_account: Pubkey
   * 9.  fallback_oracle_account: Option<Pubkey>
   * 10. direct_dex_venue: Option<Pubkey> <-- IMPORTANT pour native swap!
   * 11. jupiter_route: Option<JupiterRouteParams>
   * 12. jupiter_swap_ix_data: Option<Vec<u8>>
   * 13. liquidity_estimate: Option<u64>
   * 14. volatility_bps: Option<u16>
   * 15. min_venue_score: Option<u16>
   * 16. slippage_per_venue: Option<Vec<VenueSlippage>>
   * 17. token_a_decimals: Option<u8>
   * 18. token_b_decimals: Option<u8>
   * 19. max_staleness_override: Option<i64>
   * 20. jito_bundle: Option<JitoBundleConfig>
   */
  private serializeSwapArgs(args: {
    amountIn: BN;
    minOut: BN;
    useDynamicPlan: boolean;
    useBundle: boolean;
    planAccount: PublicKey;
    primaryOracleAccount: PublicKey;
    directDexVenue?: PublicKey;
    maxStalenessOverride?: number;
    tokenADecimals?: number;
    tokenBDecimals?: number;
  }): Buffer {
    const buffers: Buffer[] = [];
    
    // 1. amount_in: u64
    buffers.push(args.amountIn.toArrayLike(Buffer, "le", 8));
    
    // 2. min_out: u64
    buffers.push(args.minOut.toArrayLike(Buffer, "le", 8));
    
    // 3. slippage_tolerance: Option<u16> - None (using min_out)
    buffers.push(Buffer.from([0]));
    
    // 4. twap_slices: Option<u8> - None
    buffers.push(Buffer.from([0]));
    
    // 5. use_dynamic_plan: bool
    buffers.push(Buffer.from([args.useDynamicPlan ? 1 : 0]));
    
    // 6. plan_account: Option<Pubkey>
    if (args.useDynamicPlan && args.planAccount) {
      buffers.push(Buffer.from([1])); // Some
      buffers.push(args.planAccount.toBuffer());
    } else {
      buffers.push(Buffer.from([0])); // None
    }
    
    // 7. use_bundle: bool
    buffers.push(Buffer.from([args.useBundle ? 1 : 0]));
    
    // 8. primary_oracle_account: Pubkey
    buffers.push(args.primaryOracleAccount.toBuffer());
    
    // 9. fallback_oracle_account: Option<Pubkey> - None
    buffers.push(Buffer.from([0]));
    
    // 10. direct_dex_venue: Option<Pubkey> - The DEX program for native swap!
    if (args.directDexVenue) {
      buffers.push(Buffer.from([1])); // Some
      buffers.push(args.directDexVenue.toBuffer());
    } else {
      buffers.push(Buffer.from([0])); // None
    }
    
    // 11. jupiter_route: Option<JupiterRouteParams> - None (using direct DEX)
    buffers.push(Buffer.from([0]));
    
    // 12. jupiter_swap_ix_data: Option<Vec<u8>> - None
    buffers.push(Buffer.from([0]));
    
    // 13. liquidity_estimate: Option<u64> - None
    buffers.push(Buffer.from([0]));
    
    // 14. volatility_bps: Option<u16> - None
    buffers.push(Buffer.from([0]));
    
    // 15. min_venue_score: Option<u16> - None
    buffers.push(Buffer.from([0]));
    
    // 16. slippage_per_venue: Option<Vec<VenueSlippage>> - None
    buffers.push(Buffer.from([0]));
    
    // 17. token_a_decimals: Option<u8>
    if (args.tokenADecimals !== undefined) {
      buffers.push(Buffer.from([1, args.tokenADecimals]));
    } else {
      buffers.push(Buffer.from([0]));
    }
    
    // 18. token_b_decimals: Option<u8>
    if (args.tokenBDecimals !== undefined) {
      buffers.push(Buffer.from([1, args.tokenBDecimals]));
    } else {
      buffers.push(Buffer.from([0]));
    }
    
    // 19. max_staleness_override: Option<i64>
    if (args.maxStalenessOverride !== undefined && args.maxStalenessOverride > 0) {
      const staleBuf = Buffer.alloc(9);
      staleBuf.writeUInt8(1, 0); // Some
      staleBuf.writeBigInt64LE(BigInt(args.maxStalenessOverride), 1);
      buffers.push(staleBuf);
    } else {
      buffers.push(Buffer.from([0]));
    }
    
    // 19. jito_bundle: Option<JitoBundleConfig> - None
    buffers.push(Buffer.from([0]));
    
    return Buffer.concat(buffers);
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

    if (DISABLED_BEST_ROUTE_VENUES.has(route.venue)) {
      throw new Error(
        `Venue native temporairement désactivée: ${route.venue}. ` +
          `Phoenix requiert une quote orderbook pour éviter les IOC failures (0xF).`
      );
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

    // Input side: gérer WSOL (wrap SOL -> WSOL) quand inputMint est So111...
    // - Créer l'ATA WSOL si absent
    // - Transférer uniquement le déficit (si solde WSOL < amountIn)
    // - syncNative pour refléter les lamports dans le amount SPL
    if (inputMint.equals(SOL_MINT)) {
      const userTokenAccountA = await getAssociatedTokenAddress(
        inputMint,
        userPublicKey
      );

      const inputAtaInfo = await this.connection.getAccountInfo(userTokenAccountA);
      if (!inputAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPublicKey,
            userTokenAccountA,
            userPublicKey,
            inputMint
          )
        );
      }

      let currentWsolAmount = 0;
      try {
        if (inputAtaInfo) {
          const bal = await this.connection.getTokenAccountBalance(userTokenAccountA);
          currentWsolAmount = Number(bal.value.amount);
        }
      } catch {
        currentWsolAmount = 0;
      }

      const deficit = Math.max(0, amountIn - currentWsolAmount);
      if (deficit > 0) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: userTokenAccountA,
            lamports: deficit,
          })
        );
        instructions.push(createSyncNativeInstruction(userTokenAccountA));
      }
    }

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

    // 3. Ajouter l'instruction de swap (chemin direct: pas de SwapPlan)
    instructions.push(
      await this.buildNativeSwapInstruction(userPublicKey, route, params)
    );

    // 4. Construire la transaction versionnée
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();

    // Charger les ALTs (déjà des AddressLookupTableAccount prêts à l'emploi)
    const lookupTables = await getAllALTs(this.connection);

    const messageV0 = new TransactionMessage({
      payerKey: userPublicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(lookupTables);

    const transaction = new VersionedTransaction(messageV0);

    // Toujours retourner le PDA pour compat/debug (même si non créé en V1 direct)
    const [planPda] = this.deriveSwapPlanAddress(userPublicKey);

    return {
      transaction,
      route,
      planAccount: planPda,
      blockhash,
      lastValidBlockHeight,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TrueNativeSwap;
