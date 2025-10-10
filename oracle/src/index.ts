import express from 'express';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';

const connection = new Connection(SOLANA_RPC, 'confirmed');

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
  } else if (quote.marketInfos && quote.marketInfos.some((m: any) => m.label === 'RFQ')) {
    return 'RFQ'; // Route via RFQ
  }
  return 'Direct';
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
    // TODO: Lire depuis la blockchain
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

app.listen(PORT, () => {
  console.log(`🚀 Oracle SwapBack en écoute sur le port ${PORT}`);
  console.log(`📊 RPC Solana: ${SOLANA_RPC}`);
  console.log(`🔗 Jupiter API: ${JUPITER_API}`);
});
