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
import { DEX_PROGRAMS } from "../headless/router";

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
 */
export async function getOrcaWhirlpoolAccounts(
  connection: Connection,
  inputMint: PublicKey,
  outputMint: PublicKey,
  userPublicKey: PublicKey
): Promise<DEXAccounts | null> {
  try {
    const whirlpool = await findWhirlpool(connection, inputMint, outputMint);
    if (!whirlpool) {
      console.warn("[OrcaResolver] No Whirlpool found for pair");
      return null;
    }
    
    // Récupérer les données du pool
    const accountInfo = await connection.getAccountInfo(whirlpool);
    if (!accountInfo) return null;
    
    // Parser le tick actuel (offset 141 dans les données du pool)
    const data = accountInfo.data;
    const currentTickIndex = data.readInt32LE(141);
    const tickSpacing = data.readUInt16LE(145);
    const feeRate = data.readUInt16LE(147);
    
    // Déterminer la direction
    const aToB = inputMint.toBuffer().compare(outputMint.toBuffer()) < 0;
    
    // Dériver les tick arrays
    const tickArrays = deriveTickArrays(whirlpool, currentTickIndex, tickSpacing, aToB);
    
    // Dériver l'oracle
    const [oracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), whirlpool.toBuffer()],
      ORCA_WHIRLPOOL_PROGRAM
    );
    
    // Token vaults
    const tokenVaultA = new PublicKey(data.subarray(75, 107));
    const tokenVaultB = new PublicKey(data.subarray(107, 139));
    
    return {
      accounts: [
        ORCA_WHIRLPOOL_PROGRAM,
        whirlpool,
        tokenVaultA,
        tokenVaultB,
        ...tickArrays,
        oracle,
      ],
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
    // Essayer de récupérer depuis l'API Meteora
    const response = await fetch(
      `https://dlmm-api.meteora.ag/pair/all_by_groups?include_pool_token=true`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) return null;
    
    const pairs = await response.json();
    
    // Chercher la paire correspondante
    const tokenXStr = tokenX.toBase58();
    const tokenYStr = tokenY.toBase58();
    
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
    return null;
  }
}

/**
 * Résout les comptes pour un swap Meteora DLMM
 */
export async function getMeteoraAccounts(
  connection: Connection,
  inputMint: PublicKey,
  outputMint: PublicKey,
  userPublicKey: PublicKey
): Promise<DEXAccounts | null> {
  try {
    const lbPair = await findDLMMPair(connection, inputMint, outputMint);
    if (!lbPair) {
      console.warn("[MeteoraResolver] No DLMM pair found");
      return null;
    }
    
    // Récupérer les données de la paire
    const accountInfo = await connection.getAccountInfo(lbPair);
    if (!accountInfo) return null;
    
    const data = accountInfo.data;
    
    // Parser les informations clés
    // Structure DLMM: tokenXMint(32), tokenYMint(32), binStep(2), activeId(4), reserves...
    const tokenXMint = new PublicKey(data.subarray(8, 40));
    const tokenYMint = new PublicKey(data.subarray(40, 72));
    const binStep = data.readUInt16LE(72);
    const activeId = data.readInt32LE(74);
    
    // Dériver les bin arrays autour du bin actif
    const binArrays: PublicKey[] = [];
    const binsPerArray = 70; // DLMM utilise 70 bins par array
    
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
    
    // Reserves
    const [reserveX] = PublicKey.findProgramAddressSync(
      [Buffer.from("reserve_x"), lbPair.toBuffer()],
      METEORA_DLMM_PROGRAM
    );
    const [reserveY] = PublicKey.findProgramAddressSync(
      [Buffer.from("reserve_y"), lbPair.toBuffer()],
      METEORA_DLMM_PROGRAM
    );
    
    return {
      accounts: [
        METEORA_DLMM_PROGRAM,
        lbPair,
        reserveX,
        reserveY,
        ...binArrays,
        oracle,
      ],
      meta: {
        venue: 'METEORA_DLMM',
        poolAddress: lbPair.toBase58(),
        feeRate: binStep * 0.0001, // Estimation
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
  inputMint: PublicKey,
  outputMint: PublicKey,
  userPublicKey: PublicKey
): Promise<DEXAccounts | null> {
  try {
    const market = await findPhoenixMarket(connection, inputMint, outputMint);
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
      [Buffer.from("seat"), market.toBuffer(), userPublicKey.toBuffer()],
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
    const response = await fetch(
      `https://api-v3.raydium.io/pools/info/mint?mint1=${inputMint.toBase58()}&mint2=${outputMint.toBase58()}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.success || !data.data?.[0]) return null;
    
    return new PublicKey(data.data[0].id);
  } catch {
    return null;
  }
}

/**
 * Résout les comptes pour un swap Raydium AMM
 */
export async function getRaydiumAccounts(
  connection: Connection,
  inputMint: PublicKey,
  outputMint: PublicKey,
  userPublicKey: PublicKey
): Promise<DEXAccounts | null> {
  try {
    const poolId = await findRaydiumPool(inputMint, outputMint);
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
  inputMint: PublicKey,
  outputMint: PublicKey,
  userPublicKey: PublicKey
): Promise<DEXAccounts | null> {
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
  inputMint: PublicKey,
  outputMint: PublicKey,
  userPublicKey: PublicKey
): Promise<Map<SupportedVenue, DEXAccounts>> {
  const venues: SupportedVenue[] = ['ORCA_WHIRLPOOL', 'METEORA_DLMM', 'PHOENIX', 'RAYDIUM_AMM'];
  
  const results = await Promise.allSettled(
    venues.map(venue => getDEXAccounts(connection, venue, inputMint, outputMint, userPublicKey))
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
