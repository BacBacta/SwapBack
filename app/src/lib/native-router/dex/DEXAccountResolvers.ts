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
import { createRequire } from "module";
import { SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { Buffer } from "buffer";
import { logger } from "@/lib/logger";
import { DEX_PROGRAMS } from "../headless/router";
import { toPublicKey } from "../utils/publicKeyUtils";
import type { RaydiumPoolConfig } from "@/sdk/config/raydium-pools";
import { getPhoenixMarketConfig, PHOENIX_PROGRAM_ID as PHOENIX_PROGRAM } from "@/sdk/config/phoenix-markets";

if (typeof globalThis !== "undefined" && typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}
import { getRaydiumPool } from "@/sdk/config/raydium-pools";

const RESOLVER_CACHE_TTL_MS = 60_000; // short-lived cache to absorb bursty API errors
const MAX_FETCH_ATTEMPTS = 2;

const meteoraPairCache = new Map<string, { timestamp: number; pair: PublicKey | null }>();
const raydiumPoolCache = new Map<string, { timestamp: number; pool: RaydiumPoolConfig | null }>();
const serumMarketMetaCache = new Map<string, { timestamp: number; meta: SerumMarketMeta }>();
const saberPoolTokenAccountsCache = new Map<
  string,
  { timestamp: number; tokenAccounts: Array<{ address: PublicKey; mint: PublicKey; amount: bigint }> }
>();

const SERUM_MARKET_CACHE_TTL_MS = 5 * 60 * 1000;

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
      logger.warn("LifinityResolver", "No Lifinity pool found for pair", {
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
      });
      return null;
    }

    const amm = new PublicKey(pool.amm);
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

    const pool = findSaberPool(safeInputMint, safeOutputMint);
    if (!pool) {
      logger.warn("SaberResolver", "No Saber pool config found", {
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
      });
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
  const accountInfo = await connection.getAccountInfo(whirlpoolPda);
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
      const altInfo = await connection.getAccountInfo(altPda);
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
    const accountInfo = await connection.getAccountInfo(whirlpool);
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

const requireCjs = createRequire(import.meta.url);

async function loadMeteoraDLMMClass(): Promise<any> {
  // @meteora-ag/dlmm exports: default = DLMM class
  // We support both ESM import() and CJS require() to avoid tsx/source resolution pitfalls.
  try {
    const mod: any = await import("@meteora-ag/dlmm");
    const DLMM = mod?.DLMM ?? mod?.default ?? mod;
    if (DLMM?.create) return DLMM;
  } catch {
    // ignore
  }

  const req: any = requireCjs("@meteora-ag/dlmm");
  const DLMM = req?.DLMM ?? req?.default ?? req;
  return DLMM;
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

    if (cached && now - cached.timestamp < RESOLVER_CACHE_TTL_MS) {
      if (!cached.pair) {
        logger.debug("MeteoraResolver", "Serving cached miss", { cacheKey });
      }
      return cached.pair;
    }

    let lastError: string | undefined;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(
          `https://dlmm-api.meteora.ag/pair/all_by_groups?include_pool_token=true`,
          { signal: AbortSignal.timeout(5000) }
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

        for (const group of pairs.groups || []) {
          for (const pair of group.pairs || []) {
            if (
              (pair.mint_x === tokenXStr && pair.mint_y === tokenYStr) ||
              (pair.mint_x === tokenYStr && pair.mint_y === tokenXStr)
            ) {
              const resolved = new PublicKey(pair.address);
              meteoraPairCache.set(cacheKey, { timestamp: now, pair: resolved });
              return resolved;
            }
          }
        }

        logger.warn("MeteoraResolver", "No DLMM pair returned by API", {
          inputMint: tokenXStr,
          outputMint: tokenYStr,
        });
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
        logger.warn("MeteoraResolver", "Resolved DLMM pair via on-chain SDK fallback", {
          inputMint: tokenXStr,
          outputMint: tokenYStr,
          pair: resolved.toBase58(),
          lastError,
        });
        meteoraPairCache.set(cacheKey, { timestamp: now, pair: resolved });
        return resolved;
      }
    } catch (error) {
      logger.warn("MeteoraResolver", "On-chain DLMM pair lookup failed", {
        inputMint: tokenXStr,
        outputMint: tokenYStr,
        error: error instanceof Error ? error.message : String(error),
        lastError,
      });
    }

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
      logger.warn("MeteoraResolver", "No DLMM pair found for mints", {
        inputMint: safeInputMint.toBase58(),
        outputMint: safeOutputMint.toBase58(),
      });
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
      tokenXMint = dlmm.tokenX.publicKey;
      tokenYMint = dlmm.tokenY.publicKey;
      tokenXProgram = dlmm.tokenX.owner;
      tokenYProgram = dlmm.tokenY.owner;

      swapForY = safeInputMint.equals(tokenXMint);
      if (!swapForY && !safeInputMint.equals(tokenYMint)) {
        console.warn("[MeteoraResolver] Input mint does not match DLMM token X/Y", {
          inputMint: safeInputMint.toBase58(),
          tokenXMint: tokenXMint.toBase58(),
          tokenYMint: tokenYMint.toBase58(),
        });
        return null;
      }

      const binArrayAccounts: Array<{ publicKey: PublicKey }> = await dlmm.getBinArrayForSwap(
        swapForY,
        5
      );
      binArrays = binArrayAccounts.map((a) => a.publicKey);
      if (binArrays.length === 0) {
        console.warn("[MeteoraResolver] DLMM.getBinArrayForSwap returned empty set", {
          lbPair: lbPair.toBase58(),
          swapForY,
        });
        return null;
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

      swapForY = safeInputMint.equals(tokenXMint);
      if (!swapForY && !safeInputMint.equals(tokenYMint)) {
        console.warn("[MeteoraResolver] Input mint does not match DLMM token X/Y (fallback)", {
          inputMint: safeInputMint.toBase58(),
          tokenXMint: tokenXMint.toBase58(),
          tokenYMint: tokenYMint.toBase58(),
        });
        return null;
      }

      logger.warn("MeteoraResolver", "DLMM SDK unavailable; using fallback bin_array scan", {
        error: sdkError instanceof Error ? sdkError.message : String(sdkError),
      });

      // Scanner un petit voisinage autour de 0 (safe) pour trouver des bin arrays initialisés.
      // Ce fallback est moins fiable que le SDK mais évite de passer des PDAs non initialisées.
      const desiredBinArrays = 5;
      const scanRadius = 500;
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
      binArrays = binArraysFound;
    }

    // Sanity: direction du swap
    if (!swapForY && !safeInputMint.equals(tokenYMint)) {
      console.warn("[MeteoraResolver] Input mint does not match DLMM token X/Y", {
        inputMint: safeInputMint.toBase58(),
        tokenXMint: tokenXMint.toBase58(),
        tokenYMint: tokenYMint.toBase58(),
      });
      return null;
    }

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
    
    // Bin array bitmap extension (doit exister si fourni)
    const [binArrayBitmapExtension] = PublicKey.findProgramAddressSync(
      [Buffer.from("bitmap"), lbPair.toBuffer()],
      METEORA_DLMM_PROGRAM
    );
    const bitmapInfo = await connection.getAccountInfo(binArrayBitmapExtension);
    if (!bitmapInfo) {
      console.warn("[MeteoraResolver] bin_array_bitmap_extension account missing", {
        lbPair: lbPair.toBase58(),
        binArrayBitmapExtension: binArrayBitmapExtension.toBase58(),
      });
      return null;
    }
    
    // Event authority
    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      METEORA_DLMM_PROGRAM
    );
    
    return {
      accounts: [
        lbPair,                        // 0. lb_pair
        binArrayBitmapExtension,       // 1. bin_array_bitmap_extension
        reserveX,                      // 2. reserve_x (vault)
        reserveY,                      // 3. reserve_y (vault)
        userTokenX,                    // 4. user_token_x
        userTokenY,                    // 5. user_token_y
        tokenXMint,                    // 6. token_x_mint
        tokenYMint,                    // 7. token_y_mint
        oracle,                        // 8. oracle
        safeInputMint.equals(tokenXMint) ? userTokenX : userTokenY, // 9. host_fee_in (optional) - use a real SPL token account
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

/**
 * Trouve le pool Raydium AMM pour une paire
 */
async function findRaydiumPool(
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
    const poolConfig = await findRaydiumPool(safeInputMint, safeOutputMint);

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
  userPublicKey: PublicKey | string
): Promise<Map<SupportedVenue, DEXAccounts>> {
  // Normaliser les inputs une fois pour toutes
  const safeInputMint = toPublicKey(inputMint);
  const safeOutputMint = toPublicKey(outputMint);
  const safeUser = toPublicKey(userPublicKey);
  const venues: SupportedVenue[] = [
    'ORCA_WHIRLPOOL',
    'METEORA_DLMM',
    'PHOENIX',
    'RAYDIUM_AMM',
    'LIFINITY',
    'SABER',
  ];
  
  const results = await Promise.allSettled(
    venues.map(venue => getDEXAccounts(connection, venue, safeInputMint, safeOutputMint, safeUser))
  );
  
  const accountsMap = new Map<SupportedVenue, DEXAccounts>();
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      accountsMap.set(venues[i], result.value);
    }
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
