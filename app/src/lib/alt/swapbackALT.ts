/**
 * Gestion des Address Lookup Tables pour SwapBack
 * Réduit la taille des transactions de ~1500 à ~400 bytes
 */

import {
  Connection,
  PublicKey,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import { ALTCache, ALTStats } from './types';

// Cache de l'ALT SwapBack
let cachedSwapbackALT: ALTCache | null = null;

// Cache pour les ALT Jupiter
const jupiterALTCache = new Map<string, ALTCache>();

// TTL du cache (1 minute)
const ALT_CACHE_TTL = 60_000;

/**
 * Récupère l'Address Lookup Table SwapBack
 */
export async function getSwapbackALT(
  connection: Connection
): Promise<{ address: PublicKey; account: AddressLookupTableAccount } | null> {
  // Vérifier le cache
  if (cachedSwapbackALT && Date.now() - cachedSwapbackALT.lastFetch < ALT_CACHE_TTL) {
    return { address: cachedSwapbackALT.address, account: cachedSwapbackALT.account };
  }

  // Récupérer l'adresse depuis les variables d'environnement
  const altAddressStr = process.env.NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS;
  
  if (!altAddressStr) {
    console.warn('[ALT] NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS not set');
    return null;
  }

  try {
    const altAddress = new PublicKey(altAddressStr);
    const altAccount = await connection.getAddressLookupTable(altAddress);
    
    if (altAccount.value) {
      cachedSwapbackALT = {
        address: altAddress,
        account: altAccount.value,
        lastFetch: Date.now(),
      };
      
      console.log(`[ALT] Loaded SwapBack ALT with ${altAccount.value.state.addresses.length} addresses`);
      return { address: altAddress, account: altAccount.value };
    }
    
    console.warn('[ALT] SwapBack ALT account not found on-chain');
    return null;
  } catch (error) {
    console.error('[ALT] Failed to fetch SwapBack ALT:', error);
    return null;
  }
}

/**
 * Récupère une ALT Jupiter depuis le cache ou le réseau
 */
export async function getJupiterALT(
  connection: Connection,
  altAddress: string
): Promise<AddressLookupTableAccount | null> {
  // Vérifier le cache
  const cached = jupiterALTCache.get(altAddress);
  if (cached && Date.now() - cached.lastFetch < ALT_CACHE_TTL) {
    return cached.account;
  }

  try {
    const altPubkey = new PublicKey(altAddress);
    const altAccount = await connection.getAddressLookupTable(altPubkey);
    
    if (altAccount.value) {
      jupiterALTCache.set(altAddress, {
        address: altPubkey,
        account: altAccount.value,
        lastFetch: Date.now(),
      });
      return altAccount.value;
    }
    
    return null;
  } catch (error) {
    console.warn(`[ALT] Failed to fetch Jupiter ALT ${altAddress}:`, error);
    return null;
  }
}

/**
 * Récupère toutes les ALT Jupiter utilisées par une transaction
 */
export async function getJupiterALTs(
  connection: Connection,
  lookups: Array<{ 
    accountKey: string; 
    writableIndexes: number[]; 
    readonlyIndexes: number[]; 
  }>
): Promise<AddressLookupTableAccount[]> {
  const alts: AddressLookupTableAccount[] = [];

  // Récupérer en parallèle pour de meilleures performances
  const promises = lookups.map(async (lookup) => {
    const alt = await getJupiterALT(connection, lookup.accountKey);
    return alt;
  });

  const results = await Promise.all(promises);
  
  for (const alt of results) {
    if (alt) {
      alts.push(alt);
    }
  }

  console.log(`[ALT] Loaded ${alts.length}/${lookups.length} Jupiter ALTs`);
  return alts;
}

/**
 * Combine l'ALT SwapBack avec les ALT Jupiter
 */
export async function getAllALTs(
  connection: Connection,
  jupiterLookups?: Array<{ 
    accountKey: string; 
    writableIndexes: number[]; 
    readonlyIndexes: number[]; 
  }>
): Promise<AddressLookupTableAccount[]> {
  const allALTs: AddressLookupTableAccount[] = [];

  // ALT SwapBack
  const swapbackALT = await getSwapbackALT(connection);
  if (swapbackALT) {
    allALTs.push(swapbackALT.account);
  }

  // ALT Jupiter
  if (jupiterLookups && jupiterLookups.length > 0) {
    const jupiterALTs = await getJupiterALTs(connection, jupiterLookups);
    allALTs.push(...jupiterALTs);
  }

  return allALTs;
}

/**
 * Récupère les statistiques d'une ALT
 */
export async function getALTStats(
  connection: Connection,
  altAddress: PublicKey
): Promise<ALTStats> {
  const altAccount = await connection.getAddressLookupTable(altAddress);
  
  if (!altAccount.value) {
    throw new Error(`ALT not found: ${altAddress.toBase58()}`);
  }

  return {
    address: altAddress.toBase58(),
    addressCount: altAccount.value.state.addresses.length,
    addresses: altAccount.value.state.addresses.map(a => a.toBase58()),
    authority: altAccount.value.state.authority?.toBase58() || null,
  };
}

/**
 * Invalide le cache (utile après ajout d'adresses à l'ALT)
 */
export function invalidateALTCache(): void {
  cachedSwapbackALT = null;
  jupiterALTCache.clear();
  console.log('[ALT] Cache invalidated');
}

/**
 * Estime la taille de transaction économisée grâce aux ALT
 */
export function estimateTransactionSizeSavings(
  numAccountsInALT: number
): { before: number; after: number; saved: number } {
  // Chaque compte = 32 bytes sans ALT, ~1 byte avec ALT
  const before = numAccountsInALT * 32;
  const after = 32 + numAccountsInALT; // 32 bytes pour l'adresse ALT + 1 byte par index
  const saved = before - after;

  return { before, after, saved };
}
