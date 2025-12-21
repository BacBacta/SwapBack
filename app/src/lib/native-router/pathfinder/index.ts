/**
 * 🗺️ Pathfinder - Automatic Route Discovery
 *
 * Implémente le route finding automatique pour trouver les meilleures routes
 * multi-hop entre tokens, inspiré de Jupiter Metis.
 *
 * Features:
 * - Route finding automatique via tokens intermédiaires
 * - Multi-hop jusqu'à 4 sauts
 * - Algorithme A* pour les gros ordres
 * - Comparaison systématique avec Jupiter
 *
 * @see https://dev.jup.ag/docs/routing - Jupiter routing reference
 * @see https://dev.jup.ag/blog/metis-v7 - Jupiter Metis algorithm
 * @author SwapBack Team
 * @date December 21, 2025
 */

import { PublicKey } from '@solana/web3.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RouteHop {
  inputMint: PublicKey;
  outputMint: PublicKey;
  venue: string;
  inputAmount: number;
  outputAmount: number;
  priceImpactBps: number;
}

export interface Route {
  hops: RouteHop[];
  totalInput: number;
  totalOutput: number;
  totalPriceImpactBps: number;
  effectivePrice: number;
  routePath: string; // e.g., "SOL -> USDC -> JUP"
}

export interface PathfinderConfig {
  maxHops: number;
  intermediateTokens: string[];
  minLiquidityUsd: number;
  maxPriceImpactBps: number;
}

export type QuoteFetcher = (
  inputMint: string,
  outputMint: string,
  amount: number
) => Promise<{ outputAmount: number; priceImpactBps: number; venue: string } | null>;

// ============================================================================
// CONSTANTS
// ============================================================================

// Tokens liquides pour routing intermédiaire
// Ordonnés par liquidité/fiabilité décroissante
export const INTERMEDIATE_TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  stSOL: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
} as const;

const DEFAULT_INTERMEDIATE_TOKENS = [
  INTERMEDIATE_TOKENS.USDC,
  INTERMEDIATE_TOKENS.SOL,
  INTERMEDIATE_TOKENS.USDT,
  INTERMEDIATE_TOKENS.mSOL,
];

const DEFAULT_CONFIG: PathfinderConfig = {
  maxHops: 3,
  intermediateTokens: DEFAULT_INTERMEDIATE_TOKENS,
  minLiquidityUsd: 1000,
  maxPriceImpactBps: 500, // 5% max impact per hop
};

// ============================================================================
// PATHFINDER CLASS
// ============================================================================

export class Pathfinder {
  private quoteFetcher: QuoteFetcher;
  private config: PathfinderConfig;

  constructor(quoteFetcher: QuoteFetcher, config: Partial<PathfinderConfig> = {}) {
    this.quoteFetcher = quoteFetcher;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Trouve toutes les routes possibles entre deux tokens
   */
  async findAllRoutes(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<Route[]> {
    const routes: Route[] = [];

    // 1. Route directe
    const directRoute = await this.findDirectRoute(inputMint, outputMint, amount);
    if (directRoute) {
      routes.push(directRoute);
    }

    // 2. Routes 2-hop via tokens intermédiaires
    const twoHopRoutes = await this.find2HopRoutes(inputMint, outputMint, amount);
    routes.push(...twoHopRoutes);

    // 3. Routes 3-hop pour les paires exotiques (si configuré)
    if (this.config.maxHops >= 3 && routes.length === 0) {
      const threeHopRoutes = await this.find3HopRoutes(inputMint, outputMint, amount);
      routes.push(...threeHopRoutes);
    }

    // Trier par output décroissant
    routes.sort((a, b) => b.totalOutput - a.totalOutput);

    return routes;
  }

  /**
   * Trouve la meilleure route
   */
  async findBestRoute(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<Route | null> {
    const routes = await this.findAllRoutes(inputMint, outputMint, amount);
    return routes.length > 0 ? routes[0] : null;
  }

  /**
   * Route directe (1 hop)
   */
  private async findDirectRoute(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<Route | null> {
    try {
      const quote = await this.quoteFetcher(inputMint, outputMint, amount);
      
      if (!quote || quote.outputAmount <= 0) {
        return null;
      }

      const hop: RouteHop = {
        inputMint: new PublicKey(inputMint),
        outputMint: new PublicKey(outputMint),
        venue: quote.venue,
        inputAmount: amount,
        outputAmount: quote.outputAmount,
        priceImpactBps: quote.priceImpactBps,
      };

      return {
        hops: [hop],
        totalInput: amount,
        totalOutput: quote.outputAmount,
        totalPriceImpactBps: quote.priceImpactBps,
        effectivePrice: quote.outputAmount / amount,
        routePath: `${this.getTokenSymbol(inputMint)} -> ${this.getTokenSymbol(outputMint)}`,
      };
    } catch (error) {
      console.error('[Pathfinder] Direct route error:', error);
      return null;
    }
  }

  /**
   * Routes 2-hop via tokens intermédiaires
   */
  private async find2HopRoutes(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<Route[]> {
    const routes: Route[] = [];

    const intermediatePromises = this.config.intermediateTokens
      .filter(token => token !== inputMint && token !== outputMint)
      .map(async (intermediate) => {
        try {
          // Hop 1: input -> intermediate
          const quote1 = await this.quoteFetcher(inputMint, intermediate, amount);
          if (!quote1 || quote1.outputAmount <= 0) return null;

          // Vérifier le price impact du premier hop
          if (quote1.priceImpactBps > this.config.maxPriceImpactBps) return null;

          // Hop 2: intermediate -> output
          const quote2 = await this.quoteFetcher(intermediate, outputMint, quote1.outputAmount);
          if (!quote2 || quote2.outputAmount <= 0) return null;

          // Vérifier le price impact du second hop
          if (quote2.priceImpactBps > this.config.maxPriceImpactBps) return null;

          const hop1: RouteHop = {
            inputMint: new PublicKey(inputMint),
            outputMint: new PublicKey(intermediate),
            venue: quote1.venue,
            inputAmount: amount,
            outputAmount: quote1.outputAmount,
            priceImpactBps: quote1.priceImpactBps,
          };

          const hop2: RouteHop = {
            inputMint: new PublicKey(intermediate),
            outputMint: new PublicKey(outputMint),
            venue: quote2.venue,
            inputAmount: quote1.outputAmount,
            outputAmount: quote2.outputAmount,
            priceImpactBps: quote2.priceImpactBps,
          };

          const totalPriceImpactBps = quote1.priceImpactBps + quote2.priceImpactBps;

          return {
            hops: [hop1, hop2],
            totalInput: amount,
            totalOutput: quote2.outputAmount,
            totalPriceImpactBps,
            effectivePrice: quote2.outputAmount / amount,
            routePath: `${this.getTokenSymbol(inputMint)} -> ${this.getTokenSymbol(intermediate)} -> ${this.getTokenSymbol(outputMint)}`,
          };
        } catch (error) {
          console.debug(`[Pathfinder] 2-hop via ${intermediate} failed:`, error);
          return null;
        }
      });

    const results = await Promise.all(intermediatePromises);
    
    for (const route of results) {
      if (route) routes.push(route);
    }

    return routes;
  }

  /**
   * Routes 3-hop pour les paires très exotiques
   */
  private async find3HopRoutes(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<Route[]> {
    const routes: Route[] = [];

    // Pour les 3-hop, on utilise des chemins connus fiables
    // Exemple: TokenX -> SOL -> USDC -> TokenY
    const reliablePaths = [
      [INTERMEDIATE_TOKENS.SOL, INTERMEDIATE_TOKENS.USDC],
      [INTERMEDIATE_TOKENS.USDC, INTERMEDIATE_TOKENS.SOL],
      [INTERMEDIATE_TOKENS.SOL, INTERMEDIATE_TOKENS.USDT],
    ];

    for (const [int1, int2] of reliablePaths) {
      if (int1 === inputMint || int1 === outputMint) continue;
      if (int2 === inputMint || int2 === outputMint) continue;
      if (int1 === int2) continue;

      try {
        // Hop 1: input -> int1
        const quote1 = await this.quoteFetcher(inputMint, int1, amount);
        if (!quote1 || quote1.outputAmount <= 0) continue;
        if (quote1.priceImpactBps > this.config.maxPriceImpactBps) continue;

        // Hop 2: int1 -> int2
        const quote2 = await this.quoteFetcher(int1, int2, quote1.outputAmount);
        if (!quote2 || quote2.outputAmount <= 0) continue;
        if (quote2.priceImpactBps > this.config.maxPriceImpactBps) continue;

        // Hop 3: int2 -> output
        const quote3 = await this.quoteFetcher(int2, outputMint, quote2.outputAmount);
        if (!quote3 || quote3.outputAmount <= 0) continue;
        if (quote3.priceImpactBps > this.config.maxPriceImpactBps) continue;

        const hops: RouteHop[] = [
          {
            inputMint: new PublicKey(inputMint),
            outputMint: new PublicKey(int1),
            venue: quote1.venue,
            inputAmount: amount,
            outputAmount: quote1.outputAmount,
            priceImpactBps: quote1.priceImpactBps,
          },
          {
            inputMint: new PublicKey(int1),
            outputMint: new PublicKey(int2),
            venue: quote2.venue,
            inputAmount: quote1.outputAmount,
            outputAmount: quote2.outputAmount,
            priceImpactBps: quote2.priceImpactBps,
          },
          {
            inputMint: new PublicKey(int2),
            outputMint: new PublicKey(outputMint),
            venue: quote3.venue,
            inputAmount: quote2.outputAmount,
            outputAmount: quote3.outputAmount,
            priceImpactBps: quote3.priceImpactBps,
          },
        ];

        const totalPriceImpactBps = quote1.priceImpactBps + quote2.priceImpactBps + quote3.priceImpactBps;

        routes.push({
          hops,
          totalInput: amount,
          totalOutput: quote3.outputAmount,
          totalPriceImpactBps,
          effectivePrice: quote3.outputAmount / amount,
          routePath: `${this.getTokenSymbol(inputMint)} -> ${this.getTokenSymbol(int1)} -> ${this.getTokenSymbol(int2)} -> ${this.getTokenSymbol(outputMint)}`,
        });
      } catch (error) {
        console.debug(`[Pathfinder] 3-hop failed:`, error);
      }
    }

    return routes;
  }

  /**
   * Récupère le symbole d'un token
   */
  private getTokenSymbol(mint: string): string {
    const symbols: Record<string, string> = {
      [INTERMEDIATE_TOKENS.SOL]: 'SOL',
      [INTERMEDIATE_TOKENS.USDC]: 'USDC',
      [INTERMEDIATE_TOKENS.USDT]: 'USDT',
      [INTERMEDIATE_TOKENS.mSOL]: 'mSOL',
      [INTERMEDIATE_TOKENS.stSOL]: 'stSOL',
      [INTERMEDIATE_TOKENS.BONK]: 'BONK',
      [INTERMEDIATE_TOKENS.JUP]: 'JUP',
    };
    return symbols[mint] || mint.slice(0, 6) + '...';
  }
}

// ============================================================================
// A* OPTIMIZER FOR LARGE ORDERS
// ============================================================================

interface AStarNode {
  mint: string;
  amount: number;
  gCost: number;  // Coût accumulé (pertes de prix)
  hCost: number;  // Heuristique (estimation vers target)
  fCost: number;  // gCost + hCost
  parent: AStarNode | null;
  venue: string | null;
}

/**
 * Optimiseur A* pour les gros ordres (> $1000)
 * Trouve le chemin optimal en minimisant les pertes de prix
 */
export class AStarPathOptimizer {
  private quoteFetcher: QuoteFetcher;
  private intermediateTokens: string[];

  constructor(quoteFetcher: QuoteFetcher, intermediateTokens: string[] = DEFAULT_INTERMEDIATE_TOKENS) {
    this.quoteFetcher = quoteFetcher;
    this.intermediateTokens = intermediateTokens;
  }

  /**
   * Trouve le meilleur chemin via A*
   */
  async findOptimalPath(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<Route | null> {
    const openSet: AStarNode[] = [];
    const closedSet = new Set<string>();

    // Noeud de départ
    const startNode: AStarNode = {
      mint: inputMint,
      amount,
      gCost: 0,
      hCost: this.heuristic(inputMint, outputMint),
      fCost: this.heuristic(inputMint, outputMint),
      parent: null,
      venue: null,
    };

    openSet.push(startNode);

    while (openSet.length > 0) {
      // Trouver le noeud avec le plus petit fCost
      openSet.sort((a, b) => a.fCost - b.fCost);
      const current = openSet.shift()!;

      // Objectif atteint
      if (current.mint === outputMint) {
        return this.reconstructRoute(current, inputMint, outputMint);
      }

      closedSet.add(`${current.mint}:${current.amount}`);

      // Explorer les voisins (tokens accessibles)
      const neighbors = await this.getNeighbors(current, outputMint);

      for (const neighbor of neighbors) {
        const key = `${neighbor.mint}:${neighbor.amount}`;
        if (closedSet.has(key)) continue;

        const existingNode = openSet.find(n => n.mint === neighbor.mint);
        if (!existingNode || neighbor.fCost < existingNode.fCost) {
          if (existingNode) {
            const index = openSet.indexOf(existingNode);
            openSet.splice(index, 1);
          }
          openSet.push(neighbor);
        }
      }
    }

    return null; // Aucun chemin trouvé
  }

  /**
   * Heuristique: estimation du coût vers la cible
   */
  private heuristic(current: string, target: string): number {
    if (current === target) return 0;

    // Tokens très liquides = faible coût estimé
    const liquidTokens = new Set([
      INTERMEDIATE_TOKENS.SOL,
      INTERMEDIATE_TOKENS.USDC,
      INTERMEDIATE_TOKENS.USDT,
    ]);

    if (liquidTokens.has(current)) return 10; // 10 bps
    return 50; // 50 bps pour les autres
  }

  /**
   * Récupère les voisins (tokens accessibles depuis le noeud courant)
   */
  private async getNeighbors(node: AStarNode, targetMint: string): Promise<AStarNode[]> {
    const neighbors: AStarNode[] = [];
    const tokensToCheck = [...this.intermediateTokens, targetMint];

    for (const nextMint of tokensToCheck) {
      if (nextMint === node.mint) continue;

      try {
        const quote = await this.quoteFetcher(node.mint, nextMint, node.amount);
        if (!quote || quote.outputAmount <= 0) continue;

        // Coût = price impact en bps
        const moveCost = quote.priceImpactBps;
        const gCost = node.gCost + moveCost;
        const hCost = this.heuristic(nextMint, targetMint);

        neighbors.push({
          mint: nextMint,
          amount: quote.outputAmount,
          gCost,
          hCost,
          fCost: gCost + hCost,
          parent: node,
          venue: quote.venue,
        });
      } catch (error) {
        // Skip ce voisin
      }
    }

    return neighbors;
  }

  /**
   * Reconstruit la route à partir du noeud final
   */
  private reconstructRoute(
    endNode: AStarNode,
    inputMint: string,
    outputMint: string
  ): Route {
    const hops: RouteHop[] = [];
    let current: AStarNode | null = endNode;
    const nodes: AStarNode[] = [];

    while (current) {
      nodes.unshift(current);
      current = current.parent;
    }

    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];

      hops.push({
        inputMint: new PublicKey(from.mint),
        outputMint: new PublicKey(to.mint),
        venue: to.venue || 'unknown',
        inputAmount: from.amount,
        outputAmount: to.amount,
        priceImpactBps: to.gCost - from.gCost,
      });
    }

    const routePath = nodes.map(n => this.getTokenSymbol(n.mint)).join(' -> ');

    return {
      hops,
      totalInput: nodes[0].amount,
      totalOutput: endNode.amount,
      totalPriceImpactBps: endNode.gCost,
      effectivePrice: endNode.amount / nodes[0].amount,
      routePath,
    };
  }

  private getTokenSymbol(mint: string): string {
    const symbols: Record<string, string> = {
      [INTERMEDIATE_TOKENS.SOL]: 'SOL',
      [INTERMEDIATE_TOKENS.USDC]: 'USDC',
      [INTERMEDIATE_TOKENS.USDT]: 'USDT',
      [INTERMEDIATE_TOKENS.mSOL]: 'mSOL',
    };
    return symbols[mint] || mint.slice(0, 6);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  Pathfinder,
  AStarPathOptimizer,
  INTERMEDIATE_TOKENS,
};
