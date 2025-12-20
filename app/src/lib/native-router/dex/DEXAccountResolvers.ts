/**
 * 🏊 DEX Account Resolvers
 * 
 * Résout les comptes nécessaires pour chaque DEX:
 * - Orca Whirlpools: pool, tick arrays, oracle
 * - Meteora DLMM: LB pair, bin arrays, oracle
 * - Phoenix: market, seat, open orders
 * - Raydium: AMM, pool state, market
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { Buffer } from "buffer";
import { logger } from "@/lib/logger";
import { DEX_PROGRAMS } from "../headless/router";
import { toPublicKey } from "../utils/publicKeyUtils";
import type { RaydiumPoolConfig } from "@/sdk/config/raydium-pools";
import { getPhoenixMarketConfig, PHOENIX_PROGRAM_ID as PHOENIX_PROGRAM } from "@/sdk/config/phoenix-markets";
import bs58 from "bs58";

if (typeof globalThis !== "undefined" && typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}
import { getAllRaydiumPools, getRaydiumPool } from "@/sdk/config/raydium-pools";

const RESOLVER_CACHE_TTL_MS = 60_000; // short-lived cache to absorb bursty API errors
const MAX_FETCH_ATTEMPTS = 2;

const METEORA_PAIR_CACHE_TTL_MS_DEFAULT = 5 * 60_000;

function isBrowserRuntime(): boolean {
  return typeof window !== "undefined";
}

function isEnvTrue(name: string): boolean {
  const v = process.env[name];
  return v === "true" || v === "1" || v === "yes";
}

function getMeteoraPairCacheTtlMs(): number {
  const ttl =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_METEORA_PAIR_CACHE_TTL_MS") ??
    getEnvNumber("SWAPBACK_METEORA_PAIR_CACHE_TTL_MS") ??
    METEORA_PAIR_CACHE_TTL_MS_DEFAULT;
  return Math.max(0, Math.floor(ttl));
}

function allowMeteoraDeepFallbacks(): boolean {
  // Deep fallbacks (SDK + on-chain memcmp) peuvent être très lents, surtout en browser.
  // Par défaut on les désactive côté navigateur; réactivables explicitement en debug.
  if (isEnvTrue("NEXT_PUBLIC_SWAPBACK_ENABLE_METEORA_DEEP_FALLBACKS") || isEnvTrue("SWAPBACK_ENABLE_METEORA_DEEP_FALLBACKS")) {
    return true;
  }
  return !isBrowserRuntime();
}

const resolverLogDedupe = new Map<string, number>();
const shouldLogResolverWarning = (key: string, ttlMs: number = RESOLVER_CACHE_TTL_MS): boolean => {
  const now = Date.now();
  const last = resolverLogDedupe.get(key);
  if (typeof last === "number" && now - last < ttlMs) return false;
  resolverLogDedupe.set(key, now);
  return true;
};

const meteoraPairCache = new Map<string, { timestamp: number; pair: PublicKey | null }>();
const raydiumPoolCache = new Map<string, { timestamp: number; pool: RaydiumPoolConfig | null }>();
const serumMarketMetaCache = new Map<string, { timestamp: number; meta: SerumMarketMeta }>();
const saberPoolTokenAccountsCache = new Map<
  string,
  { timestamp: number; tokenAccounts: Array<{ address: PublicKey; mint: PublicKey; amount: bigint }> }
>();

const SERUM_MARKET_CACHE_TTL_MS = 5 * 60 * 1000;

// Cache: résolution de comptes DEX (UI quote bursts)
// Objectif: éviter de refaire les mêmes appels RPC/API à chaque rafraîchissement.
// TTL court pour rester safe sur mainnet (les pools peuvent changer, mais rarement à l'échelle de quelques secondes).
const DEX_ACCOUNTS_CACHE_MAX_ENTRIES = 750;
const DEX_ACCOUNTS_POSITIVE_TTL_MS_DEFAULT = 60_000;
const DEX_ACCOUNTS_NEGATIVE_TTL_MS_DEFAULT = 120_000;

type DexAccountsCacheEntry = {
  timestamp: number;
  value: DEXAccounts | null;
  ttlOverrideMs?: number;
};

const dexAccountsByVenueCache = new Map<string, DexAccountsCacheEntry>();

const DEX_ACCOUNTS_RESOLVE_TIMEOUT_MS_DEFAULT = 4_000;
const DEX_ACCOUNTS_RESOLVE_TIMEOUT_METEORA_MS_DEFAULT = 6_000;
const DEX_ACCOUNTS_TIMEOUT_NEGATIVE_TTL_MS_DEFAULT = 5_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms (${label})`)), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(handle);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(handle);
        reject(e);
      });
  });
}

function getResolveTimeoutMsForVenue(venue: SupportedVenue): number {
  const base =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_DEX_RESOLVE_TIMEOUT_MS") ??
    getEnvNumber("SWAPBACK_DEX_RESOLVE_TIMEOUT_MS") ??
    DEX_ACCOUNTS_RESOLVE_TIMEOUT_MS_DEFAULT;

  if (venue === "METEORA_DLMM") {
    return (
      getEnvNumber("NEXT_PUBLIC_SWAPBACK_DEX_RESOLVE_TIMEOUT_METEORA_MS") ??
      getEnvNumber("SWAPBACK_DEX_RESOLVE_TIMEOUT_METEORA_MS") ??
      Math.max(base, DEX_ACCOUNTS_RESOLVE_TIMEOUT_METEORA_MS_DEFAULT)
    );
  }

  return base;
}

function getTimeoutNegativeTtlMs(): number {
  const n =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_DEX_TIMEOUT_NEGATIVE_CACHE_MS") ??
    getEnvNumber("SWAPBACK_DEX_TIMEOUT_NEGATIVE_CACHE_MS") ??
    DEX_ACCOUNTS_TIMEOUT_NEGATIVE_TTL_MS_DEFAULT;
  return Math.max(0, Math.floor(n));
}

function getEnvNumber(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getDexAccountsCacheTtls(): { positiveTtlMs: number; negativeTtlMs: number } {
  const positiveTtlMs =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_DEX_ACCOUNTS_CACHE_MS") ??
    getEnvNumber("SWAPBACK_DEX_ACCOUNTS_CACHE_MS") ??
    DEX_ACCOUNTS_POSITIVE_TTL_MS_DEFAULT;
  const negativeTtlMs =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_DEX_ACCOUNTS_NEGATIVE_CACHE_MS") ??
    getEnvNumber("SWAPBACK_DEX_ACCOUNTS_NEGATIVE_CACHE_MS") ??
    DEX_ACCOUNTS_NEGATIVE_TTL_MS_DEFAULT;

  return {
    positiveTtlMs: Math.max(0, Math.floor(positiveTtlMs)),
    negativeTtlMs: Math.max(0, Math.floor(negativeTtlMs)),
  };
}

function pruneDexAccountsCache(): void {
  while (dexAccountsByVenueCache.size > DEX_ACCOUNTS_CACHE_MAX_ENTRIES) {
    const firstKey = dexAccountsByVenueCache.keys().next().value as string | undefined;
    if (!firstKey) return;
    dexAccountsByVenueCache.delete(firstKey);
  }
}

interface SerumMarketMeta {
  bids: PublicKey;
  asks: PublicKey;
  eventQueue: PublicKey;
  coinVault: PublicKey;
  pcVault: PublicKey;
  vaultSigner: PublicKey;
}

async function loadSerumMarketMeta(
  connection: Connection,
  market: PublicKey,
  programId: PublicKey
): Promise<SerumMarketMeta | null> {
  const cacheKey = `${market.toBase58()}::${programId.toBase58()}`;
  const now = Date.now();
  const cached = serumMarketMetaCache.get(cacheKey);

  if (cached && now - cached.timestamp < SERUM_MARKET_CACHE_TTL_MS) {
    return cached.meta;
  }

  try {
    const accountInfo = await connection.getAccountInfo(market);
    if (!accountInfo) {
      logger.warn("RaydiumResolver", "Serum market account missing", {
        market: market.toBase58(),
      });
      return null;
    }

    const { MARKET_STATE_LAYOUT_V3 } = await import("@project-serum/serum/lib/market");
    const decoded = MARKET_STATE_LAYOUT_V3.decode(accountInfo.data);
    const nonceBuffer = decoded.vaultSignerNonce?.toArrayLike
      ? decoded.vaultSignerNonce.toArrayLike(Buffer, "le", 8)
      : Buffer.alloc(8);

    const vaultSigner = await PublicKey.createProgramAddress(
      [market.toBuffer(), nonceBuffer],
      programId
    );

    const meta: SerumMarketMeta = {
      bids: decoded.bids,
      asks: decoded.asks,
      eventQueue: decoded.eventQueue,
      coinVault: decoded.baseVault,
      pcVault: decoded.quoteVault,
      vaultSigner,
    };

    serumMarketMetaCache.set(cacheKey, { timestamp: now, meta });
    return meta;
  } catch (error) {
    logger.error("RaydiumResolver", "Failed to decode Serum market", {
      market: market.toBase58(),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

const getPairCacheKey = (mintA: string, mintB: string) =>
  mintA < mintB ? `${mintA}:${mintB}` : `${mintB}:${mintA}`;

const LIFINITY_PROGRAM = DEX_PROGRAMS.LIFINITY;
const SABER_PROGRAM = DEX_PROGRAMS.SABER;

// ============================================================================
// TYPES
// ============================================================================

export interface DEXAccounts {
  /** Comptes requis pour l'instruction de swap */
  accounts: PublicKey[];
  /** Données additionnelles pour l'instruction */
  data?: Buffer;
  /** Adresses de lookup tables à utiliser */
  lookupTables?: PublicKey[];
  /** Token vaults du DEX pool (pour vault_token_account_a/b dans SwapToC) */
  vaultTokenAccountA?: PublicKey;
  vaultTokenAccountB?: PublicKey;
  /** Métadonnées */
  meta: {
    venue: string;
    poolAddress?: string;
    feeRate?: number;
    tickSpacing?: number;
  };
}

// ============================================================================
// LIFINITY
// ============================================================================

type LifinityPoolInfo = {
  amm: string;
  poolMint: string;
  feeAccount: string;
  configAccount: string;
  pythAccount: string;
  pythPcAccount: string;
  poolCoinTokenAccount: string;
  poolCoinMint: string;
  poolPcTokenAccount: string;
  poolPcMint: string;
};

async function findLifinityPool(
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<LifinityPoolInfo | null> {
  try {
    const { getPoolList } = await import("@lifinity/sdk");
    const pools = getPoolList() as Record<string, LifinityPoolInfo>;
    const input = inputMint.toBase58();
    const output = outputMint.toBase58();

    for (const pool of Object.values(pools)) {
      if (
        (pool.poolCoinMint === input && pool.poolPcMint === output) ||
        (pool.poolCoinMint === output && pool.poolPcMint === input)
      ) {
        return pool;
      }
    }
    return null;
  } catch (error) {
    logger.error("LifinityResolver", "Failed to load Lifinity pool list", {
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getLifinityAccounts(
  connection: Connection,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string
): Promise<DEXAccounts | null> {
  try {
    const safeInputMint = toPublicKey(inputMint);
    const safeOutputMint = toPublicKey(outputMint);
    const safeUser = toPublicKey(userPublicKey);

    const pool = await findLifinityPool(safeInputMint, safeOutputMint);
    if (!pool) {
      const inputStr = safeInputMint.toBase58();
      const outputStr = safeOutputMint.toBase58();
      const key = `LifinityResolver:no-pool:${getPairCacheKey(inputStr, outputStr)}`;
      if (shouldLogResolverWarning(key)) {
        logger.warn("LifinityResolver", "No Lifinity pool found for pair", {
          inputMint: inputStr,
          outputMint: outputStr,
        });
      }
      return null;
    }

    const amm = new PublicKey(pool.amm);
    // Sanity check: ensure the pool account exists on-chain.
    // This also makes unit tests deterministic (mock connections returning null should yield no accounts).
    const ammInfo = await connection.getAccountInfo(amm);
    if (!ammInfo) {
      const inputStr = safeInputMint.toBase58();
      const outputStr = safeOutputMint.toBase58();
      const key = `LifinityResolver:amm-missing:${amm.toBase58()}:${getPairCacheKey(inputStr, outputStr)}`;
      if (shouldLogResolverWarning(key)) {
        logger.warn("LifinityResolver", "Lifinity pool account missing", {
          amm: amm.toBase58(),
          inputMint: inputStr,
          outputMint: outputStr,
        });
      }
      return null;
    }

    const authority = PublicKey.findProgramAddressSync([amm.toBuffer()], LIFINITY_PROGRAM)[0];

    const userSourceAccount = await getAssociatedTokenAddress(safeInputMint, safeUser);
    const userDestinationAccount = await getAssociatedTokenAddress(safeOutputMint, safeUser);

    // NOTE: L'ordre ci-dessous suit l'IDL Lifinity (authority, amm, ...).
    // Le CPI on-chain SwapBack doit aussi être compatible côté metas (writable/readonly),
    // sinon la simulation échouera même si les comptes sont corrects.
    return {
      accounts: [
        authority,
        amm,
        safeUser, // userTransferAuthority (signer)
        userSourceAccount,
        userDestinationAccount,
        new PublicKey(
          safeInputMint.equals(new PublicKey(pool.poolCoinMint))
            ? pool.poolCoinTokenAccount
            : pool.poolPcTokenAccount
        ),
        new PublicKey(
          safeInputMint.equals(new PublicKey(pool.poolCoinMint))
            ? pool.poolPcTokenAccount
            : pool.poolCoinTokenAccount
        ),
        new PublicKey(pool.poolMint),
        new PublicKey(pool.feeAccount),
        TOKEN_PROGRAM_ID,
        new PublicKey(pool.pythAccount),
        new PublicKey(pool.pythPcAccount),
        new PublicKey(pool.configAccount),
        LIFINITY_PROGRAM, // programme (required by invoke)
      ],
      vaultTokenAccountA: new PublicKey(pool.poolCoinTokenAccount),
      vaultTokenAccountB: new PublicKey(pool.poolPcTokenAccount),
      meta: {
        venue: "LIFINITY",
        poolAddress: pool.amm,
      },
    };
  } catch (error) {
    logger.error("LifinityResolver", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// SABER
// ============================================================================

type SaberStaticPool = {
  address: string;
  tokenA: string;
  tokenB: string;
  name: string;
};

// Pool list minimal et déterministe (répliqué depuis SaberService pour éviter une dépendance croisée).
const SABER_POOLS: SaberStaticPool[] = [
  {
    name: "USDC-USDT",
    address: "YAkoNb6HKmSxQN9L8hiBE5tPJRsniSSMzND1boHmZxe",
    tokenA: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    tokenB: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
  {
    name: "mSOL-SOL",
    address: "Lee1XZJfJ9Hm2K1qTyeCz1LXNc1YBZaKZszvNY4KCDw",
    tokenA: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    tokenB: "So11111111111111111111111111111111111111112",
  },
  {
    name: "stSOL-SOL",
    address: "8CpmKczw1K64RhPfYn8YLdJSEQdE4zy7NWFJVyMYQP1r",
    tokenA: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
    tokenB: "So11111111111111111111111111111111111111112",
  },
];

function findSaberPool(inputMint: PublicKey, outputMint: PublicKey): SaberStaticPool | null {
  const input = inputMint.toBase58();
  const output = outputMint.toBase58();
  for (const pool of SABER_POOLS) {
    if ((pool.tokenA === input && pool.tokenB === output) || (pool.tokenA === output && pool.tokenB === input)) {
      return pool;
    }
  }
  return null;
}

async function getSaberReferencedTokenAccounts(
  connection: Connection,
  swapInfo: PublicKey
): Promise<Array<{ address: PublicKey; mint: PublicKey; amount: bigint }>> {
  const cacheKey = swapInfo.toBase58();
  const now = Date.now();
  const cached = saberPoolTokenAccountsCache.get(cacheKey);
  if (cached && now - cached.timestamp < RESOLVER_CACHE_TTL_MS) {
    return cached.tokenAccounts;
  }

  const info = await connection.getAccountInfo(swapInfo);
  if (!info) {
    throw new Error("Saber swapInfo account missing");
  }

  // Strategy: extract all possible Pubkeys from the data and keep the ones
  // that are valid SPL token accounts (owner=Tokenkeg, size=165).
  const data = info.data;
  const candidates = new Set<string>();
  for (let off = 0; off + 32 <= data.length; off += 1) {
    try {
      candidates.add(new PublicKey(data.slice(off, off + 32)).toBase58());
    } catch {
      // ignore
    }
  }

  const pubkeys = Array.from(candidates).map((s) => new PublicKey(s));
  const tokenAccounts: Array<{ address: PublicKey; mint: PublicKey; amount: bigint }> = [];
  const batchSize = 100;
  for (let i = 0; i < pubkeys.length; i += batchSize) {
    const slice = pubkeys.slice(i, i + batchSize);
    const infos = await connection.getMultipleAccountsInfo(slice);
    for (let j = 0; j < infos.length; j++) {
      const ai = infos[j];
      if (!ai) continue;
      if (!ai.owner.equals(TOKEN_PROGRAM_ID)) continue;
      if (ai.data.length !== 165) continue;
      const mint = new PublicKey(ai.data.slice(0, 32));
      const amount = ai.data.readBigUInt64LE(64);
      tokenAccounts.push({ address: slice[j], mint, amount });
    }
  }

  saberPoolTokenAccountsCache.set(cacheKey, { timestamp: now, tokenAccounts });
  return tokenAccounts;
}

export async function getSaberAccounts(
  connection: Connection,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string
): Promise<DEXAccounts | null> {
  try {
    const safeInputMint = toPublicKey(inputMint);
    const safeOutputMint = toPublicKey(outputMint);
    const safeUser = toPublicKey(userPublicKey);

    // Saber est un stable-swap: on ne tente la résolution que pour les paires stables connues.
    // Évite du bruit (SOL/USDC n'a pas de pool Saber dans notre config statique).
    const SABER_STABLE_MINTS = new Set([
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    ]);

    const inStr = safeInputMint.toBase58();
    const outStr = safeOutputMint.toBase58();
    if (!SABER_STABLE_MINTS.has(inStr) || !SABER_STABLE_MINTS.has(outStr)) {
      return null;
    }

    const pool = findSaberPool(safeInputMint, safeOutputMint);
    if (!pool) {
      return null;
    }

    const swapInfo = new PublicKey(pool.address);
    const swapAuthority = PublicKey.findProgramAddressSync([swapInfo.toBuffer()], SABER_PROGRAM)[0];

    const userSourceAccount = await getAssociatedTokenAddress(safeInputMint, safeUser);
    const userDestinationAccount = await getAssociatedTokenAddress(safeOutputMint, safeUser);

    const tokenAccounts = await getSaberReferencedTokenAccounts(connection, swapInfo);
    if (tokenAccounts.length < 2) {
      logger.warn("SaberResolver", "Failed to discover Saber pool token accounts", {
        swapInfo: swapInfo.toBase58(),
        found: tokenAccounts.length,
      });
      return null;
    }

    const forMint = (mint: PublicKey) => tokenAccounts.filter((t) => t.mint.equals(mint));

    const inputCandidates = forMint(safeInputMint);
    const outputCandidates = forMint(safeOutputMint);
    if (!inputCandidates.length || !outputCandidates.length) {
      logger.warn("SaberResolver", "Pool token accounts missing expected mints", {
        swapInfo: swapInfo.toBase58(),
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
      });
      return null;
    }

    // Use the largest balance account for each mint as the pool vault.
    const pickLargest = (items: Array<{ address: PublicKey; mint: PublicKey; amount: bigint }>) =>
      items.reduce((best, cur) => (cur.amount > best.amount ? cur : best));

    const swapSource = pickLargest(inputCandidates).address;
    const swapDestination = pickLargest(outputCandidates).address;

    // Admin fee destination is typically a separate token account. Prefer same output mint.
    const nonVaultOutput = outputCandidates
      .filter((x) => !x.address.equals(swapDestination))
      .map((x) => x.address);
    const adminFeeDestination = nonVaultOutput[0] ?? swapDestination;

    return {
      accounts: [
        swapInfo, // 0
        swapAuthority, // 1
        safeUser, // 2 (signer)
        userSourceAccount, // 3
        swapSource, // 4
        swapDestination, // 5
        userDestinationAccount, // 6
        adminFeeDestination, // 7
        TOKEN_PROGRAM_ID, // 8
        SYSVAR_CLOCK_PUBKEY, // 9
        SABER_PROGRAM, // 10 (required by invoke)
      ],
      meta: {
        venue: "SABER",
        poolAddress: pool.address,
      },
    };
  } catch (error) {
    logger.error("SaberResolver", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface PoolInfo {
  address: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  reserveA: number;
  reserveB: number;
  feeRate: number;
  tvl?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRpcRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("too many requests");
}

async function getProgramAccountsWithRetry(
  connection: Connection,
  programId: PublicKey,
  config: Parameters<Connection["getProgramAccounts"]>[1],
  delaysMs: number[] = [300, 600, 1200, 2400, 4800]
): Promise<Awaited<ReturnType<Connection["getProgramAccounts"]>>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await connection.getProgramAccounts(programId, config as any);
    } catch (e) {
      lastErr = e;
      if (!isRpcRateLimitError(e) || attempt === delaysMs.length) {
        throw e;
      }
      await sleep(delaysMs[attempt]);
    }
  }
  throw lastErr;
}

async function getAccountInfoWithRetry(
  connection: Connection,
  pubkey: PublicKey,
  delaysMs: number[] = [250, 500, 1000, 2000, 4000]
): Promise<import("@solana/web3.js").AccountInfo<Buffer> | null> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await connection.getAccountInfo(pubkey);
    } catch (e) {
      lastErr = e;
      if (!isRpcRateLimitError(e) || attempt === delaysMs.length) {
        throw e;
      }
      await sleep(delaysMs[attempt]);
    }
  }
  throw lastErr;
}

// ============================================================================
// ORCA WHIRLPOOL
// ============================================================================

const ORCA_WHIRLPOOL_PROGRAM = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const ORCA_CONFIG = new PublicKey("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ");

/**
 * Trouve le Whirlpool pour une paire de tokens
 */
async function findWhirlpool(
  connection: Connection,
  tokenA: PublicKey,
  tokenB: PublicKey,
  tickSpacing = 64
): Promise<PublicKey | null> {
  // Ordonner les tokens (convention Orca)
  const [sortedA, sortedB] = tokenA.toBuffer().compare(tokenB.toBuffer()) < 0
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
  
  const [whirlpoolPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("whirlpool"),
      ORCA_CONFIG.toBuffer(),
      sortedA.toBuffer(),
      sortedB.toBuffer(),
      Buffer.from(new Uint8Array(new Uint16Array([tickSpacing]).buffer)),
    ],
    ORCA_WHIRLPOOL_PROGRAM
  );
  
  // Vérifier que le pool existe
  const accountInfo = await getAccountInfoWithRetry(connection, whirlpoolPda);
  if (!accountInfo) {
    // Essayer d'autres tick spacings courants
    for (const ts of [8, 16, 128]) {
      const [altPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("whirlpool"),
          ORCA_CONFIG.toBuffer(),
          sortedA.toBuffer(),
          sortedB.toBuffer(),
          Buffer.from(new Uint8Array(new Uint16Array([ts]).buffer)),
        ],
        ORCA_WHIRLPOOL_PROGRAM
      );
      const altInfo = await getAccountInfoWithRetry(connection, altPda);
      if (altInfo) return altPda;
    }
    return null;
  }
  
  return whirlpoolPda;
}

/**
 * Dérive les tick arrays pour un Whirlpool
 */
function deriveTickArrays(
  whirlpool: PublicKey,
  currentTickIndex: number,
  tickSpacing: number,
  aToB: boolean
): PublicKey[] {
  const tickArrays: PublicKey[] = [];
  const ticksPerArray = 88 * tickSpacing;
  
  // Calculer le tick array actuel
  let startTick = Math.floor(currentTickIndex / ticksPerArray) * ticksPerArray;
  
  // Récupérer 3 tick arrays dans la direction du swap
  const direction = aToB ? -1 : 1;
  for (let i = 0; i < 3; i++) {
    const tick = startTick + direction * i * ticksPerArray;
    const [tickArrayPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        whirlpool.toBuffer(),
        Buffer.from(tick.toString()),
      ],
      ORCA_WHIRLPOOL_PROGRAM
    );
    tickArrays.push(tickArrayPda);
  }
  
  return tickArrays;
}

/**
 * Résout les comptes pour un swap Orca Whirlpool
 * 
 * L'ordre des comptes DOIT correspondre au CPI dans cpi_orca.rs:
 * 
 * 1.  token_program
 * 2.  token_authority (signer - l'utilisateur)
 * 3.  whirlpool
 * 4.  token_owner_account_a (user's token A account)
 * 5.  token_vault_a (whirlpool vault A)
 * 6.  token_owner_account_b (user's token B account)
 * 7.  token_vault_b (whirlpool vault B)
 * 8.  tick_array_0
 * 9.  tick_array_1
 * 10. tick_array_2
 * 11. oracle
 * 12. ORCA_WHIRLPOOL_PROGRAM (compte programme, requis par `invoke`)
 * 
 * Total: 11 comptes CPI + 1 compte programme (12 au total côté client)
 */
export async function getOrcaWhirlpoolAccounts(
  connection: Connection,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string
): Promise<DEXAccounts | null> {
  try {
    const safeInputMint = toPublicKey(inputMint);
    const safeOutputMint = toPublicKey(outputMint);
    const safeUser = toPublicKey(userPublicKey);
    
    const whirlpool = await findWhirlpool(connection, safeInputMint, safeOutputMint);
    if (!whirlpool) {
      console.warn("[OrcaResolver] No Whirlpool found for pair");
      return null;
    }
    
    // Récupérer les données du pool
    const accountInfo = await getAccountInfoWithRetry(connection, whirlpool);
    if (!accountInfo) return null;
    
    // Parser les données du pool avec les offsets corrects du Whirlpool struct
    // Offsets basés sur le layout Anchor avec 8 bytes discriminateur:
    // - tokenMintA: 101-133, tokenVaultA: 133-165
    // - tokenMintB: 181-213, tokenVaultB: 213-245
    // - tickCurrentIndex: 81-85, tickSpacing: 41-43, feeRate: 45-47
    const data = accountInfo.data;
    const currentTickIndex = data.readInt32LE(81);
    const tickSpacing = data.readUInt16LE(41);
    const feeRate = data.readUInt16LE(45);
    
    // Token mints du pool (offsets corrects vérifiés sur mainnet)
    const tokenMintA = new PublicKey(data.subarray(101, 133));
    const tokenMintB = new PublicKey(data.subarray(181, 213));
    
    // Déterminer la direction (a_to_b signifie échanger A contre B)
    const aToB = safeInputMint.equals(tokenMintA);
    
    // Token vaults du pool (offsets corrects vérifiés sur mainnet)
    const tokenVaultA = new PublicKey(data.subarray(133, 165));
    const tokenVaultB = new PublicKey(data.subarray(213, 245));
    
    // Dériver les tick arrays
    const tickArrays = deriveTickArrays(whirlpool, currentTickIndex, tickSpacing, aToB);
    
    // Dériver l'oracle
    const [oracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), whirlpool.toBuffer()],
      ORCA_WHIRLPOOL_PROGRAM
    );
    
    // Calculer les ATAs de l'utilisateur
    const { getAssociatedTokenAddress } = await import("@solana/spl-token");
    const userTokenAccountA = await getAssociatedTokenAddress(tokenMintA, safeUser);
    const userTokenAccountB = await getAssociatedTokenAddress(tokenMintB, safeUser);
    
    // Retourner les comptes dans l'ordre exact attendu par le CPI
    return {
      accounts: [
        TOKEN_PROGRAM_ID,       // 1. token_program
        safeUser,               // 2. token_authority (signer)
        whirlpool,              // 3. whirlpool
        userTokenAccountA,      // 4. token_owner_account_a
        tokenVaultA,            // 5. token_vault_a
        userTokenAccountB,      // 6. token_owner_account_b
        tokenVaultB,            // 7. token_vault_b
        tickArrays[0],          // 8. tick_array_0
        tickArrays[1],          // 9. tick_array_1
        tickArrays[2],          // 10. tick_array_2
        oracle,                 // 11. oracle
        ORCA_WHIRLPOOL_PROGRAM, // 12. Orca program (required by CPI invoke)
      ],
      // Exposer les vaults pour vault_token_account_a/b dans SwapToC
      vaultTokenAccountA: tokenVaultA,
      vaultTokenAccountB: tokenVaultB,
      meta: {
        venue: 'ORCA_WHIRLPOOL',
        poolAddress: whirlpool.toBase58(),
        feeRate: feeRate / 1_000_000, // Convertir en %
        tickSpacing,
      },
    };
  } catch (error) {
    console.error("[OrcaResolver] Error:", error);
    return null;
  }
}

// ============================================================================
// METEORA DLMM
// ============================================================================

const METEORA_DLMM_PROGRAM = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");

const METEORA_DLMM_API_TIMEOUT_MS = 15_000;

const METEORA_BITMAP_MISSING_TTL_MS_DEFAULT = 10 * 60_000;
const METEORA_BITMAP_ACCOUNT_TIMEOUT_MS_BROWSER_DEFAULT = 1_500;
const METEORA_BITMAP_ACCOUNT_TIMEOUT_MS_NODE_DEFAULT = 4_000;

const meteoraBitmapMissingCache = new Map<string, number>();

function getMeteoraBitmapMissingTtlMs(): number {
  const ttl =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_METEORA_BITMAP_MISSING_TTL_MS") ??
    getEnvNumber("SWAPBACK_METEORA_BITMAP_MISSING_TTL_MS") ??
    METEORA_BITMAP_MISSING_TTL_MS_DEFAULT;
  return Math.max(0, Math.floor(ttl));
}

function getMeteoraBitmapAccountTimeoutMs(): number {
  const configured =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_METEORA_BITMAP_ACCOUNT_TIMEOUT_MS") ??
    getEnvNumber("SWAPBACK_METEORA_BITMAP_ACCOUNT_TIMEOUT_MS");
  if (typeof configured === "number") return Math.max(0, Math.floor(configured));
  return isBrowserRuntime() ? METEORA_BITMAP_ACCOUNT_TIMEOUT_MS_BROWSER_DEFAULT : METEORA_BITMAP_ACCOUNT_TIMEOUT_MS_NODE_DEFAULT;
}

// L'endpoint `pair/all_by_groups` renvoie un gros payload.
// Sans cache, chaque recherche de quote (nouvelle paire) retélécharge et re-scan le JSON.
// On garde un index en mémoire pour accélérer les requêtes suivantes.
const METEORA_API_INDEX_CACHE_TTL_MS_DEFAULT = 2 * 60_000;
let meteoraApiPairsIndexCache: { timestamp: number; index: Map<string, string> } | null = null;

function getMeteoraApiIndexCacheTtlMs(): number {
  const ttl =
    getEnvNumber("NEXT_PUBLIC_SWAPBACK_METEORA_API_INDEX_CACHE_TTL_MS") ??
    getEnvNumber("SWAPBACK_METEORA_API_INDEX_CACHE_TTL_MS") ??
    METEORA_API_INDEX_CACHE_TTL_MS_DEFAULT;
  return Math.max(0, Math.floor(ttl));
}

function buildMeteoraApiPairsIndex(payload: any): Map<string, string> {
  const index = new Map<string, string>();
  for (const group of payload?.groups || []) {
    for (const pair of group?.pairs || []) {
      const mintX = typeof pair?.mint_x === "string" ? pair.mint_x : null;
      const mintY = typeof pair?.mint_y === "string" ? pair.mint_y : null;
      const address = typeof pair?.address === "string" ? pair.address : null;
      if (!mintX || !mintY || !address) continue;
      index.set(getPairCacheKey(mintX, mintY), address);
    }
  }
  return index;
}

function getMeteoraPairFromApiIndex(tokenX: PublicKey, tokenY: PublicKey): PublicKey | null | undefined {
  const ttl = getMeteoraApiIndexCacheTtlMs();
  if (!meteoraApiPairsIndexCache || ttl <= 0) return undefined;
  const now = Date.now();
  if (now - meteoraApiPairsIndexCache.timestamp > ttl) {
    meteoraApiPairsIndexCache = null;
    return undefined;
  }

  const key = getPairCacheKey(tokenX.toBase58(), tokenY.toBase58());
  const address = meteoraApiPairsIndexCache.index.get(key);
  return address ? new PublicKey(address) : null;
}

const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

// Paire SOL/USDC connue (mainnet) utilisée uniquement pour déduire les offsets memcmp de l'account lb_pair
// sans dépendre de l'API Meteora (qui peut timeout).
const METEORA_KNOWN_SOL_USDC_LBPAIR = new PublicKey("5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6");

async function loadMeteoraDLMMClass(): Promise<any> {
  // @meteora-ag/dlmm exports: default = DLMM class
  // IMPORTANT:
  // - In browser/Next.js we keep pure ESM import.
  // - In Node/tsx scripts, the ESM entry can fail because it imports
  //   `import { BN } from "@coral-xyz/anchor"` but Anchor's ESM build does not export BN.
  //   In that case we fallback to the CJS entry via createRequire.
  try {
    const mod: any = await import("@meteora-ag/dlmm");
    return mod?.DLMM ?? mod?.default ?? mod;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isNode = typeof process !== "undefined" && !!process.versions?.node;
    const missingBnExport = msg.includes("export named 'BN'") || msg.includes('export named "BN"');
    if (isNode && missingBnExport) {
      // Prevent webpack from trying to resolve the `node:` URI scheme at bundle-time.
      // This branch is only ever executed in Node runtimes.
      const nodeModule: any = await import(/* webpackIgnore: true */ "node:module");
      const createRequire = nodeModule?.createRequire;
      if (typeof createRequire !== "function") throw e;
      const req = createRequire(import.meta.url);
      // Load the CJS entry (dist/index.js) which uses require('@coral-xyz/anchor') where BN exists.
      const mod: any = req("@meteora-ag/dlmm");
      return mod?.DLMM ?? mod?.default ?? mod;
    }
    throw e;
  }
}

async function loadMeteoraDlmmModule(): Promise<any> {
  // IMPORTANT: keep this file browser-bundle-friendly (Next.js).
  // In Node/tsx, the ESM entry can fail due to Anchor ESM not exporting BN.
  try {
    return await import("@meteora-ag/dlmm");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isNode = typeof process !== "undefined" && !!process.versions?.node;
    const missingBnExport = msg.includes("export named 'BN'") || msg.includes('export named "BN"');
    if (isNode && missingBnExport) {
      // Prevent webpack from trying to resolve the `node:` URI scheme at bundle-time.
      // This branch is only ever executed in Node runtimes.
      const nodeModule: any = await import(/* webpackIgnore: true */ "node:module");
      const createRequire = nodeModule?.createRequire;
      if (typeof createRequire !== "function") throw e;
      const req = createRequire(import.meta.url);
      return req("@meteora-ag/dlmm");
    }
    throw e;
  }
}

let meteoraLbPairMemcmpCache:
  | { tokenXOffset: number; tokenYOffset: number; lbPairDiscriminatorB58: string }
  | null = null;

function findSubarrayOffsets(haystack: Buffer, needle: Buffer): number[] {
  const hits: number[] = [];
  if (needle.length === 0 || haystack.length < needle.length) return hits;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) hits.push(i);
  }
  return hits;
}

async function findDLMMPairViaApi(tokenX: PublicKey, tokenY: PublicKey): Promise<PublicKey | null> {
  const cached = getMeteoraPairFromApiIndex(tokenX, tokenY);
  if (cached !== undefined) return cached;

  const tokenXStr = tokenX.toBase58();
  const tokenYStr = tokenY.toBase58();
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(
        `https://dlmm-api.meteora.ag/pair/all_by_groups?include_pool_token=true`,
        { signal: AbortSignal.timeout(METEORA_DLMM_API_TIMEOUT_MS) }
      );

      if (!response.ok) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const pairs = await response.json();

      // Build + cache l'index complet (warm path pour les requêtes suivantes)
      meteoraApiPairsIndexCache = { timestamp: Date.now(), index: buildMeteoraApiPairsIndex(pairs) };

      for (const group of pairs.groups || []) {
        for (const pair of group.pairs || []) {
          if (
            (pair.mint_x === tokenXStr && pair.mint_y === tokenYStr) ||
            (pair.mint_x === tokenYStr && pair.mint_y === tokenXStr)
          ) {
            return new PublicKey(pair.address);
          }
        }
      }
      return null;
    } catch {
      // try again
    }
  }

  return null;
}

async function getMeteoraLbPairMemcmpLayout(connection: Connection): Promise<
  { tokenXOffset: number; tokenYOffset: number; lbPairDiscriminatorB58: string } | null
> {
  if (meteoraLbPairMemcmpCache) return meteoraLbPairMemcmpCache;

  try {
    const mod: any = await loadMeteoraDlmmModule();
    const idl: any = mod?.IDL;
    const lbPairAcc = idl?.accounts?.find((a: any) => (a?.name ?? "").toLowerCase() === "lbpair");
    const discArr: number[] | undefined = lbPairAcc?.discriminator;
    if (!Array.isArray(discArr) || discArr.length !== 8) {
      throw new Error("Missing/invalid lbPair discriminator in Meteora IDL");
    }
    const lbPairDiscriminatorB58 = bs58.encode(Buffer.from(discArr));

    // We deduce token mint offsets by inspecting a known-good LB pair account data.
    // Prefer a known SOL/USDC lb_pair pubkey (no API dependency), then fall back to API discovery.
    let knownPair: PublicKey | null = METEORA_KNOWN_SOL_USDC_LBPAIR;
    let info = await connection.getAccountInfo(knownPair);
    if (!info?.data) {
      knownPair = await findDLMMPairViaApi(WSOL_MINT, USDC_MINT);
      if (!knownPair) {
        logger.warn("MeteoraResolver", "Unable to locate a WSOL/USDC pair for layout deduction", {
          wsol: WSOL_MINT.toBase58(),
          usdc: USDC_MINT.toBase58(),
        });
        return null;
      }
      info = await connection.getAccountInfo(knownPair);
    }

    const data = info?.data;
    if (!data) {
      logger.warn("MeteoraResolver", "Known WSOL/USDC lb_pair account missing", {
        lbPair: knownPair.toBase58(),
      });
      return null;
    }

    const wsolBytes = WSOL_MINT.toBuffer();
    const usdcBytes = USDC_MINT.toBuffer();

    // token_x_mint and token_y_mint are contiguous pubkeys in the LB pair struct.
    const wsolHits = findSubarrayOffsets(data, wsolBytes);
    const usdcHits = findSubarrayOffsets(data, usdcBytes);

    let tokenXOffset: number | null = null;
    for (const i of wsolHits) {
      if (i + 64 <= data.length && data.subarray(i + 32, i + 64).equals(usdcBytes)) {
        tokenXOffset = i;
        break;
      }
    }
    if (tokenXOffset === null) {
      for (const i of usdcHits) {
        if (i + 64 <= data.length && data.subarray(i + 32, i + 64).equals(wsolBytes)) {
          tokenXOffset = i;
          break;
        }
      }
    }

    if (tokenXOffset === null) {
      logger.warn("MeteoraResolver", "Failed to deduce Meteora lb_pair mint offsets", {
        lbPair: knownPair.toBase58(),
        wsolHits: wsolHits.slice(0, 5),
        usdcHits: usdcHits.slice(0, 5),
      });
      return null;
    }

    meteoraLbPairMemcmpCache = {
      tokenXOffset,
      tokenYOffset: tokenXOffset + 32,
      lbPairDiscriminatorB58,
    };
    return meteoraLbPairMemcmpCache;
  } catch (error) {
    logger.warn("MeteoraResolver", "Failed to prepare Meteora lb_pair memcmp layout", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function findMeteoraLbPairsByMintsOnChain(
  connection: Connection,
  mintA: PublicKey,
  mintB: PublicKey
): Promise<PublicKey[]> {
  const layout = await getMeteoraLbPairMemcmpLayout(connection);
  if (!layout) return [];

  const filtersBase = [
    {
      memcmp: {
        offset: 0,
        bytes: layout.lbPairDiscriminatorB58,
      },
    },
  ];

  const mintA58 = mintA.toBase58();
  const mintB58 = mintB.toBase58();

  const queries = [
    [
      ...filtersBase,
      { memcmp: { offset: layout.tokenXOffset, bytes: mintA58 } },
      { memcmp: { offset: layout.tokenYOffset, bytes: mintB58 } },
    ],
    [
      ...filtersBase,
      { memcmp: { offset: layout.tokenXOffset, bytes: mintB58 } },
      { memcmp: { offset: layout.tokenYOffset, bytes: mintA58 } },
    ],
  ];

  const pubkeys: PublicKey[] = [];
  for (const filters of queries) {
    let lastErr: string | undefined;
    try {
      // eslint-disable-next-line no-await-in-loop
      const accounts = await getProgramAccountsWithRetry(connection, METEORA_DLMM_PROGRAM, {
        filters: filters as any,
        dataSlice: { offset: 0, length: 0 },
      });
      for (const a of accounts) pubkeys.push(a.pubkey);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }

    if (lastErr) {
      logger.warn("MeteoraResolver", "getProgramAccounts memcmp query failed", {
        mintA: mintA58,
        mintB: mintB58,
        error: lastErr,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return pubkeys.filter((pk) => {
    const k = pk.toBase58();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function findDLMMPairViaOnChainMints(
  connection: Connection,
  tokenIn: PublicKey,
  tokenOut: PublicKey
): Promise<PublicKey | null> {
  const DLMM = await loadMeteoraDLMMClass();
  if (!DLMM?.create) return null;

  const candidates = await findMeteoraLbPairsByMintsOnChain(connection, tokenIn, tokenOut);
  if (candidates.length === 0) return null;

  // Filter candidates to those where the bitmap extension PDA exists.
  const bitmapPdas = candidates.map((pair) =>
    PublicKey.findProgramAddressSync([Buffer.from("bitmap"), pair.toBuffer()], METEORA_DLMM_PROGRAM)[0]
  );

  const bitmapInfos: Array<ReturnType<typeof connection.getAccountInfo> extends Promise<infer T> ? T : any> = [];
  for (let i = 0; i < bitmapPdas.length; i += 100) {
    const slice = bitmapPdas.slice(i, i + 100);
    // eslint-disable-next-line no-await-in-loop
    const infos = await connection.getMultipleAccountsInfo(slice);
    bitmapInfos.push(...infos);
  }

  const candidatesWithBitmap = candidates.filter((_, i) => Boolean(bitmapInfos[i]));
  const shortList = (candidatesWithBitmap.length > 0 ? candidatesWithBitmap : candidates).slice(0, 24);

  for (const candidate of shortList) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const dlmm = await DLMM.create(connection, candidate);
      // IMPORTANT: le SDK DLMM expose le mint via tokenX.mint.address.
      // tokenX.publicKey peut être un token account / reserve selon versions.
      const tokenXMint: PublicKey =
        (dlmm as any)?.tokenX?.mint?.address ??
        (dlmm as any)?.tokenX?.mint?.publicKey ??
        (dlmm as any)?.tokenX?.publicKey;
      const tokenYMint: PublicKey =
        (dlmm as any)?.tokenY?.mint?.address ??
        (dlmm as any)?.tokenY?.mint?.publicKey ??
        (dlmm as any)?.tokenY?.publicKey;

      if (!tokenXMint || !tokenYMint) {
        continue;
      }

      const inputIsX = tokenXMint.equals(tokenIn);
      const inputIsY = tokenYMint.equals(tokenIn);
      if (!inputIsX && !inputIsY) {
        continue;
      }

      // Meteora DLMM SDK: swapForY => input = quote token.
      // Le quote token est *celui qui est SOL ou USDC* (contrainte SDK).
      const quoteMint = tokenXMint.equals(WSOL_MINT) || tokenXMint.equals(USDC_MINT) ? tokenXMint : tokenYMint;
      const isSupportedQuote = quoteMint.equals(WSOL_MINT) || quoteMint.equals(USDC_MINT);
      if (!isSupportedQuote) {
        continue;
      }

      const swapForY = tokenIn.equals(quoteMint);

      // Certaines paires nécessitent plus que 5 bin arrays pour couvrir la range.
      // On tente plusieurs profondeurs avant d'abandonner.
      // eslint-disable-next-line no-await-in-loop
      let binArrayAccounts: Array<{ publicKey: PublicKey }> = [];
      for (const depth of [5, 20, 60]) {
        // eslint-disable-next-line no-await-in-loop
        binArrayAccounts = await dlmm.getBinArrayForSwap(swapForY, depth);
        if (binArrayAccounts.length > 0) break;
      }
      if (binArrayAccounts.length === 0) continue;

      logger.warn("MeteoraResolver", "Resolved DLMM pair via on-chain memcmp + validation", {
        inputMint: tokenIn.toBase58(),
        outputMint: tokenOut.toBase58(),
        pair: candidate.toBase58(),
        candidateCount: candidates.length,
      });
      return candidate;
    } catch {
      // try next
    }
  }

  {
    const inputStr = tokenIn.toBase58();
    const outputStr = tokenOut.toBase58();
    const key = `MeteoraResolver:memcmp-none-validated:${getPairCacheKey(inputStr, outputStr)}`;
    if (shouldLogResolverWarning(key)) {
      logger.warn("MeteoraResolver", "On-chain memcmp candidates found but none validated", {
        inputMint: inputStr,
        outputMint: outputStr,
        candidateCount: candidates.length,
      });
    }
  }
  return null;
}

/**
 * Trouve la paire DLMM pour deux tokens
 */
async function findDLMMPair(
  connection: Connection,
  tokenX: PublicKey,
  tokenY: PublicKey
): Promise<PublicKey | null> {
  try {
    const tokenXStr = tokenX.toBase58();
    const tokenYStr = tokenY.toBase58();
    const cacheKey = getPairCacheKey(tokenXStr, tokenYStr);
    const now = Date.now();
    const cached = meteoraPairCache.get(cacheKey);

    const pairCacheTtlMs = getMeteoraPairCacheTtlMs();

    if (cached && now - cached.timestamp < pairCacheTtlMs) {
      if (!cached.pair) {
        logger.debug("MeteoraResolver", "Serving cached miss", { cacheKey });
      }
      return cached.pair;
    }

    // Warm path: si l'index API en mémoire est frais, lookup immédiat.
    const fromIndex = getMeteoraPairFromApiIndex(tokenX, tokenY);
    if (fromIndex !== undefined) {
      if (fromIndex) {
        meteoraPairCache.set(cacheKey, { timestamp: now, pair: fromIndex });
        return fromIndex;
      }
      // Index frais mais paire absente.
      if (!allowMeteoraDeepFallbacks()) {
        meteoraPairCache.set(cacheKey, { timestamp: now, pair: null });
        return null;
      }
    }

    let lastError: string | undefined;
    let apiSaysNoPair = false;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(
          `https://dlmm-api.meteora.ag/pair/all_by_groups?include_pool_token=true`,
          { signal: AbortSignal.timeout(METEORA_DLMM_API_TIMEOUT_MS) }
        );

        if (!response.ok) {
          lastError = `status_${response.status}`;
          logger.warn("MeteoraResolver", "DLMM API returned non-200", {
            status: response.status,
            attempt,
            inputMint: tokenXStr,
            outputMint: tokenYStr,
          });
          continue;
        }

        const pairs = await response.json();

        // Cache l'index complet pour accélérer les prochaines requêtes.
        meteoraApiPairsIndexCache = { timestamp: Date.now(), index: buildMeteoraApiPairsIndex(pairs) };

        const address = meteoraApiPairsIndexCache.index.get(cacheKey);
        if (address) {
          const resolved = new PublicKey(address);
          meteoraPairCache.set(cacheKey, { timestamp: now, pair: resolved });
          return resolved;
        }

        {
          const key = `MeteoraResolver:api-no-pair:${getPairCacheKey(tokenXStr, tokenYStr)}`;
          if (shouldLogResolverWarning(key)) {
            logger.warn("MeteoraResolver", "No DLMM pair returned by API", {
              inputMint: tokenXStr,
              outputMint: tokenYStr,
            });
          }
        }

        // Si l'API a répondu correctement mais ne contient pas la paire,
        // on considère que Meteora n'a pas de pool et on évite les fallbacks coûteux par défaut.
        apiSaysNoPair = true;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logger.error("MeteoraResolver", "Failed to resolve DLMM pair", {
          attempt,
          inputMint: tokenXStr,
          outputMint: tokenYStr,
          error: lastError,
        });
      }
    }

    if (apiSaysNoPair && !allowMeteoraDeepFallbacks()) {
      meteoraPairCache.set(cacheKey, { timestamp: now, pair: null });
      return null;
    }

    // Fallback on-chain (no API): ask DLMM SDK to find an existing pair.
    try {
      const DLMM = await loadMeteoraDLMMClass();
      if (!DLMM?.getCustomizablePermissionlessLbPairIfExists) {
        throw new Error("DLMM.getCustomizablePermissionlessLbPairIfExists not available");
      }

      // Try both mint orderings (SDK may canonicalize internally, but keep it safe).
      const direct = await DLMM.getCustomizablePermissionlessLbPairIfExists(connection, tokenX, tokenY);
      const reversed = direct
        ? null
        : await DLMM.getCustomizablePermissionlessLbPairIfExists(connection, tokenY, tokenX);

      const resolved = direct ?? reversed;
      if (resolved) {
        let isUsable = false;
        try {
          if (!DLMM?.create) throw new Error("DLMM.create not available");
          const dlmm = await DLMM.create(connection, resolved);
          const tokenXMint: PublicKey =
            (dlmm as any)?.tokenX?.mint?.address ??
            (dlmm as any)?.tokenX?.mint?.publicKey ??
            (dlmm as any)?.tokenX?.publicKey;
          const tokenYMint: PublicKey =
            (dlmm as any)?.tokenY?.mint?.address ??
            (dlmm as any)?.tokenY?.mint?.publicKey ??
            (dlmm as any)?.tokenY?.publicKey;

          const inputIsX = Boolean(tokenXMint && tokenXMint.equals(tokenX));
          const inputIsY = Boolean(tokenYMint && tokenYMint.equals(tokenX));
          if (inputIsX || inputIsY) {
            const quoteMint =
              tokenXMint && (tokenXMint.equals(WSOL_MINT) || tokenXMint.equals(USDC_MINT)) ? tokenXMint : tokenYMint;
            const isSupportedQuote =
              Boolean(quoteMint) && (quoteMint.equals(WSOL_MINT) || quoteMint.equals(USDC_MINT));
            if (!isSupportedQuote) {
              isUsable = false;
            } else {
              const swapForY = tokenX.equals(quoteMint);
            let binArrayAccounts: Array<{ publicKey: PublicKey }> = [];
            for (const depth of [5, 20, 60]) {
              // eslint-disable-next-line no-await-in-loop
              binArrayAccounts = await dlmm.getBinArrayForSwap(swapForY, depth);
              if (binArrayAccounts.length > 0) break;
            }
            isUsable = binArrayAccounts.length > 0;
            }
          }
        } catch {
          isUsable = false;
        }

        if (isUsable) {
          logger.warn("MeteoraResolver", "Resolved DLMM pair via on-chain SDK fallback", {
            inputMint: tokenXStr,
            outputMint: tokenYStr,
            pair: resolved.toBase58(),
            lastError,
          });
          meteoraPairCache.set(cacheKey, { timestamp: now, pair: resolved });
          return resolved;
        }

        {
          const key = `MeteoraResolver:sdk-no-bins:${resolved.toBase58()}:${getPairCacheKey(tokenXStr, tokenYStr)}`;
          if (shouldLogResolverWarning(key)) {
            logger.warn("MeteoraResolver", "SDK fallback returned DLMM pair but no bins/liquidity", {
              inputMint: tokenXStr,
              outputMint: tokenYStr,
              pair: resolved.toBase58(),
              lastError,
            });
          }
        }
      }
    } catch (error) {
      logger.warn("MeteoraResolver", "On-chain DLMM pair lookup failed", {
        inputMint: tokenXStr,
        outputMint: tokenYStr,
        error: error instanceof Error ? error.message : String(error),
        lastError,
      });
    }

    // Generic on-chain fallback: targeted search via getProgramAccounts+memcmp.
    // This avoids depending on Meteora API availability and skips dead pairs (validated via bin arrays).
    try {
      if (allowMeteoraDeepFallbacks()) {
        const resolved = await findDLMMPairViaOnChainMints(connection, tokenX, tokenY);
        if (resolved) {
          meteoraPairCache.set(cacheKey, { timestamp: now, pair: resolved });
          return resolved;
        }
      }
    } catch (error) {
      logger.warn("MeteoraResolver", "On-chain memcmp DLMM pair lookup failed", {
        inputMint: tokenXStr,
        outputMint: tokenYStr,
        error: error instanceof Error ? error.message : String(error),
        lastError,
      });
    }

    // The old SOL/USDT-only scan fallback was replaced by the generic on-chain memcmp fallback above.

    if (cached?.pair) {
      logger.warn("MeteoraResolver", "Using stale cached DLMM pair after repeated failures", {
        cacheKey,
        ageMs: now - cached.timestamp,
        lastError,
      });
      meteoraPairCache.set(cacheKey, { timestamp: now, pair: cached.pair });
      return cached.pair;
    }

    meteoraPairCache.set(cacheKey, { timestamp: now, pair: null });
    return null;
  } catch (error) {
    logger.error("MeteoraResolver", "Unexpected resolver failure", {
      inputMint: tokenX.toBase58(),
      outputMint: tokenY.toBase58(),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Résout les comptes pour un swap Meteora DLMM
 * 
 * IMPORTANT: Les reserves (vaults) NE sont PAS des PDAs dérivés !
 * Ils sont stockés dans les données du compte lb_pair et fournis par l'API.
 */
export async function getMeteoraAccounts(
  connection: Connection,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string
): Promise<DEXAccounts | null> {
  try {
    const safeInputMint = toPublicKey(inputMint);
    const safeOutputMint = toPublicKey(outputMint);
    const safeUser = toPublicKey(userPublicKey);

    const lbPair = await findDLMMPair(connection, safeInputMint, safeOutputMint);
    if (!lbPair) {
      const inputStr = safeInputMint.toBase58();
      const outputStr = safeOutputMint.toBase58();
      const key = `MeteoraResolver:no-pair:${getPairCacheKey(inputStr, outputStr)}`;
      if (shouldLogResolverWarning(key)) {
        logger.warn("MeteoraResolver", "No DLMM pair found for mints", {
          inputMint: inputStr,
          outputMint: outputStr,
        });
      }
      return null;
    }

    // Fast-fail: certains lb_pairs n'ont pas (ou plus) de bitmap extension.
    // Le check était auparavant effectué en fin de resolver, après des étapes coûteuses (SDK + bin arrays).
    // Ici on le fait tout de suite et on met en cache le miss pour éviter ~10s de latence en UI.
    const [binArrayBitmapExtension] = PublicKey.findProgramAddressSync(
      [Buffer.from("bitmap"), lbPair.toBuffer()],
      METEORA_DLMM_PROGRAM
    );

    const bitmapCacheKey = binArrayBitmapExtension.toBase58();
    const now = Date.now();
    const missingAt = meteoraBitmapMissingCache.get(bitmapCacheKey);
    const missingTtlMs = getMeteoraBitmapMissingTtlMs();
    if (typeof missingAt === "number" && missingTtlMs > 0 && now - missingAt < missingTtlMs) {
      return null;
    }

    try {
      const bitmapInfo = await withTimeout(
        connection.getAccountInfo(binArrayBitmapExtension),
        getMeteoraBitmapAccountTimeoutMs(),
        `meteora-bitmap:${lbPair.toBase58()}`
      );
      if (!bitmapInfo) {
        console.warn("[MeteoraResolver] bin_array_bitmap_extension account missing", {
          lbPair: lbPair.toBase58(),
          binArrayBitmapExtension: binArrayBitmapExtension.toBase58(),
        });
        meteoraBitmapMissingCache.set(bitmapCacheKey, now);
        return null;
      }
    } catch {
      // Timeout / RPC err: cache négatif très court pour ne pas bloquer l'UI.
      meteoraBitmapMissingCache.set(bitmapCacheKey, now);
      return null;
    }

    // Préférer le SDK DLMM pour:
    // - obtenir les vraies reserves/mints/token programs depuis on-chain,
    // - obtenir les bin arrays exacts (dynamiques) via getBinArrayForSwap.
    // IMPORTANT: forcer le chargement du build dist (CJS) via require, sinon tsx peut résoudre vers `source`.
    let reserveX: PublicKey;
    let reserveY: PublicKey;
    let tokenXMint: PublicKey;
    let tokenYMint: PublicKey;
    let tokenXProgram: PublicKey;
    let tokenYProgram: PublicKey;
    let swapForY: boolean;
    let binArrays: PublicKey[];

    let pairData:
      | { address: string; reserve_x: string; reserve_y: string; bin_step: number; mint_x: string; mint_y: string }
      | null = null;

    try {
      const DLMM = await loadMeteoraDLMMClass();
      if (!DLMM?.create) {
        throw new Error("Meteora DLMM SDK DLMM.create not available");
      }

      const dlmm = await DLMM.create(connection, lbPair);
      reserveX = dlmm.tokenX.reserve;
      reserveY = dlmm.tokenY.reserve;
      // IMPORTANT: le SDK DLMM expose le mint via `tokenX.mint.address`.
      // Utiliser `tokenX.publicKey` ici a déjà produit des mints invalides (ex: token account)
      // => Token Program TransferChecked: "Account not associated with this Mint" (custom: 0x3).
      tokenXMint =
        dlmm?.tokenX?.mint?.address ??
        dlmm?.tokenX?.mint?.publicKey ??
        dlmm?.tokenX?.publicKey;
      tokenYMint =
        dlmm?.tokenY?.mint?.address ??
        dlmm?.tokenY?.mint?.publicKey ??
        dlmm?.tokenY?.publicKey;

      if (!tokenXMint || !tokenYMint) {
        logger.warn("MeteoraResolver", "DLMM SDK missing token mints", {
          lbPair: lbPair.toBase58(),
          tokenXMint: tokenXMint?.toBase58?.() ?? null,
          tokenYMint: tokenYMint?.toBase58?.() ?? null,
        });
        return null;
      }

      // Déduire le token program via le owner du compte mint (Tokenkeg ou Token-2022)
      const [tokenXMintInfo, tokenYMintInfo] = await Promise.all([
        connection.getAccountInfo(tokenXMint),
        connection.getAccountInfo(tokenYMint),
      ]);
      if (!tokenXMintInfo || !tokenYMintInfo) {
        logger.warn("MeteoraResolver", "DLMM SDK returned mint that is missing on-chain", {
          lbPair: lbPair.toBase58(),
          tokenXMint: tokenXMint.toBase58(),
          tokenYMint: tokenYMint.toBase58(),
        });
        return null;
      }
      tokenXProgram = tokenXMintInfo.owner;
      tokenYProgram = tokenYMintInfo.owner;

      {
        const inputIsX = safeInputMint.equals(tokenXMint);
        const inputIsY = safeInputMint.equals(tokenYMint);
        if (!inputIsX && !inputIsY) {
          console.warn("[MeteoraResolver] Input mint does not match DLMM token X/Y", {
            inputMint: safeInputMint.toBase58(),
            tokenXMint: tokenXMint.toBase58(),
            tokenYMint: tokenYMint.toBase58(),
          });
          return null;
        }

        // Meteora DLMM SDK: `swapForY` correspond à la direction X->Y (output = tokenY).
        // IMPORTANT: aligner avec `TrueNativeSwap.getMeteoraQuote`.
        const hasSupportedQuote =
          tokenXMint.equals(WSOL_MINT) ||
          tokenXMint.equals(USDC_MINT) ||
          tokenYMint.equals(WSOL_MINT) ||
          tokenYMint.equals(USDC_MINT);
        if (!hasSupportedQuote) {
          return null;
        }
        swapForY = inputIsX;
      }

      // Certaines paires nécessitent plus que 5 bin arrays pour couvrir la range.
      // On tente plusieurs profondeurs avant d'abandonner.
      let binArrayAccounts: Array<{ publicKey: PublicKey }> = [];
      for (const depth of [5, 20, 60]) {
        const candidate = await dlmm.getBinArrayForSwap(swapForY, depth);
        if (candidate.length > 0) {
          // Préférer la profondeur la plus grande disponible: certaines paires
          // renvoient un set non-vide en depth=5 mais sans bins liquidés,
          // ce qui mène à 6037 (CannotFindNonZeroLiquidityBinArrayId).
          binArrayAccounts = candidate;
        }
      }

      binArrays = binArrayAccounts.map((a) => a.publicKey);
      if (binArrays.length === 0) {
        console.warn("[MeteoraResolver] DLMM.getBinArrayForSwap returned empty set", {
          lbPair: lbPair.toBase58(),
          swapForY,
          attemptedDepths: [5, 20, 60],
        });
        return null;
      }

      // IMPORTANT: limiter le nombre de bin arrays passés en remaining accounts.
      // En multi-hop (2 legs) la tx peut dépasser la taille max v0 si on inclut trop de bin arrays.
      // Pour de petits amounts (cas des simulations), un prefix suffit généralement.
      // IMPORTANT: limiter agressivement pour éviter des tx v0 trop grosses en pratique.
      // Les bin arrays sont les principaux contributeurs (comptes dynamiques) à la taille.
      const MAX_BIN_ARRAYS_FOR_TX = 8;
      if (binArrays.length > MAX_BIN_ARRAYS_FOR_TX) {
        const key = `MeteoraResolver:truncate-bin-arrays:${lbPair.toBase58()}:${swapForY}`;
        if (shouldLogResolverWarning(key)) {
          logger.warn("MeteoraResolver", "Truncating bin arrays for tx size", {
            lbPair: lbPair.toBase58(),
            swapForY,
            before: binArrays.length,
            after: MAX_BIN_ARRAYS_FOR_TX,
          });
        }
        binArrays = binArrays.slice(0, MAX_BIN_ARRAYS_FOR_TX);
      }
    } catch (sdkError) {
      // On tente de récupérer les données de paire via API (réserves/mints/bin_step)
      try {
        const tokenXStr = safeInputMint.toBase58();
        const tokenYStr = safeOutputMint.toBase58();
        const response = await fetch(
          `https://dlmm-api.meteora.ag/pair/all_by_groups?include_pool_token=true`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (response.ok) {
          const pairs = await response.json();
          for (const group of pairs.groups || []) {
            for (const pair of group.pairs || []) {
              if (
                pair.address === lbPair.toBase58() ||
                (pair.mint_x === tokenXStr && pair.mint_y === tokenYStr) ||
                (pair.mint_x === tokenYStr && pair.mint_y === tokenXStr)
              ) {
                pairData = pair;
                break;
              }
            }
            if (pairData) break;
          }
        }
      } catch {
        // ignore
      }

      if (!pairData) {
        logger.warn("MeteoraResolver", "SDK failed and API did not return pair data", {
          lbPair: lbPair.toBase58(),
          error: sdkError instanceof Error ? sdkError.message : String(sdkError),
        });
        return null;
      }

      // Fallback minimal: utiliser l'API reserves/mints et scanner des bin arrays initialisés.
      // NOTE: on n'utilise PAS les offsets lb_pair (fragiles) pour activeId.
      reserveX = new PublicKey(pairData.reserve_x);
      reserveY = new PublicKey(pairData.reserve_y);
      tokenXMint = new PublicKey(pairData.mint_x);
      tokenYMint = new PublicKey(pairData.mint_y);

      const [tokenXMintInfo, tokenYMintInfo] = await Promise.all([
        connection.getAccountInfo(tokenXMint),
        connection.getAccountInfo(tokenYMint),
      ]);
      if (!tokenXMintInfo || !tokenYMintInfo) return null;
      tokenXProgram = tokenXMintInfo.owner;
      tokenYProgram = tokenYMintInfo.owner;

      {
        const inputIsX = safeInputMint.equals(tokenXMint);
        const inputIsY = safeInputMint.equals(tokenYMint);
        if (!inputIsX && !inputIsY) {
          console.warn("[MeteoraResolver] Input mint does not match DLMM token X/Y (fallback)", {
            inputMint: safeInputMint.toBase58(),
            tokenXMint: tokenXMint.toBase58(),
            tokenYMint: tokenYMint.toBase58(),
          });
          return null;
        }

        // IMPORTANT: swapForY is derived from the INPUT mint direction, NOT quote token semantics.
        swapForY = inputIsX; // TRUE if we're swapping from tokenX to tokenY
      }

      logger.warn("MeteoraResolver", "DLMM SDK unavailable; using fallback bin_array scan", {
        error: sdkError instanceof Error ? sdkError.message : String(sdkError),
      });

      // Scanner un petit voisinage autour de 0 (safe) pour trouver des bin arrays initialisés.
      // Ce fallback est moins fiable que le SDK mais évite de passer des PDAs non initialisées.
      // IMPORTANT: il faut souvent fournir un nombre significatif de bin arrays (remaining accounts)
      // sinon le programme DLMM peut échouer avec AccountNotEnoughKeys (3005).
      const desiredBinArrays = 60;
      const minBinArraysRequired = 20;
      const scanRadius = 2500;
      const binArraysFound: PublicKey[] = [];
      const indices: number[] = [];
      for (let i = 0; i < scanRadius && indices.length < 2000; i++) {
        indices.push(i);
        indices.push(-i);
      }
      const i64ToLe = (value: number): Buffer => {
        const buf = Buffer.alloc(8);
        let v = BigInt(value);
        if (v < 0n) v = (1n << 64n) + v;
        buf.writeBigUInt64LE(v);
        return buf;
      };
      const deriveBinArrayPda = (index: number): PublicKey => {
        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from("bin_array"), lbPair.toBuffer(), i64ToLe(index)],
          METEORA_DLMM_PROGRAM
        );
        return pda;
      };
      const batchSize = 50;
      for (let offset = 0; offset < indices.length && binArraysFound.length < desiredBinArrays; offset += batchSize) {
        const batch = indices.slice(offset, offset + batchSize);
        const candidates = batch.map((idx) => deriveBinArrayPda(idx));
        const infos = await connection.getMultipleAccountsInfo(candidates);
        for (let j = 0; j < candidates.length && binArraysFound.length < desiredBinArrays; j++) {
          const info = infos[j];
          if (!info) continue;
          if (!info.owner.equals(METEORA_DLMM_PROGRAM)) continue;
          binArraysFound.push(candidates[j]);
        }
      }

      if (binArraysFound.length === 0) {
        console.warn("[MeteoraResolver] No initialized bin_array accounts found (fallback)", {
          lbPair: lbPair.toBase58(),
        });
        return null;
      }

      if (binArraysFound.length < minBinArraysRequired) {
        console.warn("[MeteoraResolver] Too few initialized bin_array accounts found (fallback)", {
          lbPair: lbPair.toBase58(),
          found: binArraysFound.length,
          required: minBinArraysRequired,
        });
        return null;
      }
      binArrays = binArraysFound;
    }

    // Sanity: input doit être X ou Y (déjà validé dans le bloc direction ci-dessus)

    // binStep depuis l'API si disponible, sinon best-effort: 0.
    // (Le feeRate est purement metadata UI; le swap n'en dépend pas.)
    const binStep = pairData?.bin_step ?? 0;
    
    // Dériver l'oracle DLMM
    const [oracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), lbPair.toBuffer()],
      METEORA_DLMM_PROGRAM
    );
    
    // Calculer les ATAs de l'utilisateur (support Token-2022 via token program owner)
    const { getAssociatedTokenAddress } = await import("@solana/spl-token");
    const userTokenX = await getAssociatedTokenAddress(tokenXMint, safeUser, false, tokenXProgram);
    const userTokenY = await getAssociatedTokenAddress(tokenYMint, safeUser, false, tokenYProgram);

    // Meteora DLMM (IDL SDK): les comptes attendus sont `user_token_in` / `user_token_out`.
    // Direction = déduite par l’ordre des comptes, pas par une paire X/Y fixe.
    const inputIsX = safeInputMint.equals(tokenXMint);
    const userTokenIn = inputIsX ? userTokenX : userTokenY;
    const userTokenOut = inputIsX ? userTokenY : userTokenX;
    
    // binArrayBitmapExtension est validé plus haut (fast-fail + cache).
    
    // Event authority
    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      METEORA_DLMM_PROGRAM
    );
    
    // `host_fee_in` est optionnel côté Meteora, mais si fourni il doit être cohérent avec le token d'entrée.
    const hostFeeIn = userTokenIn;

    return {
      accounts: [
        lbPair,                        // 0. lb_pair
        binArrayBitmapExtension,       // 1. bin_array_bitmap_extension
        reserveX,                      // 2. reserve_x (vault)
        reserveY,                      // 3. reserve_y (vault)
        userTokenIn,                   // 4. user_token_in
        userTokenOut,                  // 5. user_token_out
        tokenXMint,                    // 6. token_x_mint
        tokenYMint,                    // 7. token_y_mint
        oracle,                        // 8. oracle
        // NOTE: host_fee_in (si utilisé) doit être un compte SPL du token d'entre.
        // - X->Y: fee en X  userTokenX
        // - Y->X: fee en Y  userTokenY
        hostFeeIn,                     // 9. host_fee_in (optional) - use a real SPL token account
        safeUser,                      // 10. user (signer)
        tokenXProgram,                 // 11. token_x_program
        tokenYProgram,                 // 12. token_y_program
        eventAuthority,                // 13. event_authority
        METEORA_DLMM_PROGRAM,          // 14. program
        ...binArrays,                  // 15.. dynamic bin arrays (writable)
      ],
      // Exposer les reserves pour vault_token_account_a/b
      vaultTokenAccountA: reserveX,
      vaultTokenAccountB: reserveY,
      meta: {
        venue: 'METEORA_DLMM',
        poolAddress: lbPair.toBase58(),
        feeRate: binStep * 0.0001,
      },
    };
  } catch (error) {
    console.error("[MeteoraResolver] Error:", error);
    return null;
  }
}

// ============================================================================
// PHOENIX
// ============================================================================

/**
 * Trouve le marché Phoenix pour une paire
 */
async function findPhoenixMarket(
  connection: Connection,
  baseMint: PublicKey,
  quoteMint: PublicKey
): Promise<{ market: PublicKey; baseMint: PublicKey; quoteMint: PublicKey } | null> {
  void connection; // reserved for future SDK-based discovery; keep signature stable
  const match = getPhoenixMarketConfig(baseMint.toBase58(), quoteMint.toBase58());
  if (!match) {
    return null;
  }

  return {
    market: match.config.marketAddress,
    baseMint: match.config.baseMint,
    quoteMint: match.config.quoteMint,
  };
}

/**
 * Résout les comptes pour un swap Phoenix
 */
export async function getPhoenixAccounts(
  connection: Connection,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string
): Promise<DEXAccounts | null> {
  try {
    const safeInputMint = toPublicKey(inputMint);
    const safeOutputMint = toPublicKey(outputMint);
    const safeUser = toPublicKey(userPublicKey);
    const marketInfo = await findPhoenixMarket(connection, safeInputMint, safeOutputMint);
    if (!marketInfo) {
      console.warn("[PhoenixResolver] No Phoenix market found");
      return null;
    }

    const market = marketInfo.market;
    const baseMint = marketInfo.baseMint;
    const quoteMint = marketInfo.quoteMint;
    
    // Import du package root (CJS) pour éviter que tsx n'attrape des sources TS de dépendances (beet).
    // Le module peut exposer les exports sur la racine ou sous `default` selon le loader.
    const phoenixSdk: any = await import("@ellipsis-labs/phoenix-sdk");
    const MarketState = phoenixSdk.MarketState ?? phoenixSdk.default?.MarketState;
    if (!MarketState?.load) {
      throw new Error("Phoenix SDK MarketState export not found");
    }

    // Certains marchés Phoenix sont stockés en zstd: utiliser le helper SDK si dispo.
    const getConfirmedMarketAccountZstd =
      phoenixSdk.getConfirmedMarketAccountZstd ?? phoenixSdk.default?.getConfirmedMarketAccountZstd;
    let marketBuffer: Buffer | undefined;
    if (getConfirmedMarketAccountZstd) {
      try {
        marketBuffer = await getConfirmedMarketAccountZstd(connection, market, "confirmed");
      } catch (error) {
        // Certains RPC ne supportent pas `base64+zstd`; fallback sur `getAccountInfo` classique.
        logger.warn("PhoenixResolver", "getConfirmedMarketAccountZstd failed; falling back to getAccountInfo", {
          market: market.toBase58(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (!marketBuffer) {
      marketBuffer = (await connection.getAccountInfo(market, "confirmed"))?.data;
    }

    // Dernier recours: les gros markets Phoenix (ex SOL/USDT) peuvent dépasser les limites
    // de `getAccountInfo` en base64 côté web3. Le RPC supporte `base64+zstd`, mais web3
    // ne le décompresse pas; on fait donc un JSON-RPC raw + décompression zstd.
    if (!marketBuffer) {
      try {
        const rpcEndpoint: string | undefined = (connection as any).rpcEndpoint;
        if (rpcEndpoint && typeof fetch === "function") {
          const body = {
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [market.toBase58(), { encoding: "base64+zstd", commitment: "confirmed" }],
          };
          const resp = await fetch(rpcEndpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const json: any = await resp.json();
          const value = json?.result?.value;
          const dataEntry = value?.data;
          if (value && Array.isArray(dataEntry) && dataEntry[0] && dataEntry[1] === "base64+zstd") {
            const compressed = Buffer.from(String(dataEntry[0]), "base64");
            const { ZSTDDecoder } = await import("zstddec");
            const decoder = new ZSTDDecoder();
            await decoder.init();
            const decoded = decoder.decode(new Uint8Array(compressed));
            marketBuffer = Buffer.from(decoded);
          }
        }
      } catch (error) {
        logger.warn("PhoenixResolver", "Raw base64+zstd fallback failed", {
          market: market.toBase58(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (!marketBuffer) return null;

    const marketState = MarketState.load({ address: market, buffer: marketBuffer });
    
    // Log authority
    const [logAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("log")],
      PHOENIX_PROGRAM
    );

    const baseVault = marketState.getBaseVaultKey();
    const quoteVault = marketState.getQuoteVaultKey();

    // Phoenix seat PDA (non requis par l'instruction Swap elle-même, mais attendu
    // par certaines versions du router/cpi pour compatibilité).
    // Derivation conforme au phoenix-sdk:
    // PublicKey.findProgramAddressSync(["seat", market, trader], PHOENIX_PROGRAM)
    const [seat] = PublicKey.findProgramAddressSync(
      [Buffer.from("seat"), market.toBuffer(), safeUser.toBuffer()],
      PHOENIX_PROGRAM
    );

    // IMPORTANT: SwapBack CPI expects *user SPL token accounts* here (Tokenkeg-owned),
    // not Phoenix internal PDAs. Phoenix validates the token account owner.
    const [baseMintInfo, quoteMintInfo] = await Promise.all([
      connection.getAccountInfo(baseMint, "confirmed"),
      connection.getAccountInfo(quoteMint, "confirmed"),
    ]);
    if (!baseMintInfo || !quoteMintInfo) return null;
    if (!baseMintInfo.owner.equals(TOKEN_PROGRAM_ID) || !quoteMintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      logger.warn("PhoenixResolver", "Phoenix requires Tokenkeg mints; Token-2022 not supported", {
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58(),
        baseMintOwner: baseMintInfo.owner.toBase58(),
        quoteMintOwner: quoteMintInfo.owner.toBase58(),
      });
      return null;
    }

    const baseAccount = await getAssociatedTokenAddress(baseMint, safeUser, false, TOKEN_PROGRAM_ID);
    const quoteAccount = await getAssociatedTokenAddress(quoteMint, safeUser, false, TOKEN_PROGRAM_ID);

    const [baseAcctInfo, quoteAcctInfo, baseVaultInfo, quoteVaultInfo] =
      await connection.getMultipleAccountsInfo([baseAccount, quoteAccount, baseVault, quoteVault], "confirmed");

    logger.debug("PhoenixResolver", "Resolved Phoenix accounts", {
      market: market.toBase58(),
      baseMint: baseMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
      baseAccount: baseAccount.toBase58(),
      quoteAccount: quoteAccount.toBase58(),
      baseVault: baseVault.toBase58(),
      quoteVault: quoteVault.toBase58(),
      baseAccountOwner: baseAcctInfo?.owner?.toBase58() ?? null,
      quoteAccountOwner: quoteAcctInfo?.owner?.toBase58() ?? null,
      baseVaultOwner: baseVaultInfo?.owner?.toBase58() ?? null,
      quoteVaultOwner: quoteVaultInfo?.owner?.toBase58() ?? null,
    });

    // Note: base/quote user ATAs may not exist yet (the tx can create them before CPI).
    // Only enforce Tokenkeg ownership if the account exists. Vaults must exist and be Tokenkeg-owned.
    const existsAndBadOwner = (info: { owner: PublicKey } | null) =>
      info ? !info.owner.equals(TOKEN_PROGRAM_ID) : false;
    const missingOrBadOwner = (info: { owner: PublicKey } | null) =>
      !info || !info.owner.equals(TOKEN_PROGRAM_ID);

    if (
      existsAndBadOwner(baseAcctInfo as any) ||
      existsAndBadOwner(quoteAcctInfo as any) ||
      missingOrBadOwner(baseVaultInfo as any) ||
      missingOrBadOwner(quoteVaultInfo as any)
    ) {
      logger.warn("PhoenixResolver", "Phoenix token accounts must be Tokenkeg-owned", {
        market: market.toBase58(),
        baseAccount: baseAccount.toBase58(),
        quoteAccount: quoteAccount.toBase58(),
        baseVault: baseVault.toBase58(),
        quoteVault: quoteVault.toBase58(),
        tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
        baseAccountOwner: baseAcctInfo?.owner?.toBase58() ?? null,
        quoteAccountOwner: quoteAcctInfo?.owner?.toBase58() ?? null,
        baseVaultOwner: baseVaultInfo?.owner?.toBase58() ?? null,
        quoteVaultOwner: quoteVaultInfo?.owner?.toBase58() ?? null,
      });
      return null;
    }
    
    return {
      accounts: [
        // IMPORTANT: ordre attendu par l'instruction Phoenix Swap (phoenix-sdk createSwapInstruction)
        // (program, log, market, trader, baseAcct, quoteAcct, baseVault, quoteVault, tokenProgram)
        PHOENIX_PROGRAM,
        logAuthority,
        market,
        safeUser,
        baseAccount,
        quoteAccount,
        baseVault,
        quoteVault,
        TOKEN_PROGRAM_ID,
        // Padding/compat: certaines versions du router attendent 10 remaining accounts.
        // Le `seat` est ajouté en fin pour ne pas décaler les indices des 9 comptes du Swap.
        seat,
      ],
      meta: {
        venue: 'PHOENIX',
        poolAddress: market.toBase58(),
        feeRate: 0.001, // Phoenix a généralement des frais bas
      },
    };
  } catch (error) {
    console.error("[PhoenixResolver] Error:", error);
    return null;
  }
}

// ============================================================================
// RAYDIUM
// ============================================================================

const RAYDIUM_AMM_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

type RaydiumAmmLayout = {
  dataSize: number;
  offsets: {
    tokenMintA: number;
    tokenMintB: number;
    ammOpenOrders: number;
    poolCoinTokenAccount: number;
    poolPcTokenAccount: number;
    serumProgramId: number;
    serumMarket: number;
  };
};

let raydiumAmmLayoutCache:
  | {
      timestamp: number;
      layout: RaydiumAmmLayout;
    }
  | null = null;

const RAYDIUM_LAYOUT_CACHE_TTL_MS = 10 * 60 * 1000;

function findAllOccurrences(haystack: Buffer, needle: Buffer): number[] {
  const offsets: number[] = [];
  const n = needle.length;
  for (let i = 0; i <= haystack.length - n; i++) {
    if (haystack.subarray(i, i + n).equals(needle)) offsets.push(i);
  }
  return offsets;
}

function pickBestOffset(candidates: number[], opts: { label: string }): number | null {
  if (candidates.length === 0) return null;
  const aligned = candidates.filter((o) => o % 8 === 0);
  const chosen = (aligned.length > 0 ? aligned : candidates).slice().sort((a, b) => a - b)[0];
  if (candidates.length > 1) {
    logger.debug("RaydiumResolver", "Multiple candidate offsets; picking best", {
      label: opts.label,
      chosen,
      candidates: candidates.slice(0, 8),
      candidatesCount: candidates.length,
    });
  }
  return chosen;
}

function readPubkeyAt(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + 32));
}

function pickBestMintOffsets(mintAOffsets: number[], mintBOffsets: number[]): { a: number; b: number } | null {
  if (mintAOffsets.length === 0 || mintBOffsets.length === 0) return null;

  const aAligned = mintAOffsets.filter((o) => o % 8 === 0);
  const bAligned = mintBOffsets.filter((o) => o % 8 === 0);
  const as = aAligned.length > 0 ? aAligned : mintAOffsets;
  const bs = bAligned.length > 0 ? bAligned : mintBOffsets;

  let best: { a: number; b: number; score: number } | null = null;
  for (const a of as) {
    for (const b of bs) {
      if (a === b) continue;
      const dist = Math.abs(a - b);
      const penalty = dist > 256 ? 1_000_000 : 0;
      const score = dist + penalty;
      if (!best || score < best.score) best = { a, b, score };
    }
  }
  return best ? { a: best.a, b: best.b } : null;
}

function getRaydiumAmmAuthorityFromStaticConfig(): PublicKey | null {
  const knownPool = getAllRaydiumPools()[0];
  if (!knownPool) return null;
  return knownPool.ammAuthority;
}

function isRpcProgramAccountsIndexDisabled(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("excluded from account secondary indexes") ||
    msg.includes("this RPC method unavailable") ||
    msg.includes("get accounts owned by program")
  );
}

async function getRaydiumAmmLayout(connection: Connection): Promise<RaydiumAmmLayout | null> {
  const now = Date.now();
  if (raydiumAmmLayoutCache && now - raydiumAmmLayoutCache.timestamp < RAYDIUM_LAYOUT_CACHE_TTL_MS) {
    return raydiumAmmLayoutCache.layout;
  }

  const knownPool = getAllRaydiumPools()[0];
  if (!knownPool) {
    logger.warn("RaydiumResolver", "No static Raydium pools available to deduce AMM layout");
    return null;
  }

  const info = await connection.getAccountInfo(knownPool.ammAddress);
  if (!info?.data) {
    logger.warn("RaydiumResolver", "Known Raydium AMM account missing; cannot deduce layout", {
      ammAddress: knownPool.ammAddress.toBase58(),
    });
    return null;
  }

  const data = info.data;
  const dataSize = data.length;

  const mintAOffsets = findAllOccurrences(data, knownPool.tokenMintA.toBuffer());
  const mintBOffsets = findAllOccurrences(data, knownPool.tokenMintB.toBuffer());
  const mintOffsets = pickBestMintOffsets(mintAOffsets, mintBOffsets);
  if (!mintOffsets) {
    logger.warn("RaydiumResolver", "Failed to deduce Raydium mint offsets", {
      ammAddress: knownPool.ammAddress.toBase58(),
      mintAOffsetsCount: mintAOffsets.length,
      mintBOffsetsCount: mintBOffsets.length,
    });
    return null;
  }

  const offsets = {
    tokenMintA: mintOffsets.a,
    tokenMintB: mintOffsets.b,
    ammOpenOrders: pickBestOffset(findAllOccurrences(data, knownPool.ammOpenOrders.toBuffer()), {
      label: "ammOpenOrders",
    }),
    poolCoinTokenAccount: pickBestOffset(
      findAllOccurrences(data, knownPool.poolCoinTokenAccount.toBuffer()),
      { label: "poolCoinTokenAccount" }
    ),
    poolPcTokenAccount: pickBestOffset(
      findAllOccurrences(data, knownPool.poolPcTokenAccount.toBuffer()),
      { label: "poolPcTokenAccount" }
    ),
    serumProgramId: pickBestOffset(findAllOccurrences(data, knownPool.serumProgramId.toBuffer()), {
      label: "serumProgramId",
    }),
    serumMarket: pickBestOffset(findAllOccurrences(data, knownPool.serumMarket.toBuffer()), {
      label: "serumMarket",
    }),
  } as const;

  for (const [k, v] of Object.entries(offsets)) {
    if (v === null) {
      logger.warn("RaydiumResolver", "Failed to deduce Raydium AMM layout offset", {
        field: k,
        ammAddress: knownPool.ammAddress.toBase58(),
        dataSize,
      });
      return null;
    }
  }

  const layout: RaydiumAmmLayout = {
    dataSize,
    offsets: offsets as any,
  };

  // Safety: validate offsets against known pool
  const roundtrip = {
    tokenMintA: readPubkeyAt(data, layout.offsets.tokenMintA),
    tokenMintB: readPubkeyAt(data, layout.offsets.tokenMintB),
    ammOpenOrders: readPubkeyAt(data, layout.offsets.ammOpenOrders),
    poolCoinTokenAccount: readPubkeyAt(data, layout.offsets.poolCoinTokenAccount),
    poolPcTokenAccount: readPubkeyAt(data, layout.offsets.poolPcTokenAccount),
    serumProgramId: readPubkeyAt(data, layout.offsets.serumProgramId),
    serumMarket: readPubkeyAt(data, layout.offsets.serumMarket),
  };

  const ok =
    roundtrip.tokenMintA.equals(knownPool.tokenMintA) &&
    roundtrip.tokenMintB.equals(knownPool.tokenMintB) &&
    roundtrip.ammOpenOrders.equals(knownPool.ammOpenOrders) &&
    roundtrip.poolCoinTokenAccount.equals(knownPool.poolCoinTokenAccount) &&
    roundtrip.poolPcTokenAccount.equals(knownPool.poolPcTokenAccount) &&
    roundtrip.serumProgramId.equals(knownPool.serumProgramId) &&
    roundtrip.serumMarket.equals(knownPool.serumMarket);

  if (!ok) {
    logger.error("RaydiumResolver", "Raydium AMM layout deduction failed roundtrip validation", {
      ammAddress: knownPool.ammAddress.toBase58(),
      dataSize,
      offsets: layout.offsets,
      expected: {
        tokenMintA: knownPool.tokenMintA.toBase58(),
        tokenMintB: knownPool.tokenMintB.toBase58(),
        ammOpenOrders: knownPool.ammOpenOrders.toBase58(),
        poolCoinTokenAccount: knownPool.poolCoinTokenAccount.toBase58(),
        poolPcTokenAccount: knownPool.poolPcTokenAccount.toBase58(),
        serumProgramId: knownPool.serumProgramId.toBase58(),
        serumMarket: knownPool.serumMarket.toBase58(),
      },
      got: {
        tokenMintA: roundtrip.tokenMintA.toBase58(),
        tokenMintB: roundtrip.tokenMintB.toBase58(),
        ammOpenOrders: roundtrip.ammOpenOrders.toBase58(),
        poolCoinTokenAccount: roundtrip.poolCoinTokenAccount.toBase58(),
        poolPcTokenAccount: roundtrip.poolPcTokenAccount.toBase58(),
        serumProgramId: roundtrip.serumProgramId.toBase58(),
        serumMarket: roundtrip.serumMarket.toBase58(),
      },
    });
    return null;
  }

  raydiumAmmLayoutCache = { timestamp: now, layout };
  return layout;
}

function decodeRaydiumPoolFromAmmState(
  ammAddress: PublicKey,
  data: Buffer,
  layout: RaydiumAmmLayout,
  ammAuthority: PublicKey
): RaydiumPoolConfig {
  const tokenMintA = readPubkeyAt(data, layout.offsets.tokenMintA);
  const tokenMintB = readPubkeyAt(data, layout.offsets.tokenMintB);
  const ammOpenOrders = readPubkeyAt(data, layout.offsets.ammOpenOrders);
  const poolCoinTokenAccount = readPubkeyAt(data, layout.offsets.poolCoinTokenAccount);
  const poolPcTokenAccount = readPubkeyAt(data, layout.offsets.poolPcTokenAccount);
  const serumProgramId = readPubkeyAt(data, layout.offsets.serumProgramId);
  const serumMarket = readPubkeyAt(data, layout.offsets.serumMarket);

  return {
    symbol: `${tokenMintA.toBase58().slice(0, 6)}/${tokenMintB.toBase58().slice(0, 6)}`,
    ammAddress,
    ammAuthority,
    ammOpenOrders,
    // Champs requis par l'interface mais non utilisés par notre CPI Raydium actuel.
    ammTargetOrders: PublicKey.default,
    poolCoinTokenAccount,
    poolPcTokenAccount,
    poolWithdrawQueue: PublicKey.default,
    poolTempLpTokenAccount: PublicKey.default,
    serumProgramId,
    serumMarket,
    tokenMintA,
    tokenMintB,
    feeBps: 0,
    minLiquidityUsd: 0,
  };
}

async function findRaydiumPoolOnChain(
  connection: Connection,
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<RaydiumPoolConfig | null> {
  const readSplTokenAccountAmount = (data: Buffer | null | undefined): bigint | null => {
    // SPL Token Account layout: amount is u64 LE at offset 64
    // https://spl.solana.com/token (Token account layout)
    if (!data || data.length < 72) return null;
    try {
      return data.readBigUInt64LE(64);
    } catch {
      return null;
    }
  };

  const layout = await getRaydiumAmmLayout(connection);
  if (!layout) return null;

  const ammAuthority = getRaydiumAmmAuthorityFromStaticConfig();
  if (!ammAuthority) {
    logger.warn("RaydiumResolver", "Missing Raydium AMM authority (no static pools?)");
    return null;
  }

  try {
    const query = async (a: PublicKey, b: PublicKey) =>
      connection.getProgramAccounts(RAYDIUM_AMM_PROGRAM, {
        filters: [
          { dataSize: layout.dataSize },
          { memcmp: { offset: layout.offsets.tokenMintA, bytes: a.toBase58() } },
          { memcmp: { offset: layout.offsets.tokenMintB, bytes: b.toBase58() } },
        ],
      });

    let candidates = await query(inputMint, outputMint);
    if (candidates.length === 0) {
      candidates = await query(outputMint, inputMint);
    }

    if (candidates.length === 0) return null;

    // IMPORTANT: Il peut exister plusieurs AMM Raydium pour la même paire.
    // Choisir arbitrairement le premier peut sélectionner un pool quasi vide => CPI "insufficient funds".
    // On score les candidats (capés) via les balances des vaults (coin/pc) et on prend le meilleur.
    candidates.sort((x, y) => x.pubkey.toBase58().localeCompare(y.pubkey.toBase58()));

    const MAX_CANDIDATES_TO_SCORE = 8;
    const scoredCandidates = candidates.slice(0, MAX_CANDIDATES_TO_SCORE).map((c) => {
      const decoded = decodeRaydiumPoolFromAmmState(c.pubkey, c.account.data, layout, ammAuthority);
      return { candidate: c, decoded };
    });

    const vaultKeys: PublicKey[] = [];
    for (const item of scoredCandidates) {
      vaultKeys.push(item.decoded.poolCoinTokenAccount, item.decoded.poolPcTokenAccount);
    }

    const vaultInfos = await connection.getMultipleAccountsInfo(vaultKeys, "confirmed");
    const vaultAmountByKey = new Map<string, bigint>();
    for (let i = 0; i < vaultKeys.length; i++) {
      const amount = readSplTokenAccountAmount(vaultInfos[i]?.data);
      if (amount !== null) vaultAmountByKey.set(vaultKeys[i].toBase58(), amount);
    }

    let best = scoredCandidates[0];
    let bestScore: bigint = -1n;

    for (const item of scoredCandidates) {
      const coin = vaultAmountByKey.get(item.decoded.poolCoinTokenAccount.toBase58()) ?? 0n;
      const pc = vaultAmountByKey.get(item.decoded.poolPcTokenAccount.toBase58()) ?? 0n;
      const score = coin * pc;
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    const chosen = best.candidate;
    const decoded = best.decoded;

    const mA = decoded.tokenMintA;
    const mB = decoded.tokenMintB;
    const matches =
      (mA.equals(inputMint) && mB.equals(outputMint)) || (mA.equals(outputMint) && mB.equals(inputMint));
    if (!matches) {
      logger.warn("RaydiumResolver", "Raydium on-chain candidate did not match requested mints", {
        requested: {
          inputMint: inputMint.toBase58(),
          outputMint: outputMint.toBase58(),
        },
        decoded: {
          tokenMintA: mA.toBase58(),
          tokenMintB: mB.toBase58(),
        },
        ammAddress: chosen.pubkey.toBase58(),
      });
      return null;
    }

    if (candidates.length > 1) {
      logger.warn("RaydiumResolver", "Multiple Raydium AMM pools found for pair; picking best by vault liquidity", {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        picked: chosen.pubkey.toBase58(),
        count: candidates.length,
        scored: Math.min(candidates.length, 8),
      });
    }

    return decoded;
  } catch (error) {
    if (isRpcProgramAccountsIndexDisabled(error)) {
      logger.warn("RaydiumResolver", "RPC does not support getProgramAccounts for Raydium AMM; on-chain discovery disabled", {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        rpcHint: "Use an indexed RPC (e.g. Helius/Triton/QuickNode) if you want dynamic Raydium pool discovery",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    logger.error("RaydiumResolver", "Raydium on-chain discovery failed", {
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Trouve le pool Raydium AMM pour une paire
 */
async function findRaydiumPool(
  connection: Connection,
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<RaydiumPoolConfig | null> {
  try {
    const inputMintStr = inputMint.toBase58();
    const outputMintStr = outputMint.toBase58();
    const cacheKey = getPairCacheKey(inputMintStr, outputMintStr);
    const now = Date.now();
    const cached = raydiumPoolCache.get(cacheKey);

    if (cached && now - cached.timestamp < RESOLVER_CACHE_TTL_MS) {
      if (!cached.pool) {
        logger.debug("RaydiumResolver", "Serving cached miss", { cacheKey });
      }
      return cached.pool;
    }

    const staticPool = getRaydiumPool(inputMint, outputMint);
    if (staticPool) {
      raydiumPoolCache.set(cacheKey, { timestamp: now, pool: staticPool });
      return staticPool;
    }

    const onChainPool = await findRaydiumPoolOnChain(connection, inputMint, outputMint);
    if (onChainPool) {
      logger.info("RaydiumResolver", "Resolved Raydium AMM pool via on-chain discovery", {
        inputMint: inputMintStr,
        outputMint: outputMintStr,
        ammAddress: onChainPool.ammAddress.toBase58(),
      });
      raydiumPoolCache.set(cacheKey, { timestamp: now, pool: onChainPool });
      return onChainPool;
    }

    logger.warn("RaydiumResolver", "No Raydium pool config found", {
      inputMint: inputMintStr,
      outputMint: outputMintStr,
    });

    raydiumPoolCache.set(cacheKey, { timestamp: now, pool: null });
    return null;
  } catch (error) {
    logger.error("RaydiumResolver", "Unexpected resolver failure", {
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Résout les comptes pour un swap Raydium AMM
 */
export async function getRaydiumAccounts(
  connection: Connection,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string
): Promise<DEXAccounts | null> {
  try {
    const safeInputMint = toPublicKey(inputMint);
    const safeOutputMint = toPublicKey(outputMint);
    const safeUser = toPublicKey(userPublicKey);
    const poolConfig = await findRaydiumPool(connection, safeInputMint, safeOutputMint);

    if (!poolConfig) {
      logger.warn("RaydiumResolver", "No Raydium pool found for pair", {
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
      });
      return null;
    }

    const serumMeta = await loadSerumMarketMeta(
      connection,
      poolConfig.serumMarket,
      poolConfig.serumProgramId
    );

    if (!serumMeta) {
      logger.warn("RaydiumResolver", "Missing Serum metadata for market", {
        market: poolConfig.serumMarket.toBase58(),
      });
      return null;
    }

    // NOTE: Le CPI Raydium AMM côté programme on-chain supporte de manière fiable
    // le sens "base-in" (ex: SOL→USDC) mais le sens inverse "quote→base" a
    // montré des échecs persistants (0x28 insufficient funds) en mainnet.
    // En attendant une correction on-chain, on évite de sélectionner Raydium
    // pour ce sens afin de laisser Meteora/Orca prendre le relais.
    if (poolConfig.tokenMintA.equals(safeOutputMint) && poolConfig.tokenMintB.equals(safeInputMint)) {
      logger.debug("RaydiumResolver", "Raydium AMM quote→base temporarily disabled", {
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
        ammAddress: poolConfig.ammAddress.toBase58(),
        hint: "Use Orca/Meteora for quote→base until on-chain Raydium CPI is fixed",
      });
      return null;
    }

    const userSourceAccount = await getAssociatedTokenAddress(safeInputMint, safeUser);
    const userDestinationAccount = await getAssociatedTokenAddress(safeOutputMint, safeUser);

    return {
      accounts: [
        TOKEN_PROGRAM_ID,                      // 0. SPL token program
        poolConfig.ammAddress,                 // 1. AMM pool state
        poolConfig.ammAuthority,               // 2. AMM authority
        poolConfig.ammOpenOrders,              // 3. AMM open orders
        poolConfig.poolCoinTokenAccount,       // 4. AMM coin vault
        poolConfig.poolPcTokenAccount,         // 5. AMM pc vault
        poolConfig.serumProgramId,             // 6. Serum DEX program
        poolConfig.serumMarket,                // 7. Serum market
        serumMeta.bids,                        // 8. Serum bids
        serumMeta.asks,                        // 9. Serum asks
        serumMeta.eventQueue,                  // 10. Serum event queue
        serumMeta.coinVault,                   // 11. Serum coin vault
        serumMeta.pcVault,                     // 12. Serum pc vault
        serumMeta.vaultSigner,                 // 13. Serum vault signer PDA
        userSourceAccount,                     // 14. User source ATA
        userDestinationAccount,                // 15. User destination ATA
        safeUser,                              // 16. User authority (signer)
        RAYDIUM_AMM_PROGRAM,                   // 17. Raydium program (required by CPI invoke)
      ],
      vaultTokenAccountA: poolConfig.poolCoinTokenAccount,
      vaultTokenAccountB: poolConfig.poolPcTokenAccount,
      meta: {
        venue: 'RAYDIUM_AMM',
        poolAddress: poolConfig.ammAddress.toBase58(),
        feeRate: poolConfig.feeBps / 10_000,
      },
    };
  } catch (error) {
    logger.error("RaydiumResolver", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// UNIFIED RESOLVER
// ============================================================================

export type SupportedVenue =
  | 'ORCA_WHIRLPOOL'
  | 'METEORA_DLMM'
  | 'PHOENIX'
  | 'RAYDIUM_AMM'
  | 'LIFINITY'
  | 'SABER'
  | 'SANCTUM'
  | 'RAYDIUM_CLMM';

/**
 * Résout les comptes pour n'importe quel DEX supporté
 */
export async function getDEXAccounts(
  connection: Connection,
  venue: SupportedVenue,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string
): Promise<DEXAccounts | null> {
  // Normalisation effectuée dans chaque resolver individuel
  switch (venue) {
    case 'ORCA_WHIRLPOOL':
      return getOrcaWhirlpoolAccounts(connection, inputMint, outputMint, userPublicKey);
    case 'METEORA_DLMM':
      return getMeteoraAccounts(connection, inputMint, outputMint, userPublicKey);
    case 'PHOENIX':
      return getPhoenixAccounts(connection, inputMint, outputMint, userPublicKey);
    case 'RAYDIUM_AMM':
      return getRaydiumAccounts(connection, inputMint, outputMint, userPublicKey);
    case 'LIFINITY':
      return getLifinityAccounts(connection, inputMint, outputMint, userPublicKey);
    case 'SABER':
      return getSaberAccounts(connection, inputMint, outputMint, userPublicKey);
    case 'SANCTUM':
      console.warn('[DEXResolver] SANCTUM resolver not implemented yet');
      return null;
    case 'RAYDIUM_CLMM':
      console.warn('[DEXResolver] RAYDIUM_CLMM resolver not implemented yet');
      return null;
    default:
      console.warn(`[DEXResolver] Unknown venue: ${venue}`);
      return null;
  }
}

/**
 * Résout les comptes pour toutes les venues en parallèle
 */
export async function getAllDEXAccounts(
  connection: Connection,
  inputMint: PublicKey | string,
  outputMint: PublicKey | string,
  userPublicKey: PublicKey | string,
  venuesOverride?: SupportedVenue[]
): Promise<Map<SupportedVenue, DEXAccounts>> {
  // Normaliser les inputs une fois pour toutes
  const safeInputMint = toPublicKey(inputMint);
  const safeOutputMint = toPublicKey(outputMint);
  const safeUser = toPublicKey(userPublicKey);
  const venues: SupportedVenue[] = (venuesOverride?.length
    ? venuesOverride
    : ['ORCA_WHIRLPOOL', 'METEORA_DLMM', 'PHOENIX', 'RAYDIUM_AMM', 'LIFINITY', 'SABER']
  ).filter((v, i, arr) => arr.indexOf(v) === i);
  
  const { positiveTtlMs, negativeTtlMs } = getDexAccountsCacheTtls();
  const now = Date.now();
  const inputStr = safeInputMint.toBase58();
  const outputStr = safeOutputMint.toBase58();
  const userStr = safeUser.toBase58();
  const accountsMap = new Map<SupportedVenue, DEXAccounts>();

  const venuesToFetch: SupportedVenue[] = [];

  for (const venue of venues) {
    const cacheKey = `${venue}::${inputStr}=>${outputStr}::${userStr}`;
    const cached = dexAccountsByVenueCache.get(cacheKey);
    if (cached) {
      const ttlMs =
        typeof cached.ttlOverrideMs === "number"
          ? cached.ttlOverrideMs
          : cached.value
            ? positiveTtlMs
            : negativeTtlMs;
      if (ttlMs > 0 && now - cached.timestamp < ttlMs) {
        if (cached.value) {
          accountsMap.set(venue, cached.value);
        }
        continue;
      }
    }
    venuesToFetch.push(venue);
  }

  if (venuesToFetch.length > 0) {
    const start = Date.now();
    const timeoutNegativeTtlMs = getTimeoutNegativeTtlMs();
    const results = await Promise.allSettled(
      venuesToFetch.map((venue) =>
        withTimeout(
          getDEXAccounts(connection, venue, safeInputMint, safeOutputMint, safeUser),
          getResolveTimeoutMsForVenue(venue),
          `dex-resolve:${venue}`
        )
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const venue = venuesToFetch[i];
      const cacheKey = `${venue}::${inputStr}=>${outputStr}::${userStr}`;

      if (result.status === "fulfilled") {
        const value = result.value ?? null;
        if (value) accountsMap.set(venue, value);
        dexAccountsByVenueCache.set(cacheKey, { timestamp: now, value });
      } else {
        const reasonMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.warn("DEXAccountResolvers", `Failed to resolve ${venue}`, {
          error: reasonMsg,
        });

        // Timeout: on cache négatif *très* court pour éviter de bloquer à répétition
        // tout en permettant une nouvelle tentative rapide.
        const isTimeout = typeof reasonMsg === "string" && reasonMsg.startsWith("Timeout after");
        dexAccountsByVenueCache.set(cacheKey, {
          timestamp: now,
          value: null,
          ttlOverrideMs: isTimeout ? timeoutNegativeTtlMs : undefined,
        });
      }
    }

    pruneDexAccountsCache();

    const elapsedMs = Date.now() - start;
    logger.debug("DEXAccountResolvers", "Resolved DEX accounts", {
      inputMint: inputStr.slice(0, 8),
      outputMint: outputStr.slice(0, 8),
      venuesRequested: venues.length,
      venuesFetched: venuesToFetch.length,
      venuesCached: venues.length - venuesToFetch.length,
      resolved: accountsMap.size,
      elapsedMs,
    });
  }

  return accountsMap;
}

export default {
  getOrcaWhirlpoolAccounts,
  getMeteoraAccounts,
  getPhoenixAccounts,
  getRaydiumAccounts,
  getLifinityAccounts,
  getSaberAccounts,
  getDEXAccounts,
  getAllDEXAccounts,
};
