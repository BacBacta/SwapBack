/**
 * 🎯 Real-Time Slippage Estimator
 * 
 * Estimation avancée du slippage avec:
 * - EMA (Exponential Moving Average) sur les historiques d'exécution
 * - Facteurs de volatilité en temps réel
 * - Ajustement par taille du trade
 * - Correction par liquidité du pool
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { PublicKey, Connection } from "@solana/web3.js";
import { SLIPPAGE_CONFIG } from "../headless/router";

// ============================================================================
// TYPES
// ============================================================================

export interface SlippageObservation {
  timestamp: number;
  expectedOutput: number;
  actualOutput: number;
  slippageBps: number;
  tradeSize: number;
  poolTvl: number;
  venue: string;
}

export interface SlippageEstimate {
  /** Slippage recommandé en bps (ex: 50 = 0.5%) */
  recommendedSlippageBps: number;
  /** Slippage minimum pour garantir l'exécution */
  minimumSlippageBps: number;
  /** Slippage maximum suggéré (au-delà = risque MEV) */
  maximumSlippageBps: number;
  /** Niveau de confiance (0-100) */
  confidence: number;
  /** Facteurs contributifs */
  breakdown: {
    base: number;
    volatility: number;
    tradeSize: number;
    liquidity: number;
    emaHistory: number;
  };
  /** Avertissements éventuels */
  warnings: string[];
}

export interface VolatilityData {
  current1h: number;  // Volatilité sur 1h en bps
  current24h: number; // Volatilité sur 24h en bps
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface PoolLiquidityData {
  tvl: number;
  depth: {
    bid: number;  // Liquidité côté achat en USD
    ask: number;  // Liquidité côté vente en USD
  };
  utilization: number; // 0-100%
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EMA_ALPHA = 0.3; // Facteur de lissage EMA (plus haut = plus réactif)
const MAX_OBSERVATIONS = 100; // Historique max par paire
const OBSERVATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_VOLATILITY_BPS = 100; // 1%
const HIGH_VOLATILITY_THRESHOLD = 300; // 3%
const LOW_LIQUIDITY_THRESHOLD_USD = 100_000; // $100k

// Limites de slippage
const ABSOLUTE_MIN_SLIPPAGE_BPS = 10;   // 0.1%
const ABSOLUTE_MAX_SLIPPAGE_BPS = 1000; // 10%

// ============================================================================
// SLIPPAGE ESTIMATOR
// ============================================================================

export class RealTimeSlippageEstimator {
  private observations: Map<string, SlippageObservation[]> = new Map();
  private emaValues: Map<string, number> = new Map();
  private volatilityCache: Map<string, { data: VolatilityData; timestamp: number }> = new Map();
  private connection: Connection | null = null;
  
  constructor(connection?: Connection) {
    this.connection = connection || null;
  }
  
  /**
   * Génère une clé unique pour une paire de tokens
   */
  private getPairKey(inputMint: string, outputMint: string): string {
    // Toujours ordonner pour avoir la même clé quelle que soit la direction
    return [inputMint, outputMint].sort().join(":");
  }
  
  /**
   * Enregistre une observation de slippage après un swap
   * Utilisé pour améliorer les estimations futures
   */
  recordObservation(observation: SlippageObservation): void {
    const key = observation.venue; // Par venue pour plus de précision
    
    let observations = this.observations.get(key) || [];
    
    // Ajouter la nouvelle observation
    observations.push(observation);
    
    // Nettoyer les anciennes observations
    const cutoff = Date.now() - OBSERVATION_TTL_MS;
    observations = observations.filter(o => o.timestamp > cutoff);
    
    // Limiter la taille
    if (observations.length > MAX_OBSERVATIONS) {
      observations = observations.slice(-MAX_OBSERVATIONS);
    }
    
    this.observations.set(key, observations);
    
    // Mettre à jour l'EMA
    this.updateEMA(key, observation.slippageBps);
  }
  
  /**
   * Met à jour l'EMA du slippage pour une venue
   */
  private updateEMA(key: string, newSlippageBps: number): void {
    const currentEma = this.emaValues.get(key) ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
    const newEma = EMA_ALPHA * newSlippageBps + (1 - EMA_ALPHA) * currentEma;
    this.emaValues.set(key, newEma);
  }
  
  /**
   * Récupère l'EMA actuelle pour une venue
   */
  getEMA(venue: string): number {
    return this.emaValues.get(venue) ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
  }
  
  /**
   * Récupère la volatilité d'un token (avec cache)
   */
  async getVolatility(tokenMint: string): Promise<VolatilityData> {
    const cached = this.volatilityCache.get(tokenMint);
    const now = Date.now();
    
    // Cache de 5 minutes
    if (cached && now - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
    
    try {
      // Essayer de récupérer la volatilité depuis notre API proxy
      const response = await fetch(`/api/volatility?mint=${tokenMint}`, {
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const volatilityData: VolatilityData = {
          current1h: data.volatility1h ?? DEFAULT_VOLATILITY_BPS,
          current24h: data.volatility24h ?? DEFAULT_VOLATILITY_BPS,
          trend: data.trend ?? 'stable',
        };
        
        this.volatilityCache.set(tokenMint, { data: volatilityData, timestamp: now });
        return volatilityData;
      }
    } catch {
      // Fallback sur estimation par défaut
    }
    
    // Estimation par défaut basée sur le type de token
    const stablecoins = [
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    ];
    
    if (stablecoins.includes(tokenMint)) {
      return { current1h: 5, current24h: 10, trend: 'stable' };
    }
    
    // SOL
    if (tokenMint === "So11111111111111111111111111111111111111112") {
      return { current1h: 100, current24h: 200, trend: 'stable' };
    }
    
    // Token inconnu = plus volatile
    return { current1h: DEFAULT_VOLATILITY_BPS, current24h: DEFAULT_VOLATILITY_BPS * 2, trend: 'stable' };
  }
  
  /**
   * Estime la liquidité d'un pool pour une paire
   */
  async estimatePoolLiquidity(
    inputMint: string,
    outputMint: string,
    venue: string
  ): Promise<PoolLiquidityData> {
    try {
      // Essayer de récupérer la liquidité depuis l'API venue
      const response = await fetch(
        `/api/pool-liquidity?inputMint=${inputMint}&outputMint=${outputMint}&venue=${venue}`,
        { signal: AbortSignal.timeout(3000) }
      );
      
      if (response.ok) {
        const data = await response.json();
        return {
          tvl: data.tvl ?? 1_000_000, // Default 1M
          depth: {
            bid: data.bidDepth ?? 100_000,
            ask: data.askDepth ?? 100_000,
          },
          utilization: data.utilization ?? 50,
        };
      }
    } catch {
      // Fallback sur estimation conservatrice
    }
    
    // Estimation par défaut conservatrice
    return {
      tvl: 1_000_000, // $1M TVL par défaut
      depth: { bid: 100_000, ask: 100_000 },
      utilization: 50,
    };
  }
  
  /**
   * Calcule le slippage recommandé avec tous les facteurs
   */
  async estimateSlippage(
    inputMint: string,
    outputMint: string,
    amountIn: number,
    venue: string
  ): Promise<SlippageEstimate> {
    const warnings: string[] = [];
    
    // 1. Récupérer la volatilité
    const volatility = await this.getVolatility(inputMint);
    
    // 2. Récupérer la liquidité
    const liquidity = await this.estimatePoolLiquidity(inputMint, outputMint, venue);
    
    // 3. Récupérer l'EMA historique
    const emaSlippage = this.getEMA(venue);
    
    // 4. Calculer chaque composante
    
    // Base: slippage minimum
    const baseComponent = SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
    
    // Volatilité: ajouter slippage si marché volatile
    let volatilityComponent = 0;
    if (volatility.current1h > HIGH_VOLATILITY_THRESHOLD) {
      volatilityComponent = Math.floor(volatility.current1h / 5);
      warnings.push(`Haute volatilité détectée (${volatility.current1h / 100}%)`);
    } else {
      volatilityComponent = Math.floor(volatility.current1h / SLIPPAGE_CONFIG.VOLATILITY_DIVISOR);
    }
    
    // Ajustement par tendance de volatilité
    if (volatility.trend === 'increasing') {
      volatilityComponent = Math.floor(volatilityComponent * 1.5);
      warnings.push('Volatilité en hausse');
    }
    
    // Taille du trade: impact si > seuil de la liquidité
    let tradeSizeComponent = 0;
    if (liquidity.tvl > 0) {
      const sizeRatioBps = Math.floor((amountIn / liquidity.tvl) * 10000);
      tradeSizeComponent = Math.max(0, sizeRatioBps - SLIPPAGE_CONFIG.SIZE_THRESHOLD_BPS);
      
      if (sizeRatioBps > 500) { // Trade > 5% du pool
        warnings.push(`Trade important (${(sizeRatioBps / 100).toFixed(1)}% du pool)`);
      }
    }
    
    // Liquidité: ajouter slippage si pool peu liquide
    let liquidityComponent = 0;
    if (liquidity.tvl < LOW_LIQUIDITY_THRESHOLD_USD) {
      liquidityComponent = Math.floor(100 * (LOW_LIQUIDITY_THRESHOLD_USD / Math.max(liquidity.tvl, 10_000)));
      warnings.push(`Pool peu liquide ($${(liquidity.tvl / 1000).toFixed(0)}k TVL)`);
    }
    
    // EMA historique: ajuster vers la moyenne historique
    let emaComponent = 0;
    if (emaSlippage > SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS) {
      // L'historique montre un slippage plus élevé que la base
      emaComponent = Math.floor((emaSlippage - SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS) * 0.5);
    }
    
    // 5. Calcul du slippage recommandé
    const totalRaw = baseComponent + volatilityComponent + tradeSizeComponent + liquidityComponent + emaComponent;
    
    // 6. Clamping
    const recommendedSlippageBps = Math.min(
      Math.max(totalRaw, ABSOLUTE_MIN_SLIPPAGE_BPS),
      SLIPPAGE_CONFIG.MAX_SLIPPAGE_BPS
    );
    
    // Minimum = base + volatilité (incompressible)
    const minimumSlippageBps = Math.max(
      baseComponent + volatilityComponent,
      ABSOLUTE_MIN_SLIPPAGE_BPS
    );
    
    // Maximum = ne pas dépasser pour éviter MEV
    const maximumSlippageBps = Math.min(
      recommendedSlippageBps * 2,
      ABSOLUTE_MAX_SLIPPAGE_BPS
    );
    
    // 7. Niveau de confiance
    // Plus on a d'observations, plus la confiance est haute
    const observations = this.observations.get(venue)?.length ?? 0;
    const baseConfidence = 50; // Confiance de base
    const observationBonus = Math.min(observations, 50); // Max +50% pour 50 observations
    const confidence = Math.min(baseConfidence + observationBonus, 100);
    
    return {
      recommendedSlippageBps,
      minimumSlippageBps,
      maximumSlippageBps,
      confidence,
      breakdown: {
        base: baseComponent,
        volatility: volatilityComponent,
        tradeSize: tradeSizeComponent,
        liquidity: liquidityComponent,
        emaHistory: emaComponent,
      },
      warnings,
    };
  }
  
  /**
   * Validation post-swap: vérifie si le slippage réel était dans les attentes
   */
  validateExecution(
    expectedOutput: number,
    actualOutput: number,
    usedSlippageBps: number
  ): {
    success: boolean;
    actualSlippageBps: number;
    withinTolerance: boolean;
    message: string;
  } {
    if (!Number.isFinite(expectedOutput) || expectedOutput <= 0) {
      return {
        success: false,
        actualSlippageBps: 0,
        withinTolerance: false,
        message: "Invalid expected output",
      };
    }

    const actualSlippageBps = Math.floor(((expectedOutput - actualOutput) / expectedOutput) * 10000);
    
    const withinTolerance = actualSlippageBps <= usedSlippageBps;
    
    let message: string;
    if (actualSlippageBps < 0) {
      message = `Positive slippage: received ${(-actualSlippageBps / 100).toFixed(2)}% more than expected`;
    } else if (withinTolerance) {
      message = `Slippage within tolerance: ${(actualSlippageBps / 100).toFixed(2)}% (max: ${(usedSlippageBps / 100).toFixed(2)}%)`;
    } else {
      message = `Slippage exceeded: ${(actualSlippageBps / 100).toFixed(2)}% > ${(usedSlippageBps / 100).toFixed(2)}%`;
    }
    
    return {
      success: withinTolerance,
      actualSlippageBps: Math.max(actualSlippageBps, 0),
      withinTolerance,
      message,
    };
  }
  
  /**
   * Réinitialise le cache (pour tests)
   */
  reset(): void {
    this.observations.clear();
    this.emaValues.clear();
    this.volatilityCache.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let slippageEstimatorInstance: RealTimeSlippageEstimator | null = null;

export function getSlippageEstimator(connection?: Connection): RealTimeSlippageEstimator {
  if (!slippageEstimatorInstance) {
    slippageEstimatorInstance = new RealTimeSlippageEstimator(connection);
  }
  return slippageEstimatorInstance;
}

export default RealTimeSlippageEstimator;
