/**
 * 🔀 Split-Route Calculator
 *
 * Optimise la répartition du volume entre plusieurs venues pour minimiser
 * le price impact et maximiser l'output.
 *
 * Inspiré de Jupiter Metis:
 * @see https://dev.jup.ag/docs/routing
 * @see https://dev.jup.ag/blog/metis-v7
 *
 * @author SwapBack Team
 * @date December 20, 2025
 */

import { PublicKey } from "@solana/web3.js";
import { logger } from "@/lib/logger";
import {
  getRoutingConfig,
  getEnabledVenues,
  type SupportedVenue,
  type VenueConfig,
} from "@/config/routing";

// ============================================================================
// TYPES
// ============================================================================

export interface VenueQuote {
  venue: SupportedVenue;
  venueProgramId: PublicKey;
  inputAmount: number;
  outputAmount: number;
  priceImpactBps: number;
  latencyMs: number;
  /** Prix effectif (output/input) */
  effectivePrice: number;
}

export interface SplitQuote {
  /** Venue utilisée pour ce split */
  venue: SupportedVenue;
  /** Pourcentage du volume total (0-100) */
  percent: number;
  /** Montant d'entrée pour ce split */
  inputAmount: number;
  /** Montant de sortie pour ce split */
  outputAmount: number;
  /** Price impact en bps */
  priceImpactBps: number;
}

export interface OptimalRoute {
  /** Répartition optimale */
  splits: SplitQuote[];
  /** Output total */
  totalOutput: number;
  /** Input total */
  totalInput: number;
  /** Price impact moyen pondéré */
  weightedPriceImpactBps: number;
  /** Amélioration vs single best venue (en bps) */
  improvementVsSingleVenueBps: number;
  /** Meilleure venue single pour comparaison */
  bestSingleVenue: SupportedVenue | null;
  /** Output de la meilleure venue single */
  bestSingleVenueOutput: number;
  /** Nombre de venues utilisées */
  venueCount: number;
  /** Temps de calcul (ms) */
  calculationTimeMs: number;
}

export interface QuoteMatrix {
  /** Map: venue → Map: fraction → quote */
  quotes: Map<SupportedVenue, Map<number, VenueQuote>>;
  /** Fractions testées */
  fractions: number[];
  /** Montant total */
  totalAmount: number;
}

// Type pour la fonction de quote externe
export type QuoteFetcher = (
  venue: SupportedVenue,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number
) => Promise<VenueQuote | null>;

// ============================================================================
// SPLIT-ROUTE CALCULATOR
// ============================================================================

/**
 * Calcule la route optimale avec split entre venues
 */
export class SplitRouteCalculator {
  private quoteFetcher: QuoteFetcher;

  constructor(quoteFetcher: QuoteFetcher) {
    this.quoteFetcher = quoteFetcher;
  }

  /**
   * Trouve la répartition optimale entre les venues disponibles
   *
   * Algorithme:
   * 1. Obtenir des quotes pour différentes fractions sur chaque venue
   * 2. Calculer l'output marginal pour chaque fraction
   * 3. Utiliser un algorithme greedy pour répartir optimalement
   */
  async findOptimalSplit(
    inputMint: PublicKey,
    outputMint: PublicKey,
    totalAmount: number,
    venues?: SupportedVenue[]
  ): Promise<OptimalRoute> {
    const startTime = Date.now();
    const config = getRoutingConfig();

    // Venues à utiliser
    const targetVenues = venues ?? getEnabledVenues().map((v) => v.id);

    // Fractions à tester
    const fractions = config.splitRoute.testFractions;

    logger.info("SplitRouteCalculator", "Starting optimal split calculation", {
      totalAmount,
      venues: targetVenues,
      fractions,
    });

    // 1. Construire la matrice de quotes
    const quoteMatrix = await this.buildQuoteMatrix(
      inputMint,
      outputMint,
      totalAmount,
      targetVenues,
      fractions
    );

    // 2. Trouver la meilleure venue single (baseline)
    const bestSingle = this.findBestSingleVenue(quoteMatrix);

    // 3. Optimiser le split si configuré
    let optimalSplits: SplitQuote[];
    if (config.splitRoute.enabled && config.splitRoute.maxSplits > 1) {
      optimalSplits = this.optimizeSplit(quoteMatrix, config.splitRoute.maxSplits);
    } else {
      // Mode single venue
      optimalSplits = bestSingle.quote
        ? [
            {
              venue: bestSingle.venue!,
              percent: 100,
              inputAmount: totalAmount,
              outputAmount: bestSingle.quote.outputAmount,
              priceImpactBps: bestSingle.quote.priceImpactBps,
            },
          ]
        : [];
    }

    // 4. Calculer les métriques
    const totalOutput = optimalSplits.reduce((sum, s) => sum + s.outputAmount, 0);
    const weightedPriceImpact = this.calculateWeightedPriceImpact(optimalSplits);
    const improvementBps =
      bestSingle.output > 0
        ? Math.round(((totalOutput - bestSingle.output) / bestSingle.output) * 10000)
        : 0;

    const result: OptimalRoute = {
      splits: optimalSplits,
      totalOutput,
      totalInput: totalAmount,
      weightedPriceImpactBps: weightedPriceImpact,
      improvementVsSingleVenueBps: improvementBps,
      bestSingleVenue: bestSingle.venue,
      bestSingleVenueOutput: bestSingle.output,
      venueCount: optimalSplits.length,
      calculationTimeMs: Date.now() - startTime,
    };

    logger.info("SplitRouteCalculator", "Optimal split found", {
      splits: optimalSplits.map((s) => `${s.venue}:${s.percent}%`),
      totalOutput,
      improvementBps,
      calculationTimeMs: result.calculationTimeMs,
    });

    return result;
  }

  /**
   * Construit la matrice de quotes pour toutes les combinaisons venue/fraction
   */
  private async buildQuoteMatrix(
    inputMint: PublicKey,
    outputMint: PublicKey,
    totalAmount: number,
    venues: SupportedVenue[],
    fractions: number[]
  ): Promise<QuoteMatrix> {
    const quotes = new Map<SupportedVenue, Map<number, VenueQuote>>();

    // Requêtes en parallèle avec limite de concurrence
    const config = getRoutingConfig();
    const concurrency = config.quoteConcurrency;

    const tasks: Array<{
      venue: SupportedVenue;
      fraction: number;
      amount: number;
    }> = [];

    for (const venue of venues) {
      for (const fraction of fractions) {
        const amount = Math.floor(totalAmount * fraction);
        if (amount > 0) {
          tasks.push({ venue, fraction, amount });
        }
      }
    }

    // Exécuter avec concurrence limitée
    const results = await this.executeWithConcurrency(
      tasks,
      concurrency,
      async (task) => {
        try {
          const quote = await Promise.race([
            this.quoteFetcher(task.venue, inputMint, outputMint, task.amount),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), config.quoteTimeoutMs)
            ),
          ]);
          return { ...task, quote };
        } catch (error) {
          logger.debug("SplitRouteCalculator", `Quote failed for ${task.venue}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          return { ...task, quote: null };
        }
      }
    );

    // Organiser les résultats
    for (const result of results) {
      if (result.quote) {
        if (!quotes.has(result.venue)) {
          quotes.set(result.venue, new Map());
        }
        quotes.get(result.venue)!.set(result.fraction, result.quote);
      }
    }

    return { quotes, fractions, totalAmount };
  }

  /**
   * Trouve la meilleure venue single (100% du volume)
   */
  private findBestSingleVenue(matrix: QuoteMatrix): {
    venue: SupportedVenue | null;
    quote: VenueQuote | null;
    output: number;
  } {
    let bestVenue: SupportedVenue | null = null;
    let bestQuote: VenueQuote | null = null;
    let bestOutput = 0;

    for (const [venue, fractionQuotes] of matrix.quotes) {
      const fullQuote = fractionQuotes.get(1.0);
      if (fullQuote && fullQuote.outputAmount > bestOutput) {
        bestVenue = venue;
        bestQuote = fullQuote;
        bestOutput = fullQuote.outputAmount;
      }
    }

    return { venue: bestVenue, quote: bestQuote, output: bestOutput };
  }

  /**
   * Optimise le split avec un algorithme greedy
   *
   * Stratégie: À chaque étape, ajouter la fraction qui maximise
   * l'output marginal, jusqu'au nombre maximum de splits.
   */
  private optimizeSplit(matrix: QuoteMatrix, maxSplits: number): SplitQuote[] {
    const config = getRoutingConfig();
    const minPercent = config.splitRoute.minSplitPercent;

    // Calculer les outputs marginaux pour chaque venue/fraction
    const marginalOutputs: Array<{
      venue: SupportedVenue;
      fraction: number;
      marginalOutput: number;
      quote: VenueQuote;
    }> = [];

    for (const [venue, fractionQuotes] of matrix.quotes) {
      const sortedFractions = Array.from(fractionQuotes.keys()).sort((a, b) => a - b);

      for (let i = 0; i < sortedFractions.length; i++) {
        const fraction = sortedFractions[i];
        const quote = fractionQuotes.get(fraction)!;
        const prevFraction = i > 0 ? sortedFractions[i - 1] : 0;
        const prevQuote = i > 0 ? fractionQuotes.get(prevFraction) : null;

        const marginalOutput = prevQuote
          ? quote.outputAmount - prevQuote.outputAmount
          : quote.outputAmount;

        marginalOutputs.push({
          venue,
          fraction,
          marginalOutput,
          quote,
        });
      }
    }

    // Trier par output marginal décroissant
    marginalOutputs.sort((a, b) => b.marginalOutput - a.marginalOutput);

    // Algorithme greedy: sélectionner les meilleures fractions
    const selectedSplits: Map<SupportedVenue, { fraction: number; quote: VenueQuote }> =
      new Map();
    let remainingFraction = 1.0;

    for (const item of marginalOutputs) {
      if (selectedSplits.size >= maxSplits) break;
      if (remainingFraction <= 0) break;

      const fractionToUse = Math.min(item.fraction, remainingFraction);
      if (fractionToUse * 100 < minPercent) continue;

      // Si cette venue est déjà sélectionnée, on prend la plus grande fraction
      if (selectedSplits.has(item.venue)) {
        const existing = selectedSplits.get(item.venue)!;
        if (item.fraction > existing.fraction) {
          remainingFraction += existing.fraction;
          remainingFraction -= fractionToUse;
          selectedSplits.set(item.venue, { fraction: fractionToUse, quote: item.quote });
        }
      } else {
        remainingFraction -= fractionToUse;
        selectedSplits.set(item.venue, { fraction: fractionToUse, quote: item.quote });
      }
    }

    // Normaliser les fractions pour qu'elles totalisent 100%
    const totalSelectedFraction = Array.from(selectedSplits.values()).reduce(
      (sum, s) => sum + s.fraction,
      0
    );

    const splits: SplitQuote[] = [];
    for (const [venue, data] of selectedSplits) {
      const normalizedFraction = totalSelectedFraction > 0 
        ? data.fraction / totalSelectedFraction 
        : 0;
      const percent = Math.round(normalizedFraction * 100);
      const inputAmount = Math.floor(matrix.totalAmount * normalizedFraction);

      // Interpoler l'output pour la fraction normalisée
      const outputAmount = Math.floor(data.quote.outputAmount * normalizedFraction / data.fraction);

      splits.push({
        venue,
        percent,
        inputAmount,
        outputAmount,
        priceImpactBps: data.quote.priceImpactBps,
      });
    }

    // Trier par pourcentage décroissant
    splits.sort((a, b) => b.percent - a.percent);

    return splits;
  }

  /**
   * Calcule le price impact moyen pondéré
   */
  private calculateWeightedPriceImpact(splits: SplitQuote[]): number {
    const totalInput = splits.reduce((sum, s) => sum + s.inputAmount, 0);
    if (totalInput === 0) return 0;

    const weightedSum = splits.reduce(
      (sum, s) => sum + s.priceImpactBps * s.inputAmount,
      0
    );

    return Math.round(weightedSum / totalInput);
  }

  /**
   * Exécute des tâches avec une limite de concurrence
   */
  private async executeWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await fn(items[currentIndex]);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    );

    await Promise.all(workers);
    return results;
  }
}

// ============================================================================
// JUPITER BENCHMARK
// ============================================================================

export interface JupiterBenchmarkResult {
  /** Output Jupiter */
  jupiterOutput: number;
  /** Output SwapBack */
  swapbackOutput: number;
  /** Différence en bps (positif = SwapBack meilleur) */
  differenceBps: number;
  /** SwapBack est-il meilleur? */
  isSwapbackBetter: boolean;
  /** Alerte si SwapBack est significativement pire */
  shouldAlert: boolean;
  /** Latence Jupiter (ms) */
  jupiterLatencyMs: number;
}

/**
 * Compare une route SwapBack avec Jupiter
 */
export async function benchmarkAgainstJupiter(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountIn: number,
  swapbackOutput: number
): Promise<JupiterBenchmarkResult | null> {
  const config = getRoutingConfig();
  if (!config.jupiterBenchmark.enabled) {
    return null;
  }

  try {
    const startTime = Date.now();
    const url = new URL(config.jupiterBenchmark.quoteEndpoint);
    url.searchParams.set("inputMint", inputMint.toBase58());
    url.searchParams.set("outputMint", outputMint.toBase58());
    url.searchParams.set("amount", Math.floor(amountIn).toString());
    url.searchParams.set("slippageBps", "50");

    const response = await Promise.race([
      fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(config.jupiterBenchmark.timeoutMs),
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), config.jupiterBenchmark.timeoutMs)
      ),
    ]);

    if (!response || !response.ok) {
      logger.debug("SplitRouteCalculator", "Jupiter benchmark failed", {
        status: response?.status,
      });
      return null;
    }

    const data = await response.json();
    const jupiterOutput = Number(data.outAmount || 0);
    const jupiterLatencyMs = Date.now() - startTime;

    if (!Number.isFinite(jupiterOutput) || jupiterOutput <= 0) {
      return null;
    }

    const differenceBps = Math.round(
      ((swapbackOutput - jupiterOutput) / jupiterOutput) * 10000
    );

    return {
      jupiterOutput,
      swapbackOutput,
      differenceBps,
      isSwapbackBetter: differenceBps >= 0,
      shouldAlert: differenceBps < -config.jupiterBenchmark.alertThresholdBps,
      jupiterLatencyMs,
    };
  } catch (error) {
    logger.debug("SplitRouteCalculator", "Jupiter benchmark exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { SplitRouteCalculator as default };
