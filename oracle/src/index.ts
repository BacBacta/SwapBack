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
    
    const simulation = {
      type: usesIntermediate ? "Aggregator" : "Direct",
      inputAmount: baseAmount,
      estimatedOutput: baseAmount * 0.995,
      npi: baseAmount * 0.01,
      rebateAmount: baseAmount * 0.0075,
      burnAmount: baseAmount * 0.0025,
      fees: baseAmount * 0.001,
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
