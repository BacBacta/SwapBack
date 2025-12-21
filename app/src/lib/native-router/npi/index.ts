/**
 * 💰 NPI (Native Price Improvement) Module
 *
 * L'avantage compétitif unique de SwapBack:
 * - 70% des gains de routing redistribués aux utilisateurs
 * - 15% pour la plateforme
 * - 15% pour le boost pool communautaire
 *
 * Ce module calcule et distribue les améliorations de prix obtenues
 * par le routing optimisé par rapport à un swap simple.
 *
 * @see https://station.jup.ag/docs/apis/swap-api - Jupiter baseline
 * @author SwapBack Team
 * @date December 21, 2025
 */

// ============================================================================
// TYPES
// ============================================================================

export interface NPIDistribution {
  /** Rebate utilisateur: 70% du NPI */
  userRebateBps: number;
  /** Fee plateforme: 15% du NPI */
  platformFeeBps: number;
  /** Contribution boost pool: 15% du NPI */
  boostPoolBps: number;
}

export interface NPIResult {
  /** Output qu'aurait obtenu l'utilisateur sans optimisation (direct route) */
  baseOutput: number;
  /** Output obtenu avec le routing SwapBack optimisé */
  optimizedOutput: number;
  /** Différence brute (optimized - base) */
  improvement: number;
  /** Amélioration en basis points */
  improvementBps: number;
  /** Rebate versé à l'utilisateur (70% de improvement) */
  userRebate: number;
  /** Fee pour la plateforme (15% de improvement) */
  platformFee: number;
  /** Contribution au boost pool (15% de improvement) */
  boostPool: number;
  /** Output final que reçoit l'utilisateur (optimizedOutput) */
  userFinalOutput: number;
  /** Comparaison vs Jupiter */
  vsJupiter?: {
    jupiterOutput: number;
    deltaBps: number;
    advantage: 'SWAPBACK' | 'JUPITER' | 'TIE';
  };
}

export interface NPIConfig {
  /** Distribution du NPI */
  distribution: NPIDistribution;
  /** Seuil minimum d'amélioration pour activer le NPI (en bps) */
  minImprovementBps: number;
  /** Activer le calcul NPI */
  enabled: boolean;
}

export interface SwapComparison {
  swapback: {
    output: number;
    rebate: number;
    totalValue: number;
  };
  jupiter: {
    output: number;
  };
  advantage: {
    outputDelta: number;
    outputDeltaBps: number;
    withRebate: number;
    withRebateBps: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Distribution par défaut du NPI */
export const DEFAULT_NPI_DISTRIBUTION: NPIDistribution = {
  userRebateBps: 7000, // 70%
  platformFeeBps: 1500, // 15%
  boostPoolBps: 1500,  // 15%
};

/** Configuration par défaut */
export const DEFAULT_NPI_CONFIG: NPIConfig = {
  distribution: DEFAULT_NPI_DISTRIBUTION,
  minImprovementBps: 5, // Min 0.05% d'amélioration pour activer NPI
  enabled: true,
};

// ============================================================================
// NPI CALCULATOR
// ============================================================================

export class NPICalculator {
  private config: NPIConfig;

  constructor(config: Partial<NPIConfig> = {}) {
    this.config = { ...DEFAULT_NPI_CONFIG, ...config };
  }

  /**
   * Calcule le NPI (Native Price Improvement)
   *
   * @param directQuote - Ce que l'utilisateur aurait obtenu sans optimisation
   * @param optimizedQuote - Ce que SwapBack obtient via routing optimisé
   * @returns Résultat NPI avec distribution
   */
  calculate(directQuote: number, optimizedQuote: number): NPIResult {
    const improvement = optimizedQuote - directQuote;
    const improvementBps = directQuote > 0
      ? Math.round((improvement / directQuote) * 10000)
      : 0;

    // Pas d'amélioration ou amélioration trop faible
    if (!this.config.enabled || improvement <= 0 || improvementBps < this.config.minImprovementBps) {
      return {
        baseOutput: directQuote,
        optimizedOutput: optimizedQuote,
        improvement: 0,
        improvementBps: 0,
        userRebate: 0,
        platformFee: 0,
        boostPool: 0,
        userFinalOutput: optimizedQuote,
      };
    }

    // Distribution du NPI
    const { distribution } = this.config;
    const totalBps = distribution.userRebateBps + distribution.platformFeeBps + distribution.boostPoolBps;

    const userRebate = Math.floor((improvement * distribution.userRebateBps) / totalBps);
    const platformFee = Math.floor((improvement * distribution.platformFeeBps) / totalBps);
    const boostPool = improvement - userRebate - platformFee; // Le reste va au boost pool

    return {
      baseOutput: directQuote,
      optimizedOutput: optimizedQuote,
      improvement,
      improvementBps,
      userRebate,
      platformFee,
      boostPool,
      userFinalOutput: optimizedQuote, // L'utilisateur reçoit l'output optimisé complet
    };
  }

  /**
   * Calcule le NPI avec comparaison Jupiter
   */
  async calculateWithJupiterComparison(
    directQuote: number,
    optimizedQuote: number,
    jupiterQuote: number
  ): Promise<NPIResult> {
    const baseResult = this.calculate(directQuote, optimizedQuote);

    // Comparaison avec Jupiter
    const deltaBps = jupiterQuote > 0
      ? Math.round(((optimizedQuote - jupiterQuote) / jupiterQuote) * 10000)
      : 0;

    let advantage: 'SWAPBACK' | 'JUPITER' | 'TIE' = 'TIE';
    if (deltaBps > 5) advantage = 'SWAPBACK';
    else if (deltaBps < -5) advantage = 'JUPITER';

    return {
      ...baseResult,
      vsJupiter: {
        jupiterOutput: jupiterQuote,
        deltaBps,
        advantage,
      },
    };
  }

  /**
   * Génère une comparaison détaillée pour l'affichage UI
   */
  generateComparison(
    swapbackOutput: number,
    jupiterOutput: number,
    npi: NPIResult
  ): SwapComparison {
    const outputDelta = swapbackOutput - jupiterOutput;
    const outputDeltaBps = jupiterOutput > 0
      ? Math.round((outputDelta / jupiterOutput) * 10000)
      : 0;

    const totalValueWithRebate = swapbackOutput + npi.userRebate;
    const withRebateDelta = totalValueWithRebate - jupiterOutput;
    const withRebateBps = jupiterOutput > 0
      ? Math.round((withRebateDelta / jupiterOutput) * 10000)
      : 0;

    return {
      swapback: {
        output: swapbackOutput,
        rebate: npi.userRebate,
        totalValue: totalValueWithRebate,
      },
      jupiter: {
        output: jupiterOutput,
      },
      advantage: {
        outputDelta,
        outputDeltaBps,
        withRebate: withRebateDelta,
        withRebateBps,
      },
    };
  }

  /**
   * Formate le NPI pour l'affichage
   */
  formatForDisplay(npi: NPIResult, outputSymbol: string = 'tokens'): NPIDisplayInfo {
    const formatAmount = (amount: number, decimals: number = 6): string => {
      return (amount / Math.pow(10, decimals)).toFixed(4);
    };

    return {
      hasImprovement: npi.improvement > 0,
      improvementText: npi.improvement > 0
        ? `+${formatAmount(npi.improvement)} ${outputSymbol} (+${(npi.improvementBps / 100).toFixed(2)}%)`
        : 'No improvement',
      rebateText: npi.userRebate > 0
        ? `+${formatAmount(npi.userRebate)} ${outputSymbol} rebate`
        : null,
      comparisonText: npi.vsJupiter
        ? this.formatJupiterComparison(npi.vsJupiter, outputSymbol)
        : null,
    };
  }

  private formatJupiterComparison(
    vsJupiter: NonNullable<NPIResult['vsJupiter']>,
    symbol: string
  ): string {
    const sign = vsJupiter.deltaBps >= 0 ? '+' : '';
    const pct = (vsJupiter.deltaBps / 100).toFixed(2);
    
    if (vsJupiter.advantage === 'SWAPBACK') {
      return `${sign}${pct}% vs Jupiter ✅`;
    } else if (vsJupiter.advantage === 'JUPITER') {
      return `${sign}${pct}% vs Jupiter ⚠️`;
    }
    return `Same as Jupiter (${sign}${pct}%)`;
  }
}

// ============================================================================
// TYPES POUR L'AFFICHAGE
// ============================================================================

export interface NPIDisplayInfo {
  hasImprovement: boolean;
  improvementText: string;
  rebateText: string | null;
  comparisonText: string | null;
}

// ============================================================================
// MEV PROTECTION
// ============================================================================

export interface MEVProtectionConfig {
  useJito: boolean;
  tipLamports: number;
  usePrivatePool: boolean;
  maxSlippageForMEV: number;
}

export const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export const DEFAULT_MEV_CONFIG: MEVProtectionConfig = {
  useJito: true,
  tipLamports: 10000, // 0.00001 SOL tip
  usePrivatePool: false, // À activer pour les gros swaps
  maxSlippageForMEV: 50, // 0.5%
};

/**
 * Sélectionne un compte de tip Jito aléatoirement
 */
export function getRandomJitoTipAccount(): string {
  const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return JITO_TIP_ACCOUNTS[index];
}

/**
 * Calcule le tip recommandé basé sur la taille du swap
 */
export function calculateRecommendedTip(swapValueUsd: number): number {
  // Tip minimal pour petits swaps
  if (swapValueUsd < 100) {
    return 5000; // 0.000005 SOL
  }
  
  // Tip standard pour swaps moyens
  if (swapValueUsd < 1000) {
    return 10000; // 0.00001 SOL
  }
  
  // Tip plus élevé pour gros swaps (plus de MEV potentiel)
  if (swapValueUsd < 10000) {
    return 50000; // 0.00005 SOL
  }
  
  // Tip premium pour très gros swaps
  return 100000; // 0.0001 SOL
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

let globalNPICalculator: NPICalculator | null = null;

export function getNPICalculator(): NPICalculator {
  if (!globalNPICalculator) {
    globalNPICalculator = new NPICalculator();
  }
  return globalNPICalculator;
}

export function resetNPICalculator(): void {
  globalNPICalculator = null;
}

export default {
  NPICalculator,
  getNPICalculator,
  resetNPICalculator,
  DEFAULT_NPI_DISTRIBUTION,
  DEFAULT_NPI_CONFIG,
  DEFAULT_MEV_CONFIG,
  JITO_TIP_ACCOUNTS,
  getRandomJitoTipAccount,
  calculateRecommendedTip,
};
