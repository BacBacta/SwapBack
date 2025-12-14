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
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { logger } from "@/lib/logger";
import { DEX_PROGRAMS } from "../headless/router";
import { toPublicKey } from "../utils/publicKeyUtils";

const RESOLVER_CACHE_TTL_MS = 60_000; // short-lived cache to absorb bursty API errors
const MAX_FETCH_ATTEMPTS = 2;

const meteoraPairCache = new Map<string, { timestamp: number; pair: PublicKey | null }>();
const raydiumPoolCache = new Map<string, { timestamp: number; pool: PublicKey | null }>();

const getPairCacheKey = (mintA: string, mintB: string) =>
  mintA < mintB ? `${mintA}:${mintB}` : `${mintB}:${mintA}`;

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
 * 
 * Total: 11 comptes (ORCA_SWAP_ACCOUNT_COUNT)
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
        meteoraPairCache.set(cacheKey, { timestamp: now, pair: null });
        return null;
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
    
    // Utiliser l'API pour obtenir la paire avec les vraies reserves
    const tokenXStr = safeInputMint.toBase58();
    const tokenYStr = safeOutputMint.toBase58();
    
    let pairData: { address: string; reserve_x: string; reserve_y: string; bin_step: number; mint_x: string; mint_y: string } | null = null;
    
    try {
      const response = await fetch(
        `https://dlmm-api.meteora.ag/pair/all_by_groups?include_pool_token=true`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (response.ok) {
        const pairs = await response.json();
        for (const group of pairs.groups || []) {
          for (const pair of group.pairs || []) {
            if (
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
      console.warn("[MeteoraResolver] API fetch failed, falling back to on-chain");
    }
    
    if (!pairData) {
      console.warn("[MeteoraResolver] No DLMM pair found");
      return null;
    }
    
    const lbPair = new PublicKey(pairData.address);
    const reserveX = new PublicKey(pairData.reserve_x);
    const reserveY = new PublicKey(pairData.reserve_y);
    const tokenXMint = new PublicKey(pairData.mint_x);
    const tokenYMint = new PublicKey(pairData.mint_y);
    
    // Récupérer les données de la paire pour le bin actif
    const accountInfo = await connection.getAccountInfo(lbPair);
    if (!accountInfo) return null;
    
    const data = accountInfo.data;
    const binStep = data.readUInt16LE(72);
    const activeId = data.readInt32LE(74);
    
    // Dériver les bin arrays autour du bin actif
    const binArrays: PublicKey[] = [];
    const binsPerArray = 70;
    
    const currentArrayIndex = Math.floor(activeId / binsPerArray);
    for (let i = -1; i <= 1; i++) {
      const arrayIndex = currentArrayIndex + i;
      const [binArrayPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("bin_array"),
          lbPair.toBuffer(),
          Buffer.from(arrayIndex.toString()),
        ],
        METEORA_DLMM_PROGRAM
      );
      binArrays.push(binArrayPda);
    }
    
    // Dériver l'oracle DLMM
    const [oracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), lbPair.toBuffer()],
      METEORA_DLMM_PROGRAM
    );
    
    // Calculer les ATAs de l'utilisateur
    const { getAssociatedTokenAddress } = await import("@solana/spl-token");
    const userTokenX = await getAssociatedTokenAddress(tokenXMint, safeUser);
    const userTokenY = await getAssociatedTokenAddress(tokenYMint, safeUser);
    
    // Bin array bitmap extension
    const [binArrayBitmapExtension] = PublicKey.findProgramAddressSync(
      [Buffer.from("bitmap"), lbPair.toBuffer()],
      METEORA_DLMM_PROGRAM
    );
    
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
        PublicKey.default,             // 9. host_fee_in (optional)
        safeUser,                      // 10. user (signer)
        TOKEN_PROGRAM_ID,              // 11. token_x_program
        TOKEN_PROGRAM_ID,              // 12. token_y_program
        eventAuthority,                // 13. event_authority
        METEORA_DLMM_PROGRAM,          // 14. program
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

const PHOENIX_PROGRAM = new PublicKey("PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY");

/**
 * Trouve le marché Phoenix pour une paire
 */
async function findPhoenixMarket(
  connection: Connection,
  baseMint: PublicKey,
  quoteMint: PublicKey
): Promise<PublicKey | null> {
  try {
    // Phoenix utilise un registre de marchés
    // Pour l'instant, on utilise les marchés connus
    const knownMarkets: Record<string, string> = {
      // SOL/USDC
      "So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 
        "4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg",
    };
    
    const key = `${baseMint.toBase58()}:${quoteMint.toBase58()}`;
    const reverseKey = `${quoteMint.toBase58()}:${baseMint.toBase58()}`;
    
    const marketAddress = knownMarkets[key] || knownMarkets[reverseKey];
    if (marketAddress) {
      return new PublicKey(marketAddress);
    }
    
    return null;
  } catch {
    return null;
  }
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
    const market = await findPhoenixMarket(connection, safeInputMint, safeOutputMint);
    if (!market) {
      console.warn("[PhoenixResolver] No Phoenix market found");
      return null;
    }
    
    // Récupérer les données du marché
    const accountInfo = await connection.getAccountInfo(market);
    if (!accountInfo) return null;
    
    const data = accountInfo.data;
    
    // Dériver le seat (trader state)
    const [seat] = PublicKey.findProgramAddressSync(
      [Buffer.from("seat"), market.toBuffer(), safeUser.toBuffer()],
      PHOENIX_PROGRAM
    );
    
    // Log seat
    const [logAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("log")],
      PHOENIX_PROGRAM
    );
    
    // Vaults
    const baseVault = new PublicKey(data.subarray(72, 104));
    const quoteVault = new PublicKey(data.subarray(104, 136));
    
    return {
      accounts: [
        PHOENIX_PROGRAM,
        market,
        seat,
        logAuthority,
        baseVault,
        quoteVault,
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
): Promise<PublicKey | null> {
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

    let lastError: string | undefined;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(
          `https://api-v3.raydium.io/pools/info/mint?mint1=${inputMintStr}&mint2=${outputMintStr}`,
          { signal: AbortSignal.timeout(5000) }
        );
        
        if (!response.ok) {
          lastError = `status_${response.status}`;
          logger.warn("RaydiumResolver", "Raydium pool API error", {
            status: response.status,
            attempt,
            inputMint: inputMintStr,
            outputMint: outputMintStr,
          });
          continue;
        }
        
        const data = await response.json();
        if (!data.success || !data.data?.[0]) {
          logger.warn("RaydiumResolver", "Pool API returned empty response", {
            inputMint: inputMintStr,
            outputMint: outputMintStr,
          });
          raydiumPoolCache.set(cacheKey, { timestamp: now, pool: null });
          break;
        }
        
        const resolved = new PublicKey(data.data[0].id);
        raydiumPoolCache.set(cacheKey, { timestamp: now, pool: resolved });
        return resolved;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logger.error("RaydiumResolver", "Failed to fetch Raydium pool", {
          attempt,
          inputMint: inputMintStr,
          outputMint: outputMintStr,
          error: lastError,
        });
      }
    }

    if (cached?.pool) {
      logger.warn("RaydiumResolver", "Using stale cached pool after repeated failures", {
        cacheKey,
        ageMs: now - cached.timestamp,
        lastError,
      });
      raydiumPoolCache.set(cacheKey, { timestamp: now, pool: cached.pool });
      return cached.pool;
    }

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
    const poolId = await findRaydiumPool(safeInputMint, safeOutputMint);
    if (!poolId) {
      console.warn("[RaydiumResolver] No Raydium pool found");
      return null;
    }
    
    // Récupérer les données du pool
    const accountInfo = await connection.getAccountInfo(poolId);
    if (!accountInfo) return null;
    
    const data = accountInfo.data;
    
    // Parser les comptes du pool AMM
    // Structure: status(8), nonce(8), maxOrder(8), depth(8), etc.
    // Puis les pubkeys: coinVault, pcVault, coinMint, pcMint, lpMint, openOrders, market, etc.
    const offset = 32; // Skip discriminator et flags
    
    return {
      accounts: [
        RAYDIUM_AMM_PROGRAM,
        poolId,
        // Les autres comptes seront dérivés par le programme
      ],
      meta: {
        venue: 'RAYDIUM_AMM',
        poolAddress: poolId.toBase58(),
        feeRate: 0.0025, // Raydium AMM = 0.25%
      },
    };
  } catch (error) {
    console.error("[RaydiumResolver] Error:", error);
    return null;
  }
}

// ============================================================================
// UNIFIED RESOLVER
// ============================================================================

export type SupportedVenue = 'ORCA_WHIRLPOOL' | 'METEORA_DLMM' | 'PHOENIX' | 'RAYDIUM_AMM';

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
  const venues: SupportedVenue[] = ['ORCA_WHIRLPOOL', 'METEORA_DLMM', 'PHOENIX', 'RAYDIUM_AMM'];
  
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
  getDEXAccounts,
  getAllDEXAccounts,
};
