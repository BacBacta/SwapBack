import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware pour parser le JSON
app.use(express.json());

// Gestionnaires d'erreurs global (log seulement)
process.on('uncaughtException', (error) => {
  console.error('❌ Exception non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée:', reason);
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simulation d'itinéraire avec données mockées
app.post('/simulate', (req: Request, res: Response) => {
  console.log('📥 Requête simulation reçue:', req.body);
  
  try {
    const { inputMint, outputMint, inputAmount } = req.body;

    if (!inputMint || !outputMint || !inputAmount) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const baseAmount = parseFloat(inputAmount);
    if (isNaN(baseAmount)) {
      return res.status(400).json({ error: 'inputAmount invalide' });
    }
    
    // Simulation avec données mockées - Routes multi-étapes
    const usesIntermediate = Math.random() > 0.5; // 50% de chance d'avoir une route multi-étapes
    
    let routes;
    if (usesIntermediate && inputMint !== outputMint) {
      // Route en 2 étapes via USDC comme token intermédiaire
      const intermediateToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
      const step1Output = baseAmount * 0.998;
      const step2Output = step1Output * 0.997;
      
      routes = [
        {
          label: 'Raydium',
          inputMint,
          outputMint: intermediateToken,
          inAmount: baseAmount.toString(),
          outAmount: step1Output.toString(),
          fee: (baseAmount * 0.002).toString()
        },
        {
          label: 'Orca',
          inputMint: intermediateToken,
          outputMint, // ✅ Correction: utiliser le outputMint final, pas l'intermédiaire
          inAmount: step1Output.toString(),
          outAmount: step2Output.toString(),
          fee: (step1Output * 0.003).toString()
        }
      ];
    } else {
      // Route directe
      routes = [{
        label: 'Jupiter Aggregator',
        inputMint,
        outputMint,
        inAmount: baseAmount.toString(),
        outAmount: (baseAmount * 0.995).toString(),
        fee: (baseAmount * 0.005).toString()
      }];
    }
    
    // Calculer le prix non optimisé (ce que l'utilisateur obtiendrait sans SwapBack)
    // Prix standard du marché avec frais plus élevés (~1.5% au lieu de 0.5%)
    const nonOptimizedOutput = baseAmount * 0.985; // Frais standard 1.5%
    const optimizedOutput = baseAmount * 0.995; // Avec SwapBack: 0.5%
    
    // Calculer les économies réalisées par SwapBack
    const totalSavings = optimizedOutput - nonOptimizedOutput; // 1% d'économie
    
    // Répartition des économies SwapBack :
    // - 60% NPI (Net Price Improvement) = 0.6% du montant d'entrée
    // - 30% Rebate (remise utilisateur) = 0.3% du montant d'entrée  
    // - 10% Burn (brûlage $BACK) = 0.1% du montant d'entrée
    const npi = baseAmount * 0.006; // 0.6%
    const rebateAmount = baseAmount * 0.003; // 0.3%
    const burnAmount = baseAmount * 0.001; // 0.1%
    const fees = baseAmount * 0.001; // Frais réseau 0.1%
    
    const simulation = {
      type: usesIntermediate ? "Aggregator" : "Direct",
      inputAmount: baseAmount,
      estimatedOutput: optimizedOutput, // Prix avec SwapBack
      nonOptimizedOutput: nonOptimizedOutput, // ✨ Prix sans SwapBack (pour comparaison)
      npi: npi,
      rebateAmount: rebateAmount,
      burnAmount: burnAmount,
      fees: fees,
      priceImpact: Math.random() * 0.5, // Impact aléatoire entre 0 et 0.5%
      route: routes
    };

    console.log('📤 Simulation réussie:', simulation);
    res.json(simulation);
  } catch (error) {
    console.error('❌ Erreur simulation:', error);
    res.status(500).json({ 
      error: 'Erreur interne', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Oracle SwapBack démarré sur le port ${PORT}`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - Simulate: http://localhost:${PORT}/simulate`);
});
