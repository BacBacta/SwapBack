/**
 * Pyth Oracle Integration for SwapBack
 * Fetches real-time $BACK/USD price feed
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { HermesClient } from '@pythnetwork/hermes-client';

// Pyth Price Service (Hermes) - Mainnet & Devnet
const PYTH_PRICE_SERVICE_MAINNET = 'https://hermes.pyth.network';
const PYTH_PRICE_SERVICE_DEVNET = 'https://hermes-beta.pyth.network';

// Feed IDs
// NOTE: À remplacer par le vrai feed ID une fois $BACK listé sur Pyth
// Pour le moment, utiliser SOL/USD comme référence ou prix manuel
export const BACK_USD_FEED_ID = process.env.NEXT_PUBLIC_BACK_USD_FEED_ID || 
  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'; // SOL/USD (fallback)

// Prix manuel de fallback (pour dev/tests)
const MANUAL_BACK_PRICE = parseFloat(process.env.NEXT_PUBLIC_BACK_MANUAL_PRICE || '0.001'); // $0.001

/**
 * Récupère le prix $BACK/USD depuis Pyth Oracle
 * Fallback sur prix manuel si feed non disponible
 */
export async function fetchBackPrice(network: 'mainnet' | 'devnet' = 'devnet'): Promise<number> {
  try {
    const priceServiceUrl = network === 'mainnet' 
      ? PYTH_PRICE_SERVICE_MAINNET 
      : PYTH_PRICE_SERVICE_DEVNET;
    
    const hermesClient = new HermesClient(priceServiceUrl);

    // Fetch latest price feeds
    const priceFeeds = await hermesClient.getLatestPriceUpdates([BACK_USD_FEED_ID]);
    
    if (!priceFeeds || !priceFeeds.parsed || priceFeeds.parsed.length === 0) {
      console.warn('No price feed found for $BACK, using manual price:', MANUAL_BACK_PRICE);
      return MANUAL_BACK_PRICE;
    }

    const backFeed = priceFeeds.parsed[0];
    const price = backFeed.price;

    if (!price) {
      console.warn('Price data not available, using manual price:', MANUAL_BACK_PRICE);
      return MANUAL_BACK_PRICE;
    }

    // Convert to USD with exponent
    const priceUsd = Number(price.price) * Math.pow(10, price.expo);
    
    console.log('Pyth price for $BACK/USD:', {
      price: price.price,
      expo: price.expo,
      priceUsd,
      confidence: price.conf,
      publishTime: new Date(Number(price.publish_time) * 1000).toISOString(),
    });

    return priceUsd;
  } catch (error) {
    console.error('Error fetching Pyth price:', error);
    console.warn('Falling back to manual price:', MANUAL_BACK_PRICE);
    return MANUAL_BACK_PRICE;
  }
}

/**
 * Obtient le Price Update Account pour transactions on-chain
 * Ce compte est nécessaire pour que le programme puisse lire le prix
 */
export async function getPriceUpdateAccount(
  connection: Connection,
  network: 'mainnet' | 'devnet' = 'devnet'
): Promise<PublicKey> {
  try {
    const priceServiceUrl = network === 'mainnet' 
      ? PYTH_PRICE_SERVICE_MAINNET 
      : PYTH_PRICE_SERVICE_DEVNET;
    
    const hermesClient = new HermesClient(priceServiceUrl);

    // Get latest price updates (VAAs)
    const priceUpdates = await hermesClient.getLatestPriceUpdates([BACK_USD_FEED_ID]);
    
    if (!priceUpdates || !priceUpdates.binary) {
      throw new Error('No price update data found');
    }

    // Pour Pyth Solana Receiver, le price update account est dérivé du VAA
    // Documentation: https://docs.pyth.network/price-feeds/use-real-time-data/solana
    
    // NOTE: Pour l'implémentation complète, utiliser:
    // import { getPythProgramKeyForCluster } from '@pythnetwork/pyth-solana-receiver';
    // const pythProgram = getPythProgramKeyForCluster(network);
    
    // Pour le moment, retourner un compte mock pour dev
    // TODO: Implémenter la création du price update account
    const mockPriceUpdateAccount = new PublicKey('PyTHMockAccountxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    
    console.warn('Using mock price update account - implement real Pyth account creation');
    return mockPriceUpdateAccount;
  } catch (error) {
    console.error('Error getting price update account:', error);
    throw error;
  }
}

/**
 * Calcule le montant minimum de $BACK attendu avec slippage protection
 * @param usdcAmount - Montant en USDC (UI units, ex: 100 = 100 USDC)
 * @param slippageBps - Slippage en basis points (ex: 100 = 1%)
 * @returns Montant minimum de $BACK en lamports (9 decimals)
 */
export async function calculateMinBackAmount(
  usdcAmount: number,
  slippageBps: number = 100, // 1% par défaut
  network: 'mainnet' | 'devnet' = 'devnet'
): Promise<bigint> {
  const backPrice = await fetchBackPrice(network);
  
  // Calculer combien de $BACK peut être acheté
  // back_amount = usdc_amount / back_price
  const expectedBackUi = usdcAmount / backPrice;
  
  // Appliquer slippage protection
  const slippageMultiplier = 1 - (slippageBps / 10_000);
  const minBackUi = expectedBackUi * slippageMultiplier;
  
  // Convertir en lamports (9 decimals)
  const minBackLamports = BigInt(Math.floor(minBackUi * 1e9));
  
  console.log('Swap calculation:', {
    usdcAmount,
    backPrice,
    expectedBackUi,
    slippageBps,
    minBackUi,
    minBackLamports: minBackLamports.toString(),
  });
  
  return minBackLamports;
}

/**
 * Mock price update account pour dev/tests
 * À remplacer par vrai Pyth account en production
 */
export function getMockPriceUpdateAccount(): PublicKey {
  // SystemProgram comme mock (ne sera pas utilisé en vrai)
  // TODO: Créer un vrai price update account Pyth
  return new PublicKey('11111111111111111111111111111111');
}

/**
 * Vérifie si Pyth est configuré correctement
 */
export function isPythConfigured(): boolean {
  const hasFeedId = !!process.env.NEXT_PUBLIC_BACK_USD_FEED_ID;
  const hasPriceService = !!process.env.NEXT_PUBLIC_PYTH_PRICE_SERVICE_URL;
  
  return hasFeedId || hasPriceService;
}

/**
 * Configuration recommandée pour .env.local
 */
export const PYTH_ENV_TEMPLATE = `
# Pyth Oracle Configuration
NEXT_PUBLIC_PYTH_PRICE_SERVICE_URL=https://hermes-beta.pyth.network
NEXT_PUBLIC_BACK_USD_FEED_ID=<YOUR_BACK_USD_FEED_ID>
NEXT_PUBLIC_BACK_MANUAL_PRICE=0.001

# Pour obtenir un feed ID:
# 1. Soumettre demande sur https://pyth.network/publishers
# 2. Ou créer pool Raydium et utiliser prix de pool
# 3. Ou utiliser feed existant comme proxy temporaire
`;
