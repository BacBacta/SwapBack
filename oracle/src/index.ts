import express from 'express';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const RAYDIUM_API = 'https://api.raydium.io/v2';
const ORCA_API = 'https://api.orca.so';
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';

const connection = new Connection(SOLANA_RPC, 'confirmed');

// Program IDs
const CNFT_PROGRAM_ID = new PublicKey('FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8');
const ROUTER_PROGRAM_ID = new PublicKey('FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55');

/**
 * Simule une route de swap optimale
 */
app.post('/simulate', async (req, res) => {
  try {
    const { inputMint, outputMint, inputAmount, slippage, userPubkey } = req.body;

    console.log('Simulation de route:', { inputMint, outputMint, inputAmount });

    // 1. Obtenir la quote Jupiter
    const jupiterQuote = await getJupiterQuote(
      inputMint,
      outputMint,
      inputAmount,
      slippage
    );

    // 2. Calculer le NPI (Net Price Improvement)
    const directRoute = await getDirectRoute(inputMint, outputMint, inputAmount);
    const npi = jupiterQuote.outAmount - directRoute.outAmount;

    // 3. Calculer la répartition remise/burn
    const rebatePercentage = 75; // 75% du NPI pour l'utilisateur
    const burnPercentage = 25; // 25% pour le burn

    const rebateAmount = (npi * rebatePercentage) / 100;
    const burnAmount = (npi * burnPercentage) / 100;

    // 4. Déterminer le type de route optimal
    const routeType = determineRouteType(npi, jupiterQuote);

    const simulation = {
      type: routeType,
      inputAmount: parseFloat(inputAmount),
      estimatedOutput: jupiterQuote.outAmount,
      npi,
      rebateAmount,
      burnAmount,
      fees: jupiterQuote.platformFee || 0,
      priceImpact: jupiterQuote.priceImpactPct || 0,
      route: jupiterQuote.routePlan,
    };

    res.json(simulation);
  } catch (error) {
    console.error('Erreur lors de la simulation:', error);
    res.status(500).json({ error: 'Erreur lors de la simulation' });
  }
});

/**
 * Obtient une quote de Jupiter
 */
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippage: number
): Promise<any> {
  try {
    const response = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps: Math.floor(slippage * 100), // Convertir en basis points
      },
    });

    return response.data;
  } catch (error) {
    console.error('Erreur Jupiter API:', error);
    throw error;
  }
}

/**
 * Obtient la route directe (sans optimisation)
 */
async function getDirectRoute(
  inputMint: string,
  outputMint: string,
  amount: string
): Promise<any> {
  // Pour le MVP, on suppose que la route directe donne 98% de la route optimisée
  const jupiterQuote = await getJupiterQuote(inputMint, outputMint, amount, 0.5);
  return {
    outAmount: jupiterQuote.outAmount * 0.98,
  };
}

/**
 * Détermine le type de route optimal
 */
function determineRouteType(npi: number, quote: any): string {
  // Logique de sélection du type de route
  if (npi > 1000) {
    return 'Bundle'; // Utiliser Jito bundle pour les gros gains
  } else if (quote.routePlan && quote.routePlan.length > 1) {
    return 'Aggregator'; // Route multi-DEX
  } else if (quote.marketInfos?.some((m: any) => m.label === 'RFQ')) {
    return 'RFQ'; // Route via RFQ
  }
  return 'Direct';
}

/**
 * Récupère les routes Jupiter
 */
async function getJupiterRoutes(inputMint: string, outputMint: string, amount: string): Promise<any[]> {
  try {
    const response = await axios.get(`${JUPITER_API}/quote`, {
      params: { inputMint, outputMint, amount, slippageBps: 50 }
    });

    return [{
      provider: 'jupiter',
      outputAmount: response.data.outAmount,
      fee: response.data.platformFee?.amount || 0,
      priceImpact: response.data.priceImpactPct || 0,
      route: response.data.routePlan,
      raw: response.data
    }];
  } catch (error) {
    console.warn('Erreur Jupiter:', (error as Error).message);
    // Fallback vers données simulées quand Jupiter n'est pas disponible
    const baseAmount = parseFloat(amount);
    const simulatedOutput = baseAmount * 0.997; // 0.3% de frais simulés
    
    return [{
      provider: 'jupiter',
      outputAmount: simulatedOutput,
      fee: baseAmount * 0.003,
      priceImpact: 0.3,
      route: 'Whirlpool',
      raw: null
    }];
  }
}

/**
 * Récupère les routes Raydium
 */
async function getRaydiumRoutes(inputMint: string, outputMint: string, amount: string): Promise<any[]> {
  try {
    // Simulation - Raydium n'a pas d'API publique simple
    // Pour le MVP, on simule une route légèrement différente
    const baseAmount = parseFloat(amount);
    const simulatedOutput = baseAmount * 0.995; // 0.5% de frais simulés

    return [{
      provider: 'raydium',
      outputAmount: simulatedOutput,
      fee: baseAmount * 0.005,
      priceImpact: 0.5,
      route: 'Direct AMM'
    }];
  } catch (error) {
    console.warn('Erreur Raydium:', (error as Error).message);
    return [];
  }
}

/**
 * Récupère les routes Orca
 */
async function getOrcaRoutes(inputMint: string, outputMint: string, amount: string): Promise<any[]> {
  try {
    // Simulation - Orca a une API complexe
    const baseAmount = parseFloat(amount);
    const simulatedOutput = baseAmount * 0.997; // 0.3% de frais simulés

    return [{
      provider: 'orca',
      outputAmount: simulatedOutput,
      fee: baseAmount * 0.003,
      priceImpact: 0.3,
      route: 'Whirlpool'
    }];
  } catch (error) {
    console.warn('Erreur Orca:', (error as Error).message);
    return [];
  }
}

/**
 * Calcule le coût réel d'une route (coût - rebates)
 */
function calculateTrueCost(route: any, inputAmount: string, userBoost: number): any {
  const baseAmount = parseFloat(inputAmount);
  const outputAmount = route.outputAmount;
  const fee = route.fee || 0;

  // Coût du swap = input - output + fees
  const swapCost = baseAmount - outputAmount + fee;

  // Rebate = 0.3% base + boost utilisateur
  const rebateRate = 0.003 + (userBoost / 100);
  const rebateAmount = outputAmount * rebateRate;

  // Coût réel = coût du swap - rebate
  const trueCost = swapCost - rebateAmount;

  return {
    ...route,
    swapCost,
    rebateAmount,
    trueCost,
    rebateRate: rebateRate * 100 // en pourcentage
  };
}

/**
 * Endpoint de santé
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Stats globales
 */
app.get('/stats/global', async (req, res) => {
  try {
    // Simulation de stats pour le MVP
    const stats = {
      totalVolume: 1234567,
      totalSwaps: 5678,
      totalNPI: 24680,
      totalRebates: 18510,
      totalBurned: 6170,
    };

    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Récupère les données cNFT d'un utilisateur
 */
app.get('/user/:wallet/cnft', async (req, res) => {
  try {
    const { wallet } = req.params;
    const userPubkey = new PublicKey(wallet);

    // Dériver le PDA du UserNft
    const userNftPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('user_nft'), userPubkey.toBuffer()],
      CNFT_PROGRAM_ID
    )[0];

    // Récupérer les données du compte
    const accountInfo = await connection.getAccountInfo(userNftPDA);

    if (!accountInfo) {
      return res.json({
        level: 0,
        boost: 0,
        lockedAmount: 0,
        exists: false
      });
    }

    // Décoder les données (même structure que dans useCNFT.ts)
    const data = accountInfo.data;
    let offset = 8; // Skip discriminator

    offset += 32; // authority
    const level = data.readUInt8(offset);
    offset += 1;
    const boost = data.readUInt16LE(offset) / 100; // Convertir en pourcentage
    offset += 2;
    const lockedAmount = Number(data.readBigUInt64LE(offset));

    res.json({
      level,
      boost,
      lockedAmount,
      exists: true
    });

  } catch (error) {
    console.error('Erreur lors de la récupération cNFT:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Génère un devis optimisé pour un swap
 */
app.post('/quote', async (req, res) => {
  try {
    const { inputMint, outputMint, amount, userWallet } = req.body;

    console.log('🔍 Génération de devis optimisé:', { inputMint, outputMint, amount, userWallet });

    // 1. Récupérer le boost utilisateur
    let userBoost = 0;
    if (userWallet) {
      try {
        const cnftResponse = await axios.get(`${req.protocol}://${req.get('host')}/user/${userWallet}/cnft`);
        userBoost = cnftResponse.data.boost || 0;
      } catch (error) {
        console.warn('Impossible de récupérer le boost utilisateur:', (error as Error).message);
      }
    }

    // 2. Récupérer les routes de tous les DEX en parallèle
    const [jupiterRoutes, raydiumRoutes, orcaRoutes] = await Promise.allSettled([
      getJupiterRoutes(inputMint, outputMint, amount),
      getRaydiumRoutes(inputMint, outputMint, amount),
      getOrcaRoutes(inputMint, outputMint, amount)
    ]);

    console.log('Routes récupérées:', {
      jupiter: jupiterRoutes,
      raydium: raydiumRoutes,
      orca: orcaRoutes
    });

    // 3. Consolider toutes les routes
    const allRoutes = [
      ...(jupiterRoutes.status === 'fulfilled' ? jupiterRoutes.value : []),
      ...(raydiumRoutes.status === 'fulfilled' ? raydiumRoutes.value : []),
      ...(orcaRoutes.status === 'fulfilled' ? orcaRoutes.value : [])
    ];

    if (allRoutes.length === 0) {
      return res.status(400).json({ error: 'Aucune route trouvée' });
    }

    // 4. Calculer le coût réel de chaque route
    const routesWithCosts = allRoutes.map(route => calculateTrueCost(route, amount, userBoost));

    // 5. Trier par meilleur coût
    routesWithCosts.sort((a, b) => a.trueCost - b.trueCost);

    // 6. Retourner la meilleure route
    const bestRoute = routesWithCosts[0];
    const savings = routesWithCosts[1] ? routesWithCosts[1].trueCost - bestRoute.trueCost : 0;

    res.json({
      bestRoute,
      allRoutes: routesWithCosts.slice(0, 5),
      savings,
      userBoost
    });

  } catch (error) {
    console.error('Erreur lors de la génération du devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Oracle SwapBack en écoute sur le port ${PORT}`);
  console.log(`📊 RPC Solana: ${SOLANA_RPC}`);
  console.log(`🔗 Jupiter API: ${JUPITER_API}`);
});
