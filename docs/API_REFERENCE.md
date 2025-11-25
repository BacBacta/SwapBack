# 📘 API Reference - SwapBack SDK

Référence complète de l'API du SDK SwapBack.

## Table des Matières

- [SwapBackClient](#swapbackclient)
- [Types](#types)
- [Services](#services)
- [Clients Spécialisés](#clients-spécialisés)
- [Constantes](#constantes)

---

## SwapBackClient

Client principal pour interagir avec SwapBack.

### Constructor

```typescript
constructor(config: SwapBackConfig)
```

#### Paramètres

**config: SwapBackConfig**

| Propriété | Type | Description |
|-----------|------|-------------|
| `connection` | `Connection` | Connexion Solana RPC |
| `wallet` | `SwapBackWallet` | Wallet adapter |
| `routerProgramId` | `PublicKey` | Programme router ID |
| `buybackProgramId` | `PublicKey` | Programme buyback ID |
| `oracleEndpoint` | `string` | URL API oracle |

#### Exemple

```typescript
const client = new SwapBackClient({
  connection: new Connection('https://api.mainnet-beta.solana.com'),
  wallet: {
    publicKey: wallet.publicKey,
    signTransaction: async (tx) => { /* ... */ },
    signAllTransactions: async (txs) => { /* ... */ }
  },
  routerProgramId: new PublicKey('SwapRouter111...'),
  buybackProgramId: new PublicKey('BuybackBurn111...'),
  oracleEndpoint: 'https://oracle.swapback.io'
});
```

---

### Méthodes

#### simulateRoute

Simule un swap et retourne la meilleure route disponible.

```typescript
async simulateRoute(
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputAmount: number,
  slippage?: number
): Promise<RouteSimulation>
```

##### Paramètres

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `inputMint` | `PublicKey` | - | Token d'entrée |
| `outputMint` | `PublicKey` | - | Token de sortie |
| `inputAmount` | `number` | - | Montant à swapper |
| `slippage` | `number` | `0.5` | Tolérance slippage (%) |

##### Retour

`Promise<RouteSimulation>`

```typescript
interface RouteSimulation {
  inputMint: string;           // Mint address input
  outputMint: string;          // Mint address output
  inputAmount: number;         // Montant input
  estimatedOutput: number;     // Output estimé
  priceImpact: number;         // Impact prix (%)
  route: RouteType;            // Type de route
  npi: number;                 // Net Price Improvement (%)
  rebateAmount: number;        // Rebate $BACK estimé
  burnAmount: number;          // $BACK brûlé
  estimatedFeeUSD: number;     // Frais estimés ($)
}
```

##### Exemple

```typescript
const route = await client.simulateRoute(
  SOL_MINT,
  USDC_MINT,
  1.0,    // 1 SOL
  0.5     // 0.5% slippage
);

console.log(`Prix: ${route.estimatedOutput} USDC`);
console.log(`NPI: ${route.npi}%`);
console.log(`Rebate: ${route.rebateAmount} $BACK`);
```

##### Erreurs

- `InvalidMintError` - Token mint invalide
- `InsufficientLiquidityError` - Liquidité insuffisante
- `NetworkError` - Erreur réseau

---

#### executeSwap

Exécute un swap atomique sur la blockchain.

```typescript
async executeSwap(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number,
  minimumOutput: number,
  route: RouteSimulation
): Promise<SwapResult>
```

##### Paramètres

| Nom | Type | Description |
|-----|------|-------------|
| `inputMint` | `PublicKey` | Token à vendre |
| `outputMint` | `PublicKey` | Token à acheter |
| `amount` | `number` | Montant à swapper |
| `minimumOutput` | `number` | Output minimum accepté |
| `route` | `RouteSimulation` | Route de `simulateRoute()` |

##### Retour

`Promise<SwapResult>`

```typescript
interface SwapResult {
  signature: string;        // Transaction signature
  actualOutput: number;     // Output réel reçu
  npiRealized: number;      // NPI réalisé (%)
  rebateEarned: number;     // Rebate gagné
  burnAmount: number;       // Montant brûlé
  route: RouteSimulation;   // Route utilisée
}
```

##### Exemple

```typescript
const route = await client.simulateRoute(SOL, USDC, 1.0);
const minOutput = route.estimatedOutput * 0.995; // 0.5% slippage

const result = await client.executeSwap(
  SOL,
  USDC,
  1.0,
  minOutput,
  route
);

console.log(`✅ Swap: ${result.signature}`);
console.log(`Reçu: ${result.actualOutput} USDC`);
```

##### Erreurs

- `SlippageExceededError` - Slippage dépassé
- `InsufficientFundsError` - Fonds insuffisants
- `TransactionFailedError` - Transaction échouée

---

#### executeSwapWithBundle

Exécute un swap avec protection MEV via Jito bundles.

```typescript
async executeSwapWithBundle(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number,
  minimumOutput: number,
  route: RouteSimulation
): Promise<string>
```

##### Paramètres

Identiques à `executeSwap()`.

##### Retour

`Promise<string>` - Transaction signature

##### Exemple

```typescript
// Pour swaps > $1000, utiliser bundle protection
const signature = await client.executeSwapWithBundle(
  SOL,
  USDC,
  10.0,  // 10 SOL
  minOutput,
  route
);
```

##### Notes

- ✅ Recommandé pour swaps > $1,000
- ✅ Protection contre MEV/sandwich attacks
- ⚠️ Frais légèrement plus élevés
- ⚠️ Peut prendre plus de temps

---

#### lockTokens

Verrouille des tokens $BACK pour booster les rebates.

```typescript
async lockTokens(
  amount: number,
  durationDays: number
): Promise<string>
```

##### Paramètres

| Nom | Type | Valeurs | Description |
|-----|------|---------|-------------|
| `amount` | `number` | > 0 | Montant $BACK |
| `durationDays` | `number` | 7, 30, 90, 180, 365 | Durée lock |

##### Retour

`Promise<string>` - Transaction signature

##### Boosts Disponibles

| Durée | Boost | Pénalité Unlock Anticipé |
|-------|-------|--------------------------|
| 7j    | 1.2x  | 50% |
| 30j   | 2x    | 40% |
| 90j   | 4x    | 30% |
| 180j  | 7x    | 20% |
| 365j  | 10x   | 10% |

##### Exemple

```typescript
// Lock 1000 $BACK pour 90 jours = 4x boost
const lockTx = await client.lockTokens(1000, 90);
console.log(`✅ Locked: ${lockTx}`);

// Stats après lock
const stats = await client.getUserStats();
console.log(`Boost: ${stats.rebateBoost}x`);
```

##### Erreurs

- `InsufficientBackBalanceError` - Solde $BACK insuffisant
- `InvalidLockDurationError` - Durée invalide
- `AlreadyLockedError` - Tokens déjà verrouillés

---

#### unlockTokens

Déverrouille les tokens $BACK verrouillés.

```typescript
async unlockTokens(): Promise<string>
```

##### Retour

`Promise<string>` - Transaction signature

##### Exemple

```typescript
const stats = await client.getUserStats();

if (stats.lockExpiryDate && new Date() > stats.lockExpiryDate) {
  // Lock expiré, unlock sans pénalité
  const unlockTx = await client.unlockTokens();
  console.log(`✅ Unlocked: ${unlockTx}`);
} else {
  // Unlock anticipé avec pénalité
  console.warn('⚠️ Early unlock will incur penalty');
  const unlockTx = await client.unlockTokens();
}
```

##### Notes

- ⚠️ Unlock anticipé applique une pénalité
- ✅ Unlock après expiration sans pénalité
- ✅ Pénalité va au buyback/burn

---

#### claimRewards

Récupère tous les rebates $BACK accumulés.

```typescript
async claimRewards(): Promise<string>
```

##### Retour

`Promise<string>` - Transaction signature

##### Exemple

```typescript
// Vérifier solde rebates
const balance = await client.getRebateBalance();
const amount = balance.toNumber() / 1e9;

console.log(`Rebates disponibles: ${amount} $BACK`);

// Claim si > seuil
if (amount > 10) {
  const claimTx = await client.claimRewards();
  console.log(`✅ Claimed ${amount} $BACK: ${claimTx}`);
}
```

##### Erreurs

- `NoRebatesAvailableError` - Pas de rebates à claim
- `TransactionFailedError` - Transaction échouée

---

#### getRebateBalance

Consulte le solde rebate d'un wallet.

```typescript
async getRebateBalance(
  wallet?: PublicKey
): Promise<BN>
```

##### Paramètres

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `wallet` | `PublicKey?` | Wallet connecté | Wallet à consulter |

##### Retour

`Promise<BN>` - Balance en lamports (1 $BACK = 1e9 lamports)

##### Exemple

```typescript
import { BN } from '@coral-xyz/anchor';

// Solde du wallet connecté
const balance = await client.getRebateBalance();
console.log(`Rebates: ${balance.toNumber() / 1e9} $BACK`);

// Solde d'un autre wallet
const otherWallet = new PublicKey('...');
const otherBalance = await client.getRebateBalance(otherWallet);
```

---

#### getUserStats

Récupère les statistiques détaillées d'un utilisateur.

```typescript
async getUserStats(
  userPubkey?: PublicKey
): Promise<UserStats>
```

##### Paramètres

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `userPubkey` | `PublicKey?` | Wallet connecté | Utilisateur à consulter |

##### Retour

`Promise<UserStats>`

```typescript
interface UserStats {
  totalSwaps: number;           // Nombre total swaps
  totalVolumeUSD: number;       // Volume cumulé ($)
  totalRebatesEarned: number;   // Rebates gagnés
  totalSavingsUSD: number;      // Économies totales ($)
  backTokensLocked: number;     // $BACK verrouillés
  lockExpiryDate: Date | null;  // Date expiration lock
  rebateBoost: number;          // Boost actif (1x-10x)
  nftTier: number;              // Tier NFT (0-3)
  averageNPI: number;           // NPI moyen (%)
}
```

##### Exemple

```typescript
const stats = await client.getUserStats();

console.log(`📊 Stats Utilisateur:`);
console.log(`Swaps: ${stats.totalSwaps}`);
console.log(`Volume: $${stats.totalVolumeUSD.toLocaleString()}`);
console.log(`Rebates: ${stats.totalRebatesEarned} $BACK`);
console.log(`Savings: $${stats.totalSavingsUSD.toFixed(2)}`);
console.log(`Boost: ${stats.rebateBoost}x`);
console.log(`NFT Tier: ${stats.nftTier}`);
console.log(`Avg NPI: ${stats.averageNPI.toFixed(2)}%`);
```

---

#### getGlobalStats

Récupère les statistiques globales du protocole.

```typescript
async getGlobalStats(): Promise<GlobalStats>
```

##### Retour

`Promise<GlobalStats>`

```typescript
interface GlobalStats {
  totalSwaps: number;         // Total swaps protocole
  totalVolumeUSD: number;     // Volume total ($)
  totalRebatesPaid: number;   // Rebates distribués
  totalBurned: number;        // $BACK brûlé
  totalValueLocked: number;   // TVL ($)
  activeUsers: number;        // Utilisateurs 30j
  volume24h: number;          // Volume 24h ($)
  averageNPI: number;         // NPI moyen protocole (%)
}
```

##### Exemple

```typescript
const stats = await client.getGlobalStats();

console.log(`🌐 Stats Protocole:`);
console.log(`TVL: $${stats.totalValueLocked.toLocaleString()}`);
console.log(`Volume 24h: $${stats.volume24h.toLocaleString()}`);
console.log(`Total Swaps: ${stats.totalSwaps.toLocaleString()}`);
console.log(`Rebates Paid: ${stats.totalRebatesPaid.toLocaleString()} $BACK`);
console.log(`Burned: ${stats.totalBurned.toLocaleString()} $BACK`);
console.log(`Active Users: ${stats.activeUsers}`);
console.log(`Avg NPI: ${stats.averageNPI.toFixed(2)}%`);
```

---

## Types

### SwapBackConfig

Configuration du client SwapBack.

```typescript
interface SwapBackConfig {
  connection: Connection;
  wallet: SwapBackWallet;
  routerProgramId: PublicKey;
  buybackProgramId: PublicKey;
  oracleEndpoint: string;
}
```

---

### SwapBackWallet

Interface wallet pour signer les transactions.

```typescript
interface SwapBackWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}
```

#### Compatibilité

- ✅ `@solana/wallet-adapter-react`
- ✅ Phantom wallet
- ✅ Solflare wallet
- ✅ Ledger hardware wallet
- ✅ Keypair (pour bots)

---

### RouteSimulation

Résultat de simulation de route.

```typescript
interface RouteSimulation {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  estimatedOutput: number;
  priceImpact: number;
  route: RouteType;
  npi: number;
  rebateAmount: number;
  burnAmount: number;
  estimatedFeeUSD: number;
}
```

---

### SwapResult

Résultat d'exécution de swap.

```typescript
interface SwapResult {
  signature: string;
  actualOutput: number;
  npiRealized: number;
  rebateEarned: number;
  burnAmount: number;
  route: RouteSimulation;
}
```

---

### RouteType

Types de routes disponibles.

```typescript
enum RouteType {
  Direct = 'direct',
  Aggregator = 'jupiter',
  RFQ = 'metis-rfq',
  Bundle = 'jito-bundle'
}
```

#### Descriptions

| Type | Description | Cas d'usage |
|------|-------------|-------------|
| `Direct` | Route directe SwapBack | Pairs liquides |
| `Aggregator` | Agrégateur Jupiter | Multi-DEX routing |
| `RFQ` | Request For Quote Metis | Large trades |
| `Bundle` | Jito bundle protection | MEV protection |

---

### UserStats

Statistiques utilisateur.

```typescript
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

---

### GlobalStats

Statistiques protocole.

```typescript
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

---

## Services

Services internes utilisés par SwapBackClient.

### SwapExecutor

Service d'exécution de swaps avec logique avancée.

```typescript
import { SwapExecutor } from '@swapback/sdk/services';

const executor = new SwapExecutor(
  connection,
  wallet,
  routerProgramId,
  oracleEndpoint
);

const result = await executor.executeSwap({
  inputMint: SOL,
  outputMint: USDC,
  inputAmount: 1.0,
  maxSlippageBps: 50,  // 0.5%
  userAccount: wallet.publicKey
});
```

#### Fonctionnalités

- ✅ Multi-route execution
- ✅ Split trades automatique
- ✅ Circuit breaker
- ✅ Retry logic
- ✅ Fallback routes
- ✅ MEV protection

---

### JupiterService

Intégration Jupiter Aggregator.

```typescript
import { JupiterService } from '@swapback/sdk/services';

const jupiter = new JupiterService(connection);

const quote = await jupiter.getQuote({
  inputMint: SOL,
  outputMint: USDC,
  amount: 1_000_000_000,  // 1 SOL (lamports)
  slippageBps: 50
});
```

---

### JitoBundleService

Service Jito bundles pour protection MEV.

```typescript
import { JitoBundleService } from '@swapback/sdk/services';

const jitoService = new JitoBundleService(
  connection,
  'https://mainnet.block-engine.jito.wtf'
);

const result = await jitoService.submitProtectedBundle(
  [swapTx],
  { tipLamports: 10_000 }
);
```

---

## Clients Spécialisés

### BackTokenClient

Client pour opérations sur le token $BACK.

```typescript
import { BackTokenClient } from '@swapback/sdk';

const backClient = new BackTokenClient(
  connection,
  backTokenMint,
  wallet
);

// Transfer $BACK
await backClient.transfer(
  fromPubkey,
  toPubkey,
  1000  // Montant
);

// Get balance
const balance = await backClient.getBalance(wallet.publicKey);
```

---

### CnftClient

Client pour opérations cNFT (Compressed NFTs).

```typescript
import { CnftClient } from '@swapback/sdk';

const cnftClient = new CnftClient(
  connection,
  treePubkey,
  wallet
);

// Mint cNFT
await cnftClient.mintCNFT(
  ownerPubkey,
  {
    name: 'SwapBack NFT',
    symbol: 'SBNFT',
    uri: 'https://...'
  }
);

// Transfer cNFT
await cnftClient.transferCNFT(
  fromPubkey,
  toPubkey,
  assetId
);
```

---

## Constantes

### Mints Communs

```typescript
import { PublicKey } from '@solana/web3.js';

// SOL (wrapped)
export const SOL_MINT = new PublicKey(
  'So11111111111111111111111111111111111111112'
);

// USDC
export const USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

// USDT
export const USDT_MINT = new PublicKey(
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
);

// $BACK
export const BACK_MINT = new PublicKey(
  'BackToken111111111111111111111111111111111'
);
```

### Program IDs

```typescript
// Mainnet
export const ROUTER_PROGRAM_ID = new PublicKey(
  'SwapRouter11111111111111111111111111111111'
);

export const BUYBACK_PROGRAM_ID = new PublicKey(
  'BuybackBurn111111111111111111111111111111'
);

// Devnet
export const ROUTER_PROGRAM_ID_DEVNET = new PublicKey(
  'DevRouter11111111111111111111111111111111'
);
```

### Endpoints

```typescript
// Mainnet
export const ORACLE_ENDPOINT_MAINNET = 'https://oracle.swapback.io';
export const JITO_ENDPOINT_MAINNET = 'https://mainnet.block-engine.jito.wtf';

// Devnet
export const ORACLE_ENDPOINT_DEVNET = 'https://oracle-dev.swapback.io';
export const JITO_ENDPOINT_DEVNET = 'https://devnet.block-engine.jito.wtf';
```

---

## Erreurs

### SlippageExceededError

Levée quand le slippage dépasse la tolérance.

```typescript
try {
  await client.executeSwap(...);
} catch (error) {
  if (error instanceof SlippageExceededError) {
    console.log('Slippage too high, increase tolerance');
  }
}
```

### InsufficientFundsError

Levée quand le wallet n'a pas assez de fonds.

```typescript
if (error instanceof InsufficientFundsError) {
  console.log('Not enough balance');
}
```

### NetworkError

Levée lors d'erreurs réseau/RPC.

```typescript
if (error instanceof NetworkError) {
  console.log('Network error, retry later');
}
```

---

**Version:** 1.0.0  
**Dernière mise à jour:** Novembre 2025
