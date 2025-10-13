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
    
    // Simulation avec données mockées
    const simulation = {
      type: "Aggregator",
      inputAmount: baseAmount,
      estimatedOutput: baseAmount * 0.995,
      npi: baseAmount * 0.01,
      rebateAmount: baseAmount * 0.0075,
      burnAmount: baseAmount * 0.0025,
      fees: baseAmount * 0.001,
      priceImpact: 0.1,
      route: [{
        label: 'Mock DEX',
        inputMint,
        outputMint,
        inAmount: inputAmount,
        outAmount: (baseAmount * 0.995).toString(),
        fee: (baseAmount * 0.001).toString()
      }]
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
