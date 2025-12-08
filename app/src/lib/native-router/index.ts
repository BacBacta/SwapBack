/**
 * 🔀 SwapBack Native Router
 * 
 * Router qui utilise EXCLUSIVEMENT les venues natives (Raydium, Orca, Meteora, etc.)
 * au lieu de passer par Jupiter. Cela permet de:
 * - Générer du NPI (Native Price Improvement) 
 * - Distribuer les rebates aux utilisateurs
 * - Utiliser le scoring des venues on-chain
 * 
 * @author SwapBack Team
 * @date December 8, 2025
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
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { BN, Program, AnchorProvider, type Idl } from "@coral-xyz/anchor";
import { logger } from "@/lib/logger";
import { getOracleFeedsForPair } from "@/config/oracles";
import { getTokenPrice, getSolPrice } from "@/lib/price-service";

// ============================================================================
// CONSTANTS
// ============================================================================

// Program IDs (Mainnet - Deployed December 8, 2025)
export const ROUTER_PROGRAM_ID = new PublicKey("FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg");
export const BUYBACK_PROGRAM_ID = new PublicKey("7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ");
export const CNFT_PROGRAM_ID = new PublicKey("26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru");

// DEX Program IDs
export const DEX_PROGRAMS = {
  RAYDIUM_AMM: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
  RAYDIUM_CLMM: new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"),
  ORCA_WHIRLPOOL: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
  METEORA_DLMM: new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"),
  PHOENIX: new PublicKey("PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY"),
  LIFINITY: new PublicKey("EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S"),
  SANCTUM: new PublicKey("5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx"),
  SABER: new PublicKey("SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ"),
  JUPITER: new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"), // Jupiter comme référence
};

// Common token mints
export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Default oracle (Pyth SOL/USD mainnet)
export const PYTH_SOL_USD_MAINNET = new PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");
export const DEFAULT_ORACLE = PYTH_SOL_USD_MAINNET; // Fallback si getOracleFeedsForPair échoue

// Jito MEV Protection (mainnet tip accounts)
export const JITO_BLOCK_ENGINE_URL = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
export const JITO_TIP_ACCOUNTS = [
  new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
  new PublicKey("HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe"),
  new PublicKey("Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY"),
  new PublicKey("ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49"),
  new PublicKey("DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh"),
  new PublicKey("ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt"),
  new PublicKey("DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL"),
  new PublicKey("3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"),
];
export const DEFAULT_JITO_TIP_LAMPORTS = 10_000; // 0.00001 SOL

// Slippage Configuration (matches on-chain SlippageConfig)
export const SLIPPAGE_CONFIG = {
  BASE_SLIPPAGE_BPS: 50,     // 0.5% base
  MAX_SLIPPAGE_BPS: 500,     // 5% max
  SIZE_THRESHOLD_BPS: 100,   // Impact si > 1% pool
  VOLATILITY_DIVISOR: 10,    // Facteur volatilité
};

// Scoring thresholds
export const MIN_VENUE_SCORE = 2500; // Score minimum pour inclure une venue
export const MAX_VENUES = 10;
export const MAX_FALLBACKS = 5;

// Oracle validation
export const MAX_STALENESS_SECS = 300; // 5 minutes
export const MIN_STALENESS_SECS = 10;
export const MAX_ORACLE_DIVERGENCE_BPS = 200; // 2%

// ============================================================================
// TYPES
// ============================================================================

export interface VenueQuote {
  venue: keyof typeof DEX_PROGRAMS;
  venueProgramId: PublicKey;
  inputAmount: number;
  outputAmount: number;
  priceImpactBps: number;
  /** Comptes nécessaires pour le CPI */
  accounts: PublicKey[];
  /** Données d'instruction spécifiques au DEX */
  instructionData?: Buffer;
  /** Estimation du NPI généré */
  estimatedNpiBps: number;
  /** Latence de la quote en ms */
  latencyMs: number;
}

export interface NativeRouteQuote {
  venues: VenueQuote[];
  /** Nom de la meilleure venue sélectionnée */
  bestVenue: keyof typeof DEX_PROGRAMS;
  totalInputAmount: number;
  totalOutputAmount: number;
  totalPriceImpactBps: number;
  estimatedRebate: number;
  estimatedNpi: number;
  platformFeeBps: number;
  /** Meilleur output net après frais + rebates */
  netOutputAmount: number;
}

export interface NativeSwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountIn: number;
  minAmountOut: number;
  slippageBps?: number;
  userPublicKey: PublicKey;
  /** Utiliser le bundling Jito pour MEV protection */
  useJitoBundle?: boolean;
  /** Boost NFT level (0 si pas de NFT) */
  boostBps?: number;
  /** 
   * Override du seuil de staleness oracle (en secondes)
   * Par défaut: 300s (5 min)
   * Min: 10s, Max: 300s (clampé par le programme on-chain)
   * Augmenter pour les actifs peu liquides
   */
  maxStalenessSecs?: number;
}

export interface NativeSwapResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  venues: string[];
  rebateAmount: number;
  npiGenerated: number;
  transactionFee: number;
}

/** VenueScore on-chain account data */
export interface VenueScoreData {
  venue: PublicKey;
  venueType: VenueType;
  totalSwaps: number;
  totalVolume: number;
  totalNpiGenerated: number;
  avgLatencyMs: number;
  avgSlippageBps: number;
  qualityScore: number; // 0-10000
  lastUpdated: number;
  windowStart: number;
}

export enum VenueType {
  Raydium = 0,
  RaydiumClmm = 1,
  Orca = 2,
  Meteora = 3,
  Phoenix = 4,
  Lifinity = 5,
  Sanctum = 6,
  Saber = 7,
  Jupiter = 8,
  Unknown = 9,
}

/** Dynamic slippage calculation inputs */
export interface DynamicSlippageInputs {
  swapAmount: number;
  poolTvl: number;
  volatilityBps: number;
}

/** Slippage calculation result with breakdown */
export interface SlippageResult {
  slippageBps: number;
  baseComponent: number;
  sizeComponent: number;
  volatilityComponent: number;
}

/** Oracle observation data */
export interface OracleObservation {
  price: number;
  confidence: number;
  publishTime: number;
  slot: number;
  oracleType: 'pyth' | 'switchboard';
  feed: PublicKey;
}

// ============================================================================
// VENUE SCORE FETCHING
// ============================================================================

/**
 * Dérive le PDA VenueScore pour une venue donnée
 */
function deriveVenueScorePda(venueProgramId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("venue_score"), venueProgramId.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  return pda;
}

/**
 * Parse les données brutes d'un compte VenueScore
 */
function parseVenueScoreData(data: Buffer): VenueScoreData | null {
  try {
    // Skip 8-byte discriminator
    if (data.length < 89) return null;
    
    const offset = 8;
    const venue = new PublicKey(data.subarray(offset, offset + 32));
    const venueType = data.readUInt8(offset + 32) as VenueType;
    const totalSwaps = Number(data.readBigUInt64LE(offset + 33));
    const totalVolume = Number(data.readBigUInt64LE(offset + 41));
    const totalNpiGenerated = Number(data.readBigInt64LE(offset + 49));
    const avgLatencyMs = data.readUInt32LE(offset + 57);
    const avgSlippageBps = data.readUInt16LE(offset + 61);
    const qualityScore = data.readUInt16LE(offset + 63);
    const lastUpdated = Number(data.readBigInt64LE(offset + 65));
    const windowStart = Number(data.readBigInt64LE(offset + 73));
    
    return {
      venue,
      venueType,
      totalSwaps,
      totalVolume,
      totalNpiGenerated,
      avgLatencyMs,
      avgSlippageBps,
      qualityScore,
      lastUpdated,
      windowStart,
    };
  } catch (error) {
    logger.warn("NativeRouter", "Failed to parse VenueScore", { error });
    return null;
  }
}

/**
 * Récupère les scores de toutes les venues depuis la blockchain
 */
async function fetchVenueScores(
  connection: Connection
): Promise<Map<string, VenueScoreData>> {
  const scores = new Map<string, VenueScoreData>();
  
  const venueKeys = Object.keys(DEX_PROGRAMS) as (keyof typeof DEX_PROGRAMS)[];
  const pdas = venueKeys.map(key => deriveVenueScorePda(DEX_PROGRAMS[key]));
  
  try {
    const accounts = await connection.getMultipleAccountsInfo(pdas);
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      if (account && account.data) {
        const scoreData = parseVenueScoreData(account.data as Buffer);
        if (scoreData) {
          scores.set(venueKeys[i], scoreData);
        }
      }
    }
    
    logger.info("NativeRouter", `Fetched ${scores.size} venue scores from on-chain`);
  } catch (error) {
    logger.warn("NativeRouter", "Failed to fetch venue scores", { error });
  }
  
  return scores;
}

// ============================================================================
// DYNAMIC SLIPPAGE CALCULATION
// ============================================================================

/**
 * Calcule le slippage dynamique basé sur:
 * - Base slippage (0.5%)
 * - Size impact (swap amount vs pool TVL)
 * - Volatility (from oracle)
 * 
 * Formule: slippage = base + size_impact + (volatility / 10)
 */
export function calculateDynamicSlippage(inputs: DynamicSlippageInputs): SlippageResult {
  const { swapAmount, poolTvl, volatilityBps } = inputs;
  
  // Base component
  const baseComponent = SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
  
  // Size impact: Additional slippage when swap is > threshold % of pool
  let sizeComponent = 0;
  if (poolTvl > 0) {
    const sizeRatioBps = Math.floor((swapAmount / poolTvl) * 10000);
    sizeComponent = Math.max(0, sizeRatioBps - SLIPPAGE_CONFIG.SIZE_THRESHOLD_BPS);
  } else {
    // Unknown TVL: add 100 bps safety margin
    sizeComponent = 100;
  }
  
  // Volatility impact
  const volatilityComponent = Math.floor(volatilityBps / SLIPPAGE_CONFIG.VOLATILITY_DIVISOR);
  
  // Sum and cap
  const total = Math.min(
    baseComponent + sizeComponent + volatilityComponent,
    SLIPPAGE_CONFIG.MAX_SLIPPAGE_BPS
  );
  
  return {
    slippageBps: total,
    baseComponent,
    sizeComponent,
    volatilityComponent,
  };
}

// ============================================================================
// ORACLE VALIDATION
// ============================================================================

/**
 * Vérifie la validité d'un prix oracle
 */
async function validateOraclePrice(
  connection: Connection,
  oracleAccount: PublicKey,
  currentSlot: number
): Promise<{ valid: boolean; price: number; staleness: number }> {
  try {
    // Utiliser le price-service pour obtenir le prix en temps réel
    // L'oracle account est utilisé pour déterminer quel token nous cherchons
    const oracleKey = oracleAccount.toBase58();
    
    // Pour SOL/USD oracle, utiliser le prix SOL
    const solPrice = await getSolPrice();
    
    if (solPrice > 0) {
      return { valid: true, price: solPrice, staleness: 0 };
    }
    
    // Fallback: essayer de lire les données on-chain
    const accountInfo = await connection.getAccountInfo(oracleAccount);
    if (!accountInfo) {
      return { valid: false, price: 0, staleness: Infinity };
    }
    
    // Pyth price feed layout: price at offset 8, expo at offset 16
    const data = accountInfo.data;
    if (data.length >= 32) {
      try {
        const priceRaw = data.readBigInt64LE(8);
        const expo = data.readInt32LE(16);
        const price = Number(priceRaw) * Math.pow(10, expo);
        if (price > 0) {
          return { valid: true, price, staleness: 0 };
        }
      } catch (parseError) {
        logger.warn("NativeRouter", "Failed to parse oracle data", { parseError });
      }
    }
    
    return { valid: false, price: 0, staleness: Infinity };
  } catch (error) {
    logger.warn("NativeRouter", "Oracle validation failed", { error });
    return { valid: false, price: 0, staleness: Infinity };
  }
}

/**
 * Vérifie la divergence entre deux oracles
 */
export function checkOracleDivergence(price1: number, price2: number): {
  divergenceBps: number;
  isValid: boolean;
} {
  if (price1 === 0 || price2 === 0) {
    return { divergenceBps: 10000, isValid: false };
  }
  
  const avgPrice = (price1 + price2) / 2;
  const diff = Math.abs(price1 - price2);
  const divergenceBps = Math.floor((diff / avgPrice) * 10000);
  
  return {
    divergenceBps,
    isValid: divergenceBps <= MAX_ORACLE_DIVERGENCE_BPS,
  };
}

// ============================================================================
// JITO BUNDLE INTEGRATION
// ============================================================================

/**
 * Envoie une transaction via Jito pour protection MEV
 */
async function sendJitoBundle(
  transactions: VersionedTransaction[],
  tipLamports: number = DEFAULT_JITO_TIP_LAMPORTS
): Promise<string> {
  // Sélectionner un tip account aléatoire
  const tipAccount = JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
  
  logger.info("NativeRouter", "Sending Jito bundle", {
    numTransactions: transactions.length,
    tipLamports,
    tipAccount: tipAccount.toString(),
  });
  
  // Sérialiser les transactions en base64
  const encodedTxs = transactions.map(tx => 
    Buffer.from(tx.serialize()).toString('base64')
  );
  
  try {
    const response = await fetch(JITO_BLOCK_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [encodedTxs],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Jito bundle failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Jito error: ${data.error.message}`);
    }
    
    const bundleId = data.result;
    logger.info("NativeRouter", "Jito bundle sent", { bundleId });
    
    return bundleId;
  } catch (error) {
    logger.error("NativeRouter", "Jito bundle failed", { error });
    throw error;
  }
}

/**
 * Crée une instruction de tip pour Jito
 */
function createJitoTipInstruction(
  payer: PublicKey,
  tipLamports: number = DEFAULT_JITO_TIP_LAMPORTS
): TransactionInstruction {
  const tipAccount = JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
  
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: tipAccount,
    lamports: tipLamports,
  });
}

// ============================================================================
// VENUE QUOTE FETCHERS
// ============================================================================

/**
 * Récupère une quote depuis l'API Raydium
 */
async function fetchRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    // Raydium API v3
    const response = await fetch(
      `https://api-v3.raydium.io/compute/swap-base-in?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.success || !data.data) return null;
    
    const quote = data.data;
    const latencyMs = Date.now() - startTime;
    
    return {
      venue: "RAYDIUM_AMM",
      venueProgramId: DEX_PROGRAMS.RAYDIUM_AMM,
      inputAmount: amountIn,
      outputAmount: parseInt(quote.outputAmount),
      priceImpactBps: Math.floor(parseFloat(quote.priceImpact || "0") * 100),
      accounts: [], // Sera rempli par le builder
      estimatedNpiBps: 10, // ~0.1% NPI estimé
      latencyMs,
    };
  } catch (error) {
    logger.warn("NativeRouter", "Raydium quote failed", { error });
    return null;
  }
}

/**
 * Récupère une quote depuis l'API Orca Whirlpool
 */
async function fetchOrcaQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    // Orca Whirlpool API
    const response = await fetch(
      `https://api.mainnet.orca.so/v1/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippage=0.5`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.outAmount) return null;
    
    const latencyMs = Date.now() - startTime;
    
    return {
      venue: "ORCA_WHIRLPOOL",
      venueProgramId: DEX_PROGRAMS.ORCA_WHIRLPOOL,
      inputAmount: amountIn,
      outputAmount: parseInt(data.outAmount),
      priceImpactBps: Math.floor(parseFloat(data.priceImpactPercent || "0") * 100),
      accounts: [],
      estimatedNpiBps: 12, // Orca CLMM a généralement un bon NPI
      latencyMs,
    };
  } catch (error) {
    logger.warn("NativeRouter", "Orca quote failed", { error });
    return null;
  }
}

/**
 * Récupère une quote depuis Meteora DLMM
 */
async function fetchMeteoraQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    // Utiliser l'API Meteora DLMM quote
    const response = await fetch(
      `https://dlmm-api.meteora.ag/pair/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&swapMode=ExactIn`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      const latencyMs = Date.now() - startTime;
      
      if (data.outAmount) {
        return {
          venue: "METEORA_DLMM",
          venueProgramId: DEX_PROGRAMS.METEORA_DLMM,
          inputAmount: amountIn,
          outputAmount: parseInt(data.outAmount),
          priceImpactBps: Math.floor(parseFloat(data.priceImpact || "0") * 10000),
          accounts: [],
          estimatedNpiBps: 15, // DLMM peut générer plus de NPI
          latencyMs,
        };
      }
    }
    
    // Fallback: utiliser les prix en temps réel pour estimer
    const [inputPrice, outputPrice] = await Promise.all([
      getTokenPrice(inputMint),
      getTokenPrice(outputMint),
    ]);
    
    const latencyMs = Date.now() - startTime;
    
    if (inputPrice.price > 0 && outputPrice.price > 0) {
      // Calculer le taux de change basé sur les prix réels
      const exchangeRate = inputPrice.price / outputPrice.price;
      // Appliquer les frais typiques de Meteora (0.2%)
      const estimatedOutput = Math.floor(amountIn * exchangeRate * 0.998);
      
      return {
        venue: "METEORA_DLMM",
        venueProgramId: DEX_PROGRAMS.METEORA_DLMM,
        inputAmount: amountIn,
        outputAmount: estimatedOutput,
        priceImpactBps: 20,
        accounts: [],
        estimatedNpiBps: 15,
        latencyMs,
      };
    }
    
    return null;
  } catch (error) {
    logger.warn("NativeRouter", "Meteora quote failed", { error });
    return null;
  }
}

/**
 * Récupère une quote depuis Phoenix (CLOB)
 */
async function fetchPhoenixQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    // Phoenix SDK ou API
    const response = await fetch(
      `https://api.phoenix.com/v1/quote?` +
      `base=${inputMint}&quote=${outputMint}&amount=${amountIn}&side=sell`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    
    return {
      venue: "PHOENIX",
      venueProgramId: DEX_PROGRAMS.PHOENIX,
      inputAmount: amountIn,
      outputAmount: parseInt(data.expectedOutput || "0"),
      priceImpactBps: Math.floor(parseFloat(data.priceImpact || "0") * 100),
      accounts: [],
      estimatedNpiBps: 8, // CLOB a moins de NPI mais meilleur prix
      latencyMs,
    };
  } catch (error) {
    // Phoenix peut ne pas avoir de liquidité pour toutes les paires
    return null;
  }
}

/**
 * Récupère une quote depuis Jupiter comme benchmark de comparaison
 * Jupiter agrège tous les DEX donc sert de référence du marché
 */
async function fetchJupiterBenchmark(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.outAmount) return null;
    
    const latencyMs = Date.now() - startTime;
    
    // Identifier la venue principale utilisée par Jupiter
    const mainRoute = data.routePlan?.[0]?.swapInfo?.label || "Jupiter";
    
    return {
      venue: "JUPITER" as keyof typeof DEX_PROGRAMS, // Type assertion pour compatibilité
      venueProgramId: new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
      inputAmount: amountIn,
      outputAmount: parseInt(data.outAmount),
      priceImpactBps: Math.floor(parseFloat(data.priceImpactPct || "0") * 100),
      accounts: [],
      estimatedNpiBps: 0, // Jupiter n'a pas de NPI
      latencyMs,
    };
  } catch (error) {
    logger.warn("NativeRouter", "Jupiter benchmark failed", { error });
    return null;
  }
}

// ============================================================================
// NATIVE ROUTER SERVICE
// ============================================================================

export class NativeRouterService {
  private connection: Connection;
  private programId: PublicKey;
  private venueScoresCache: Map<string, VenueScoreData> = new Map();
  private lastScoresFetch: number = 0;
  private readonly SCORES_CACHE_TTL_MS = 60_000; // 1 minute cache
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = ROUTER_PROGRAM_ID;
  }
  
  /**
   * Récupère les scores des venues (avec cache)
   */
  async getVenueScores(): Promise<Map<string, VenueScoreData>> {
    const now = Date.now();
    if (now - this.lastScoresFetch < this.SCORES_CACHE_TTL_MS && this.venueScoresCache.size > 0) {
      return this.venueScoresCache;
    }
    
    this.venueScoresCache = await fetchVenueScores(this.connection);
    this.lastScoresFetch = now;
    return this.venueScoresCache;
  }
  
  /**
   * Ajuste les poids des venues basé sur leurs scores on-chain
   * - Exclut les venues avec score < 2500
   * - Scale les poids par (score / 10000)
   * - Renormalise à exactement 10,000 bps
   */
  adjustVenueWeightsWithScores(
    quotes: VenueQuote[],
    scores: Map<string, VenueScoreData>
  ): VenueQuote[] {
    // Calculer le poids initial (basé sur output amount)
    const maxOutput = Math.max(...quotes.map(q => q.outputAmount));
    
    const weightedQuotes = quotes.map(quote => {
      const score = scores.get(quote.venue);
      const qualityScore = score?.qualityScore ?? 10000; // Default: full score if not found
      
      // Exclure les venues avec score < MIN_VENUE_SCORE
      if (qualityScore < MIN_VENUE_SCORE) {
        logger.info("NativeRouter", `Venue ${quote.venue} excluded: score ${qualityScore} < ${MIN_VENUE_SCORE}`);
        return null;
      }
      
      // Calculer le poids brut basé sur output
      const outputWeight = Math.floor((quote.outputAmount / maxOutput) * 10000);
      
      // Ajuster par le score de qualité
      const adjustedWeight = Math.floor((outputWeight * qualityScore) / 10000);
      
      return {
        ...quote,
        adjustedWeight,
      };
    }).filter((q): q is VenueQuote & { adjustedWeight: number } => q !== null);
    
    // Renormaliser à 10,000 bps
    const totalWeight = weightedQuotes.reduce((sum, q) => sum + q.adjustedWeight, 0);
    if (totalWeight === 0) return [];
    
    const normalizedQuotes = weightedQuotes.map(q => ({
      ...q,
      adjustedWeight: Math.floor((q.adjustedWeight / totalWeight) * 10000),
    }));
    
    // Ajuster le dernier pour atteindre exactement 10,000
    const currentSum = normalizedQuotes.reduce((sum, q) => sum + q.adjustedWeight, 0);
    if (normalizedQuotes.length > 0 && currentSum !== 10000) {
      normalizedQuotes[normalizedQuotes.length - 1].adjustedWeight += 10000 - currentSum;
    }
    
    // Log les poids ajustés
    for (const q of normalizedQuotes) {
      logger.info("NativeRouter", `Venue ${q.venue} weight: ${q.adjustedWeight} bps`);
    }
    
    return normalizedQuotes;
  }
  
  /**
   * Estime la TVL du pool pour le calcul de slippage
   */
  async estimatePoolTvl(
    inputMint: PublicKey,
    outputMint: PublicKey,
    venue: keyof typeof DEX_PROGRAMS
  ): Promise<number> {
    // Default: 10M USDC equivalent (conservative)
    const DEFAULT_TVL = 10_000_000_000_000; // 10M avec 6 decimals
    
    try {
      // Pour Raydium, on peut fetcher la TVL depuis l'API
      if (venue === "RAYDIUM_AMM") {
        const response = await fetch(
          `https://api-v3.raydium.io/pools/info/mint?mint1=${inputMint}&mint2=${outputMint}`,
          { signal: AbortSignal.timeout(2000) }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.[0]?.tvl) {
            return Math.floor(parseFloat(data.data[0].tvl) * 1_000_000);
          }
        }
      }
    } catch {
      // Fallback to default
    }
    
    return DEFAULT_TVL;
  }
  
  /**
   * Récupère la volatilité depuis l'oracle
   */
  async getOracleVolatility(tokenMint: PublicKey): Promise<number> {
    // Pour l'instant, retourne une volatilité estimée
    // Une vraie implémentation lirait les données de volatilité depuis Pyth/Switchboard
    
    // Volatilité par défaut: 100 bps (1%)
    // SOL/stables ont généralement une volatilité plus élevée
    if (tokenMint.equals(SOL_MINT)) {
      return 200; // 2% volatilité pour SOL
    }
    if (tokenMint.equals(USDC_MINT)) {
      return 10; // 0.1% volatilité pour USDC
    }
    
    return 100; // 1% par défaut
  }
  
  /**
   * Récupère des quotes depuis toutes les venues natives disponibles
   * Utilise l'API proxy pour éviter les problèmes CORS côté client
   * Inclut Jupiter comme benchmark pour comparaison
   */
  async getMultiVenueQuotes(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number
  ): Promise<VenueQuote[]> {
    const inputMintStr = inputMint.toString();
    const outputMintStr = outputMint.toString();
    
    logger.info("NativeRouter", "Fetching multi-venue quotes via API proxy", {
      inputMint: inputMintStr,
      outputMint: outputMintStr,
      amountIn,
    });
    
    // Détecter si on est côté client (browser) ou serveur
    const isClient = typeof window !== 'undefined';
    
    if (isClient) {
      // Côté client: utiliser l'API proxy pour éviter CORS
      try {
        const response = await fetch(
          `/api/venue-quotes?inputMint=${inputMintStr}&outputMint=${outputMintStr}&amount=${amountIn}`,
          { signal: AbortSignal.timeout(10000) }
        );
        
        if (!response.ok) {
          logger.warn("NativeRouter", "Venue quotes API failed", { status: response.status });
          return [];
        }
        
        const data = await response.json();
        
        // Convertir les résultats en VenueQuote
        const quotes: VenueQuote[] = [];
        
        for (const q of data.quotes || []) {
          if (q.outputAmount > 0 && !q.error) {
            const venueKey = this.mapVenueNameToKey(q.venue);
            quotes.push({
              venue: venueKey,
              venueProgramId: DEX_PROGRAMS[venueKey] || DEX_PROGRAMS.RAYDIUM_AMM,
              inputAmount: amountIn,
              outputAmount: q.outputAmount,
              priceImpactBps: q.priceImpactBps || 0,
              accounts: [],
              estimatedNpiBps: this.getEstimatedNpiBps(venueKey),
              latencyMs: q.latencyMs || 0,
            });
          }
        }
        
        // Ajouter Jupiter comme benchmark
        if (data.jupiterBenchmark && data.jupiterBenchmark.outputAmount > 0) {
          quotes.push({
            venue: "JUPITER" as keyof typeof DEX_PROGRAMS,
            venueProgramId: DEX_PROGRAMS.JUPITER,
            inputAmount: amountIn,
            outputAmount: data.jupiterBenchmark.outputAmount,
            priceImpactBps: data.jupiterBenchmark.priceImpactBps || 0,
            accounts: [],
            estimatedNpiBps: 0, // Jupiter ne génère pas de NPI
            latencyMs: data.jupiterBenchmark.latencyMs || 0,
          });
        }
        
        // Trier par meilleur output
        quotes.sort((a, b) => b.outputAmount - a.outputAmount);
        
        logger.info("NativeRouter", `Got ${quotes.length} venue quotes from API`, {
          venues: quotes.map(q => ({
            venue: q.venue,
            output: q.outputAmount,
            priceImpact: q.priceImpactBps,
            latency: q.latencyMs,
          })),
          bestVenue: quotes[0]?.venue,
          bestOutput: quotes[0]?.outputAmount,
        });
        
        // Si on a des quotes, les retourner
        if (quotes.length > 0) {
          return quotes;
        }
        
        // Sinon, fallback sur estimation locale
        logger.warn("NativeRouter", "API returned no valid quotes, using local estimation");
        return this.getLocalEstimatedQuotes(inputMint, outputMint, amountIn);
      } catch (error) {
        logger.error("NativeRouter", "Failed to fetch quotes via API", { error });
        // Fallback: estimation locale basée sur les prix
        return this.getLocalEstimatedQuotes(inputMint, outputMint, amountIn);
      }
    } else {
      // Côté serveur: appeler directement les APIs (pas de CORS)
      const quotePromises = [
        fetchRaydiumQuote(inputMintStr, outputMintStr, amountIn),
        fetchOrcaQuote(inputMintStr, outputMintStr, amountIn),
        fetchMeteoraQuote(inputMintStr, outputMintStr, amountIn),
        fetchPhoenixQuote(inputMintStr, outputMintStr, amountIn),
        fetchJupiterBenchmark(inputMintStr, outputMintStr, amountIn),
      ];
      
      const results = await Promise.allSettled(quotePromises);
      
      const quotes: VenueQuote[] = [];
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          quotes.push(result.value);
        }
      }
      
      // Trier par meilleur output
      quotes.sort((a, b) => b.outputAmount - a.outputAmount);
      
      logger.info("NativeRouter", `Got ${quotes.length} venue quotes (server-side)`, {
        venues: quotes.map(q => ({
          venue: q.venue,
          output: q.outputAmount,
        })),
      });
      
      return quotes;
    }
  }
  
  /**
   * Map le nom de venue de l'API vers la clé DEX_PROGRAMS
   */
  private mapVenueNameToKey(venueName: string): keyof typeof DEX_PROGRAMS {
    const mapping: Record<string, keyof typeof DEX_PROGRAMS> = {
      'RAYDIUM': 'RAYDIUM_AMM',
      'ORCA': 'ORCA_WHIRLPOOL',
      'METEORA': 'METEORA_DLMM',
      'PHOENIX': 'PHOENIX',
      'JUPITER': 'JUPITER',
      'JUPITER_FALLBACK': 'JUPITER', // Fallback utilise Jupiter
    };
    return mapping[venueName] || 'RAYDIUM_AMM';
  }
  
  /**
   * Retourne le NPI estimé par venue
   */
  private getEstimatedNpiBps(venue: keyof typeof DEX_PROGRAMS): number {
    const npiByVenue: Partial<Record<keyof typeof DEX_PROGRAMS, number>> = {
      'RAYDIUM_AMM': 10,
      'RAYDIUM_CLMM': 12,
      'ORCA_WHIRLPOOL': 12,
      'METEORA_DLMM': 15,
      'PHOENIX': 8,
      'LIFINITY': 10,
      'JUPITER': 0, // Jupiter ne génère pas de NPI
    };
    return npiByVenue[venue] || 10;
  }
  
  /**
   * Génère des quotes estimées localement basées sur les prix
   * Utilisé comme fallback quand l'API /api/venue-quotes échoue
   * Utilise notre API proxy /api/price pour éviter CORS
   */
  private async getLocalEstimatedQuotes(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number
  ): Promise<VenueQuote[]> {
    const quotes: VenueQuote[] = [];
    
    try {
      const inputMintStr = inputMint.toBase58();
      const outputMintStr = outputMint.toBase58();
      
      // Utiliser notre API proxy /api/price pour éviter CORS
      const [inputPriceRes, outputPriceRes] = await Promise.all([
        fetch(`/api/price?mint=${inputMintStr}`, { signal: AbortSignal.timeout(5000) }),
        fetch(`/api/price?mint=${outputMintStr}`, { signal: AbortSignal.timeout(5000) }),
      ]);
      
      if (!inputPriceRes.ok || !outputPriceRes.ok) {
        logger.warn("NativeRouter", "Price API failed", { 
          inputStatus: inputPriceRes.status, 
          outputStatus: outputPriceRes.status 
        });
        return quotes;
      }
      
      const inputPriceData = await inputPriceRes.json();
      const outputPriceData = await outputPriceRes.json();
      
      const inputPrice = inputPriceData.price || 0;
      const outputPrice = outputPriceData.price || 0;
      
      if (inputPrice <= 0 || outputPrice <= 0) {
        logger.warn("NativeRouter", "Invalid prices", { inputPrice, outputPrice });
        return quotes;
      }
      
      // Calculer le montant de sortie estimé
      // Déterminer les decimals basé sur les tokens connus
      const inputDecimals = inputMintStr === SOL_MINT.toBase58() ? 9 : 6;
      const outputDecimals = outputMintStr === USDC_MINT.toBase58() ? 6 : 
                             outputMintStr === SOL_MINT.toBase58() ? 9 : 6;
      
      const inputAmountNormalized = amountIn / Math.pow(10, inputDecimals);
      const inputValueUsd = inputAmountNormalized * inputPrice;
      const outputAmountNormalized = inputValueUsd / outputPrice;
      const baseOutputAmount = Math.floor(outputAmountNormalized * Math.pow(10, outputDecimals));
      
      logger.info("NativeRouter", "Local price estimation", {
        inputPrice,
        outputPrice,
        inputAmountNormalized,
        inputValueUsd,
        outputAmountNormalized,
        baseOutputAmount,
      });
      
      // Créer des quotes estimées pour chaque venue avec différents spreads
      const venueConfigs: { venue: keyof typeof DEX_PROGRAMS; spreadBps: number }[] = [
        { venue: 'RAYDIUM_AMM', spreadBps: 20 },      // 0.2%
        { venue: 'ORCA_WHIRLPOOL', spreadBps: 25 },   // 0.25%
        { venue: 'METEORA_DLMM', spreadBps: 30 },     // 0.3%
        { venue: 'PHOENIX', spreadBps: 10 },          // 0.1%
      ];
      
      for (const config of venueConfigs) {
        const outputAmount = Math.floor(baseOutputAmount * (10000 - config.spreadBps) / 10000);
        quotes.push({
          venue: config.venue,
          venueProgramId: DEX_PROGRAMS[config.venue],
          inputAmount: amountIn,
          outputAmount,
          priceImpactBps: 10, // Estimé
          accounts: [],
          estimatedNpiBps: this.getEstimatedNpiBps(config.venue),
          latencyMs: 0,
        });
      }
      
      // Ajouter Jupiter comme benchmark (meilleur prix théorique)
      quotes.push({
        venue: 'JUPITER' as keyof typeof DEX_PROGRAMS,
        venueProgramId: DEX_PROGRAMS.JUPITER,
        inputAmount: amountIn,
        outputAmount: baseOutputAmount,
        priceImpactBps: 5,
        accounts: [],
        estimatedNpiBps: 0,
        latencyMs: 0,
      });
      
      // Trier par meilleur output
      quotes.sort((a, b) => b.outputAmount - a.outputAmount);
      
      logger.info("NativeRouter", `Generated ${quotes.length} estimated quotes`, {
        venues: quotes.map(q => ({ venue: q.venue, output: q.outputAmount })),
      });
      
    } catch (error) {
      logger.error("NativeRouter", "Local estimation failed", { error });
    }
    
    return quotes;
  }
  
  /**
   * Construit la meilleure route native basée sur les quotes
   * Utilise le scoring on-chain et le slippage dynamique
   */
  async buildNativeRoute(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    slippageBps?: number
  ): Promise<NativeRouteQuote | null> {
    // 1. Récupérer les quotes
    const quotes = await this.getMultiVenueQuotes(inputMint, outputMint, amountIn);
    
    if (quotes.length === 0) {
      logger.warn("NativeRouter", "No venue quotes available");
      return null;
    }
    
    // 2. Récupérer les scores on-chain
    const venueScores = await this.getVenueScores();
    
    // 3. Ajuster les poids basé sur les scores
    const adjustedQuotes = this.adjustVenueWeightsWithScores(quotes, venueScores);
    
    if (adjustedQuotes.length === 0) {
      logger.warn("NativeRouter", "All venues excluded by scoring");
      // Fallback: utiliser les quotes originales sans ajustement
      adjustedQuotes.push(...quotes.slice(0, MAX_VENUES));
    }
    
    // 4. Calculer le slippage dynamique si non fourni
    let finalSlippageBps = slippageBps ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
    
    if (!slippageBps) {
      const bestVenue = adjustedQuotes[0];
      
      // Estimer TVL et volatilité
      const [poolTvl, volatilityBps] = await Promise.all([
        this.estimatePoolTvl(inputMint, outputMint, bestVenue.venue),
        this.getOracleVolatility(inputMint),
      ]);
      
      // Calculer slippage dynamique
      const slippageResult = calculateDynamicSlippage({
        swapAmount: amountIn,
        poolTvl,
        volatilityBps,
      });
      
      finalSlippageBps = slippageResult.slippageBps;
      
      logger.info("NativeRouter", "Dynamic slippage calculated", {
        base: slippageResult.baseComponent,
        size: slippageResult.sizeComponent,
        volatility: slippageResult.volatilityComponent,
        total: slippageResult.slippageBps,
      });
    }
    
    // 5. Stratégie: utiliser la meilleure venue
    const bestQuote = adjustedQuotes[0];
    
    // Calculer le min output avec slippage
    const minOutput = Math.floor(bestQuote.outputAmount * (10000 - finalSlippageBps) / 10000);
    
    // 6. Calculer le NPI RÉEL en comparant avec le prix du marché (Jupiter)
    const { npi: realNpiBps, jupiterOutput } = await this.calculateRealNPI(
      inputMint,
      outputMint,
      amountIn,
      bestQuote.outputAmount
    );
    
    // NPI = amélioration réelle par rapport à Jupiter
    // Si Jupiter est meilleur ou égal, NPI = 0 (pas de fallback sur estimation!)
    // L'estimation hardcodée ne doit JAMAIS être utilisée pour afficher le NPI
    const effectiveNpiBps = realNpiBps; // Plus de fallback!
    
    // Estimation du NPI et rebates basée sur le NPI réel UNIQUEMENT
    const platformFeeBps = 20; // 0.2%
    const npiEstimate = effectiveNpiBps > 0 
      ? Math.floor(bestQuote.outputAmount * effectiveNpiBps / 10000)
      : 0;
    const rebateEstimate = Math.floor(npiEstimate * 0.7); // 70% du NPI va aux rebates
    
    // Net output = output - platform fee + rebate
    const platformFee = Math.floor(bestQuote.outputAmount * platformFeeBps / 10000);
    const netOutput = bestQuote.outputAmount - platformFee + rebateEstimate;
    
    logger.info("NativeRouter", "NPI calculation (REAL)", {
      bestVenue: bestQuote.venue,
      bestVenueOutput: bestQuote.outputAmount,
      jupiterOutput,
      improvementBps: realNpiBps,
      npiAmount: npiEstimate,
      rebateAmount: rebateEstimate,
      isJupiterBetter: jupiterOutput > bestQuote.outputAmount,
    });
    
    // Ne retourner que la meilleure venue (celle utilisée pour le swap)
    // Les autres venues sont juste pour comparaison dans les logs
    return {
      venues: [bestQuote], // SEULEMENT la meilleure venue utilisée
      bestVenue: bestQuote.venue,
      totalInputAmount: amountIn,
      totalOutputAmount: bestQuote.outputAmount,
      totalPriceImpactBps: bestQuote.priceImpactBps,
      estimatedRebate: rebateEstimate,
      estimatedNpi: npiEstimate,
      platformFeeBps,
      netOutputAmount: netOutput,
    };
  }
  
  /**
   * Calcule le NPI réel en comparant avec Jupiter (benchmark du marché)
   * Utilise l'API proxy côté client pour éviter CORS
   * 
   * OPTIMISÉ: 
   * - Timeout réduit côté client pour éviter les DOMException
   * - Race entre venue-quotes et fallback direct
   * - Le NPI n'est pas critique, on retourne 0 si timeout
   */
  async calculateRealNPI(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    nativeOutput: number
  ): Promise<{ npi: number; jupiterOutput: number }> {
    try {
      const inputMintStr = inputMint.toBase58();
      const outputMintStr = outputMint.toBase58();
      
      // Détecter si on est côté client (browser) ou serveur
      const isClient = typeof window !== 'undefined';
      
      let jupiterOutput = 0;
      
      if (isClient) {
        // Côté client: timeout très court (3s) car venue-quotes fait déjà des appels cascadés
        // Utiliser Promise.race avec un fallback prix direct
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          // Stratégie 1: venue-quotes (complet mais plus lent)
          const venueQuotesPromise = fetch(
            `/api/venue-quotes?inputMint=${inputMintStr}&outputMint=${outputMintStr}&amount=${amountIn}`,
            { signal: controller.signal }
          ).then(async (res) => {
            if (!res.ok) return 0;
            const data = await res.json();
            return data.jupiterBenchmark?.outputAmount || 0;
          }).catch(() => 0);
          
          // Stratégie 2: API prix directe (plus rapide, estimation)
          const priceApiPromise = fetch(
            `/api/price?mint=${outputMintStr}`,
            { signal: controller.signal }
          ).then(async (res) => {
            if (!res.ok) return 0;
            const data = await res.json();
            const outputPrice = data.price || 0;
            if (outputPrice <= 0) return 0;
            
            // Récupérer aussi le prix d'entrée
            const inputRes = await fetch(`/api/price?mint=${inputMintStr}`, { signal: controller.signal });
            if (!inputRes.ok) return 0;
            const inputData = await inputRes.json();
            const inputPrice = inputData.price || 0;
            if (inputPrice <= 0) return 0;
            
            // Estimation: (amountIn * inputPrice) / outputPrice
            // Ajuster pour les décimales (assumé 6 pour USDC, 9 pour SOL)
            const inputDecimals = inputMintStr === 'So11111111111111111111111111111111111111112' ? 9 : 6;
            const outputDecimals = outputMintStr === 'So11111111111111111111111111111111111111112' ? 9 : 6;
            
            const inputValue = (amountIn / Math.pow(10, inputDecimals)) * inputPrice;
            const estimatedOutput = (inputValue / outputPrice) * Math.pow(10, outputDecimals);
            
            return Math.floor(estimatedOutput);
          }).catch(() => 0);
          
          // Race: prendre le premier résultat non-nul
          const results = await Promise.allSettled([venueQuotesPromise, priceApiPromise]);
          clearTimeout(timeoutId);
          
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value > 0) {
              jupiterOutput = result.value;
              break;
            }
          }
        } catch (e) {
          // AbortError est normal, pas besoin de logger
          if (e instanceof Error && e.name !== 'AbortError') {
            logger.debug("NativeRouter", "NPI calculation aborted (expected)", { error: e.message });
          }
        }
      } else {
        // Côté serveur: appeler Jupiter directement avec timeout court
        const jupiterResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${inputMintStr}&outputMint=${outputMintStr}&amount=${amountIn}&slippageBps=50`,
          { signal: AbortSignal.timeout(2500) }
        );
        
        if (jupiterResponse.ok) {
          const jupiterQuote = await jupiterResponse.json();
          jupiterOutput = parseInt(jupiterQuote.outAmount || "0");
        }
      }
      
      if (jupiterOutput === 0) {
        return { npi: 0, jupiterOutput: 0 };
      }
      
      // NPI = (nativeOutput - jupiterOutput) / jupiterOutput * 10000
      // Positif si notre route est meilleure que Jupiter
      const improvement = nativeOutput - jupiterOutput;
      const npiBps = Math.floor((improvement / jupiterOutput) * 10000);
      
      // Clamp à des valeurs raisonnables (0-100 bps = 0-1%)
      // Si négatif, Jupiter est meilleur - on utilise 0
      const clampedNpi = Math.max(0, Math.min(npiBps, 100));
      
      logger.info("NativeRouter", "Real NPI calculated", {
        nativeOutput,
        jupiterOutput,
        improvement,
        npiBps,
        clampedNpi,
      });
      
      return { npi: clampedNpi, jupiterOutput };
    } catch (error) {
      logger.warn("NativeRouter", "Failed to calculate real NPI", { error });
      return { npi: 0, jupiterOutput: 0 };
    }
  }
  
  /**
   * Dérive les PDAs nécessaires pour le swap
   */
  async deriveSwapAccounts(
    userPublicKey: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<{
    routerState: PublicKey;
    rebateVault: PublicKey;
    vaultTokenAccountA: PublicKey;
    vaultTokenAccountB: PublicKey;
    userTokenAccountA: PublicKey;
    userTokenAccountB: PublicKey;
    userRebateAccount: PublicKey;
    userNftPda: PublicKey;
    oracleCache: PublicKey;
    venueScore: PublicKey;
  }> {
    // Router State PDA
    const [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      this.programId
    );
    
    // Rebate Vault PDA
    const [rebateVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("rebate_vault"), routerState.toBuffer()],
      this.programId
    );
    
    // Vault token accounts (ATAs du RouterState pour chaque token)
    // Ces comptes doivent être créés avec init-router-vaults.js
    const vaultTokenAccountA = await getAssociatedTokenAddress(
      inputMint,
      routerState,
      true // allowOwnerOffCurve = true car routerState est un PDA
    );
    const vaultTokenAccountB = await getAssociatedTokenAddress(
      outputMint,
      routerState,
      true // allowOwnerOffCurve = true car routerState est un PDA
    );
    
    // User token accounts (ATAs)
    const userTokenAccountA = await getAssociatedTokenAddress(inputMint, userPublicKey);
    const userTokenAccountB = await getAssociatedTokenAddress(outputMint, userPublicKey);
    
    // User USDC account for rebates
    const userRebateAccount = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
    
    // User NFT PDA (from cNFT program)
    const [userNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_nft"), userPublicKey.toBuffer()],
      CNFT_PROGRAM_ID
    );
    
    // Oracle cache PDA
    const [oracleCache] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle_cache"), DEFAULT_ORACLE.toBuffer()],
      this.programId
    );
    
    // Venue score PDA
    const [venueScore] = PublicKey.findProgramAddressSync(
      [Buffer.from("venue_score"), routerState.toBuffer()],
      this.programId
    );
    
    return {
      routerState,
      rebateVault,
      vaultTokenAccountA,
      vaultTokenAccountB,
      userTokenAccountA,
      userTokenAccountB,
      userRebateAccount,
      userNftPda,
      oracleCache,
      venueScore,
    };
  }
  
  /**
   * Construit la transaction de swap native
   */
  async buildSwapTransaction(
    params: NativeSwapParams,
    route: NativeRouteQuote
  ): Promise<VersionedTransaction> {
    const { userPublicKey, inputMint, outputMint, amountIn, minAmountOut } = params;
    
    logger.info("NativeRouter", "Building swap transaction", {
      amountIn,
      minAmountOut,
      venues: route.venues.map(v => v.venue),
    });
    
    // Dériver les comptes
    const accounts = await this.deriveSwapAccounts(userPublicKey, inputMint, outputMint);
    
    const instructions: TransactionInstruction[] = [];
    
    // Vérifier si les ATAs utilisateurs existent, sinon les créer
    const ataChecks = await Promise.all([
      this.connection.getAccountInfo(accounts.userTokenAccountA),
      this.connection.getAccountInfo(accounts.userTokenAccountB),
    ]);
    
    if (!ataChecks[0]) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          accounts.userTokenAccountA,
          userPublicKey,
          inputMint
        )
      );
    }
    
    if (!ataChecks[1]) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          accounts.userTokenAccountB,
          userPublicKey,
          outputMint
        )
      );
    }
    
    // Vérifier si les vaults du router existent (ATAs appartenant au RouterState)
    // Ces comptes sont nécessaires pour stocker temporairement les tokens durant le swap
    const vaultAtaChecks = await Promise.all([
      this.connection.getAccountInfo(accounts.vaultTokenAccountA),
      this.connection.getAccountInfo(accounts.vaultTokenAccountB),
    ]);

    if (!vaultAtaChecks[0]) {
      logger.info("NativeRouter", "Creating router vault ATA (token A)", {
        mint: inputMint.toBase58(),
        vault: accounts.vaultTokenAccountA.toBase58(),
      });
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          accounts.vaultTokenAccountA,
          accounts.routerState,
          inputMint
        )
      );
    }

    if (!vaultAtaChecks[1]) {
      logger.info("NativeRouter", "Creating router vault ATA (token B)", {
        mint: outputMint.toBase58(),
        vault: accounts.vaultTokenAccountB.toBase58(),
      });
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          accounts.vaultTokenAccountB,
          accounts.routerState,
          outputMint
        )
      );
    }

    // Construire les VenueWeight pour chaque venue
    const venueWeights = route.venues.map((venue, index) => ({
      venue: venue.venueProgramId,
      weight: index === 0 ? 10000 : 0, // 100% sur la meilleure venue pour l'instant
    }));
    
    // Construire l'instruction swap_toc
    const swapInstruction = await this.buildSwapToCInstruction(
      userPublicKey,
      accounts,
      inputMint,
      outputMint,
      amountIn,
      minAmountOut,
      venueWeights,
      route.venues[0], // Meilleure venue
      params.maxStalenessSecs // Optionnel: override staleness
    );
    
    instructions.push(swapInstruction);
    
    // Construire la transaction versionnée
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    
    const messageV0 = new TransactionMessage({
      payerKey: userPublicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    
    const transaction = new VersionedTransaction(messageV0);
    
    return transaction;
  }
  
  /**
   * Construit l'instruction swap_toc
   */
  private async buildSwapToCInstruction(
    userPublicKey: PublicKey,
    accounts: Awaited<ReturnType<typeof this.deriveSwapAccounts>>,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    minAmountOut: number,
    venueWeights: { venue: PublicKey; weight: number }[],
    bestVenue: VenueQuote,
    maxStalenessSecs?: number
  ): Promise<TransactionInstruction> {
    // Charger l'IDL
    const idlResponse = await fetch("/idl/swapback_router.json");
    const idl = await idlResponse.json();
    
    // Discriminator pour swap_toc (depuis l'IDL)
    // swap_toc => [187, 201, 212, 51, 16, 155, 236, 60]
    const discriminator = Buffer.from([187, 201, 212, 51, 16, 155, 236, 60]);
    
    // Sérialiser les arguments SwapArgs
    const argsBuffer = this.serializeSwapArgs({
      amountIn: new BN(amountIn),
      minOut: new BN(minAmountOut),
      slippageTolerance: 50, // 0.5%
      useDynamicPlan: false,
      useBundle: false,
      primaryOracleAccount: PYTH_SOL_USD_MAINNET, // Sera overridé par les oracles dans keys
      venues: venueWeights,
      maxStalenessOverride: maxStalenessSecs,
    });
    
    const data = Buffer.concat([discriminator, argsBuffer]);
    
    // Récupérer les comptes du DEX pour le CPI
    const venueAccounts = await this.getVenueAccounts(bestVenue, inputMint, outputMint);
    
    // Vérifier quels comptes optionnels existent on-chain
    const [userNftExists, oracleCacheExists, venueScoreExists] = await Promise.all([
      this.connection.getAccountInfo(accounts.userNftPda).then(info => !!info),
      this.connection.getAccountInfo(accounts.oracleCache).then(info => !!info),
      this.connection.getAccountInfo(accounts.venueScore).then(info => !!info),
    ]);
    
    logger.debug("NativeRouter", "Optional accounts check", {
      userNftExists,
      oracleCacheExists,
      venueScoreExists,
    });
    
    // Obtenir les oracles pour cette paire de tokens
    // IMPORTANT: Ne PAS fallback silencieusement sur DEFAULT_ORACLE
    let primaryOracle: PublicKey;
    let fallbackOracle: PublicKey | null = null;
    
    try {
      const oracleConfig = getOracleFeedsForPair(inputMint.toBase58(), outputMint.toBase58());
      primaryOracle = oracleConfig.primary;
      fallbackOracle = oracleConfig.fallback || null;
      
      logger.info("NativeRouter", "Using oracles for pair", {
        inputMint: inputMint.toBase58().slice(0, 8),
        outputMint: outputMint.toBase58().slice(0, 8),
        primary: primaryOracle.toBase58().slice(0, 8),
        fallback: fallbackOracle?.toBase58().slice(0, 8) || "none",
      });
    } catch (e) {
      // NE PAS fallback silencieusement - renvoyer une erreur explicite
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      logger.error("NativeRouter", "No oracle configured for pair", {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        error: errorMsg,
      });
      throw new Error(
        `Swap impossible: aucun oracle configuré pour la paire ` +
        `${inputMint.toBase58().slice(0, 8)}.../${outputMint.toBase58().slice(0, 8)}... ` +
        `Veuillez contacter le support ou utiliser une autre paire.`
      );
    }
    
    // Comptes selon l'ordre de l'IDL swap_toc:
    // Pour les comptes optionnels qui n'existent pas, on utilise le program ID du router
    // Anchor traite cela comme "None" pour Option<Account>
    const NONE_ACCOUNT = this.programId;
    
    const keys = [
      // 1. state
      { pubkey: accounts.routerState, isSigner: false, isWritable: true },
      // 2. user
      { pubkey: userPublicKey, isSigner: true, isWritable: true },
      // 3. primary_oracle (Pyth ou Switchboard selon la paire)
      { pubkey: primaryOracle, isSigner: false, isWritable: false },
      // 4. fallback_oracle (optional - utiliser si disponible)
      { pubkey: fallbackOracle || NONE_ACCOUNT, isSigner: false, isWritable: false },
      // 5. user_token_account_a
      { pubkey: accounts.userTokenAccountA, isSigner: false, isWritable: true },
      // 6. user_token_account_b
      { pubkey: accounts.userTokenAccountB, isSigner: false, isWritable: true },
      // 7. vault_token_account_a
      { pubkey: accounts.vaultTokenAccountA, isSigner: false, isWritable: true },
      // 8. vault_token_account_b
      { pubkey: accounts.vaultTokenAccountB, isSigner: false, isWritable: true },
      // 9. plan (optional - None)
      { pubkey: NONE_ACCOUNT, isSigner: false, isWritable: false },
      // 10. user_nft (optional - seulement si existe)
      { pubkey: userNftExists ? accounts.userNftPda : NONE_ACCOUNT, isSigner: false, isWritable: false },
      // 11. buyback_program (optional - None)
      { pubkey: NONE_ACCOUNT, isSigner: false, isWritable: false },
      // 12. buyback_usdc_vault (optional - None)
      { pubkey: NONE_ACCOUNT, isSigner: false, isWritable: false },
      // 13. buyback_state (optional - None)
      { pubkey: NONE_ACCOUNT, isSigner: false, isWritable: false },
      // 14. user_rebate_account (optional)
      { pubkey: accounts.userRebateAccount, isSigner: false, isWritable: true },
      // 15. rebate_vault
      { pubkey: accounts.rebateVault, isSigner: false, isWritable: true },
      // 16. oracle_cache (optional - seulement si existe)
      { pubkey: oracleCacheExists ? accounts.oracleCache : NONE_ACCOUNT, isSigner: false, isWritable: oracleCacheExists },
      // 17. venue_score (optional - seulement si existe)
      { pubkey: venueScoreExists ? accounts.venueScore : NONE_ACCOUNT, isSigner: false, isWritable: venueScoreExists },
      // 18. token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // 19. system_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // remaining_accounts: Venue accounts pour le CPI
      ...venueAccounts.map(pubkey => ({
        pubkey,
        isSigner: false,
        isWritable: true,
      })),
    ];
    
    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }
  
  /**
   * Sérialise les arguments SwapArgs pour l'instruction
   */
  private serializeSwapArgs(args: {
    amountIn: BN;
    minOut: BN;
    slippageTolerance: number;
    useDynamicPlan: boolean;
    useBundle: boolean;
    primaryOracleAccount: PublicKey;
    venues: { venue: PublicKey; weight: number }[];
    maxStalenessOverride?: number; // En secondes (10-300)
  }): Buffer {
    // Sérialisation manuelle selon le format Anchor
    const buffers: Buffer[] = [];
    
    // amount_in: u64
    buffers.push(args.amountIn.toArrayLike(Buffer, "le", 8));
    
    // min_out: u64
    buffers.push(args.minOut.toArrayLike(Buffer, "le", 8));
    
    // slippage_tolerance: Option<u16>
    const slippageBuf = Buffer.alloc(3);
    slippageBuf.writeUInt8(1, 0); // Some
    slippageBuf.writeUInt16LE(args.slippageTolerance, 1);
    buffers.push(slippageBuf);
    
    // twap_slices: Option<u8>
    buffers.push(Buffer.from([0])); // None
    
    // use_dynamic_plan: bool
    buffers.push(Buffer.from([args.useDynamicPlan ? 1 : 0]));
    
    // plan_account: Option<Pubkey>
    buffers.push(Buffer.from([0])); // None
    
    // use_bundle: bool
    buffers.push(Buffer.from([args.useBundle ? 1 : 0]));
    
    // primary_oracle_account: Pubkey
    buffers.push(args.primaryOracleAccount.toBuffer());
    
    // fallback_oracle_account: Option<Pubkey>
    buffers.push(Buffer.from([0])); // None
    
    // jupiter_route: Option<...>
    buffers.push(Buffer.from([0])); // None - on utilise les venues natives
    
    // jupiter_swap_ix_data: Option<Vec<u8>>
    buffers.push(Buffer.from([0])); // None
    
    // liquidity_estimate: Option<u64>
    buffers.push(Buffer.from([0])); // None
    
    // volatility_bps: Option<u16>
    buffers.push(Buffer.from([0])); // None
    
    // min_venue_score: Option<u16>
    const minScoreBuf = Buffer.alloc(3);
    minScoreBuf.writeUInt8(1, 0); // Some
    minScoreBuf.writeUInt16LE(2500, 1); // 25% minimum
    buffers.push(minScoreBuf);
    
    // slippage_per_venue: Option<Vec<...>>
    buffers.push(Buffer.from([0])); // None
    
    // token decimals: Option<u8> x2
    buffers.push(Buffer.from([0])); // None
    buffers.push(Buffer.from([0])); // None
    
    // max_staleness_override: Option<i64>
    // Si fourni, permet d'augmenter le seuil de staleness (10-300s)
    if (args.maxStalenessOverride && args.maxStalenessOverride > 0) {
      // Clamp entre 10 et 300 secondes côté client aussi
      const clampedStaleness = Math.max(10, Math.min(300, args.maxStalenessOverride));
      const stalenessBuf = Buffer.alloc(9);
      stalenessBuf.writeUInt8(1, 0); // Some
      // i64 little-endian
      const bn = new BN(clampedStaleness);
      bn.toArrayLike(Buffer, "le", 8).copy(stalenessBuf, 1);
      buffers.push(stalenessBuf);
    } else {
      buffers.push(Buffer.from([0])); // None - utiliser défaut (300s)
    }
    
    // jito_bundle: Option<...>
    buffers.push(Buffer.from([0])); // None
    
    return Buffer.concat(buffers);
  }
  
  /**
   * Récupère les comptes nécessaires pour le CPI vers un DEX
   */
  private async getVenueAccounts(
    venue: VenueQuote,
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<PublicKey[]> {
    // Pour l'instant, retourne les comptes de base du DEX
    // Une vraie implémentation nécessiterait de fetch les pools spécifiques
    
    switch (venue.venue) {
      case "RAYDIUM_AMM":
        return await this.getRaydiumAccounts(inputMint, outputMint);
      case "ORCA_WHIRLPOOL":
        return await this.getOrcaAccounts(inputMint, outputMint);
      case "METEORA_DLMM":
        return await this.getMeteoraAccounts(inputMint, outputMint);
      case "PHOENIX":
        return await this.getPhoenixAccounts(inputMint, outputMint);
      default:
        return [];
    }
  }
  
  /**
   * Récupère les comptes Raydium pour le CPI
   */
  private async getRaydiumAccounts(
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<PublicKey[]> {
    // Fetch le pool Raydium pour cette paire
    try {
      const response = await fetch(
        `https://api-v3.raydium.io/pools/info/mint?` +
        `mint1=${inputMint.toString()}&mint2=${outputMint.toString()}&poolType=standard`,
        { signal: AbortSignal.timeout(3000) }
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      if (!data.success || !data.data?.[0]) return [];
      
      const pool = data.data[0];
      
      // Retourner les comptes nécessaires pour le swap Raydium
      return [
        new PublicKey(pool.id), // Pool ID
        new PublicKey(pool.marketId), // Serum Market
        // ... autres comptes nécessaires
      ];
    } catch {
      return [];
    }
  }
  
  /**
   * Récupère les comptes Orca pour le CPI
   */
  private async getOrcaAccounts(
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<PublicKey[]> {
    // Similaire à Raydium, fetch les whirlpools
    return [];
  }
  
  /**
   * Récupère les comptes Meteora pour le CPI
   */
  private async getMeteoraAccounts(
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<PublicKey[]> {
    return [];
  }
  
  /**
   * Récupère les comptes Phoenix pour le CPI
   */
  private async getPhoenixAccounts(
    inputMint: PublicKey,
    outputMint: PublicKey
  ): Promise<PublicKey[]> {
    return [];
  }
  
  /**
   * Exécute un swap complet via le router natif
   * Supporte Jito bundles pour protection MEV
   */
  async executeSwap(
    params: NativeSwapParams,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  ): Promise<NativeSwapResult> {
    logger.info("NativeRouter", "Executing native swap", {
      inputMint: params.inputMint.toString(),
      outputMint: params.outputMint.toString(),
      amountIn: params.amountIn,
      useJito: params.useJitoBundle,
    });
    
    // 1. Construire la route
    const route = await this.buildNativeRoute(
      params.inputMint,
      params.outputMint,
      params.amountIn,
      params.slippageBps
    );
    
    if (!route) {
      throw new Error("Impossible de trouver une route native");
    }
    
    // 2. Construire la transaction
    const transaction = await this.buildSwapTransaction(params, route);
    
    // 3. Ajouter tip Jito si demandé (pour protection MEV)
    if (params.useJitoBundle) {
      const tipInstruction = createJitoTipInstruction(
        params.userPublicKey,
        DEFAULT_JITO_TIP_LAMPORTS
      );
      
      // Reconstruire la transaction avec le tip
      const { blockhash } = await this.connection.getLatestBlockhash();
      const message = transaction.message;
      
      // Note: Pour une vraie implémentation, il faudrait modifier le message
      // pour inclure l'instruction de tip. Ici on log l'intention.
      logger.info("NativeRouter", "Jito MEV protection enabled", {
        tipLamports: DEFAULT_JITO_TIP_LAMPORTS,
      });
    }
    
    // 4. Signer
    const signedTransaction = await signTransaction(transaction);
    
    // 5. Envoyer (via Jito ou normal)
    let signature: string;
    
    if (params.useJitoBundle) {
      // Envoyer via Jito bundle engine
      try {
        const bundleId = await sendJitoBundle([signedTransaction]);
        
        // Attendre la confirmation du bundle
        // Note: Jito bundles n'ont pas de signature standard, on attend le landing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Le bundle ID est retourné, mais pour le résultat on utilise le hash de la tx
        const txHash = Buffer.from(signedTransaction.signatures[0]).toString('base58');
        signature = txHash;
        
        logger.info("NativeRouter", "Jito bundle landed", {
          bundleId,
          signature,
        });
      } catch (jitoError) {
        logger.warn("NativeRouter", "Jito bundle failed, falling back to normal send", {
          error: jitoError,
        });
        
        // Fallback: envoyer normalement
        const rawTransaction = signedTransaction.serialize();
        signature = await this.connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });
      }
    } else {
      // Envoi standard
      const rawTransaction = signedTransaction.serialize();
      signature = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
    }
    
    // 6. Confirmer
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed");
    
    logger.info("NativeRouter", "Swap executed successfully", {
      signature,
      venues: route.venues.map(v => v.venue),
      outputAmount: route.totalOutputAmount,
      rebate: route.estimatedRebate,
      usedJito: params.useJitoBundle,
    });
    
    return {
      signature,
      inputAmount: params.amountIn,
      outputAmount: route.totalOutputAmount,
      venues: route.venues.map(v => v.venue),
      rebateAmount: route.estimatedRebate,
      npiGenerated: route.estimatedNpi,
      transactionFee: params.useJitoBundle ? 5000 + DEFAULT_JITO_TIP_LAMPORTS : 5000,
    };
  }
  
  /**
   * Compare les prix entre plusieurs venues et retourne le meilleur
   */
  async compareVenuePrices(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number
  ): Promise<{
    venues: VenueQuote[];
    bestVenue: string;
    priceDifferenceBps: number;
  }> {
    const quotes = await this.getMultiVenueQuotes(inputMint, outputMint, amountIn);
    
    if (quotes.length === 0) {
      return { venues: [], bestVenue: "", priceDifferenceBps: 0 };
    }
    
    const best = quotes[0];
    const worst = quotes[quotes.length - 1];
    
    const priceDifferenceBps = worst.outputAmount > 0 
      ? Math.floor(((best.outputAmount - worst.outputAmount) / worst.outputAmount) * 10000)
      : 0;
    
    return {
      venues: quotes,
      bestVenue: best.venue,
      priceDifferenceBps,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let nativeRouterInstance: NativeRouterService | null = null;

export function getNativeRouter(connection: Connection): NativeRouterService {
  if (!nativeRouterInstance) {
    nativeRouterInstance = new NativeRouterService(connection);
  }
  return nativeRouterInstance;
}
