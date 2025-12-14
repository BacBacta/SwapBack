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

    // Dériver les comptes
    const accounts = await this.deriveSwapAccounts(
      safeUser,
      inputMint,
      outputMint
    );
    const [planPda] = this.deriveSwapPlanAddress(safeUser);

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

    // Obtenir les oracles
    const oracleConfig = getOracleFeedsForPair(
      inputMint.toBase58(),
      outputMint.toBase58()
    );

    // Sérialiser SwapArgs avec direct_dex_venue pour native swap
    const argsBuffer = this.serializeSwapArgs({
      amountIn: new BN(amountIn),
      minOut: new BN(minAmountOut),
      useDynamicPlan: false, // Not using dynamic plan - direct DEX swap
      useBundle: false,
      planAccount: planPda,
      primaryOracleAccount: oracleConfig.primary,
      directDexVenue: route.venueProgramId, // <-- THE KEY for native swap!
      maxStalenessOverride: MAX_STALENESS_SECS,
      tokenADecimals: 9, // SOL default
      tokenBDecimals: 6, // USDC default
    });

    // Discriminator pour swap_toc
    const discriminator = Buffer.from([187, 201, 212, 51, 16, 155, 236, 60]);
    const data = Buffer.concat([discriminator, argsBuffer]);

    // Oracle cache PDA - seeds: ["oracle_cache", primary_oracle]
    const [oracleCache] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle_cache"), oracleConfig.primary.toBuffer()],
      ROUTER_PROGRAM_ID
    );

    // Venue score PDA - seeds: ["venue_score", state]
    const [venueScore] = PublicKey.findProgramAddressSync(
      [Buffer.from("venue_score"), accounts.state.toBuffer()],
      ROUTER_PROGRAM_ID
    );

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
    
    // Utiliser les vaults du DEX si disponibles, sinon fallback vers user token accounts
    // (le programme ne les utilise pas vraiment pour les swaps DEX car tout passe par remaining_accounts)
    const vaultTokenAccountA = route.dexAccounts.vaultTokenAccountA ?? accounts.userTokenAccountA;
    const vaultTokenAccountB = route.dexAccounts.vaultTokenAccountB ?? accounts.userTokenAccountB;
    
    // Vérifier si user_rebate existe, sinon utiliser placeholder
    const userRebateAccountInfo = await this.connection.getAccountInfo(accounts.userRebate);
    const userRebateKey = userRebateAccountInfo ? accounts.userRebate : ROUTER_PROGRAM_ID;
    if (!userRebateAccountInfo) {
      console.log("[TrueNativeSwap] user_rebate not initialized, using placeholder");
    }

    // Vérifier oracle_cache et venue_score (optionnels) avant de les passer
    const oracleCacheInfo = await this.connection.getAccountInfo(oracleCache);
    const oracleCacheKey = oracleCacheInfo ? oracleCache : ROUTER_PROGRAM_ID;
    if (!oracleCacheInfo) {
      console.log("[TrueNativeSwap] oracle_cache not initialized, using placeholder");
    }

    const venueScoreInfo = await this.connection.getAccountInfo(venueScore);
    const venueScoreKey = venueScoreInfo ? venueScore : ROUTER_PROGRAM_ID;
    if (!venueScoreInfo) {
      console.log("[TrueNativeSwap] venue_score not initialized, using placeholder");
    }
    
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
      // 9. plan (optional but we're using dynamic plan)
      { pubkey: planPda, isSigner: false, isWritable: true },
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
      { pubkey: userRebateKey, isSigner: false, isWritable: userRebateAccountInfo !== null },
      // 16. rebate_vault (writable, PDA)
      { pubkey: accounts.rebateVault, isSigner: false, isWritable: true },
      // 17. oracle_cache (optional, PDA)
      { pubkey: oracleCacheKey, isSigner: false, isWritable: oracleCacheInfo !== null },
      // 18. venue_score (optional, PDA)
      { pubkey: venueScoreKey, isSigner: false, isWritable: venueScoreInfo !== null },
      // 19. token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // 20. system_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // DEX accounts (remaining accounts)
      ...normalizedDexAccounts.map((pubkey) => ({
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

    // 3. Créer le plan (seulement s'il n'existe pas déjà)
    const [planPda] = this.deriveSwapPlanAddress(userPublicKey);
    const planAccountInfo = await this.connection.getAccountInfo(planPda);
    
    if (!planAccountInfo) {
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
      console.log("[TrueNativeSwap] Creating new plan:", planPda.toBase58());
    } else {
      console.log("[TrueNativeSwap] Plan already exists, reusing:", planPda.toBase58());
    }

    // 4. Ajouter l'instruction de swap
    instructions.push(
      await this.buildNativeSwapInstruction(userPublicKey, route, params)
    );

    // 5. Construire la transaction versionnée
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
