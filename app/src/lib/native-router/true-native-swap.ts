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
import { getOracleFeedsForPair, hasOracleForPair } from "@/config/oracles";
import { getAllALTs } from "@/lib/alt/swapbackALT";
import {
  DEXAccounts,
  SupportedVenue,
  getDEXAccounts,
  getAllDEXAccounts,
} from "./dex/DEXAccountResolvers";
import { toPublicKey, toBase58Safe } from "./utils/publicKeyUtils";
import {
  getRoutingConfig,
  getEnabledVenues,
  isVenueEnabled,
  calculateDynamicSlippage,
  type VenueConfig,
} from "@/config/routing";
import { benchmarkAgainstJupiter } from "./split-route";
import { getTokenPrice } from "@/lib/price-service";
import { VOLATILE_TOKEN_MINTS } from "./index";

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

// Configuration - Now loaded from centralized config
// @see app/src/config/routing.ts
const PRIORITY_FEE_MICRO_LAMPORTS = 500_000;
const COMPUTE_UNITS = 400_000;

/**
 * Retourne les venues désactivées pour le routing.
 * Utilise la configuration centralisée au lieu de constantes hardcodées.
 * 
 * CHANGEMENT v2.0 (Dec 20, 2025):
 * - PHOENIX et RAYDIUM_AMM sont maintenant ACTIVÉS via routing.ts
 * - La désactivation est gérée dynamiquement via isVenueEnabled()
 */
function getDisabledVenues(): Set<SupportedVenue> {
  const config = getRoutingConfig();
  const disabled = new Set<SupportedVenue>();
  
  for (const venue of config.venues) {
    if (!venue.enabled) {
      disabled.add(venue.id);
    }
  }
  
  return disabled;
}

/**
 * Retourne les venues avec implémentation de quote.
 * Utilise la configuration centralisée.
 */
function getQuotableVenueIds(): Set<SupportedVenue> {
  const config = getRoutingConfig();
  const quotable = new Set<SupportedVenue>();
  
  for (const venue of config.venues) {
    if (venue.enabled && venue.hasQuoteAPI) {
      quotable.add(venue.id);
    }
  }
  
  // Toujours inclure ces venues si elles sont activées (quote via SDK)
  if (isVenueEnabled("PHOENIX")) quotable.add("PHOENIX");
  
  return quotable;
}

/**
 * Retourne les venues prioritaires pour les quotes.
 * Triées par quotePriority de la configuration.
 */
function getPrimaryQuoteVenues(): SupportedVenue[] {
  const enabledVenues = getEnabledVenues();
  return enabledVenues
    .filter(v => v.hasQuoteAPI)
    .sort((a, b) => a.quotePriority - b.quotePriority)
    .slice(0, 3) // Top 3 venues
    .map(v => v.id);
}

// Legacy compatibility - dynamically computed getters
// Ces getters sont appelés à chaque utilisation pour obtenir la config à jour
const DISABLED_BEST_ROUTE_VENUES = {
  has: (venue: SupportedVenue) => getDisabledVenues().has(venue),
};

const QUOTED_VENUES = {
  has: (venue: SupportedVenue) => getQuotableVenueIds().has(venue),
  [Symbol.iterator]: () => getQuotableVenueIds()[Symbol.iterator](),
};

const PRIMARY_QUOTE_VENUES = {
  includes: (venue: SupportedVenue) => getPrimaryQuoteVenues().includes(venue),
};

// MAX_STALENESS_SECS from config
const MAX_STALENESS_SECS = getRoutingConfig().maxOracleStalenessSecs;

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

  /**
   * V1.1: support optionnel multi-hop (2 legs max).
   * Représente une exécution en 2 instructions `swap_toc` dans la même transaction:
   *   input → intermediate → output
   *
   * IMPORTANT:
   * - Le 2e leg utilise `amountIn = minOut(leg1)` pour éviter un échec "insufficient funds"
   *   si le 1er leg exécute moins bien que la quote (défense en profondeur).
   */
  multiHop?: {
    intermediateMint: PublicKey;
    firstLeg: {
      inputMint: PublicKey;
      outputMint: PublicKey;
      amountIn: number;
      minAmountOut: number;
      route: TrueNativeRoute;
    };
    secondLeg: {
      inputMint: PublicKey;
      outputMint: PublicKey;
      amountIn: number;
      minAmountOut: number;
      route: TrueNativeRoute;
    };
  };
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

// Cache pour les paires sans venue disponible (évite les appels inutiles)
// Clé: "inputMint:outputMint", Valeur: timestamp d'expiration
const pairNoVenueCache = new Map<string, number>();
const PAIR_NO_VENUE_CACHE_TTL_MS = 20_000; // 20 secondes - réduit pour retenter plus tôt

function getPairNoVenueKey(inputMint: string, outputMint: string): string {
  return `${inputMint}:${outputMint}`;
}

function isPairCachedAsNoVenue(inputMint: string, outputMint: string): boolean {
  const key = getPairNoVenueKey(inputMint, outputMint);
  const until = pairNoVenueCache.get(key);
  if (typeof until !== "number") return false;
  if (Date.now() <= until) return true;
  pairNoVenueCache.delete(key);
  return false;
}

function cachePairAsNoVenue(inputMint: string, outputMint: string): void {
  const key = getPairNoVenueKey(inputMint, outputMint);
  pairNoVenueCache.set(key, Date.now() + PAIR_NO_VENUE_CACHE_TTL_MS);
  
  // Limiter la taille du cache
  if (pairNoVenueCache.size > 200) {
    const firstKey = pairNoVenueCache.keys().next().value as string | undefined;
    if (firstKey) pairNoVenueCache.delete(firstKey);
  }
}

export class TrueNativeSwap {
  private connection: Connection;
  private mintDecimalsCache = new Map<string, number>();
  private mintOwnerCache = new Map<string, PublicKey>();
  private temporarilyDisabledVenues = new Map<SupportedVenue, number>();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  markVenueUnavailable(venue: SupportedVenue, ttlMs: number): void {
    const ttl = Math.max(0, Math.floor(ttlMs));
    if (ttl === 0) return;
    this.temporarilyDisabledVenues.set(venue, Date.now() + ttl);
  }

  private isVenueTemporarilyDisabled(venue: SupportedVenue): boolean {
    const until = this.temporarilyDisabledVenues.get(venue);
    if (typeof until !== "number") return false;
    if (Date.now() <= until) return true;
    this.temporarilyDisabledVenues.delete(venue);
    return false;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms (${label})`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const limit = Math.max(1, Math.floor(concurrency));
    const results = new Array<R>(items.length);

    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const current = nextIndex;
        nextIndex += 1;
        if (current >= items.length) return;
        // eslint-disable-next-line no-await-in-loop
        results[current] = await fn(items[current], current);
      }
    });

    await Promise.all(workers);
    return results;
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

  private async getMintOwner(mint: PublicKey): Promise<PublicKey> {
    const key = mint.toBase58();
    const cached = this.mintOwnerCache.get(key);
    if (cached) return cached;

    const mintInfo = await this.getAccountInfoWithRetry(mint);
    if (!mintInfo) {
      throw new Error(`Mint introuvable: ${key}`);
    }

    this.mintOwnerCache.set(key, mintInfo.owner);
    return mintInfo.owner;
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

    const inputMintStr = safeInputMint.toBase58();
    const outputMintStr = safeOutputMint.toBase58();

    // Fast-path: si cette paire est connue comme n'ayant pas de venue native,
    // retourner immédiatement un tableau vide (économise les appels réseau)
    if (isPairCachedAsNoVenue(inputMintStr, outputMintStr)) {
      logger.debug("TrueNativeSwap", "Pair cached as no-venue, skipping native quotes", {
        inputMint: inputMintStr.slice(0, 8),
        outputMint: outputMintStr.slice(0, 8),
      });
      return quotes;
    }

    logger.info("TrueNativeSwap", "Fetching native quotes", {
      inputMint: inputMintStr.slice(0, 8),
      outputMint: outputMintStr.slice(0, 8),
      amountIn,
    });

    const venuesToResolve = venuesOverride?.length ? venuesOverride : Array.from(getQuotableVenueIds());

    // Browser fast-path: avoid heavy RPC account resolution for quotes.
    // On /app/swap we only need a live quote; dex accounts can be resolved lazily at execution time.
    if (typeof window !== "undefined") {
      const bpsRaw = typeof slippageBps === "number" && Number.isFinite(slippageBps) ? slippageBps : 50;
      const bps = Math.min(10_000, Math.max(0, Math.floor(bpsRaw)));

      if (
        venuesToResolve.includes("ORCA_WHIRLPOOL") &&
        !this.isVenueTemporarilyDisabled("ORCA_WHIRLPOOL") &&
        !DISABLED_BEST_ROUTE_VENUES.has("ORCA_WHIRLPOOL")
      ) {
        try {
          const startTime = Date.now();
          const response = await fetch(
            `/api/dex/orca/quote?` +
              new URLSearchParams({
                inputMint: safeInputMint.toBase58(),
                outputMint: safeOutputMint.toBase58(),
                amount: amountIn.toString(),
                slippageBps: bps.toString(),
                forceFresh: "1",
              }),
            // Timeout réduit de 8s à 4s pour améliorer la latence perçue
            { signal: AbortSignal.timeout(4000), cache: "no-store" }
          );

          if (response.ok) {
            const data = await response.json();
            const outputAmount = Number(data.outputAmount ?? data.outAmount ?? 0);
            const priceImpactBps = Number(data.priceImpactBps ?? 0);
            const latencyMs = Date.now() - startTime;
            if (Number.isFinite(outputAmount) && outputAmount > 0) {
              quotes.push({
                venue: "ORCA_WHIRLPOOL",
                venueProgramId: DEX_PROGRAM_IDS.ORCA_WHIRLPOOL,
                inputAmount: amountIn,
                outputAmount,
                priceImpactBps: Number.isFinite(priceImpactBps) ? priceImpactBps : 0,
                accounts: {
                  accounts: [],
                  meta: {
                    venue: "ORCA_WHIRLPOOL",
                    poolAddress: typeof data.pool === "string" ? data.pool : undefined,
                  },
                },
                latencyMs,
              });
              quotes.sort((a, b) => b.outputAmount - a.outputAmount);
              return quotes;
            }
          } else {
            const errorText = await response.text().catch(() => "");
            logger.warn("TrueNativeSwap", "Browser fast-quote Orca failed", {
              status: response.status,
              error: errorText.slice(0, 200),
            });
            // Circuit breaker: désactiver temporairement Orca sur erreurs 5xx
            if (response.status >= 500 && response.status < 600) {
              // 30 secondes de cooldown sur erreur serveur
              this.markVenueUnavailable("ORCA_WHIRLPOOL", 30_000);
              logger.info("TrueNativeSwap", "Orca temporarily disabled (circuit breaker)", {
                status: response.status,
                cooldownMs: 30_000,
              });
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn("TrueNativeSwap", "Browser fast-quote Orca exception", {
            error: errMsg,
          });
          // Circuit breaker: timeout ou erreur réseau = désactiver 15 secondes
          if (errMsg.includes("Timeout") || errMsg.includes("abort") || errMsg.includes("network")) {
            this.markVenueUnavailable("ORCA_WHIRLPOOL", 15_000);
            logger.info("TrueNativeSwap", "Orca temporarily disabled (timeout/network)", {
              cooldownMs: 15_000,
            });
          }
        }
      }
      // If fast-path fails, fall back to the full resolver (may still work on some RPCs).
    }

    // Résoudre uniquement les comptes des venues pertinentes.
    const resolveStart = Date.now();
    const allAccounts = await getAllDEXAccounts(
      this.connection,
      safeInputMint,
      safeOutputMint,
      safeUser,
      venuesToResolve
    );
    const resolveLatencyMs = Date.now() - resolveStart;

    logger.info("TrueNativeSwap", "DEX accounts resolved", {
      venuesWithAccounts: Array.from(allAccounts.keys()),
      count: allAccounts.size,
      resolveLatencyMs,
    });

    if (allAccounts.size === 0) {
      logger.warn("TrueNativeSwap", "No DEX pools found for this pair", {
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
      });
    }

    // Pour chaque venue disponible, obtenir une quote (concurrence limitée pour réduire le temps total)
    const quoteConcurrencyRaw = Number(process.env.NEXT_PUBLIC_SWAPBACK_QUOTE_CONCURRENCY);
    const quoteConcurrency = Number.isFinite(quoteConcurrencyRaw) ? quoteConcurrencyRaw : 2;
    const quoteTimeoutRaw = Number(process.env.NEXT_PUBLIC_SWAPBACK_QUOTE_TIMEOUT_MS);
    // Timeout réduit de 12s à 6s pour améliorer la latence
    const quoteTimeoutMs = Number.isFinite(quoteTimeoutRaw) ? quoteTimeoutRaw : 6_000;

    const entries = Array.from(allAccounts.entries());
    const maybeQuotes = await this.mapWithConcurrency(entries, quoteConcurrency, async ([venue, accounts]) => {
      if (this.isVenueTemporarilyDisabled(venue)) {
        logger.debug("TrueNativeSwap", `Skipping temporarily disabled venue: ${venue}`);
        return null;
      }
      if (DISABLED_BEST_ROUTE_VENUES.has(venue)) {
        logger.debug("TrueNativeSwap", `Skipping disabled venue in best-route: ${venue}`);
        return null;
      }

      if (!QUOTED_VENUES.has(venue)) {
        logger.debug("TrueNativeSwap", `Skipping venue without quote implementation: ${venue}`);
        return null;
      }

      try {
        const startTime = Date.now();
        const quote = await this.withTimeout(
          this.getQuoteForVenue(venue, safeInputMint, safeOutputMint, amountIn, accounts, slippageBps),
          quoteTimeoutMs,
          `quote:${venue}`
        );
        const latencyMs = Date.now() - startTime;

        if (quote) {
          const venueProgramId = DEX_PROGRAM_IDS[venue];
          if (!venueProgramId) {
            logger.warn("TrueNativeSwap", `Unknown venue program ID for ${venue}`);
            return null;
          }

          logger.debug("TrueNativeSwap", `Quote from ${venue}`, {
            outputAmount: quote.outputAmount,
            priceImpactBps: quote.priceImpactBps,
            latencyMs,
          });

          return {
            venue,
            venueProgramId,
            inputAmount: amountIn,
            outputAmount: quote.outputAmount,
            priceImpactBps: quote.priceImpactBps,
            minOutAmount: quote.minOutAmount,
            accounts,
            latencyMs,
          } satisfies NativeVenueQuote;
        }

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

        return null;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn("TrueNativeSwap", `Failed to get quote from ${venue}`, { error: errMsg });
        
        // Circuit breaker: désactiver la venue sur timeout ou erreur grave
        if (errMsg.includes("Timeout") || errMsg.includes("503") || errMsg.includes("502")) {
          // Désactiver 20 secondes pour timeout, 30 pour erreurs 5xx
          const cooldownMs = errMsg.includes("Timeout") ? 20_000 : 30_000;
          this.markVenueUnavailable(venue, cooldownMs);
          logger.info("TrueNativeSwap", `${venue} temporarily disabled (circuit breaker)`, {
            reason: errMsg.slice(0, 100),
            cooldownMs,
          });
        }
        return null;
      }
    });

    for (const q of maybeQuotes) {
      if (q) quotes.push(q);
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

    // Si aucune quote trouvée, cacher cette paire comme "sans venue" pour 60 secondes
    // Cela évite de re-tenter les mêmes appels API pour des paires non supportées
    if (quotes.length === 0) {
      cachePairAsNoVenue(inputMintStr, outputMintStr);
      logger.info("TrueNativeSwap", "No native quotes found, caching pair as no-venue", {
        inputMint: inputMintStr.slice(0, 8),
        outputMint: outputMintStr.slice(0, 8),
        cacheTtlMs: PAIR_NO_VENUE_CACHE_TTL_MS,
      });
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
      case "LIFINITY":
        return this.getLifinityQuote(inputMint, outputMint, amountIn, accounts, slippageBps);
      case "SABER":
        return this.getSaberQuote(inputMint, outputMint, amountIn, accounts, slippageBps);
      case "PHOENIX":
        return this.getPhoenixQuote(inputMint, outputMint, amountIn, accounts);
      default:
        return null;
    }
  }

  /**
   * Quote Lifinity via SDK (on-chain quote).
   *
   * NOTE: Le SDK Lifinity choisit le pool 0 partir de la liste interne.
   * Cela peut diverger s'il existe plusieurs pools pour la mame paire.
   * On limite donc l'usage 0 la s0lection best-route + validation 0 la simulation.
   */
  private async getLifinityQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts,
    slippageBps?: number
  ): Promise<{ outputAmount: number; priceImpactBps: number; minOutAmount?: number } | null> {
    void accounts;
    try {
      const bpsRaw = typeof slippageBps === "number" && Number.isFinite(slippageBps) ? slippageBps : 50;
      const bps = Math.min(10_000, Math.max(0, Math.floor(bpsRaw)));

      // Lifinity SDK attend un pourcentage (ex: 0.5 = 0.5%).
      const slippagePercent = bps / 100;

      const { getAmountOut } = await import("@lifinity/sdk");
      const quote: any = await getAmountOut(
        this.connection,
        amountIn,
        inputMint,
        outputMint,
        slippagePercent
      );

      const outputAmount = Number(quote?.amountOut ?? 0);
      if (!Number.isFinite(outputAmount) || outputAmount <= 0) return null;

      const minOutAmount = Number(quote?.amountOutWithSlippage ?? 0);
      const priceImpactPct = Number(quote?.priceImpact ?? 0);
      const priceImpactBps = Number.isFinite(priceImpactPct) ? Math.round(priceImpactPct) : 0;

      return {
        outputAmount,
        priceImpactBps,
        minOutAmount: Number.isFinite(minOutAmount) && minOutAmount > 0 ? minOutAmount : undefined,
      };
    } catch (err) {
      logger.warn("TrueNativeSwap", "Lifinity quote exception", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Quote Saber (StableSwap) 0 partir des vaults r9solus.
   *
   * Impl0mentation conservatrice: approximation constant-product sur les vaults.
   * Pour les paires stables, cela sous-estime g9n0ralement la sortie (donc minOut plus s0r).
   */
  private async getSaberQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts,
    slippageBps?: number
  ): Promise<{ outputAmount: number; priceImpactBps: number; minOutAmount?: number } | null> {
    void inputMint;
    void outputMint;

    try {
      // Indexes align9s avec `getSaberAccounts` (DEXAccountResolvers.ts)
      const swapSource = accounts.accounts[4];
      const swapDestination = accounts.accounts[5];
      if (!swapSource || !swapDestination) return null;

      const [srcInfo, dstInfo] = await this.connection.getMultipleAccountsInfo(
        [swapSource, swapDestination],
        "confirmed"
      );
      if (!srcInfo || !dstInfo) return null;
      if (srcInfo.data.length < 72 || dstInfo.data.length < 72) return null;

      const reserveIn = srcInfo.data.readBigUInt64LE(64);
      const reserveOut = dstInfo.data.readBigUInt64LE(64);
      if (reserveIn <= 0n || reserveOut <= 0n) return null;

      const amountInBig = BigInt(Math.max(0, Math.floor(amountIn)));
      if (amountInBig <= 0n) return null;

      const outputBig = (amountInBig * reserveOut) / (reserveIn + amountInBig);
      const outputAmount = Number(outputBig);
      if (!Number.isFinite(outputAmount) || outputAmount <= 0) return null;

      const bpsRaw = typeof slippageBps === "number" && Number.isFinite(slippageBps) ? slippageBps : 50;
      const bps = Math.min(10_000, Math.max(0, Math.floor(bpsRaw)));
      const minOutAmount = Math.floor(outputAmount * (1 - bps / 10_000));

      return {
        outputAmount,
        priceImpactBps: 0,
        minOutAmount: minOutAmount > 0 ? minOutAmount : undefined,
      };
    } catch (err) {
      logger.warn("TrueNativeSwap", "Saber quote exception", {
        error: err instanceof Error ? err.message : String(err),
      });
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
          forceFresh: "1",
        });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });

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

        // Meteora DLMM SDK: `swapForY` correspond à la direction X->Y (output = tokenY).
        // IMPORTANT: utiliser la direction basée sur tokenX/tokenY, sinon on obtient des quotes absurdes
        // (ex: BONK->USDC qui renvoie des milliers de USDC pour quelques BONK) et l'exécution échoue.
        const hasSupportedQuote =
          tokenXMint.equals(SOL_MINT) ||
          tokenXMint.equals(USDC_MINT) ||
          tokenYMint.equals(SOL_MINT) ||
          tokenYMint.equals(USDC_MINT);
        if (!hasSupportedQuote) return null;

        const swapForY = inputMint.equals(tokenXMint);
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
            forceFresh: "1",
          }),
        { signal: AbortSignal.timeout(8000), cache: "no-store" }
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
        : `/api/dex/raydium/quote?` + new URLSearchParams({
            ...Object.fromEntries(query.entries()),
            forceFresh: "1",
          });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });

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
   * Quote Phoenix via estimation de prix
   * 
   * Phoenix est un CLOB (Central Limit Order Book) - pas d'API quote publique simple.
   * On utilise une estimation basée sur les prix du marché avec un spread conservateur.
   * 
   * CHANGEMENT v2.0 (Dec 20, 2025):
   * - Activé avec estimation basée sur les prix (comme venue-quotes API)
   * - Spread conservateur de 0.3% pour éviter les IOC failures
   * 
   * @see https://docs.phoenix.trade/
   */
  private async getPhoenixQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    accounts: DEXAccounts
  ): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
    try {
      // Vérifier que nous avons un market address
      if (!accounts?.meta?.poolAddress) {
        logger.debug("TrueNativeSwap", "Phoenix: no market address found");
        return null;
      }

      const inputMintStr = inputMint.toBase58();
      const outputMintStr = outputMint.toBase58();

      // Obtenir les prix des tokens via le service de prix centralisé
      const [inputPriceData, outputPriceData] = await Promise.all([
        getTokenPrice(inputMintStr),
        getTokenPrice(outputMintStr),
      ]);

      const inputPrice = inputPriceData.price;
      const outputPrice = outputPriceData.price;

      if (inputPrice <= 0 || outputPrice <= 0) {
        logger.debug("TrueNativeSwap", "Phoenix: unable to get token prices", {
          inputPrice,
          outputPrice,
        });
        return null;
      }

      // Déterminer les décimales des tokens
      const inputDecimals = inputMintStr === SOL_MINT.toBase58() ? 9 : 6;
      const outputDecimals = outputMintStr === SOL_MINT.toBase58() ? 9 : 6;

      // Calculer la valeur en USD de l'input
      const inputAmountNormalized = amountIn / Math.pow(10, inputDecimals);
      const inputValueUsd = inputAmountNormalized * inputPrice;

      // Calculer l'output estimé
      const outputAmountNormalized = inputValueUsd / outputPrice;
      const outputAmountRaw = Math.floor(outputAmountNormalized * Math.pow(10, outputDecimals));

      // Appliquer un spread conservateur de 0.3% (30 bps)
      // Phoenix CLOB peut avoir des spreads variables selon la liquidité
      const conservativeSpread = 0.997;
      const outputAmount = Math.floor(outputAmountRaw * conservativeSpread);

      if (outputAmount <= 0) {
        return null;
      }

      logger.debug("TrueNativeSwap", "Phoenix quote (estimated)", {
        inputMint: inputMintStr.slice(0, 8),
        outputMint: outputMintStr.slice(0, 8),
        amountIn,
        outputAmount,
        inputPrice,
        outputPrice,
        source: "price-estimation",
      });

      return {
        outputAmount,
        priceImpactBps: 30, // Impact conservateur pour CLOB
      };
    } catch (err) {
      logger.warn("TrueNativeSwap", "Phoenix quote estimation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
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

    // RouterSwap instruction: refuser avant signature si oracle manquant.
    // IMPORTANT V1.1 multi-hop: le gating oracle doit être évalué par *leg*
    // (input→USDC et USDC→output), pas uniquement sur la paire finale.
    const inputMintStr = inputMintPk.toBase58();
    const outputMintStr = outputMintPk.toBase58();
    const directOracleOk = hasOracleForPair(inputMintStr, outputMintStr);

    const venuesForBestRoute = Array.from(getQuotableVenueIds()).filter(
      (v) => !DISABLED_BEST_ROUTE_VENUES.has(v)
    );

    let quotes: NativeVenueQuote[] = [];
    if (directOracleOk) {
      const primaryVenuesList = getPrimaryQuoteVenues();
      const primaryVenues = venuesForBestRoute.filter((v) => primaryVenuesList.includes(v));
      const secondaryVenues = venuesForBestRoute.filter((v) => !primaryVenuesList.includes(v));

      const primaryQuotes = primaryVenues.length
        ? await this.getNativeQuotes(inputMintPk, outputMintPk, amountIn, userPk, params.slippageBps, primaryVenues)
        : [];

      if (primaryQuotes.length > 0 || secondaryVenues.length === 0) {
        quotes = primaryQuotes;
      } else {
        const secondaryQuotes = await this.getNativeQuotes(
          inputMintPk,
          outputMintPk,
          amountIn,
          userPk,
          params.slippageBps,
          secondaryVenues
        );
        quotes = [...primaryQuotes, ...secondaryQuotes];
        quotes.sort((a, b) => b.outputAmount - a.outputAmount);
      }
    }

    const bestDirect = quotes.find((q) => !DISABLED_BEST_ROUTE_VENUES.has(q.venue)) ?? null;

    // V1.1: Multi-hop simple A→USDC→B (2 legs max) pour améliorer la couverture.
    // NOTE: On limite volontairement aux venues avec quote+couplage CPI déjà prouvé (Orca/Meteora).
    let bestMultiHop: TrueNativeRoute | null = null;
    const slippageBps = params.slippageBps;
    const enableMultiHop = !inputMintPk.equals(USDC_MINT) && !outputMintPk.equals(USDC_MINT);

    // Optim perf: éviter de refaire deux séries de quotes (leg1+leg2) si une route directe existe déjà.
    // On peut ré-activer le "compare multi-hop vs direct" via flag si nécessaire.
    const multiHopCompareAlways = process.env.NEXT_PUBLIC_SWAPBACK_MULTI_HOP_COMPARE_ALWAYS === "true";

    if (enableMultiHop && (multiHopCompareAlways || !bestDirect)) {
      const usdcStr = USDC_MINT.toBase58();
      const canOracleLeg1 = hasOracleForPair(inputMintStr, usdcStr);
      const canOracleLeg2 = hasOracleForPair(usdcStr, outputMintStr);
      const multiHopVenues = venuesForBestRoute.filter(
        (v) => v === "ORCA_WHIRLPOOL" || v === "METEORA_DLMM"
      );

      if (canOracleLeg1 && canOracleLeg2 && multiHopVenues.length > 0) {
        try {
          const leg1Quotes = await this.getNativeQuotes(
            inputMintPk,
            USDC_MINT,
            amountIn,
            userPk,
            slippageBps,
            multiHopVenues
          );

          const leg1Best = leg1Quotes[0];
          if (leg1Best && leg1Best.outputAmount > 0) {
            const leg1MinOut = Math.max(
              0,
              Math.floor((leg1Best.outputAmount * (10_000 - slippageBps)) / 10_000)
            );

            if (leg1MinOut > 0) {
              const leg2Quotes = await this.getNativeQuotes(
                USDC_MINT,
                outputMintPk,
                leg1MinOut,
                userPk,
                slippageBps,
                multiHopVenues
              );

              const leg2Best = leg2Quotes[0];
              if (leg2Best && leg2Best.outputAmount > 0) {
                const leg2MinOut = Math.max(
                  0,
                  Math.floor((leg2Best.outputAmount * (10_000 - slippageBps)) / 10_000)
                );

                const leg1Route: TrueNativeRoute = {
                  venue: leg1Best.venue,
                  venueProgramId: leg1Best.venueProgramId,
                  inputAmount: leg1Best.inputAmount,
                  outputAmount: leg1Best.outputAmount,
                  priceImpactBps: leg1Best.priceImpactBps,
                  platformFeeBps: 15,
                  dexAccounts: leg1Best.accounts,
                  allQuotes: leg1Quotes,
                };

                const leg2Route: TrueNativeRoute = {
                  venue: leg2Best.venue,
                  venueProgramId: leg2Best.venueProgramId,
                  inputAmount: leg2Best.inputAmount,
                  outputAmount: leg2Best.outputAmount,
                  priceImpactBps: leg2Best.priceImpactBps,
                  platformFeeBps: 15,
                  dexAccounts: leg2Best.accounts,
                  allQuotes: leg2Quotes,
                };

                bestMultiHop = {
                  // Pour rester compatible avec le type `SupportedVenue`,
                  // on expose la venue du 2e leg comme "venue principale".
                  venue: leg2Best.venue,
                  venueProgramId: leg2Best.venueProgramId,
                  inputAmount: amountIn,
                  // Output conservateur: basé sur amountIn=leg1MinOut pour le 2e leg.
                  outputAmount: leg2Best.outputAmount,
                  priceImpactBps: (leg1Best.priceImpactBps ?? 0) + (leg2Best.priceImpactBps ?? 0),
                  platformFeeBps: 15,
                  dexAccounts: leg2Best.accounts,
                  // Exposer les 2 legs comme "quotes" pour que l'UI puisse au moins
                  // afficher les venues réellement exécutées.
                  allQuotes: [leg1Best, leg2Best],
                  multiHop: {
                    intermediateMint: USDC_MINT,
                    firstLeg: {
                      inputMint: inputMintPk,
                      outputMint: USDC_MINT,
                      amountIn,
                      minAmountOut: leg1MinOut,
                      route: leg1Route,
                    },
                    secondLeg: {
                      inputMint: USDC_MINT,
                      outputMint: outputMintPk,
                      amountIn: leg1MinOut,
                      minAmountOut: leg2MinOut,
                      route: leg2Route,
                    },
                  },
                };

                logger.info("TrueNativeSwap", "Multi-hop candidate built", {
                  legs: [leg1Best.venue, leg2Best.venue],
                  leg1Out: leg1Best.outputAmount,
                  leg1MinOut,
                  finalOut: leg2Best.outputAmount,
                });
              }
            }
          }
        } catch (err) {
          logger.warn("TrueNativeSwap", "Multi-hop quote failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (!bestDirect && !bestMultiHop) {
      if (!directOracleOk) {
        logger.warn("TrueNativeSwap", "Oracle missing for direct pair and multi-hop not available", {
          inputMint: inputMintStr,
          outputMint: outputMintStr,
        });
      } else {
        logger.warn("TrueNativeSwap", "No native venues available for this pair");
      }
      return null;
    }

    const selected =
      bestMultiHop && (!bestDirect || bestMultiHop.outputAmount > bestDirect.outputAmount)
        ? bestMultiHop
        : bestDirect
          ? {
              venue: bestDirect.venue,
              venueProgramId: bestDirect.venueProgramId,
              inputAmount: bestDirect.inputAmount,
              outputAmount: bestDirect.outputAmount,
              priceImpactBps: bestDirect.priceImpactBps,
              platformFeeBps: 15, // 0.15% platform fee
              dexAccounts: bestDirect.accounts,
              allQuotes: quotes,
            }
          : null;

    return selected;
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
    const [inputTokenProgram, outputTokenProgram] = await Promise.all([
      this.getMintOwner(safeInput),
      this.getMintOwner(safeOutput),
    ]);

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
    params: TrueNativeSwapParams,
    overrides?: {
      userTokenAccountA?: PublicKey;
      userTokenAccountB?: PublicKey;
    }
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

    // Vérifier que la venue est activée dans la configuration
    // Les venues désactivées dans routing.ts ne peuvent pas être exécutées
    if (DISABLED_BEST_ROUTE_VENUES.has(route.venue)) {
      throw new Error(
        `Venue native temporairement désactivée: ${route.venue}. ` +
          `Vérifiez la configuration dans routing.ts.`
      );
    }

    // Dériver les comptes
    const accounts = await this.deriveSwapAccounts(
      safeUser,
      inputMint,
      outputMint
    );

    const userTokenAccountA = overrides?.userTokenAccountA ?? accounts.userTokenAccountA;
    const userTokenAccountB = overrides?.userTokenAccountB ?? accounts.userTokenAccountB;

    // Si la quote a été obtenue via fast-path (browser), les dexAccounts peuvent être vides.
    // On résout alors les comptes DEX au moment de la construction du swap.
    if (!route.dexAccounts?.accounts?.length) {
      const resolved = await getDEXAccounts(this.connection, route.venue, inputMint, outputMint, safeUser);
      if (!resolved) {
        throw new Error(`Impossible de résoudre les comptes DEX pour ${route.venue} (${inputMint.toBase58()} -> ${outputMint.toBase58()})`);
      }
      route.dexAccounts = resolved;
    }

    // Défense en profondeur: vérifier la cohérence on-chain des ATAs et des reserves
    try {
      const { AccountLayout } = await import("@solana/spl-token");

      // Vérifier les ATAs utilisateurs (mint match)
      const [userAInfo, userBInfo] = await Promise.all([
        this.connection.getAccountInfo(userTokenAccountA),
        this.connection.getAccountInfo(userTokenAccountB),
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
    const vaultTokenAccountA = userTokenAccountA;
    const vaultTokenAccountB = userTokenAccountB;

    // user_rebate est désormais créé automatiquement côté on-chain (init_if_needed).
    // Le client DOIT toujours fournir le PDA dérivé et le marquer writable.

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
      { pubkey: userTokenAccountA, isSigner: false, isWritable: true },
      // 6. user_token_account_b
      { pubkey: userTokenAccountB, isSigner: false, isWritable: true },
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
      // 15. user_rebate (PDA, writable) - init_if_needed on-chain
      { pubkey: accounts.userRebate, isSigner: false, isWritable: true },
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

    const resolveExistingUserTokenAccountForMint = async (opts: {
      mint: PublicKey;
      minAmount: number;
    }): Promise<PublicKey> => {
      const { mint, minAmount } = opts;

      const readDecodedTokenAmount = (decoded: any): bigint => {
        const v = decoded?.amount;
        if (typeof v === "bigint") return v;
        if (typeof v === "number") return BigInt(v);
        if (typeof v === "string") return BigInt(v);
        if (v && (Buffer.isBuffer(v) || v instanceof Uint8Array)) {
          return Buffer.from(v).readBigUInt64LE(0);
        }
        if (Array.isArray(v)) {
          return Buffer.from(v).readBigUInt64LE(0);
        }
        throw new Error("Unsupported token account amount encoding");
      };

      const mintInfo = await this.getAccountInfoWithRetry(mint);
      if (!mintInfo) throw new Error(`Mint introuvable: ${mint.toBase58()}`);

      const tokenProgram = mintInfo.owner;
      const ata = await getAssociatedTokenAddress(mint, userPublicKey, false, tokenProgram);
      const ataInfo = await this.getAccountInfoWithRetry(ata);

      if (ataInfo?.data) {
        try {
          const { AccountLayout } = await import("@solana/spl-token");
          const decoded = AccountLayout.decode(ataInfo.data);
          const ataMint = new PublicKey(decoded.mint);
          if (ataMint.equals(mint)) {
            const ataAmt = readDecodedTokenAmount(decoded);
            if (ataAmt >= BigInt(minAmount)) return ata;
          }
        } catch {
          // ignore
        }
      }

      const { AccountLayout } = await import("@solana/spl-token");
      const candidates: Array<{ pubkey: PublicKey; amount: bigint }> = [];

      if (tokenProgram.equals(TOKEN_PROGRAM_ID)) {
        const resp = await this.connection.getTokenAccountsByOwner(userPublicKey, { mint });
        for (const { pubkey, account } of resp.value) {
          try {
            const decoded = AccountLayout.decode(account.data);
            const accMint = new PublicKey(decoded.mint);
            if (!accMint.equals(mint)) continue;
            const amt = readDecodedTokenAmount(decoded);
            candidates.push({ pubkey, amount: amt });
          } catch {
            // ignore
          }
        }
      } else if (tokenProgram.equals(TOKEN_2022_PROGRAM_ID)) {
        // RPC filter { mint } n'est pas fiable pour Token-2022; on filtre côté client.
        const resp = await this.connection.getTokenAccountsByOwner(userPublicKey, { programId: TOKEN_2022_PROGRAM_ID });
        for (const { pubkey, account } of resp.value) {
          try {
            const decoded = AccountLayout.decode(account.data);
            const accMint = new PublicKey(decoded.mint);
            if (!accMint.equals(mint)) continue;
            const amt = readDecodedTokenAmount(decoded);
            candidates.push({ pubkey, amount: amt });
          } catch {
            // ignore
          }
        }
      }

      const best = candidates
        .filter((c) => c.amount >= BigInt(minAmount))
        .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0))[0];

      if (best) return best.pubkey;

      throw new Error(
        `No initialized token account found for input mint ${mint.toBase58()} with required amount ${minAmount}. ` +
          `Fund the wallet with this token (ideally its ATA), or set SOLANA_KEYPAIR to a funded wallet.`
      );
    };

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

    // V1.1 multi-hop: construire une transaction avec 2 legs.
    if (route.multiHop) {
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

      // Input side WSOL handling (wrap) si inputMint est SOL.
      let resolvedUserTokenAccountA: PublicKey | null = null;
      if (inputMint.equals(SOL_MINT)) {
        const userWsolAta = await getAssociatedTokenAddress(inputMint, userPublicKey);

        const inputAtaInfo = await this.getAccountInfoWithRetry(userWsolAta);
        if (!inputAtaInfo) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              userPublicKey,
              userWsolAta,
              userPublicKey,
              inputMint
            )
          );
        }

        let currentWsolAmount = 0;
        try {
          if (inputAtaInfo) {
            const bal = await this.connection.getTokenAccountBalance(userWsolAta);
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
              toPubkey: userWsolAta,
              lamports: deficit,
            })
          );
          instructions.push(createSyncNativeInstruction(userWsolAta));
        }

        resolvedUserTokenAccountA = userWsolAta;
      }

      if (!inputMint.equals(SOL_MINT)) {
        resolvedUserTokenAccountA = await resolveExistingUserTokenAccountForMint({
          mint: inputMint,
          minAmount: amountIn,
        });
      }

      // Intermédiaire (USDC) ATA: nécessaire avant le 1er swap.
      const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
      const usdcAtaInfo = await this.getAccountInfoWithRetry(userUsdcAta);
      if (!usdcAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPublicKey,
            userUsdcAta,
            userPublicKey,
            USDC_MINT
          )
        );
      }

      // Output ATA (peut être Token-2022): créer si nécessaire.
      const outputMintInfo = await this.getAccountInfoWithRetry(outputMint);
      if (!outputMintInfo) {
        throw new Error(`Mint introuvable (output): ${outputMint.toBase58()}`);
      }
      const outputTokenProgram = outputMintInfo.owner;

      const userOutputAta = await getAssociatedTokenAddress(
        outputMint,
        userPublicKey,
        false,
        outputTokenProgram
      );
      const outAtaInfo = await this.getAccountInfoWithRetry(userOutputAta);
      if (!outAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPublicKey,
            userOutputAta,
            userPublicKey,
            outputMint,
            outputTokenProgram
          )
        );
      }

      // 1er leg (input -> USDC)
      const leg1Params: TrueNativeSwapParams = {
        inputMint: route.multiHop.firstLeg.inputMint,
        outputMint: route.multiHop.firstLeg.outputMint,
        amountIn: route.multiHop.firstLeg.amountIn,
        minAmountOut: route.multiHop.firstLeg.minAmountOut,
        slippageBps,
        userPublicKey,
        routeOverride: route.multiHop.firstLeg.route,
      };
      instructions.push(
        await this.buildNativeSwapInstruction(userPublicKey, route.multiHop.firstLeg.route, leg1Params, {
          userTokenAccountA: resolvedUserTokenAccountA ?? undefined,
          userTokenAccountB: userUsdcAta,
        })
      );

      // 2e leg (USDC -> output)
      const leg2Params: TrueNativeSwapParams = {
        inputMint: route.multiHop.secondLeg.inputMint,
        outputMint: route.multiHop.secondLeg.outputMint,
        amountIn: route.multiHop.secondLeg.amountIn,
        minAmountOut: route.multiHop.secondLeg.minAmountOut,
        slippageBps,
        userPublicKey,
        routeOverride: route.multiHop.secondLeg.route,
      };
      instructions.push(
        await this.buildNativeSwapInstruction(userPublicKey, route.multiHop.secondLeg.route, leg2Params, {
          userTokenAccountA: userUsdcAta,
          userTokenAccountB: userOutputAta,
        })
      );

      // Output side: unwrap SOL si nécessaire (close WSOL ATA)
      if (outputMint.equals(SOL_MINT)) {
        let closeIx: TransactionInstruction | null = null;

        try {
          const spl: any = await import("@solana/spl-token");
          const createClose =
            spl?.createCloseAccountInstruction ??
            spl?.default?.createCloseAccountInstruction;

          if (typeof createClose === "function") {
            closeIx = createClose(
              userOutputAta,
              userPublicKey,
              userPublicKey
            );
          }
        } catch {
          // ignore
        }

        if (!closeIx) {
          closeIx = new TransactionInstruction({
            programId: TOKEN_PROGRAM_ID,
            keys: [
              { pubkey: userOutputAta, isSigner: false, isWritable: true },
              { pubkey: userPublicKey, isSigner: false, isWritable: true },
              { pubkey: userPublicKey, isSigner: true, isWritable: false },
            ],
            data: Buffer.from([9]),
          });
        }

        instructions.push(closeIx);
      }

      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash();

      const lookupTables = await getAllALTs(this.connection);
      const messageV0 = new TransactionMessage({
        payerKey: userPublicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(lookupTables);

      const transaction = new VersionedTransaction(messageV0);

      const [planPda] = this.deriveSwapPlanAddress(userPublicKey);

      return {
        transaction,
        route,
        planAccount: planPda,
        blockhash,
        lastValidBlockHeight,
      };
    }

    // Vérifier que la venue est activée dans la configuration
    if (DISABLED_BEST_ROUTE_VENUES.has(route.venue)) {
      throw new Error(
        `Venue native temporairement désactivée: ${route.venue}. ` +
          `Vérifiez la configuration dans routing.ts.`
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

    // Pour Raydium AMM: TOUJOURS re-quoter juste avant la construction de la TX
    // pour obtenir le prix le plus frais et éviter les erreurs de slippage 0x1e
    if (route.venue === "RAYDIUM_AMM") {
      const raydiumQuote = await this.getRaydiumQuote(
        inputMint,
        outputMint,
        amountIn,
        route.dexAccounts,
        slippageBps
      );
      
      if (raydiumQuote) {
        // PRIORITÉ 1: Utiliser otherAmountThreshold si disponible (le plus sûr)
        if (raydiumQuote.minOutAmount && Number.isFinite(raydiumQuote.minOutAmount)) {
          const candidate = Math.max(0, Math.floor(raydiumQuote.minOutAmount));
          if (candidate > 0) {
            minAmountOut = candidate;
            logger.debug("TrueNativeSwap", "Using Raydium otherAmountThreshold", {
              minAmountOut,
              originalMinOut: Math.floor((route.outputAmount * (10_000 - slippageBps)) / 10_000),
            });
          }
        }
        // PRIORITÉ 2: Si otherAmountThreshold absent, recalculer depuis le NOUVEAU outputAmount
        else if (raydiumQuote.outputAmount > 0) {
          const freshMinOut = Math.max(
            0,
            Math.floor((raydiumQuote.outputAmount * (10_000 - slippageBps)) / 10_000)
          );
          if (freshMinOut > 0 && freshMinOut < minAmountOut) {
            logger.info("TrueNativeSwap", "Raydium re-quote: price dropped, using fresh minOut", {
              oldMinOut: minAmountOut,
              freshMinOut,
              oldOutput: route.outputAmount,
              freshOutput: raydiumQuote.outputAmount,
              priceDrop: ((route.outputAmount - raydiumQuote.outputAmount) / route.outputAmount * 100).toFixed(2) + "%",
            });
            minAmountOut = freshMinOut;
          }
        }
      } else {
        // Re-quote a échoué - ajouter une marge de sécurité supplémentaire pour les tokens volatils
        const isVolatile = VOLATILE_TOKEN_MINTS.has(inputMint.toBase58()) || 
                          VOLATILE_TOKEN_MINTS.has(outputMint.toBase58());
        if (isVolatile) {
          // Réduire minAmountOut de 2% supplémentaire pour compenser le stale quote
          const safetyMarginBps = 200;
          const saferMinOut = Math.floor(minAmountOut * (10_000 - safetyMarginBps) / 10_000);
          logger.warn("TrueNativeSwap", "Raydium re-quote failed for volatile token, applying safety margin", {
            originalMinOut: minAmountOut,
            saferMinOut,
            safetyMarginBps,
          });
          minAmountOut = saferMinOut;
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
    let resolvedUserTokenAccountA: PublicKey | null = null;
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

      resolvedUserTokenAccountA = userTokenAccountA;
    }

    if (!inputMint.equals(SOL_MINT)) {
      resolvedUserTokenAccountA = await resolveExistingUserTokenAccountForMint({
        mint: inputMint,
        minAmount: amountIn,
      });
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

    const resolvedUserTokenAccountB = userTokenAccountB;

    // 3. Ajouter l'instruction de swap (chemin direct: pas de SwapPlan)
    // IMPORTANT: on force l'usage des montants dérivés/validés (évite amount_in=0 → 6014)
    const effectiveParams: TrueNativeSwapParams = {
      ...params,
      amountIn,
      minAmountOut,
    };
    instructions.push(
      await this.buildNativeSwapInstruction(userPublicKey, route, effectiveParams, {
        userTokenAccountA: resolvedUserTokenAccountA ?? undefined,
        userTokenAccountB: resolvedUserTokenAccountB,
      })
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
