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
  Keypair,
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
const PRIORITY_FEE_MICRO_LAMPORTS = 500_000;
const COMPUTE_UNITS = 400_000;

// Phoenix (CLOB) requiert une quote orderbook (phoenix-sdk). Tant que ce n'est
// pas implémenté côté client, on l'exclut du best-route pour éviter les IOC
// failures (custom program error 0xF) dues à un minOut irréaliste.
// Best-route venues disabled until their quote->CPI coupling is proven reliable.
// - PHOENIX: quote orderbook not implemented (IOC failures).
// - RAYDIUM_AMM: REST quote can route through different pools than CPI (can trigger slippage failure 0x1e).
const DISABLED_BEST_ROUTE_VENUES = new Set<SupportedVenue>(["PHOENIX", "RAYDIUM_AMM"]);

// Venues pour lesquelles on a une implémentation de quote dans ce module.
const QUOTED_VENUES = new Set<SupportedVenue>([
  "ORCA_WHIRLPOOL",
  "METEORA_DLMM",
  "RAYDIUM_AMM",
]);

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
  /** Optionnel: minOut recommandé par le DEX (ex Raydium otherAmountThreshold) */
  minOutAmount?: number;
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
  /** Optionnel: forcer la route (évite un second choix/quote lors du build) */
  routeOverride?: TrueNativeRoute;
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getAccountInfoWithRetry(pubkey: PublicKey): Promise<Awaited<ReturnType<Connection["getAccountInfo"]>>> {
    // web3.js a déjà un retry interne, mais sur certains RPC publics ça reste insuffisant.
    // On ajoute une couche de backoff supplémentaire pour éviter les échecs non déterministes en simulate.
    const delaysMs = [500, 1000, 2000, 4000, 8000, 12000];
    let lastErr: unknown;
    for (let i = 0; i < delaysMs.length; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await this.connection.getAccountInfo(pubkey);
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        const is429 = msg.includes("429") || msg.toLowerCase().includes("rate limit");
        if (!is429) throw e;
        // eslint-disable-next-line no-await-in-loop
        await this.sleep(delaysMs[i]);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
    userPublicKey: PublicKey,
    slippageBps?: number,
    venuesOverride?: SupportedVenue[]
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

    const venuesToResolve = venuesOverride?.length ? venuesOverride : Array.from(QUOTED_VENUES);

    // Résoudre uniquement les comptes des venues pertinentes.
    const allAccounts = await getAllDEXAccounts(
      this.connection,
      safeInputMint,
      safeOutputMint,
      safeUser,
      venuesToResolve
    );

    logger.info("TrueNativeSwap", "DEX accounts resolved", {
      venuesWithAccounts: Array.from(allAccounts.keys()),
      count: allAccounts.size,
    });

    if (allAccounts.size === 0) {
      logger.warn("TrueNativeSwap", "No DEX pools found for this pair", {
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
      });
    }

    // Pour chaque venue disponible, obtenir une quote
    for (const [venue, accounts] of allAccounts) {
      if (DISABLED_BEST_ROUTE_VENUES.has(venue)) {
        logger.debug("TrueNativeSwap", `Skipping disabled venue in best-route: ${venue}`);
        continue;
      }

      if (!QUOTED_VENUES.has(venue)) {
        logger.debug("TrueNativeSwap", `Skipping venue without quote implementation: ${venue}`);
        continue;
      }
      try {
        const startTime = Date.now();
        const quote = await this.getQuoteForVenue(
          venue,
          safeInputMint,
          safeOutputMint,
          amountIn,
          accounts,
          slippageBps
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
            minOutAmount: quote.minOutAmount,
            accounts,
            latencyMs,
          });

          logger.debug("TrueNativeSwap", `Quote from ${venue}`, {
            outputAmount: quote.outputAmount,
            priceImpactBps: quote.priceImpactBps,
            latencyMs,
          });
        } else {
          if (venue === "ORCA_WHIRLPOOL") {
            logger.debug("TrueNativeSwap", `Quote returned null for ${venue}`, {
              poolAddress: accounts.meta?.poolAddress || "none",
              latencyMs,
            });
          } else {
            const payload = {
              poolAddress: accounts.meta?.poolAddress || "none",
              latencyMs,
            };

            if (venue === "LIFINITY") {
              logger.debug("TrueNativeSwap", `Quote returned null for ${venue}`, payload);
            } else {
              logger.warn("TrueNativeSwap", `Quote returned null for ${venue}`, payload);
            }
          }
        }
      } catch (error) {
        logger.warn("TrueNativeSwap", `Failed to get quote from ${venue}`, { error });
      }
    }

    // Trier par meilleur output
    quotes.sort((a, b) => b.outputAmount - a.outputAmount);

    // IMPORTANT:
    // Raydium REST quote peut router via d'autres pools que ceux utilisés en CPI,
    // et sans comptes DEX résolus on ne peut pas exécuter la route de manière fiable.
    // On laisse un flag explicite pour debug uniquement.
    const enableRaydiumApiFallback = process.env.SWAPBACK_ENABLE_RAYDIUM_API_FALLBACK === "true";
    if (enableRaydiumApiFallback && quotes.length === 0 && !allAccounts.has("RAYDIUM_AMM")) {
      logger.info("TrueNativeSwap", "Trying Raydium API fallback (debug flag enabled)");
      try {
        const startTime = Date.now();
        const emptyAccounts: DEXAccounts = {
          accounts: [],
          vaultTokenAccountA: safeInputMint,
          vaultTokenAccountB: safeOutputMint,
          meta: { venue: "RAYDIUM_AMM", poolAddress: "", feeRate: 0.0025 },
        };
        const raydiumQuote = await this.getRaydiumQuote(
          safeInputMint,
          safeOutputMint,
          amountIn,
          emptyAccounts,
          slippageBps
        );
        const latencyMs = Date.now() - startTime;

        if (raydiumQuote) {
          quotes.push({
            venue: "RAYDIUM_AMM",
            venueProgramId: DEX_PROGRAM_IDS.RAYDIUM_AMM,
            inputAmount: amountIn,
            outputAmount: raydiumQuote.outputAmount,
            priceImpactBps: raydiumQuote.priceImpactBps,
            minOutAmount: raydiumQuote.minOutAmount,
            accounts: emptyAccounts,
            latencyMs,
          });
          logger.info("TrueNativeSwap", "Raydium API fallback succeeded", {
            outputAmount: raydiumQuote.outputAmount,
            latencyMs,
          });
        }
      } catch (err) {
        logger.warn("TrueNativeSwap", "Raydium API fallback failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

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
    accounts: DEXAccounts,
    slippageBps?: number
  ): Promise<{ outputAmount: number; priceImpactBps: number; minOutAmount?: number } | null> {
    switch (venue) {
      case "ORCA_WHIRLPOOL":
        return this.getOrcaQuote(inputMint, outputMint, amountIn, accounts, slippageBps);
      case "METEORA_DLMM":
        return this.getMeteoraQuote(inputMint, outputMint, amountIn, accounts, slippageBps);
      case "RAYDIUM_AMM":
        return this.getRaydiumQuote(inputMint, outputMint, amountIn, accounts, slippageBps);
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
    accounts: DEXAccounts,
    slippageBps?: number
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    try {
      const bpsRaw = typeof slippageBps === "number" && Number.isFinite(slippageBps) ? slippageBps : 50;
      const bps = Math.min(10_000, Math.max(0, Math.floor(bpsRaw)));

      const isNode = typeof window === "undefined";

      // En Node/tsx (scripts): utiliser l'Orca Whirlpools SDK (quote on-chain)
      // pour éviter les incidents REST (Cloudflare, payloads non-JSON, 1016, etc.).
      if (isNode) {
        const poolAddress = accounts.meta.poolAddress;
        if (!poolAddress) return null;

        const [{ AnchorProvider }, { Percentage }, whirlpools] = await Promise.all([
          import("@coral-xyz/anchor"),
          import("@orca-so/common-sdk"),
          import("@orca-so/whirlpools-sdk"),
        ]);

        const {
          WhirlpoolContext,
          buildWhirlpoolClient,
          swapQuoteByInputToken,
          UseFallbackTickArray,
        } = whirlpools as any;

        const payer = Keypair.generate();
        // Wallet readonly: suffisant pour lire/quote via SDK.
        const wallet: any = {
          publicKey: payer.publicKey,
          payer,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signTransaction: async (tx: any) => tx,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signAllTransactions: async (txs: any[]) => txs,
        };

        const provider = new AnchorProvider(this.connection, wallet, AnchorProvider.defaultOptions());
        const context = WhirlpoolContext.withProvider(provider);
        const client = buildWhirlpoolClient(context);

        const pool = await client.getPool(new PublicKey(poolAddress));
        await pool.refreshData();

        const slippage = Percentage.fromFraction(bps, 10_000);
        const quote = await swapQuoteByInputToken(
          pool,
          inputMint,
          new BN(amountIn.toString()),
          slippage,
          DEX_PROGRAM_IDS.ORCA_WHIRLPOOL,
          context.fetcher,
          undefined,
          UseFallbackTickArray.Situational
        );

        const outputAmount = Number(quote?.estimatedAmountOut?.toString?.() ?? 0);
        if (!Number.isFinite(outputAmount) || outputAmount <= 0) {
          return null;
        }

        return { outputAmount, priceImpactBps: 0 };
      }

      // En navigateur: passer par /api/dex/* (évite CORS).
      const url =
        `/api/dex/orca/quote?` +
        new URLSearchParams({
          inputMint: inputMint.toBase58(),
          outputMint: outputMint.toBase58(),
          amount: amountIn.toString(),
          pool: accounts.meta.poolAddress || "",
          slippageBps: bps.toString(),
        });

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const payload = {
          status: response.status,
          error: errorText.slice(0, 200),
        };
        if (response.status === 502) {
          logger.debug("TrueNativeSwap", "Orca API error", payload);
        } else {
          logger.warn("TrueNativeSwap", "Orca API error", payload);
        }
        return null;
      }

      const data = await response.json();
      const outputAmount = Number(data.outputAmount ?? data.outAmount ?? 0);
      // /api/dex/orca/quote renvoie priceImpactBps; l'upstream renvoie priceImpactPercent.
      const priceImpactBps = Number(
        data.priceImpactBps ??
          (typeof data.priceImpactPercent === "number"
            ? Math.round(data.priceImpactPercent * 100)
            : (typeof data.priceImpact === "number" ? data.priceImpact * 10000 : 0))
      );

      if (!Number.isFinite(outputAmount) || outputAmount <= 0) {
        logger.warn("TrueNativeSwap", "Orca quote invalid output", {
          outputAmount,
          data: JSON.stringify(data).slice(0, 200),
        });
        return null;
      }

      return {
        outputAmount,
        priceImpactBps: Number.isFinite(priceImpactBps) ? priceImpactBps : 0,
      };
    } catch (err) {
      logger.warn("TrueNativeSwap", "Orca quote exception", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Quote Meteora DLMM via API
   */
  private async getMeteoraQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts,
    slippageBps?: number
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    try {
      const bpsRaw = typeof slippageBps === "number" && Number.isFinite(slippageBps) ? slippageBps : 50;
      const bps = Math.min(10_000, Math.max(0, Math.floor(bpsRaw)));

      const isNode = typeof window === "undefined";
      if (isNode) {
        const pairAddress = accounts.meta.poolAddress;
        if (!pairAddress) return null;

        // Note: en Node ESM, l'import ESM de @meteora-ag/dlmm peut échouer
        // (résolution Anchor "Directory import ... not supported").
        // En scripts/serveur, on préfère charger la build CJS via createRequire().
        let dlmmMod: any;
        try {
          const nodeModule: any = await import(/* webpackIgnore: true */ "node:module");
          const createRequire = nodeModule?.createRequire;
          if (typeof createRequire === "function") {
            const req = createRequire(import.meta.url);
            dlmmMod = req("@meteora-ag/dlmm");
          } else {
            dlmmMod = await import("@meteora-ag/dlmm");
          }
        } catch (e) {
          try {
            dlmmMod = await import("@meteora-ag/dlmm");
          } catch (e2) {
            logger.warn("TrueNativeSwap", "Meteora DLMM module load failed", {
              error: e2 instanceof Error ? e2.message : String(e2),
            });
            return null;
          }
        }

        const DLMM: any = (dlmmMod as any)?.DLMM ?? (dlmmMod as any)?.default ?? dlmmMod;

        const dlmm = await DLMM.create(this.connection, new PublicKey(pairAddress));
        const tokenXMint: PublicKey =
          dlmm?.tokenX?.mint?.address ?? dlmm?.tokenX?.mint?.publicKey ?? dlmm?.tokenX?.publicKey;
        const tokenYMint: PublicKey =
          dlmm?.tokenY?.mint?.address ?? dlmm?.tokenY?.mint?.publicKey ?? dlmm?.tokenY?.publicKey;
        if (!tokenXMint || !tokenYMint) return null;

        const quoteMint =
          tokenXMint.equals(SOL_MINT) || tokenXMint.equals(USDC_MINT) ? tokenXMint : tokenYMint;
        const isSupportedQuote = quoteMint.equals(SOL_MINT) || quoteMint.equals(USDC_MINT);
        if (!isSupportedQuote) return null;

        const swapForY = inputMint.equals(quoteMint);
        let binArrayAccounts: Array<{ publicKey: PublicKey }> = [];
        for (const depth of [5, 20, 60]) {
          // eslint-disable-next-line no-await-in-loop
          binArrayAccounts = await dlmm.getBinArrayForSwap(swapForY, depth);
          if (binArrayAccounts.length > 0) break;
        }
        if (binArrayAccounts.length === 0) return null;

        const quote = await dlmm.swapQuote(
          new BN(amountIn.toString()),
          swapForY,
          new BN(bps.toString()),
          binArrayAccounts
        );

        const outAmountStr = quote?.outAmount?.toString?.() ?? "0";
        const outAmount = Number(outAmountStr);
        if (!Number.isFinite(outAmount) || outAmount <= 0) return null;
        return { outputAmount: outAmount, priceImpactBps: 0 };
      }

      const response = await fetch(
        `/api/dex/meteora/quote?` +
          new URLSearchParams({
            inputMint: inputMint.toBase58(),
            outputMint: outputMint.toBase58(),
            amount: amountIn.toString(),
            pairAddress: accounts.meta.poolAddress || "",
            slippageBps: bps.toString(),
          }),
        { signal: AbortSignal.timeout(8000) }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.warn("TrueNativeSwap", "Meteora API error", {
          status: response.status,
          poolAddress: accounts.meta.poolAddress,
          error: errorText.slice(0, 200),
        });
        return null;
      }

      const data = await response.json();
      const outputAmount = Number(data.outputAmount ?? data.outAmount ?? 0);
      
      if (!Number.isFinite(outputAmount) || outputAmount <= 0) {
        logger.warn("TrueNativeSwap", "Meteora quote invalid output", {
          outputAmount,
          data: JSON.stringify(data).slice(0, 200),
        });
        return null;
      }
      
      return {
        outputAmount,
        priceImpactBps:
          typeof data.priceImpactBps === "number" && Number.isFinite(data.priceImpactBps)
            ? data.priceImpactBps
            : (Number(data.priceImpact || 0) || 0) * 10000,
      };
    } catch (err) {
      logger.warn("TrueNativeSwap", "Meteora quote exception", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Quote Raydium AMM via API
   */
  private async getRaydiumQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts,
    slippageBps?: number
  ): Promise<{ outputAmount: number; priceImpactBps: number; minOutAmount?: number } | null> {
    const poolId = accounts.meta.poolAddress;
    
    // Note: Si poolId est absent, on laisse l'API Raydium router automatiquement.
    // C'est moins sûr (risque de décalage quote/CPI) mais permet d'obtenir des quotes.
    if (!poolId) {
      logger.debug("TrueNativeSwap", "Raydium quote without specific poolId", {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        amountIn,
      });
    }
    
    try {
      const isNode = typeof window === "undefined";
      const params: Record<string, string> = {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        amount: amountIn.toString(),
      };
      
      if (poolId) {
        params.poolId = poolId;
      }
      
      if (typeof slippageBps === "number" && Number.isFinite(slippageBps)) {
        params.slippageBps = Math.floor(slippageBps).toString();
      }
      
      const query = new URLSearchParams(params);
      const url = isNode
        ? `https://transaction-v1.raydium.io/compute/swap-base-in?` +
          new URLSearchParams({
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            amount: params.amount,
            slippageBps: params.slippageBps ?? "50",
            txVersion: "V0",
            ...(params.poolId ? { poolId: params.poolId } : {}),
          })
        : `/api/dex/raydium/quote?` + query;

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.warn("TrueNativeSwap", "Raydium API error", {
          status: response.status,
          poolId,
          error: errorText.slice(0, 200),
        });
        return null;
      }

      const data = await response.json();

      // Normaliser format: /api/dex/raydium/quote renvoie directement outputAmount;
      // l'upstream renvoie { success, data: { outputAmount, otherAmountThreshold, priceImpactPct, ... } }
      const normalizedOutput = data?.data?.outputAmount ?? data?.outputAmount ?? 0;
      const normalizedMinOut = data?.data?.otherAmountThreshold ?? data?.minOutAmount;
      const outputAmount = Number(normalizedOutput);
      if (!Number.isFinite(outputAmount) || outputAmount <= 0) {
        logger.warn("TrueNativeSwap", "Raydium quote invalid output", {
          outputAmount,
          data: JSON.stringify(data).slice(0, 200),
        });
        return null;
      }

      // Vérifier que le poolId retourné correspond à celui demandé (si on passe par la route interne)
      if (!isNode && data.poolId && data.poolId !== poolId) {
        logger.warn("TrueNativeSwap", "Raydium API returned quote for different pool", {
          requestedPoolId: poolId,
          returnedPoolId: data.poolId,
          hint: "Using returned quote but CPI might target different pool",
        });
      }

      const priceImpactPctRaw = data?.data?.priceImpactPct ?? data?.priceImpactPct ?? data?.priceImpact;
      const priceImpactPct = typeof priceImpactPctRaw === "string" ? Number(priceImpactPctRaw) : Number(priceImpactPctRaw ?? 0);

      return {
        outputAmount,
        // priceImpactPct upstream est un % (ex: 0.15 = 0.15%) ; on convertit en bps.
        priceImpactBps: Number.isFinite(priceImpactPct) ? Math.round(priceImpactPct * 100) : 0,
        minOutAmount:
          typeof normalizedMinOut === "number" && Number.isFinite(normalizedMinOut)
            ? normalizedMinOut
            : typeof normalizedMinOut === "string" && Number.isFinite(Number(normalizedMinOut))
              ? Number(normalizedMinOut)
            : undefined,
      };
    } catch (err) {
      logger.warn("TrueNativeSwap", "Raydium quote exception", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
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

    const venuesForBestRoute = Array.from(QUOTED_VENUES).filter(
      (v) => !DISABLED_BEST_ROUTE_VENUES.has(v)
    );

    const quotes = await this.getNativeQuotes(
      inputMintPk,
      outputMintPk,
      amountIn,
      userPk,
      params.slippageBps,
      venuesForBestRoute
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

    // IMPORTANT: l'ATA dépend du token program (Tokenkeg vs Token-2022).
    // Si on dérive avec le mauvais programId, le router on-chain peut:
    // - inférer une mauvaise direction (ctx.user_token_account_a/b mismatch)
    // - provoquer TransferChecked: "Account not associated with this Mint" (0x3)
    const [inputMintInfo, outputMintInfo] = await Promise.all([
      this.getAccountInfoWithRetry(safeInput),
      this.getAccountInfoWithRetry(safeOutput),
    ]);
    if (!inputMintInfo) {
      throw new Error(`Mint introuvable (input): ${safeInput.toBase58()}`);
    }
    if (!outputMintInfo) {
      throw new Error(`Mint introuvable (output): ${safeOutput.toBase58()}`);
    }

    const inputTokenProgram = inputMintInfo.owner;
    const outputTokenProgram = outputMintInfo.owner;

    const userTokenAccountA = await getAssociatedTokenAddress(
      safeInput,
      safeUser,
      false,
      inputTokenProgram
    );
    const userTokenAccountB = await getAssociatedTokenAddress(
      safeOutput,
      safeUser,
      false,
      outputTokenProgram
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
    const amountIn = Math.floor(params.amountIn);
    const minAmountOut = Math.floor(params.minAmountOut);

    if (!Number.isFinite(amountIn) || amountIn <= 0) {
      throw new Error(
        "Invalid amountIn for SwapToc: must be > 0 (in base units/lamports)."
      );
    }

    // Phoenix (CLOB) n'est pas exécutable sans quote orderbook fiable.
    // Défense en profondeur: gate aussi sur le programId (même si la route est mal étiquetée).
    if (
      DISABLED_BEST_ROUTE_VENUES.has(route.venue) ||
      route.venueProgramId?.equals?.(DEX_PROGRAM_IDS.PHOENIX)
    ) {
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

    // Défense en profondeur: vérifier la cohérence on-chain des ATAs et des reserves
    try {
      const { AccountLayout } = await import("@solana/spl-token");

      // Vérifier les ATAs utilisateurs (mint match)
      const [userAInfo, userBInfo] = await Promise.all([
        this.connection.getAccountInfo(accounts.userTokenAccountA),
        this.connection.getAccountInfo(accounts.userTokenAccountB),
      ]);

      if (userAInfo?.data) {
        try {
          const decoded = AccountLayout.decode(userAInfo.data);
          const ataMint = new PublicKey(decoded.mint);
          if (!ataMint.equals(inputMint)) {
            throw new Error(`User ATA A mint mismatch: expected ${inputMint.toBase58()} got ${ataMint.toBase58()}`);
          }
        } catch (e) {
          throw new Error(`Failed ATA A sanity check: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (userBInfo?.data) {
        try {
          const decoded = AccountLayout.decode(userBInfo.data);
          const ataMint = new PublicKey(decoded.mint);
          if (!ataMint.equals(outputMint)) {
            throw new Error(`User ATA B mint mismatch: expected ${outputMint.toBase58()} got ${ataMint.toBase58()}`);
          }
        } catch (e) {
          throw new Error(`Failed ATA B sanity check: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Vérifier les reserves fournies par le DEX (seulement pour Meteora)
      if (route.venue === "METEORA_DLMM") {
        const vaults = [route.dexAccounts.vaultTokenAccountA, route.dexAccounts.vaultTokenAccountB].filter(Boolean) as PublicKey[];
        if (vaults.length === 2) {
          const [rxInfo, ryInfo] = await this.connection.getMultipleAccountsInfo(vaults);
          if (rxInfo?.data && ryInfo?.data) {
            const rx = AccountLayout.decode(rxInfo.data);
            const ry = AccountLayout.decode(ryInfo.data);
            const rxMint = new PublicKey(rx.mint);
            const ryMint = new PublicKey(ry.mint);

            const tokenXFromDex = route.dexAccounts.accounts[6];
            const tokenYFromDex = route.dexAccounts.accounts[7];
            if (!rxMint.equals(tokenXFromDex) && !rxMint.equals(tokenYFromDex)) {
              throw new Error(`Reserve X mint ${rxMint.toBase58()} does not match tokenX/tokenY from DEX`);
            }
            if (!ryMint.equals(tokenXFromDex) && !ryMint.equals(tokenYFromDex)) {
              throw new Error(`Reserve Y mint ${ryMint.toBase58()} does not match tokenX/tokenY from DEX`);
            }
          }
        }
      }
    } catch (e) {
      // Faire échouer la construction de la transaction avec un message lisible
      logger.error("TrueNativeSwap", "Pre-swap sanity check failed", { error: e instanceof Error ? e.message : String(e) });
      throw new Error(`Pre-swap sanity check failed: ${e instanceof Error ? e.message : String(e)}`);
    }

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
    const amountIn = Math.floor(params.amountIn);
    const slippageBps = params.slippageBps;

    logger.info("TrueNativeSwap", "Building true native swap transaction", {
      inputMint: inputMint.toBase58().slice(0, 8),
      outputMint: outputMint.toBase58().slice(0, 8),
      amountIn,
      slippageBps,
    });

    if (!Number.isFinite(amountIn) || amountIn <= 0) {
      throw new Error(
        "Invalid amountIn for native swap: must be > 0 (in base units/lamports). " +
          "If you typed a decimal amount, ensure it did not round down to 0."
      );
    }

    if (!Number.isSafeInteger(amountIn)) {
      throw new Error(
        "Invalid amountIn for native swap: amountIn must be a safe integer number of base units."
      );
    }

    // 1. Obtenir la meilleure route native (ou utiliser celle déjà calculée)
    const route =
      params.routeOverride ??
      (await this.getBestNativeRoute({
        inputMint,
        outputMint,
        amountIn,
        minAmountOut: 0,
        slippageBps,
        userPublicKey,
      }));
    if (!route) {
      logger.error("TrueNativeSwap", "No native route available");
      return null;
    }

    if (
      DISABLED_BEST_ROUTE_VENUES.has(route.venue) ||
      route.venueProgramId?.equals?.(DEX_PROGRAM_IDS.PHOENIX)
    ) {
      throw new Error(
        `Venue native temporairement désactivée: ${route.venue}. ` +
          `Phoenix requiert une quote orderbook pour éviter les IOC failures (0xF).`
      );
    }

    logger.info("TrueNativeSwap", `Best route: ${route.venue}`, {
      outputAmount: route.outputAmount,
      priceImpactBps: route.priceImpactBps,
    });

    // MinOut strict dérivé de la route réellement utilisée + slippage utilisateur.
    // IMPORTANT: Raydium renvoie `otherAmountThreshold` (minOut) qui peut inclure
    // des détails spécifiques (arrondis/frais) et doit être préféré pour éviter
    // "exceeds desired slippage limit" (custom program error: 0x1e).
    let minAmountOut = Math.max(
      0,
      Math.floor((route.outputAmount * (10_000 - slippageBps)) / 10_000)
    );

    if (route.venue === "RAYDIUM_AMM") {
      const raydiumQuote = await this.getRaydiumQuote(
        inputMint,
        outputMint,
        amountIn,
        route.dexAccounts,
        slippageBps
      );
      if (raydiumQuote?.minOutAmount && Number.isFinite(raydiumQuote.minOutAmount)) {
        const candidate = Math.max(0, Math.floor(raydiumQuote.minOutAmount));
        if (candidate > 0) {
          minAmountOut = candidate;
        }
      }
    }

    // Sanity: si minOut est supérieur au out estimé, la simulation échouera.
    if (minAmountOut > route.outputAmount) {
      logger.warn("TrueNativeSwap", "minAmountOut exceeds quoted outputAmount", {
        minAmountOut,
        outputAmount: route.outputAmount,
        venue: route.venue,
        slippageBps,
        hint: "MinOut should generally be <= quoted outAmount (after slippage)",
      });
    }

    logger.info("TrueNativeSwap", "Derived minAmountOut", {
      minAmountOut,
      slippageBps,
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

      const inputAtaInfo = await this.getAccountInfoWithRetry(userTokenAccountA);
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

    const outputMintInfo = await this.getAccountInfoWithRetry(outputMint);
    if (!outputMintInfo) {
      throw new Error(`Mint introuvable (output): ${outputMint.toBase58()}`);
    }
    const outputTokenProgram = outputMintInfo.owner;

    const userTokenAccountB = await getAssociatedTokenAddress(
      outputMint,
      userPublicKey,
      false,
      outputTokenProgram
    );
    const accountInfo = await this.getAccountInfoWithRetry(userTokenAccountB);
    if (!accountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userTokenAccountB,
          userPublicKey,
          outputMint,
          outputTokenProgram
        )
      );
    }

    // 3. Ajouter l'instruction de swap (chemin direct: pas de SwapPlan)
    // IMPORTANT: on force l'usage des montants dérivés/validés (évite amount_in=0 → 6014)
    const effectiveParams: TrueNativeSwapParams = {
      ...params,
      amountIn,
      minAmountOut,
    };
    instructions.push(
      await this.buildNativeSwapInstruction(userPublicKey, route, effectiveParams)
    );
    
    // Output side: si l'utilisateur a demandé du SOL natif, on swap vers WSOL
    // (So111...) puis on close le compte WSOL pour unwrap et renvoyer les lamports.
    // NOTE: on utilise l'ATA WSOL (créé ci-dessus si absent). Il sera recréé au besoin.
    if (outputMint.equals(SOL_MINT)) {
      // Certaines versions/bundles de @solana/spl-token n'exportent pas toujours
      // `createCloseAccountInstruction` de manière stable (CJS/ESM). On fait donc
      // un import dynamique + fallback sur une instruction CloseAccount manuelle.
      let closeIx: TransactionInstruction | null = null;

      try {
        const spl: any = await import("@solana/spl-token");
        const createClose =
          spl?.createCloseAccountInstruction ??
          spl?.default?.createCloseAccountInstruction;

        if (typeof createClose === "function") {
          closeIx = createClose(
            userTokenAccountB, // account
            userPublicKey, // destination
            userPublicKey // owner
          );
        }
      } catch {
        // ignore
      }

      if (!closeIx) {
        // SPL Token CloseAccount instruction (Tokenkeg): tag = 9
        // Accounts: [account (w), destination (w), owner (signer)]
        closeIx = new TransactionInstruction({
          programId: TOKEN_PROGRAM_ID,
          keys: [
            { pubkey: userTokenAccountB, isSigner: false, isWritable: true },
            { pubkey: userPublicKey, isSigner: false, isWritable: true },
            { pubkey: userPublicKey, isSigner: true, isWritable: false },
          ],
          data: Buffer.from([9]),
        });
      }

      instructions.push(closeIx);
    }

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
