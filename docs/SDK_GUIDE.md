# 📖 Guide Complet du SDK SwapBack

Guide détaillé pour développeurs utilisant le SDK SwapBack.

## 📚 Table des Matières

1. [Installation & Setup](#installation--setup)
2. [Architecture](#architecture)
3. [Cas d'Usage](#cas-dusage)
4. [API Référence](#api-référence)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Installation & Setup

### Prérequis

```json
{
  "node": ">=18.0.0",
  "npm": ">=9.0.0"
}
```

### Installation

```bash
npm install @swapback/sdk @solana/web3.js @coral-xyz/anchor
```

### Configuration Environnement

```bash
# .env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
WALLET_PRIVATE_KEY=your_private_key_here
SWAPBACK_ORACLE=https://oracle.swapback.io
```

### Premier Code

```typescript
// setup.ts
import { SwapBackClient } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Connexion RPC
export const connection = new Connection(
  process.env.SOLANA_RPC_URL!,
  'confirmed'
);

// Wallet depuis variable d'env
export const wallet = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
);

// Constantes programmes
export const ROUTER_PROGRAM = new PublicKey(
  'SwapRouter11111111111111111111111111111111'
);
export const BUYBACK_PROGRAM = new PublicKey(
  'BuybackBurn111111111111111111111111111111'
);

// Client SDK
export const client = new SwapBackClient({
  connection,
  wallet: {
    publicKey: wallet.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(wallet);
      return tx;
    },
    signAllTransactions: async (txs) => {
      txs.forEach(tx => tx.partialSign(wallet));
      return txs;
    }
  },
  routerProgramId: ROUTER_PROGRAM,
  buybackProgramId: BUYBACK_PROGRAM,
  oracleEndpoint: process.env.SWAPBACK_ORACLE!
});
```

---

## Architecture

### Structure du SDK

```
@swapback/sdk
├── SwapBackClient          # Client principal
├── services/
│   ├── SwapExecutor        # Exécution swaps
│   ├── JupiterService      # Intégration Jupiter
│   ├── RFQCompetitionService # Quotes Metis
│   ├── JitoBundleService   # MEV protection
│   ├── LiquidityDataCollector # Agrégation liquidité
│   ├── IntelligentOrderRouter # Routing intelligent
│   └── OraclePriceService  # Prix oracles
├── clients/
│   ├── BackTokenClient     # $BACK token ops
│   ├── CnftClient          # cNFT ops
│   └── RouterClient        # High-level routing
└── types/                  # Types TypeScript
```

### Flux de Swap

```
1. User Request
   ↓
2. simulateRoute()
   ↓
3. LiquidityDataCollector → Fetch multi-DEX
   ↓
4. IntelligentOrderRouter → Optimize route
   ↓
5. RFQCompetitionService → Check Metis quotes
   ↓
6. Return best RouteSimulation
   ↓
7. executeSwap()
   ↓
8. SwapExecutor → Build transaction
   ↓
9. JitoBundleService (optional) → MEV protection
   ↓
10. Submit to chain
    ↓
11. Return SwapResult
```

---

## Cas d'Usage

### 1. Simple Swap Bot

Bot qui swap automatiquement à intervalle régulier :

```typescript
// swap-bot.ts
import { client, connection } from './setup';
import { PublicKey } from '@solana/web3.js';

const SOL = new PublicKey('So11111111111111111111111111111111111111112');
const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function swapBot() {
  setInterval(async () => {
    try {
      console.log('🔄 Démarrage swap...');
      
      // 1. Simulation
      const route = await client.simulateRoute(SOL, USDC, 0.1, 1.0);
      
      console.log(`Prix: ${route.estimatedOutput} USDC`);
      console.log(`NPI: ${route.npi.toFixed(2)}%`);
      
      // 2. Vérifier si bon NPI
      if (route.npi < 0.5) {
        console.log('⏭️ NPI trop faible, skip');
        return;
      }
      
      // 3. Exécuter
      const minOutput = route.estimatedOutput * 0.99;
      const result = await client.executeSwap(SOL, USDC, 0.1, minOutput, route);
      
      console.log(`✅ Swap: ${result.signature}`);
      console.log(`Reçu: ${result.actualOutput} USDC`);
      console.log(`Rebate: ${result.rebateEarned} $BACK`);
      
    } catch (error) {
      console.error(`❌ Erreur: ${error.message}`);
    }
  }, 60_000); // Toutes les minutes
}

swapBot();
```

### 2. Portfolio Rebalancer

Rééquilibrer automatiquement un portfolio :

```typescript
// rebalancer.ts
import { client } from './setup';
import { PublicKey } from '@solana/web3.js';

interface Target {
  mint: PublicKey;
  symbol: string;
  targetPercent: number;
}

const PORTFOLIO: Target[] = [
  { mint: SOL_MINT, symbol: 'SOL', targetPercent: 40 },
  { mint: USDC_MINT, symbol: 'USDC', targetPercent: 30 },
  { mint: BONK_MINT, symbol: 'BONK', targetPercent: 20 },
  { mint: JUP_MINT, symbol: 'JUP', targetPercent: 10 },
];

async function rebalance() {
  // 1. Fetch balances actuels
  const balances = await fetchBalances(wallet.publicKey);
  const totalValueUSD = calculateTotalValue(balances);
  
  // 2. Calculer déviations
  for (const target of PORTFOLIO) {
    const currentValue = balances[target.symbol] || 0;
    const currentPercent = (currentValue / totalValueUSD) * 100;
    const deviation = currentPercent - target.targetPercent;
    
    // 3. Rebalancer si déviation > 5%
    if (Math.abs(deviation) > 5) {
      if (deviation > 0) {
        // Trop de ce token, vendre
        const sellAmount = (deviation / 100) * totalValueUSD;
        await sellToken(target.mint, sellAmount);
      } else {
        // Pas assez, acheter
        const buyAmount = (Math.abs(deviation) / 100) * totalValueUSD;
        await buyToken(target.mint, buyAmount);
      }
    }
  }
}

async function sellToken(mint: PublicKey, amountUSD: number) {
  // Vendre pour USDC
  const route = await client.simulateRoute(mint, USDC_MINT, amountUSD, 1.0);
  await client.executeSwap(mint, USDC_MINT, amountUSD, route.estimatedOutput * 0.98, route);
}

async function buyToken(mint: PublicKey, amountUSD: number) {
  // Acheter avec USDC
  const route = await client.simulateRoute(USDC_MINT, mint, amountUSD, 1.0);
  await client.executeSwap(USDC_MINT, mint, amountUSD, route.estimatedOutput * 0.98, route);
}

// Rebalancer toutes les 6 heures
setInterval(rebalance, 6 * 60 * 60 * 1000);
```

### 3. Price Alert & Auto-Swap

Swap automatique quand prix atteint un seuil :

```typescript
// price-alert.ts
import { client } from './setup';
import { PublicKey } from '@solana/web3.js';

interface PriceAlert {
  inputMint: PublicKey;
  outputMint: PublicKey;
  targetPrice: number;
  amount: number;
  direction: 'above' | 'below';
}

const alerts: PriceAlert[] = [
  {
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    targetPrice: 100, // Vendre SOL si > $100
    amount: 1.0,
    direction: 'above'
  },
  {
    inputMint: USDC_MINT,
    outputMint: SOL_MINT,
    targetPrice: 80, // Acheter SOL si < $80
    amount: 100,
    direction: 'below'
  }
];

async function checkAlerts() {
  for (const alert of alerts) {
    try {
      // 1. Simuler pour obtenir prix actuel
      const route = await client.simulateRoute(
        alert.inputMint,
        alert.outputMint,
        alert.amount,
        1.0
      );
      
      const currentPrice = route.estimatedOutput / alert.amount;
      
      // 2. Vérifier condition
      const triggered = alert.direction === 'above' 
        ? currentPrice > alert.targetPrice
        : currentPrice < alert.targetPrice;
      
      if (triggered) {
        console.log(`🚨 Alert triggered! Prix: $${currentPrice}`);
        
        // 3. Exécuter swap
        const minOutput = route.estimatedOutput * 0.98;
        const result = await client.executeSwap(
          alert.inputMint,
          alert.outputMint,
          alert.amount,
          minOutput,
          route
        );
        
        console.log(`✅ Swap executé: ${result.signature}`);
        
        // 4. Retirer l'alerte (one-shot)
        alerts.splice(alerts.indexOf(alert), 1);
      }
      
    } catch (error) {
      console.error(`❌ Erreur alert: ${error.message}`);
    }
  }
}

// Vérifier toutes les 30 secondes
setInterval(checkAlerts, 30_000);
```

### 4. MEV-Protected Large Trade

Exécuter un gros trade avec protection MEV :

```typescript
// large-trade.ts
import { client } from './setup';
import { PublicKey } from '@solana/web3.js';

async function executeLargeTrade(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number
) {
  console.log(`💼 Large trade: ${amount} tokens`);
  
  // 1. Simulation standard
  const route = await client.simulateRoute(inputMint, outputMint, amount, 0.5);
  
  console.log(`Route: ${route.route}`);
  console.log(`Price impact: ${route.priceImpact.toFixed(2)}%`);
  
  // 2. Si impact > 1%, split en plusieurs trades
  if (route.priceImpact > 1.0) {
    console.log('⚠️ High impact, splitting trade...');
    return await executeSplitTrade(inputMint, outputMint, amount);
  }
  
  // 3. Si montant > $10k, utiliser Jito bundle
  if (route.estimatedOutput > 10_000) {
    console.log('🛡️ Using Jito bundle for MEV protection...');
    
    const signature = await client.executeSwapWithBundle(
      inputMint,
      outputMint,
      amount,
      route.estimatedOutput * 0.995,
      route
    );
    
    console.log(`✅ Protected swap: ${signature}`);
    return signature;
  }
  
  // 4. Swap standard sinon
  const result = await client.executeSwap(
    inputMint,
    outputMint,
    amount,
    route.estimatedOutput * 0.995,
    route
  );
  
  return result.signature;
}

async function executeSplitTrade(
  inputMint: PublicKey,
  outputMint: PublicKey,
  totalAmount: number
) {
  // Split en 5 trades de taille égale
  const numSplits = 5;
  const splitAmount = totalAmount / numSplits;
  
  console.log(`Splitting into ${numSplits} trades of ${splitAmount} each`);
  
  const results = [];
  
  for (let i = 0; i < numSplits; i++) {
    const route = await client.simulateRoute(inputMint, outputMint, splitAmount, 0.5);
    const result = await client.executeSwap(
      inputMint,
      outputMint,
      splitAmount,
      route.estimatedOutput * 0.98,
      route
    );
    
    results.push(result);
    console.log(`✅ Split ${i + 1}/${numSplits}: ${result.signature}`);
    
    // Attendre 2 secondes entre chaque trade
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return results;
}
```

### 5. Rebate Maximizer

Optimiser pour maximiser les rebates $BACK :

```typescript
// rebate-maximizer.ts
import { client } from './setup';

async function maximizeRebates() {
  // 1. Vérifier stats actuelles
  const stats = await client.getUserStats();
  
  console.log(`Current boost: ${stats.rebateBoost}x`);
  console.log(`Locked $BACK: ${stats.backTokensLocked}`);
  console.log(`Rebates earned: ${stats.totalRebatesEarned} $BACK`);
  
  // 2. Si pas de lock, suggérer lock optimal
  if (stats.backTokensLocked === 0) {
    console.log('💡 Suggestion: Lock $BACK pour booster rebates!');
    
    const backBalance = await getBackBalance(wallet.publicKey);
    
    if (backBalance >= 1000) {
      // Lock 30% du solde pour 90 jours = 4x boost
      const lockAmount = backBalance * 0.3;
      const lockTx = await client.lockTokens(lockAmount, 90);
      
      console.log(`✅ Locked ${lockAmount} $BACK for 90 days (4x boost)`);
      console.log(`Transaction: ${lockTx}`);
    }
  }
  
  // 3. Calculer ROI du boost
  const monthlyVolume = await estimateMonthlyVolume(wallet.publicKey);
  const currentRebates = monthlyVolume * 0.0099; // 0.99% rebate base
  const boostedRebates = currentRebates * stats.rebateBoost;
  
  console.log(`\n💰 Rebate Projection (monthly):`);
  console.log(`Without boost: ${currentRebates.toFixed(2)} $BACK`);
  console.log(`With ${stats.rebateBoost}x boost: ${boostedRebates.toFixed(2)} $BACK`);
  console.log(`Extra earnings: +${(boostedRebates - currentRebates).toFixed(2)} $BACK/month`);
  
  // 4. Auto-claim si rebates > seuil
  const rebateBalance = await client.getRebateBalance();
  const rebateAmount = rebateBalance.toNumber() / 1e9;
  
  if (rebateAmount > 100) {
    console.log(`\n💸 Auto-claiming ${rebateAmount} $BACK rebates...`);
    const claimTx = await client.claimRewards();
    console.log(`✅ Claimed: ${claimTx}`);
  }
}

// Vérifier tous les jours
setInterval(maximizeRebates, 24 * 60 * 60 * 1000);
```

---

## API Référence

### SwapBackClient

#### Constructor

```typescript
new SwapBackClient(config: SwapBackConfig)
```

**Paramètres:**
- `config.connection`: Connection Solana RPC
- `config.wallet`: Wallet adapter
- `config.routerProgramId`: Programme router SwapBack
- `config.buybackProgramId`: Programme buyback/burn
- `config.oracleEndpoint`: URL oracle API

#### Méthodes

##### simulateRoute()

```typescript
async simulateRoute(
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputAmount: number,
  slippage: number = 0.5
): Promise<RouteSimulation>
```

Simule un swap et retourne la meilleure route.

**Retour:** `RouteSimulation`
- `inputMint`: Token input
- `outputMint`: Token output
- `inputAmount`: Montant input
- `estimatedOutput`: Output estimé
- `priceImpact`: Impact prix (%)
- `route`: Type de route ('jupiter' | 'metis-rfq' | 'direct')
- `npi`: Net Price Improvement (%)
- `rebateAmount`: Rebate $BACK estimé
- `burnAmount`: $BACK brûlé
- `estimatedFeeUSD`: Frais estimés

##### executeSwap()

```typescript
async executeSwap(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number,
  minimumOutput: number,
  route: RouteSimulation
): Promise<SwapResult>
```

Exécute un swap atomique.

**Retour:** `SwapResult`
- `signature`: Transaction signature
- `actualOutput`: Output réel reçu
- `npiRealized`: NPI réalisé
- `rebateEarned`: Rebate gagné
- `burnAmount`: Montant brûlé
- `route`: Route utilisée

##### executeSwapWithBundle()

```typescript
async executeSwapWithBundle(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number,
  minimumOutput: number,
  route: RouteSimulation
): Promise<string>
```

Exécute swap avec protection MEV (Jito bundle).

**Retour:** Transaction signature

##### lockTokens()

```typescript
async lockTokens(
  amount: number,
  durationDays: number
): Promise<string>
```

Verrouille $BACK pour boost rebate.

**Durées supportées:** 7, 30, 90, 180, 365 jours

**Retour:** Transaction signature

##### unlockTokens()

```typescript
async unlockTokens(): Promise<string>
```

Déverrouille $BACK (avec pénalité si anticipé).

**Retour:** Transaction signature

##### claimRewards()

```typescript
async claimRewards(): Promise<string>
```

Récupère tous les rebates accumulés.

**Retour:** Transaction signature

##### getRebateBalance()

```typescript
async getRebateBalance(wallet?: PublicKey): Promise<BN>
```

Consulte le solde rebate d'un wallet.

**Retour:** Balance en lamports (BN)

##### getUserStats()

```typescript
async getUserStats(userPubkey?: PublicKey): Promise<UserStats>
```

Récupère statistiques utilisateur.

**Retour:** `UserStats`
- `totalSwaps`: Nombre total swaps
- `totalVolumeUSD`: Volume total ($)
- `totalRebatesEarned`: Total rebates gagnés
- `totalSavingsUSD`: Économies totales ($)
- `backTokensLocked`: $BACK verrouillés
- `lockExpiryDate`: Date expiration lock
- `rebateBoost`: Multiplicateur rebate actif
- `nftTier`: Tier NFT
- `averageNPI`: NPI moyen

##### getGlobalStats()

```typescript
async getGlobalStats(): Promise<GlobalStats>
```

Récupère statistiques protocole.

**Retour:** `GlobalStats`
- `totalSwaps`: Total swaps protocole
- `totalVolumeUSD`: Volume total ($)
- `totalRebatesPaid`: Rebates payés
- `totalBurned`: $BACK brûlé
- `totalValueLocked`: TVL ($)
- `activeUsers`: Utilisateurs actifs
- `volume24h`: Volume 24h ($)
- `averageNPI`: NPI moyen

---

## Best Practices

### 1. Gestion des Erreurs

```typescript
// ✅ BON - Gestion exhaustive
try {
  const result = await client.executeSwap(...);
} catch (error) {
  if (error instanceof SlippageError) {
    // Retry avec plus de slippage
    return retryWithHigherSlippage();
  } else if (error instanceof InsufficientFundsError) {
    // Logger et notifier
    logger.error('Insufficient funds', { wallet: wallet.publicKey });
    notifyUser('Not enough SOL for transaction');
  } else {
    // Erreur inconnue
    logger.error('Unknown swap error', { error });
    throw error;
  }
}

// ❌ MAUVAIS - Catch générique
try {
  await client.executeSwap(...);
} catch (error) {
  console.log('Error:', error);
}
```

### 2. Optimisation Performance

```typescript
// ✅ BON - Réutiliser client
const client = new SwapBackClient(config); // Une fois
async function swap1() { await client.executeSwap(...); }
async function swap2() { await client.executeSwap(...); }

// ❌ MAUVAIS - Créer client à chaque fois
async function swap1() {
  const client = new SwapBackClient(config);
  await client.executeSwap(...);
}
```

### 3. Slippage Management

```typescript
// ✅ BON - Slippage adaptatif
function getSlippage(volatility: number, liquidity: number): number {
  if (volatility > 5 && liquidity < 1_000_000) {
    return 2.0; // 2% pour tokens volatils/illiquides
  } else if (volatility > 2) {
    return 1.0; // 1% pour volatilité moyenne
  } else {
    return 0.5; // 0.5% pour stablecoins/tokens liquides
  }
}

// ❌ MAUVAIS - Slippage fixe
const slippage = 1.0; // Toujours 1%
```

### 4. Transaction Confirmation

```typescript
// ✅ BON - Attendre confirmation
const signature = await client.executeSwap(...);
await connection.confirmTransaction(signature, 'confirmed');
console.log('✅ Swap confirmed');

// ❌ MAUVAIS - Ne pas attendre
const signature = await client.executeSwap(...);
console.log('Done'); // Peut ne pas être confirmé!
```

### 5. Rate Limiting

```typescript
// ✅ BON - Rate limiting
import pLimit from 'p-limit';

const limit = pLimit(3); // Max 3 requêtes simultanées

const promises = tokens.map(token =>
  limit(() => client.simulateRoute(SOL, token, 1.0))
);

await Promise.all(promises);

// ❌ MAUVAIS - Trop de requêtes parallèles
await Promise.all(
  tokens.map(token => client.simulateRoute(SOL, token, 1.0))
); // Peut surcharger RPC
```

---

## Troubleshooting

### Erreur: "Failed to simulate route"

**Cause:** RPC timeout ou token invalide

**Solution:**
```typescript
// Augmenter timeout RPC
const connection = new Connection(RPC_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60_000 // 60s
});

// Vérifier validité token
const tokenInfo = await connection.getParsedAccountInfo(tokenMint);
if (!tokenInfo.value) {
  throw new Error('Invalid token mint');
}
```

### Erreur: "Transaction too large"

**Cause:** Trop d'instructions dans la transaction

**Solution:**
```typescript
// Utiliser versioned transactions
import { TransactionMessage, VersionedTransaction } from '@solana/web3.js';

// Ou split en plusieurs transactions
const tx1 = new Transaction().add(...instructions.slice(0, 5));
const tx2 = new Transaction().add(...instructions.slice(5));

await sendAndConfirmTransaction(connection, tx1, [wallet]);
await sendAndConfirmTransaction(connection, tx2, [wallet]);
```

### Erreur: "Insufficient SOL"

**Cause:** Pas assez de SOL pour frais

**Solution:**
```typescript
// Vérifier solde avant swap
const balance = await connection.getBalance(wallet.publicKey);
const MIN_SOL_BALANCE = 0.01 * LAMPORTS_PER_SOL;

if (balance < MIN_SOL_BALANCE) {
  throw new Error('Need at least 0.01 SOL for transaction fees');
}
```

### Performance Lente

**Cause:** RPC surchargé

**Solution:**
```typescript
// Utiliser RPC premium
const PREMIUM_RPC = 'https://api.mainnet-beta.solana.com'; // Remplacer par Helius/Triton

// Ou ajouter fallback
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana'
];

async function getConnectionWithFallback() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const conn = new Connection(endpoint);
      await conn.getLatestBlockhash();
      return conn; // RPC fonctionne
    } catch {
      continue;
    }
  }
  throw new Error('All RPC endpoints failed');
}
```

---

**Besoin d'aide ?** [Discord](https://discord.gg/swapback) | [GitHub Issues](https://github.com/BacBacta/SwapBack/issues)
