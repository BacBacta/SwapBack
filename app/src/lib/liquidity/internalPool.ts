/**
 * Internal Liquidity Pool Manager
 * Gère la liquidité interne SwapBack pour capturer plus de volume
 */

import { PublicKey, Connection } from "@solana/web3.js";

export interface LiquidityPosition {
  owner: string;
  tokenMint: string;
  amount: number;
  depositTimestamp: number;
  earnedRewards: number;
  lockDurationDays: number;
}

export interface PoolStats {
  tokenMint: string;
  symbol: string;
  totalLiquidity: number;
  utilizationRate: number;
  apr: number;
  providers: number;
  volume24h: number;
}

export interface SwapOpportunity {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  savings: number; // vs external DEX
  rebateAmount: number;
}

// Tokens supportés par les pools internes
const SUPPORTED_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", decimals: 9 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", decimals: 6 },
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": { symbol: "JUP", decimals: 6 },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", decimals: 5 },
};

export interface InternalPoolConfig {
  /** APR de base pour les LPs (annualisé) */
  baseAprPercent: number;
  /** Bonus APR pour lock long terme */
  lockBonusPerMonth: number;
  /** Frais de swap interne (bps) */
  swapFeeBps: number;
  /** % des frais redistribués aux LPs */
  lpFeeShare: number;
  /** % des frais pour buyback $BACK */
  buybackShare: number;
  /** Rebate utilisateur (% des économies vs DEX externe) */
  userRebatePercent: number;
}

const DEFAULT_CONFIG: InternalPoolConfig = {
  baseAprPercent: 8,
  lockBonusPerMonth: 0.5, // +0.5% par mois de lock
  swapFeeBps: 5, // 0.05% - très compétitif
  lpFeeShare: 0.6, // 60% aux LPs
  buybackShare: 0.3, // 30% buyback $BACK
  userRebatePercent: 0.7, // 70% des économies redistribuées
};

export class InternalLiquidityPool {
  private positions: Map<string, LiquidityPosition[]> = new Map();
  private poolBalances: Map<string, number> = new Map();
  private volume24h: Map<string, number> = new Map();
  private config: InternalPoolConfig;
  private connection: Connection | null = null;

  constructor(config: Partial<InternalPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initPools();
  }

  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  private initPools(): void {
    // Initialiser les pools pour chaque token supporté
    for (const mint of Object.keys(SUPPORTED_TOKENS)) {
      this.poolBalances.set(mint, 0);
      this.volume24h.set(mint, 0);
    }
  }

  /**
   * Vérifie si un swap peut être exécuté en interne
   */
  canExecuteInternally(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): boolean {
    // Vérifier que les deux tokens sont supportés
    if (!SUPPORTED_TOKENS[inputMint] || !SUPPORTED_TOKENS[outputMint]) {
      return false;
    }

    // Vérifier la liquidité disponible
    const outputBalance = this.poolBalances.get(outputMint) || 0;
    const estimatedOutput = this.estimateOutput(inputMint, outputMint, inputAmount);
    
    return outputBalance >= estimatedOutput * 1.1; // 10% buffer
  }

  /**
   * Estime le output pour un swap interne
   */
  estimateOutput(inputMint: string, outputMint: string, inputAmount: number): number {
    // Utiliser un oracle price feed (simplifié ici)
    const prices: Record<string, number> = {
      "So11111111111111111111111111111111111111112": 180, // SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1, // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 1, // USDT
      "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": 0.85, // JUP
      "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": 0.000025, // BONK
    };

    const inputPrice = prices[inputMint] || 0;
    const outputPrice = prices[outputMint] || 0;

    if (!inputPrice || !outputPrice) return 0;

    const feeMultiplier = 1 - this.config.swapFeeBps / 10000;
    return (inputAmount * inputPrice / outputPrice) * feeMultiplier;
  }

  /**
   * Calcule les économies vs DEX externe
   */
  calculateSavings(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    externalOutput: number
  ): SwapOpportunity {
    const internalOutput = this.estimateOutput(inputMint, outputMint, inputAmount);
    const savings = internalOutput - externalOutput;
    const rebateAmount = savings > 0 ? savings * this.config.userRebatePercent : 0;

    return {
      inputMint,
      outputMint,
      inputAmount,
      outputAmount: internalOutput,
      priceImpact: 0.001, // Impact très faible pour pools internes
      savings: Math.max(0, savings),
      rebateAmount,
    };
  }

  /**
   * Exécute un swap interne (simulation)
   */
  async executeInternalSwap(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    minOutput: number
  ): Promise<{ success: boolean; outputAmount: number; signature?: string }> {
    if (!this.canExecuteInternally(inputMint, outputMint, inputAmount)) {
      return { success: false, outputAmount: 0 };
    }

    const outputAmount = this.estimateOutput(inputMint, outputMint, inputAmount);
    if (outputAmount < minOutput) {
      return { success: false, outputAmount };
    }

    // Mettre à jour les balances
    const currentInput = this.poolBalances.get(inputMint) || 0;
    const currentOutput = this.poolBalances.get(outputMint) || 0;

    this.poolBalances.set(inputMint, currentInput + inputAmount);
    this.poolBalances.set(outputMint, currentOutput - outputAmount);

    // Mettre à jour le volume
    const vol = this.volume24h.get(inputMint) || 0;
    this.volume24h.set(inputMint, vol + inputAmount);

    // NOTE: En production, ceci exécuterait une vraie transaction on-chain
    return {
      success: true,
      outputAmount,
      signature: `internal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }

  /**
   * Dépose de la liquidité
   */
  depositLiquidity(
    owner: string,
    tokenMint: string,
    amount: number,
    lockDays: number = 0
  ): LiquidityPosition | null {
    if (!SUPPORTED_TOKENS[tokenMint]) return null;

    const position: LiquidityPosition = {
      owner,
      tokenMint,
      amount,
      depositTimestamp: Date.now(),
      earnedRewards: 0,
      lockDurationDays: lockDays,
    };

    const ownerPositions = this.positions.get(owner) || [];
    ownerPositions.push(position);
    this.positions.set(owner, ownerPositions);

    // Mettre à jour le pool
    const current = this.poolBalances.get(tokenMint) || 0;
    this.poolBalances.set(tokenMint, current + amount);

    return position;
  }

  /**
   * Retire de la liquidité
   */
  withdrawLiquidity(owner: string, tokenMint: string, amount: number): boolean {
    const ownerPositions = this.positions.get(owner) || [];
    const position = ownerPositions.find(p => p.tokenMint === tokenMint);
    
    if (!position) return false;

    // Vérifier le lock
    const lockEndTime = position.depositTimestamp + position.lockDurationDays * 24 * 60 * 60 * 1000;
    if (Date.now() < lockEndTime) {
      return false; // Still locked
    }

    if (position.amount < amount) return false;

    position.amount -= amount;
    const current = this.poolBalances.get(tokenMint) || 0;
    this.poolBalances.set(tokenMint, Math.max(0, current - amount));

    return true;
  }

  /**
   * Calcule les rewards d'un LP
   */
  calculateRewards(owner: string): { tokenMint: string; rewards: number }[] {
    const ownerPositions = this.positions.get(owner) || [];
    const results: { tokenMint: string; rewards: number }[] = [];

    for (const position of ownerPositions) {
      const daysStaked = (Date.now() - position.depositTimestamp) / (24 * 60 * 60 * 1000);
      const lockBonus = Math.min(position.lockDurationDays, 12) * this.config.lockBonusPerMonth;
      const effectiveApr = this.config.baseAprPercent + lockBonus;
      
      const rewards = position.amount * (effectiveApr / 100) * (daysStaked / 365);
      results.push({ tokenMint: position.tokenMint, rewards });
    }

    return results;
  }

  /**
   * Stats de tous les pools
   */
  getPoolStats(): PoolStats[] {
    const stats: PoolStats[] = [];

    for (const [mint, info] of Object.entries(SUPPORTED_TOKENS)) {
      const liquidity = this.poolBalances.get(mint) || 0;
      const volume = this.volume24h.get(mint) || 0;
      const utilizationRate = liquidity > 0 ? volume / liquidity : 0;

      // Compter les providers
      let providers = 0;
      for (const positions of this.positions.values()) {
        if (positions.some(p => p.tokenMint === mint && p.amount > 0)) {
          providers++;
        }
      }

      stats.push({
        tokenMint: mint,
        symbol: info.symbol,
        totalLiquidity: liquidity,
        utilizationRate,
        apr: this.config.baseAprPercent,
        providers,
        volume24h: volume,
      });
    }

    return stats;
  }

  /**
   * Incitation pour les early LPs
   */
  getEarlyLPBonus(depositTimestamp: number): number {
    // Bonus dégressif pour les premiers LPs
    const launchDate = new Date("2025-01-01").getTime();
    const daysSinceLaunch = (depositTimestamp - launchDate) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLaunch < 30) return 2.0; // +200% APR premier mois
    if (daysSinceLaunch < 90) return 1.5; // +150% APR 3 premiers mois
    if (daysSinceLaunch < 180) return 1.0; // +100% APR 6 premiers mois
    return 0;
  }
}

// Singleton
let globalPool: InternalLiquidityPool | null = null;

export function getInternalPool(): InternalLiquidityPool {
  if (!globalPool) {
    globalPool = new InternalLiquidityPool();
  }
  return globalPool;
}
