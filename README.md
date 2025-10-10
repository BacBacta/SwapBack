# SwapBack - Routeur d'Exécution Optimisé pour Solana

![SwapBack Logo](https://via.placeholder.com/800x200?text=SwapBack+Best+Execution+Router)

## 📋 Table des matières

- [Vision](#vision)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Tokenomics](#tokenomics)
- [Roadmap](#roadmap)
- [Contribution](#contribution)

## 🎯 Vision

$BACK (SwapBack) est un routeur d'exécution pour Solana qui maximise le prix net des swaps tout en redistribuant 70-80% de l'économie réalisée aux utilisateurs. Il s'agit d'un bouton « Best‑Exec » intégré aux wallets et aux dapps.

### Objectifs

1. **Améliorer l'exécution** : Routage intelligent via Metis, Juno et RFQ privés
2. **Atténuer le MEV** : Optimisation des priority fees et bundles Jito
3. **Redistribuer la valeur** : 70-80% du surplus aux utilisateurs, 20-30% en burn

## ✨ Fonctionnalités

### Routage « Best‑Exec »

- ✅ Simulation de routes multi-DEX
- ✅ Intégration Jupiter (Metis/Juno)
- ✅ Support des RFQ privés
- ✅ Bundles Jito pour les grandes transactions
- ✅ Calcul du Net Price Improvement (NPI)

### Mécanisme de Remise et Burn

- 💰 **70-80% du surplus** → Remises utilisateur
- 🔥 **20-30% du surplus** → Buyback & Burn de $BACK
- 📊 Transfer Hook Token-2022 pour burn automatique
- 🎁 Points cumulables et échangeables

### Verrouillage et Boost

- 🔒 Lock de $BACK pour boost de remise (+10% à +50%)
- 🏆 Niveaux Bronze/Silver/Gold avec cNFTs
- ⚡ Accès à des fonctionnalités avancées
- 🚫 Pénalités en cas de retrait anticipé

### SDK & Intégrations

- 📦 SDK TypeScript/React
- 🔗 API REST pour wallets et dapps
- 🔗 Support Blink/Action
- 📊 Dashboard de suivi en temps réel

## 🏗️ Architecture

### Structure du Projet

```
SwapBack/
├── programs/                # Programmes Solana (Anchor)
│   ├── swapback_router/    # Programme principal de routage
│   └── swapback_buyback/   # Programme de buyback et burn
├── app/                     # Application Next.js
│   └── src/
│       ├── components/      # Composants React
│       └── hooks/          # Hooks personnalisés
├── sdk/                     # SDK TypeScript
│   └── src/
│       └── index.ts        # Client SwapBack
├── oracle/                  # Service Oracle (routage)
│   └── src/
│       └── index.ts        # API Express
├── tests/                   # Tests Anchor
└── docs/                    # Documentation
```

### Programmes Solana

#### 1. swapback_router

**Comptes principaux :**

- `GlobalState` : Paramètres globaux (% remise, % burn, seuils)
- `UserRebate` : Stats et remises par utilisateur
- `Partner` : Intégrations partenaires

**Instructions :**

- `initialize` : Initialisation du protocole
- `simulate_route` : Simulation de route
- `execute_swap` : Exécution du swap
- `lock_back` : Verrouillage de tokens
- `unlock_back` : Déverrouillage
- `claim_rewards` : Réclamation des remises

#### 2. swapback_buyback

**Comptes principaux :**

- `BuybackState` : État du buyback (USDC accumulés, $BACK brûlés)

**Instructions :**

- `initialize` : Initialisation
- `deposit_usdc` : Dépôt pour buyback
- `execute_buyback` : Achat de $BACK
- `burn_back` : Brûlage de tokens
- `update_params` : Mise à jour des paramètres

### Service Oracle

Service off-chain qui :

1. Interroge Jupiter API (Metis/Juno)
2. Compare les routes DEX, RFQ, bundles
3. Calcule le NPI et la répartition remise/burn
4. Renvoie la route optimale

## 🚀 Installation

### Prérequis

- Node.js >= 18
- Rust >= 1.70
- Solana CLI >= 1.18
- Anchor CLI >= 0.30

### Étapes

1. **Cloner le repository**

```bash
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Build les programmes Anchor**

```bash
anchor build
```

4. **Déployer sur devnet**

```bash
anchor deploy --provider.cluster devnet
```

5. **Lancer l'oracle**

```bash
cd oracle
npm install
npm run dev
```

6. **Lancer l'application**

```bash
cd app
npm install
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 📖 Utilisation

### Exemple SDK

```typescript
import { SwapBackClient } from '@swapback/sdk';
import { Connection, PublicKey } from '@solana/web3.js';

// Initialisation
const connection = new Connection('https://api.devnet.solana.com');
const client = new SwapBackClient({
  connection,
  wallet: yourWallet,
  routerProgramId: new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'),
  buybackProgramId: new PublicKey('Hn7cLGf4hYNd8F1RqYNdqxqLKxqVMiEUPPbRKZJd3zKx'),
});

// Simuler une route
const route = await client.simulateRoute(
  usdcMint,
  solMint,
  500, // 500 USDC
  0.5  // 0.5% slippage
);

console.log('NPI:', route.npi);
console.log('Remise:', route.rebateAmount);

// Exécuter le swap
const result = await client.executeSwap(
  usdcMint,
  solMint,
  500,
  route.estimatedOutput,
  route
);

console.log('Signature:', result.signature);
```

### Exemple Intégration React

```tsx
import { useSwapBack } from '@swapback/react';

function SwapButton() {
  const { simulateSwap, executeSwap } = useSwapBack();
  
  const handleSwap = async () => {
    const route = await simulateSwap('USDC', 'SOL', 100);
    const result = await executeSwap(route);
    console.log('Swap réussi!', result);
  };
  
  return <button onClick={handleSwap}>Swap avec SwapBack</button>;
}
```

## 💎 Tokenomics

### Supply & Distribution

- **Supply fixe** : 1 000 000 000 $BACK

| Allocation                    | %   | Montant       | Vesting      |
|-------------------------------|-----|---------------|--------------|
| Trésorerie communautaire      | 40% | 400 000 000   | DAO contrôlé |
| Airdrop d'usage               | 30% | 300 000 000   | Basé volume  |
| Liquidité & Équipe            | 20% | 200 000 000   | 24 mois      |
| Partenariats & Market Makers  | 10% | 100 000 000   | 12 mois      |

### Utilité du Token

1. **Remises** : Proportionnelles au locking
2. **Boost** : +10% à +50% selon niveau
3. **Accès** : Fonctionnalités avancées (ordres conditionnels, limites)
4. **Gouvernance** : Vote sur paramètres opérationnels

### Mécanisme de Burn

- 20-30% du NPI → Conversion USDC → Buyback $BACK → Burn
- Transfer Hook Token-2022 pour automatisation
- Pression déflationniste continue

## 🗺️ Roadmap

### Phase 1 : MVP (Semaines 1-6)

- [x] Programmes Anchor de base
- [x] SDK TypeScript
- [x] Interface frontend
- [x] Service Oracle
- [ ] Intégration Jupiter API
- [ ] Tests unitaires

### Phase 2 : Alpha (Semaines 7-8)

- [ ] Alpha fermée avec testeurs
- [ ] Audit de sécurité
- [ ] Optimisations gas
- [ ] Documentation complète

### Phase 3 : Beta (Semaines 9-10)

- [ ] Beta publique sur devnet
- [ ] Intégrations wallets (Phantom, Solflare)
- [ ] Programme de bug bounty
- [ ] Marketing et communauté

### Phase 4 : Mainnet (Semaine 11+)

- [ ] Déploiement mainnet
- [ ] Airdrop d'usage
- [ ] Partenariats DEX
- [ ] Intégration $BONKED

## 🔒 Sécurité

### Bonnes Pratiques

- ✅ Validation stricte des comptes
- ✅ Vérification des signers
- ✅ Gestion sécurisée des PDAs
- ✅ Protection contre le reentrancy
- ✅ Limites de rate limiting

### Audits

- [ ] Audit par [Firme à définir]
- [ ] Bug bounty programme
- [ ] Tests continus

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

## 📄 Licence

MIT License - voir [LICENSE](LICENSE)

## 🔗 Liens

- Website: [swapback.io](https://swapback.io)
- Twitter: [@SwapBackProtocol](https://twitter.com/SwapBackProtocol)
- Discord: [discord.gg/swapback](https://discord.gg/swapback)
- Docs: [docs.swapback.io](https://docs.swapback.io)

---

**Fait avec ❤️ pour la communauté Solana**