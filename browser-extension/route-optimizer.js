/**
 * SwapBack Route Optimizer
 * Compare toutes les routes possibles et trouve la meilleure
 */

const JUPITER_API = 'https://quote-api.jup.ag/v6';
const RAYDIUM_API = 'https://api.raydium.io/v2';
const ORCA_API = 'https://api.orca.so';
const SWAPBACK_API = 'https://api.swapback.app/v1'; // Notre API

/**
 * Classe principale d'optimisation de routes
 */
class RouteOptimizer {
  constructor(connection, userWallet) {
    this.connection = connection;
    this.userWallet = userWallet;
    this.userBoost = 0; // Sera chargé depuis le cNFT
  }

  /**
   * Trouve la meilleure route pour un swap
   */
  async findBestRoute(params) {
    const { inputMint, outputMint, amount, slippageBps = 50 } = params;

    console.log('🔍 SwapBack: Recherche des meilleures routes...');

    try {
      // 1. Charger le boost de l'utilisateur (cNFT)
      await this.loadUserBoost();

      // 2. Récupérer les routes de tous les agrégateurs en parallèle
      const [jupiterRoutes, raydiumRoutes, orcaRoutes] = await Promise.allSettled([
        this.getJupiterRoutes(inputMint, outputMint, amount, slippageBps),
        this.getRaydiumRoutes(inputMint, outputMint, amount),
        this.getOrcaRoutes(inputMint, outputMint, amount),
      ]);

      // 3. Consolider toutes les routes
      const allRoutes = [
        ...(jupiterRoutes.status === 'fulfilled' ? jupiterRoutes.value : []),
        ...(raydiumRoutes.status === 'fulfilled' ? raydiumRoutes.value : []),
        ...(orcaRoutes.status === 'fulfilled' ? orcaRoutes.value : []),
      ];

      if (allRoutes.length === 0) {
        throw new Error('Aucune route trouvée');
      }

      console.log(`✅ ${allRoutes.length} routes trouvées`);

      // 4. Calculer le coût réel de chaque route (incluant rebates)
      const routesWithCosts = allRoutes.map(route => 
        this.calculateTrueCost(route, amount)
      );

      // 5. Trier par meilleur coût (le plus bas = meilleur)
      routesWithCosts.sort((a, b) => a.trueCost - b.trueCost);

      // 6. Retourner la meilleure route
      const bestRoute = routesWithCosts[0];

      console.log('🏆 Meilleure route trouvée:', {
        provider: bestRoute.provider,
        outputAmount: bestRoute.outputAmount,
        trueCost: bestRoute.trueCost,
        estimatedRebate: bestRoute.estimatedRebate,
        savings: routesWithCosts[1].trueCost - bestRoute.trueCost,
      });

      return {
        bestRoute,
        allRoutes: routesWithCosts.slice(0, 5), // Top 5
        savings: routesWithCosts[1] ? 
          routesWithCosts[1].trueCost - bestRoute.trueCost : 0,
      };

    } catch (error) {
      console.error('❌ Erreur lors de la recherche de routes:', error);
      throw error;
    }
  }

  /**
   * Charge le boost de l'utilisateur depuis son cNFT
   */
  async loadUserBoost() {
    try {
      const response = await fetch(
        `${SWAPBACK_API}/user/${this.userWallet}/cnft`
      );
      
      if (response.ok) {
        const data = await response.json();
        this.userBoost = data.boost || 0;
        this.userLevel = data.level || null;
        console.log(`✨ User boost: ${this.userBoost}% (${this.userLevel || 'No cNFT'})`);
      } else {
        this.userBoost = 0;
      }
    } catch (error) {
      console.warn('Impossible de charger le boost utilisateur:', error);
      this.userBoost = 0;
    }
  }

  /**
   * Récupère les routes de Jupiter
   */
  async getJupiterRoutes(inputMint, outputMint, amount, slippageBps) {
    try {
      const response = await fetch(
        `${JUPITER_API}/quote?` +
        `inputMint=${inputMint}&` +
        `outputMint=${outputMint}&` +
        `amount=${amount}&` +
        `slippageBps=${slippageBps}`
      );

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const data = await response.json();

      // Transformer en format unifié
      return data.data.slice(0, 3).map(route => ({
        provider: 'Jupiter',
        inputMint,
        outputMint,
        inputAmount: amount,
        outputAmount: parseInt(route.outAmount),
        priceImpactPct: parseFloat(route.priceImpactPct || 0),
        marketInfos: route.marketInfos || [],
        fees: this.calculateJupiterFees(route),
        raw: route,
      }));

    } catch (error) {
      console.warn('Erreur Jupiter:', error);
      return [];
    }
  }

  /**
   * Récupère les routes de Raydium
   */
  async getRaydiumRoutes(inputMint, outputMint, amount) {
    try {
      const response = await fetch(
        `${RAYDIUM_API}/swap/route?` +
        `inputMint=${inputMint}&` +
        `outputMint=${outputMint}&` +
        `amount=${amount}`
      );

      if (!response.ok) {
        throw new Error(`Raydium API error: ${response.status}`);
      }

      const data = await response.json();

      return [{
        provider: 'Raydium',
        inputMint,
        outputMint,
        inputAmount: amount,
        outputAmount: parseInt(data.outputAmount || 0),
        priceImpactPct: parseFloat(data.priceImpact || 0),
        marketInfos: data.route || [],
        fees: parseFloat(data.fee || 0),
        raw: data,
      }];

    } catch (error) {
      console.warn('Erreur Raydium:', error);
      return [];
    }
  }

  /**
   * Récupère les routes d'Orca
   */
  async getOrcaRoutes(inputMint, outputMint, amount) {
    try {
      const response = await fetch(
        `${ORCA_API}/quote?` +
        `inputMint=${inputMint}&` +
        `outputMint=${outputMint}&` +
        `amount=${amount}`
      );

      if (!response.ok) {
        throw new Error(`Orca API error: ${response.status}`);
      }

      const data = await response.json();

      return [{
        provider: 'Orca',
        inputMint,
        outputMint,
        inputAmount: amount,
        outputAmount: parseInt(data.expectedOutputAmount || 0),
        priceImpactPct: parseFloat(data.priceImpact || 0),
        marketInfos: data.route || [],
        fees: parseFloat(data.fees || 0),
        raw: data,
      }];

    } catch (error) {
      console.warn('Erreur Orca:', error);
      return [];
    }
  }

  /**
   * Calcule les frais réels d'une route Jupiter
   */
  calculateJupiterFees(route) {
    let totalFees = 0;

    // Platform fee
    if (route.platformFee) {
      totalFees += parseFloat(route.platformFee.amount || 0);
    }

    // Market fees
    if (route.marketInfos) {
      route.marketInfos.forEach(market => {
        if (market.lpFee) {
          totalFees += parseFloat(market.lpFee.amount || 0);
        }
      });
    }

    return totalFees;
  }

  /**
   * Calcule le coût RÉEL incluant rebates SwapBack
   */
  calculateTrueCost(route, inputAmount) {
    // 1. Coût de base = input - output (perte due au swap)
    const baseCost = inputAmount - route.outputAmount;

    // 2. Ajouter les frais
    const totalCost = baseCost + route.fees;

    // 3. CRITÈRE CLÉ: Calculer le rebate SwapBack
    const baseRebateRate = 0.003; // 0.3% de rebate
    const boostedRebateRate = baseRebateRate * (1 + this.userBoost / 100);
    const estimatedRebate = inputAmount * boostedRebateRate;

    // 4. Coût réel = coût total - rebate
    const trueCost = totalCost - estimatedRebate;

    // 5. Calculer l'efficacité (output / input)
    const efficiency = (route.outputAmount / inputAmount) * 100;

    return {
      ...route,
      baseCost,
      totalCost,
      estimatedRebate,
      trueCost,
      efficiency,
      userBoost: this.userBoost,
      // Indicateur si SwapBack améliore cette route
      swapbackAdvantage: estimatedRebate > 0,
    };
  }

  /**
   * Compare deux routes et retourne un résumé
   */
  compareRoutes(routeA, routeB) {
    const comparison = {
      winner: routeA.trueCost < routeB.trueCost ? 'A' : 'B',
      difference: Math.abs(routeA.trueCost - routeB.trueCost),
      percentageDiff: ((Math.abs(routeA.trueCost - routeB.trueCost) / routeB.trueCost) * 100).toFixed(2),
      routeA: {
        provider: routeA.provider,
        outputAmount: routeA.outputAmount,
        trueCost: routeA.trueCost,
        rebate: routeA.estimatedRebate,
      },
      routeB: {
        provider: routeB.provider,
        outputAmount: routeB.outputAmount,
        trueCost: routeB.trueCost,
        rebate: routeB.estimatedRebate,
      },
    };

    return comparison;
  }

  /**
   * Génère un rapport de recommandation pour l'utilisateur
   */
  generateRecommendation(bestRoute, allRoutes) {
    const secondBest = allRoutes[1];
    const savings = secondBest ? secondBest.trueCost - bestRoute.trueCost : 0;
    const savingsPercent = secondBest ? 
      ((savings / secondBest.trueCost) * 100).toFixed(2) : 0;

    return {
      recommendation: {
        provider: bestRoute.provider,
        outputAmount: bestRoute.outputAmount,
        trueCost: bestRoute.trueCost,
        estimatedRebate: bestRoute.estimatedRebate,
        userBoost: this.userBoost,
        userLevel: this.userLevel,
      },
      comparison: secondBest ? {
        vsProvider: secondBest.provider,
        savings: savings,
        savingsPercent: savingsPercent,
        message: `Économie de ${savings.toFixed(6)} tokens (${savingsPercent}%) vs ${secondBest.provider}`,
      } : null,
      swapbackBenefit: {
        rebateAmount: bestRoute.estimatedRebate,
        boostApplied: this.userBoost > 0,
        message: this.userBoost > 0 ?
          `Votre cNFT ${this.userLevel} vous rapporte ${bestRoute.estimatedRebate.toFixed(6)} tokens de plus!` :
          `Lockez $BACK pour obtenir jusqu'à +20% de rebates supplémentaires!`,
      },
      alternatives: allRoutes.slice(0, 5).map(route => ({
        provider: route.provider,
        outputAmount: route.outputAmount,
        trueCost: route.trueCost,
        difference: route.trueCost - bestRoute.trueCost,
      })),
    };
  }
}

/**
 * Fonction utilitaire pour formater les montants
 */
function formatTokenAmount(amount, decimals = 6) {
  return (amount / Math.pow(10, decimals)).toFixed(6);
}

/**
 * Fonction utilitaire pour formater les pourcentages
 */
function formatPercent(value) {
  return (value * 100).toFixed(2) + '%';
}

// Export pour utilisation dans l'extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RouteOptimizer, formatTokenAmount, formatPercent };
}
