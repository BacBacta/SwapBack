/**
 * 🪐 Intégration Jupiter - Routeur DEX Multi-hôte
 * 
 * Obtient les meilleures routes de swap via Jupiter, avec support
 * pour Raydium, Orca et autres DEX.
 * 
 * @author SwapBack Team
 * @date October 26, 2025
 */

import { PublicKey } from '@solana/web3.js';

export interface JupiterResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  routePlan?: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }>;
  priceImpactPct?: string;
  slippageBps?: number;
}

export interface JupiterQuote {
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputAmount: bigint;
  outputAmount: bigint;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }>;
  priceImpactPct: number;
  slippageBps: number;
}

export interface SwapRoute {
  id: string;
  name: string;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpact: number;
  venues: string[];
  fee: number;
  mevRisk: 'low' | 'medium' | 'high';
}

/**
 * Client Jupiter pour les routes de swap
 */
export class JupiterClient {
  private readonly apiUrl = 'https://price.jup.ag/v4';
  private readonly apiTimeout = 10000; // 10 secondes

  /**
   * Obtenir des routes de swap via Jupiter
   */
  async getRoutes(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippageBps: number = 50 // 0.5% par défaut
  ): Promise<SwapRoute[]> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
      return this.formatRoutes(quote);
    } catch (error) {
      console.error('Erreur lors de la récupération des routes Jupiter:', error);
      throw new Error('Impossible d\'obtenir les routes de swap');
    }
  }

  /**
   * Obtenir une quote de swap
   */
  private async getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippageBps: number
  ): Promise<JupiterQuote> {
    const url = new URL(`${this.apiUrl}/quote`);
    url.searchParams.append('inputMint', inputMint.toBase58());
    url.searchParams.append('outputMint', outputMint.toBase58());
    url.searchParams.append('amount', amount.toString());
    url.searchParams.append('slippageBps', slippageBps.toString());
    url.searchParams.append('onlyDirectRoutes', 'false');
    url.searchParams.append('asLegacyTransaction', 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.apiTimeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeQuote(data);
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Normaliser la réponse de Jupiter
   */
  private normalizeQuote(data: JupiterResponse): JupiterQuote {
    return {
      inputMint: new PublicKey(data.inputMint),
      outputMint: new PublicKey(data.outputMint),
      inputAmount: BigInt(data.inAmount),
      outputAmount: BigInt(data.outAmount),
      routePlan: data.routePlan || [],
      priceImpactPct: parseFloat(data.priceImpactPct || '0'),
      slippageBps: data.slippageBps || 50,
    };
  }

  /**
   * Formater les routes pour affichage
   */
  private formatRoutes(quote: JupiterQuote): SwapRoute[] {
    const venues = quote.routePlan
      .map(p => this.getVenueName(p.swapInfo.label))
      .filter((v, i, a) => a.indexOf(v) === i); // Unique

    // Estimer le MEV risk basé sur price impact
    const mevRisk = quote.priceImpactPct < 0.1 ? 'low' : 
                    quote.priceImpactPct < 0.5 ? 'medium' : 'high';

    return [{
      id: this.generateRouteId(),
      name: `Jupiter via ${venues.join(' → ')}`,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      priceImpact: quote.priceImpactPct,
      venues,
      fee: this.calculateFee(quote),
      mevRisk,
    }];
  }

  /**
   * Obtenir le nom du DEX
   */
  private getVenueName(label: string): string {
    if (label.includes('Raydium')) return 'Raydium';
    if (label.includes('Orca')) return 'Orca';
    if (label.includes('Serum')) return 'Serum';
    if (label.includes('Marinade')) return 'Marinade';
    if (label.includes('Lifinity')) return 'Lifinity';
    return label;
  }

  /**
   * Calculer les frais estimés
   */
  private calculateFee(_quote: JupiterQuote): number {
    // Les frais sont généralement ~0.3-1% par swap
    // Estimation: 0.5% par default
    return 50; // 50 BP = 0.5%
  }

  /**
   * Générer un ID unique de route
   */
  private generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Comparer les prix avec d'autres DEX
   */
  async compareWithAlternatives(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint
  ): Promise<{
    jupiter: SwapRoute;
    alternatives: { name: string; output: bigint; source: string }[];
  }> {
    const jupiterRoutes = await this.getRoutes(inputMint, outputMint, amount);
    const jupiterRoute = jupiterRoutes[0];

    // TODO: Intégrer d'autres sources (Raydium direct, Orca direct, etc.)
    const alternatives: { name: string; output: bigint; source: string }[] = [];

    return {
      jupiter: jupiterRoute,
      alternatives,
    };
  }
}

/**
 * Fonction utilitaire pour obtenir les routes
 */
export async function getJupiterRoutes(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: bigint,
  slippageBps?: number
): Promise<SwapRoute[]> {
  const client = new JupiterClient();
  return client.getRoutes(inputMint, outputMint, amount, slippageBps);
}

/**
 * Fonction utilitaire pour comparer les prix
 */
export async function compareSwapRoutes(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: bigint
): Promise<{
  best: SwapRoute;
  all: SwapRoute[];
}> {
  const client = new JupiterClient();
  const routes = await client.getRoutes(inputMint, outputMint, amount);
  
  // Trouver la meilleure route (plus de output)
  const best = routes.reduce((prev, current) => 
    current.outputAmount > prev.outputAmount ? current : prev
  );

  return { best, all: routes };
}

/**
 * Appliquer le boost au montant de output
 */
export function applyBoostToRoute(
  route: SwapRoute,
  boostBP: number // Boost en basis points (10000 = 100%)
): SwapRoute {
  const boostMultiplier = (10_000 + boostBP) / 10_000;
  const boostedOutput = BigInt(
    Math.floor(Number(route.outputAmount) * boostMultiplier)
  );

  return {
    ...route,
    outputAmount: boostedOutput,
  };
}

/**
 * Calculer les statistiques de route
 */
export function getRouteStats(routes: SwapRoute[]) {
  if (routes.length === 0) {
    return {
      count: 0,
      bestOutput: 0n,
      worstOutput: 0n,
      avgPriceImpact: 0,
      venues: [],
    };
  }

  const outputs = routes.map(r => r.outputAmount);
  const bestOutput = outputs.reduce((a, b) => a > b ? a : b);
  const worstOutput = outputs.reduce((a, b) => a < b ? a : b);
  const avgPriceImpact = routes.reduce((sum, r) => sum + r.priceImpact, 0) / routes.length;

  const venues = new Set<string>();
  routes.forEach(r => r.venues.forEach(v => venues.add(v)));

  return {
    count: routes.length,
    bestOutput,
    worstOutput,
    avgPriceImpact,
    venues: Array.from(venues),
  };
}
