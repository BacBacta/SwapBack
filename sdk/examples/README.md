# 📚 SDK Examples

Exemples pratiques d'utilisation du SDK SwapBack.

## 🚀 Quick Start

### Installation

```bash
npm install @swapback/sdk @solana/web3.js @coral-xyz/anchor dotenv
```

### Configuration

Créez un fichier `.env` :

```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
WALLET_PRIVATE_KEY=[1,2,3,...]  # Votre clé privée au format array
ROUTER_PROGRAM_ID=SwapRouter11111111111111111111111111111111
BUYBACK_PROGRAM_ID=BuybackBurn111111111111111111111111111111
ORACLE_ENDPOINT=https://oracle.swapback.io
```

### Exécution

```bash
# Compiler TypeScript
npx tsc examples/01-simple-swap.ts --outDir examples/dist

# Exécuter
node examples/dist/01-simple-swap.js
```

## 📖 Exemples Disponibles

### 01. Simple Swap

**Fichier:** `01-simple-swap.ts`

Swap basique SOL → USDC avec simulation et exécution.

```bash
node examples/dist/01-simple-swap.js
```

**Ce que vous apprendrez:**
- ✅ Initialiser le client SDK
- ✅ Simuler une route
- ✅ Exécuter un swap
- ✅ Vérifier le résultat
- ✅ Consulter vos stats

**Sortie exemple:**
```
🔄 SwapBack - Simple Swap Example

Wallet: 7xY8...9zK

📊 Simulating route...
✅ Route trouvée:
   Type: jupiter
   Input: 0.1 SOL
   Output estimé: 14.25 USDC
   Price impact: 0.012%
   NPI: 0.45%
   Rebate: 0.0014 $BACK
   
⚡ Executing swap...
✅ Swap réussi!
   Signature: 3hY8...kL9
   Output reçu: 14.27 USDC
   NPI réalisé: 0.47%
   Rebate gagné: 0.0014 $BACK
```

---

### 02. Compare Routes

**Fichier:** `02-compare-routes.ts`

Compare différentes routes avec différents paramètres de slippage.

```bash
node examples/dist/02-compare-routes.js
```

**Ce que vous apprendrez:**
- ✅ Comparer plusieurs simulations
- ✅ Choisir la meilleure route
- ✅ Comprendre l'impact du slippage
- ✅ Optimiser vos swaps

**Sortie exemple:**
```
🔍 SwapBack - Route Comparison Example

╔════════════════════════════════════════════════╗
║           ROUTE COMPARISON                     ║
╠════════════════════════════════════════════════╣
║ Route 1 (Slippage: 0.1%)                      ║
║   Output: 142.50 USDC                          ║
║   NPI: 0.42%                                   ║
╟────────────────────────────────────────────────╢
║ Route 2 (Slippage: 0.5%)                      ║
║   Output: 142.55 USDC                          ║
║   NPI: 0.45%                                   ║
╟────────────────────────────────────────────────╢
║ Route 3 (Slippage: 1.0%)                      ║
║   Output: 142.48 USDC                          ║
║   NPI: 0.43%                                   ║
╚════════════════════════════════════════════════╝

🏆 Meilleure route: Route 2 (Slippage 0.5%)
```

---

### 03. MEV Protected Swap

**Fichier:** `03-mev-protected-swap.ts`

Swap large avec protection MEV via Jito bundles.

```bash
node examples/dist/03-mev-protected-swap.js
```

**Ce que vous apprendrez:**
- ✅ Quand utiliser la protection MEV
- ✅ Comment exécuter un bundle Jito
- ✅ Comprendre les coûts vs bénéfices
- ✅ Protéger contre sandwich attacks

**Sortie exemple:**
```
🛡️ SwapBack - MEV Protected Swap Example

💼 Large trade: 10 SOL → USDC
🛡️ Using Jito bundle for MEV protection

⚠️ MEV protection RECOMMENDED:
   ✓ Large trade value: $1425.00
   ✓ Price impact: 0.523%

⚡ Executing swap with Jito bundle...
   📦 Building bundle transaction...
   🔐 Encrypting transaction...
   📤 Submitting to Jito block engine...

✅ Swap réussi avec protection MEV!
   Protected from:
     ✓ Front-running attacks
     ✓ Sandwich attacks
     ✓ MEV bots
```

---

### 04. Lock & Boost

**Fichier:** `04-lock-and-boost.ts`

Verrouiller $BACK pour booster les rebates.

```bash
node examples/dist/04-lock-and-boost.js
```

**Ce que vous apprendrez:**
- ✅ Comprendre le système de boost
- ✅ Calculer le ROI du lock
- ✅ Verrouiller et déverrouiller $BACK
- ✅ Gérer les pénalités

**Sortie exemple:**
```
🔒 SwapBack - Lock & Boost Example

📊 Current stats:
   $BACK locked: 0
   Current boost: 1x

╔═══════════════════════════════════════════════╗
║              BOOST TIERS                      ║
╠════════╦═════════╦════════════════════════════╣
║Duration║  Boost  ║  Early Unlock Penalty      ║
╠════════╬═════════╬════════════════════════════╣
║ 7 days ║  1.2x   ║       50%                  ║
║ 30 days║  2x     ║       40%                  ║
║ 90 days║  4x     ║       30%                  ║
║180 days║  7x     ║       20%                  ║
║365 days║  10x    ║       10%                  ║
╚════════╩═════════╩════════════════════════════╝

💰 Rebate Projections (monthly):
   Base (1x):     99.00 $BACK
   With 2x:       198.00 $BACK (+99.00)
   With 4x:       396.00 $BACK (+297.00)
   With 10x:      990.00 $BACK (+891.00)
```

---

### 05. Claim Rebates

**Fichier:** `05-claim-rebates.ts`

Récupérer les rebates $BACK accumulés.

```bash
node examples/dist/05-claim-rebates.js
```

**Ce que vous apprendrez:**
- ✅ Vérifier votre solde rebates
- ✅ Calculer la valeur en USD
- ✅ Claim les rebates
- ✅ Optimiser la fréquence de claim

**Sortie exemple:**
```
💸 SwapBack - Claim Rebates Example

📊 Checking rebate balance...
💰 Available rebates: 25.4567 $BACK

💵 Estimated value: $12.73 USD
   (at $BACK price: $0.50)

💡 Claim Analysis:
   Rebate value:  $12.7284
   Claim cost:    $0.0005
   Net profit:    $12.7279

💸 Claiming rebates...
✅ Rebates claimed successfully!
   Transaction: 4jK9...pL2
   Amount: 25.4567 $BACK
   Value: ~$12.73 USD
```

---

## 🔧 Configuration Avancée

### TypeScript Setup

Créez un `tsconfig.json` dans le dossier examples :

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Scripts npm

Ajoutez à votre `package.json` :

```json
{
  "scripts": {
    "build:examples": "tsc -p examples/tsconfig.json",
    "example:swap": "npm run build:examples && node examples/dist/01-simple-swap.js",
    "example:compare": "npm run build:examples && node examples/dist/02-compare-routes.js",
    "example:mev": "npm run build:examples && node examples/dist/03-mev-protected-swap.js",
    "example:lock": "npm run build:examples && node examples/dist/04-lock-and-boost.js",
    "example:claim": "npm run build:examples && node examples/dist/05-claim-rebates.js"
  }
}
```

Puis exécutez :

```bash
npm run example:swap
npm run example:compare
# etc.
```

---

## 🛡️ Sécurité

### ⚠️ IMPORTANT

**Ne commitez JAMAIS votre clé privée!**

Ajoutez à `.gitignore` :

```gitignore
.env
*.key
wallet.json
```

### Génération de Wallet Sécurisée

```typescript
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

// Générer nouveau wallet
const wallet = Keypair.generate();

// Sauvegarder (SÉCURISÉ!)
fs.writeFileSync(
  'wallet.json',
  JSON.stringify(Array.from(wallet.secretKey)),
  { mode: 0o600 } // Permissions restrictives
);

console.log('Pubkey:', wallet.publicKey.toBase58());
```

---

## 💡 Tips & Best Practices

### 1. Gestion des Erreurs

Toujours wrapper vos appels dans try/catch :

```typescript
try {
  const result = await client.executeSwap(...);
} catch (error: any) {
  console.error('Swap failed:', error.message);
  // Gérer l'erreur appropriée
}
```

### 2. Confirmation de Transaction

Attendez la confirmation :

```typescript
const signature = await client.executeSwap(...);
await connection.confirmTransaction(signature, 'confirmed');
console.log('✅ Transaction confirmed');
```

### 3. Rate Limiting

Ne spammez pas le RPC :

```typescript
import pLimit from 'p-limit';
const limit = pLimit(3); // Max 3 requêtes simultanées

const promises = tokens.map(token =>
  limit(() => client.simulateRoute(SOL, token, 1.0))
);
await Promise.all(promises);
```

### 4. Slippage Adaptatif

Ajustez selon la volatilité :

```typescript
function getSlippage(token: string): number {
  const volatile = ['BONK', 'PEPE', 'WOJAK'];
  return volatile.includes(token) ? 2.0 : 0.5;
}
```

---

## 🐛 Troubleshooting

### Erreur: "Module not found"

```bash
npm install --save @swapback/sdk @solana/web3.js
```

### Erreur: "Cannot find module 'dotenv'"

```bash
npm install --save dotenv
```

### Erreur: "Insufficient SOL"

Assurez-vous d'avoir au moins 0.01 SOL pour les frais.

### Erreur: "Slippage exceeded"

Augmentez la tolérance de slippage :

```typescript
const route = await client.simulateRoute(SOL, USDC, 1.0, 1.0); // 1%
```

---

## 📚 Ressources

- **Documentation:** [docs.swapback.io](https://docs.swapback.io)
- **API Reference:** [docs/API_REFERENCE.md](../docs/API_REFERENCE.md)
- **SDK Guide:** [docs/SDK_GUIDE.md](../docs/SDK_GUIDE.md)
- **Discord:** [discord.gg/swapback](https://discord.gg/swapback)
- **GitHub:** [github.com/BacBacta/SwapBack](https://github.com/BacBacta/SwapBack)

---

## 🤝 Support

Besoin d'aide ? 

- 💬 Discord: [discord.gg/swapback](https://discord.gg/swapback)
- 📧 Email: support@swapback.io
- 🐛 Issues: [GitHub Issues](https://github.com/BacBacta/SwapBack/issues)

---

**Fait avec ❤️ par l'équipe SwapBack**
