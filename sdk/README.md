# 🔄 SwapBack SDK

SDK TypeScript officiel pour interagir avec le protocole SwapBack sur Solana.

[![npm version](https://img.shields.io/npm/v/@swapback/sdk.svg)](https://www.npmjs.com/package/@swapback/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🌟 Fonctionnalités

- 🔀 **Smart Routing** - Agrégation multi-DEX intelligente (Jupiter, Orca, Raydium, Meteora, Phoenix)
- 🛡️ **Protection MEV** - Bundles Jito pour swaps protégés
- 💰 **Rebates $BACK** - Jusqu'à 99% de remise sur les frais
- 🔥 **Buyback & Burn** - 100% des revenus protocolaires redistribués
- 🔒 **Lock & Boost** - Verrouillez $BACK pour booster vos rebates
- 📊 **Analytics** - Statistiques détaillées utilisateur et protocole
- 🤖 **DCA** - Dollar-Cost Averaging automatisé
- 🏆 **RFQ Competition** - Quotes privées Metis pour meilleures exécutions

## 📦 Installation

```bash
npm install @swapback/sdk @solana/web3.js @coral-xyz/anchor
```

## 🚀 Quick Start

### Configuration Basique

```typescript
import { SwapBackClient } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

// Connexion Solana
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Wallet
const wallet = Keypair.fromSecretKey(/* votre clé privée */);

// Configuration SDK
const client = new SwapBackClient({
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
  routerProgramId: new PublicKey('SwapRouter11111111111111111111111111111111'),
  buybackProgramId: new PublicKey('BuybackBurn111111111111111111111111111111'),
  oracleEndpoint: 'https://oracle.swapback.io'
});
```

### Swap Simple

```typescript
import { PublicKey } from '@solana/web3.js';

// Tokens
const SOL = new PublicKey('So11111111111111111111111111111111111111112');
const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// 1. Simuler le swap
const route = await client.simulateRoute(
  SOL,           // Token input
  USDC,          // Token output
  1.0,           // Montant en SOL
  0.5            // Slippage 0.5%
);

console.log(`Prix: ${route.estimatedOutput} USDC`);
console.log(`NPI: ${route.npi.toFixed(2)}`);
console.log(`Rebate: ${route.rebateAmount} $BACK`);

// 2. Exécuter le swap
const result = await client.executeSwap(
  SOL,
  USDC,
  1.0,
  route.estimatedOutput * 0.995, // Minimum avec slippage
  route
);

console.log(`✅ Swap réussi: ${result.signature}`);
console.log(`Reçu: ${result.actualOutput} USDC`);
console.log(`Rebate gagné: ${result.rebateEarned} $BACK`);
```

### Swap avec Protection MEV

```typescript
// Utiliser Jito bundles pour protection MEV
const signature = await client.executeSwapWithBundle(
  SOL,
  USDC,
  10.0,  // 10 SOL
  route.estimatedOutput * 0.995,
  route
);

console.log(`✅ Swap protégé MEV: ${signature}`);
```

## 📚 Guide d'Utilisation

### 1. Simulation de Routes

La méthode `simulateRoute()` analyse toutes les routes possibles et retourne la meilleure :

```typescript
const route = await client.simulateRoute(
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputAmount: number,
  slippage?: number  // Default: 0.5%
);

// Informations retournées
interface RouteSimulation {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  estimatedOutput: number;
  priceImpact: number;
  route: 'jupiter' | 'metis-rfq' | 'direct';
  npi: number;              // Net Price Improvement
  rebateAmount: number;      // $BACK rebate
  burnAmount: number;        // $BACK burned
  estimatedFeeUSD: number;
}
```

**Routes Disponibles:**
- `jupiter` - Agrégateur Jupiter (multi-DEX)
- `metis-rfq` - Request For Quote privé Metis
- `direct` - Routing direct SwapBack

### 2. Exécution de Swaps

#### Swap Standard

```typescript
const result = await client.executeSwap(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number,
  minimumOutput: number,
  route: RouteSimulation
);

// Résultat
interface SwapResult {
  signature: string;
  actualOutput: number;
  npiRealized: number;
  rebateEarned: number;
  burnAmount: number;
  route: RouteSimulation;
}
```

#### Swap avec MEV Protection (Jito Bundle)

```typescript
// Pour swaps > 1000 USDC, recommandé d'utiliser bundles
const signature = await client.executeSwapWithBundle(
  inputMint,
  outputMint,
  amount,
  minimumOutput,
  route
);
```

**Quand utiliser les bundles ?**
- ✅ Swaps > $1,000
- ✅ Tokens volatils
- ✅ Périodes de haute congestion
- ❌ Micro-swaps (< $100) - frais bundle > économie MEV

### 3. Lock & Unlock $BACK

Verrouillez $BACK pour booster vos rebates jusqu'à 10x :

```typescript
// Lock $BACK
const lockTx = await client.lockTokens(
  1000,  // Montant $BACK
  30     // Durée en jours (7, 30, 90, 180, 365)
);

// Déverrouillage anticipé (avec pénalité)
const unlockTx = await client.unlockTokens();
```

**Tableau des Boosts:**

| Durée | Boost Rebate | Pénalité Early Unlock |
|-------|--------------|----------------------|
| 7j    | 1.2x         | 50%                  |
| 30j   | 2x           | 40%                  |
| 90j   | 4x           | 30%                  |
| 180j  | 7x           | 20%                  |
| 365j  | 10x          | 10%                  |

### 4. Rebates & Rewards

#### Récupérer les Rebates

```typescript
// Claim tous les rebates accumulés
const claimTx = await client.claimRewards();
console.log(`✅ Rebates réclamés: ${claimTx}`);
```

#### Consulter le Solde Rebate

```typescript
import { BN } from '@coral-xyz/anchor';

const balance: BN = await client.getRebateBalance(
  wallet.publicKey  // Optionnel, utilise le wallet connecté si omis
);

console.log(`Rebates disponibles: ${balance.toNumber() / 1e9} $BACK`);
```

### 5. Statistiques

#### Stats Utilisateur

```typescript
const stats = await client.getUserStats();

console.log(`Total volume: $${stats.totalVolumeUSD.toLocaleString()}`);
console.log(`Rebates gagnés: ${stats.totalRebatesEarned} $BACK`);
console.log(`$BACK locked: ${stats.backTokensLocked}`);
console.log(`Boost actif: ${stats.rebateBoost}x`);
console.log(`Savings totaux: $${stats.totalSavingsUSD}`);

interface UserStats {
  totalSwaps: number;
  totalVolumeUSD: number;
  totalRebatesEarned: number;
  totalSavingsUSD: number;
  backTokensLocked: number;
  lockExpiryDate: Date | null;
  rebateBoost: number;
  nftTier: number;
  averageNPI: number;
}
```

#### Stats Globales

```typescript
const globalStats = await client.getGlobalStats();

console.log(`TVL: $${globalStats.totalValueLocked.toLocaleString()}`);
console.log(`Volume 24h: $${globalStats.volume24h.toLocaleString()}`);
console.log(`$BACK burned: ${globalStats.totalBurned.toLocaleString()}`);

interface GlobalStats {
  totalSwaps: number;
  totalVolumeUSD: number;
  totalRebatesPaid: number;
  totalBurned: number;
  totalValueLocked: number;
  activeUsers: number;
  volume24h: number;
  averageNPI: number;
}
```

## 🎯 Exemples Avancés

### Multi-Route Comparison

```typescript
// Comparer toutes les routes disponibles
const routes = await Promise.all([
  client.simulateRoute(SOL, USDC, 10, 0.5),
  client.simulateRoute(SOL, USDC, 10, 1.0),  // Plus de slippage
  client.simulateRoute(SOL, USDC, 10, 0.1),  // Moins de slippage
]);

// Trouver la meilleure
const best = routes.reduce((best, route) => 
  route.npi > best.npi ? route : best
);

console.log(`Meilleure route: ${best.route} (NPI: ${best.npi})`);
```

### Gestion d'Erreurs

```typescript
try {
  const result = await client.executeSwap(SOL, USDC, 1.0, minOutput, route);
  console.log(`✅ Swap réussi: ${result.signature}`);
} catch (error) {
  if (error.message.includes('Slippage')) {
    console.error('❌ Slippage trop élevé, réessayez avec tolérance plus grande');
  } else if (error.message.includes('Insufficient')) {
    console.error('❌ Solde insuffisant');
  } else if (error.message.includes('Network')) {
    console.error('❌ Erreur réseau, réessayez');
  } else {
    console.error(`❌ Erreur: ${error.message}`);
  }
}
```

### Batch Operations

```typescript
// Récupérer plusieurs statistiques en parallèle
const [userStats, globalStats, rebateBalance] = await Promise.all([
  client.getUserStats(),
  client.getGlobalStats(),
  client.getRebateBalance()
]);
```

## 🔧 Configuration Avancée

### Network Endpoints

```typescript
// Mainnet
const MAINNET_CONFIG = {
  connection: new Connection('https://api.mainnet-beta.solana.com'),
  routerProgramId: new PublicKey('SwapRouter11111111111111111111111111111111'),
  buybackProgramId: new PublicKey('BuybackBurn111111111111111111111111111111'),
  oracleEndpoint: 'https://oracle.swapback.io'
};

// Devnet
const DEVNET_CONFIG = {
  connection: new Connection('https://api.devnet.solana.com'),
  routerProgramId: new PublicKey('DevRouter11111111111111111111111111111111'),
  buybackProgramId: new PublicKey('DevBuyback111111111111111111111111111111'),
  oracleEndpoint: 'https://oracle-dev.swapback.io'
};
```

### Custom Wallet Adapter

```typescript
import { WalletContextState } from '@solana/wallet-adapter-react';

// Utiliser avec wallet-adapter
const client = new SwapBackClient({
  connection,
  wallet: {
    publicKey: walletContext.publicKey!,
    signTransaction: walletContext.signTransaction!,
    signAllTransactions: walletContext.signAllTransactions!
  },
  // ... autres configs
});
```

## 📊 Types TypeScript

Le SDK est entièrement typé. Importez les types :

```typescript
import {
  SwapBackClient,
  SwapBackConfig,
  RouteSimulation,
  SwapResult,
  UserStats,
  GlobalStats,
  SwapParams,
  RouteType,
  SwapBackWallet
} from '@swapback/sdk';
```

### Types Principaux

```typescript
interface SwapBackConfig {
  connection: Connection;
  wallet: SwapBackWallet;
  routerProgramId: PublicKey;
  buybackProgramId: PublicKey;
  oracleEndpoint: string;
}

interface SwapBackWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

enum RouteType {
  Direct = 'direct',
  Aggregator = 'jupiter',
  RFQ = 'metis-rfq',
  Bundle = 'jito-bundle'
}
```

## 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Coverage
npm run test:coverage
```

## 🐛 Dépannage

### Erreur: "Program not deployed"

Le SDK fonctionne en mode mock jusqu'au déploiement des programmes Solana. Les simulations retournent des données réalistes.

### Erreur: "Insufficient SOL for transaction"

Assurez-vous d'avoir assez de SOL pour les frais de transaction (~0.005 SOL).

### Erreur: "Slippage tolerance exceeded"

Augmentez la tolérance de slippage ou attendez de meilleures conditions de marché.

### Performance Optimization

```typescript
// Réutilisez l'instance client
const client = new SwapBackClient(config);  // Une seule fois

// Évitez les simulations inutiles
const route = await client.simulateRoute(...);  // Cache 30s
```

## 🔗 Liens

- **Documentation:** [docs.swapback.io](https://docs.swapback.io)
- **API Reference:** [docs.swapback.io/api](https://docs.swapback.io/api)
- **GitHub:** [github.com/BacBacta/SwapBack](https://github.com/BacBacta/SwapBack)
- **Discord:** [discord.gg/swapback](https://discord.gg/swapback)
- **Twitter:** [@SwapBackDEX](https://twitter.com/SwapBackDEX)

## 📄 License

MIT © SwapBack

## 🤝 Support

- 📧 Email: support@swapback.io
- 💬 Discord: [discord.gg/swapback](https://discord.gg/swapback)
- 🐛 Issues: [GitHub Issues](https://github.com/BacBacta/SwapBack/issues)

---

**Fait avec ❤️ par l'équipe SwapBack**
