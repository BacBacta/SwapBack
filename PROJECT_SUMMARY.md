# 📊 Résumé du Projet SwapBack

## Vue d'ensemble

SwapBack est un **routeur d'exécution optimisé** pour l'écosystème Solana qui maximise les profits des traders tout en réduisant l'impact du MEV. Le projet implémente un mécanisme unique de **cashback (70-80%)** et de **buyback & burn automatique (20-30%)** du token $BACK.

## Architecture Complète

### 🏗️ Structure du Projet

```
SwapBack/
├── programs/               # Smart contracts Solana (Rust/Anchor)
│   ├── swapback_router/   # Programme de routage principal
│   └── swapback_buyback/  # Programme de buyback et burn
│
├── app/                   # Interface utilisateur (Next.js 14)
│   ├── src/components/    # Composants React
│   ├── src/hooks/        # Hooks personnalisés
│   └── src/app/          # Pages et layouts
│
├── sdk/                   # SDK TypeScript pour développeurs
│   └── src/index.ts      # Client SwapBack
│
├── oracle/                # Service de routage off-chain
│   └── src/index.ts      # API Express + intégration Jupiter
│
├── tests/                 # Tests Anchor
├── docs/                  # Documentation complète
└── scripts/               # Scripts de build et déploiement
```

## Composants Principaux

### 1. Programmes Solana (Anchor)

#### swapback_router
**Fonctionnalités :**
- ✅ Routage intelligent de swaps
- ✅ Calcul du Net Price Improvement (NPI)
- ✅ Distribution de remises aux utilisateurs
- ✅ Système de verrouillage (lock) avec boost
- ✅ Gestion des statistiques utilisateur

**Comptes clés :**
- `GlobalState` : Configuration globale (% remise, % burn, seuils)
- `UserRebate` : Stats et remises par utilisateur

**Instructions principales :**
```rust
initialize()        // Initialise le protocole
execute_swap()      // Exécute un swap optimisé
lock_back()         // Verrouille $BACK pour boost
unlock_back()       // Déverrouille après période
claim_rewards()     // Récupère les remises
```

#### swapback_buyback
**Fonctionnalités :**
- ✅ Accumulation des USDC des frais
- ✅ Buyback automatique de $BACK
- ✅ Burn avec Transfer Hook Token-2022
- ✅ Transparence totale des burns

**Instructions principales :**
```rust
deposit_usdc()      // Dépôt pour buyback
execute_buyback()   // Achat de $BACK sur le marché
burn_back()         // Brûlage des tokens
```

### 2. Frontend (Next.js 14 + React)

**Composants :**
- `SwapInterface` : Interface de swap avec simulation
- `Dashboard` : Stats utilisateur et protocole
- `Navigation` : Wallet adapter et menu
- `WalletProvider` : Intégration Solana wallet adapter

**Features :**
- 🎨 Design moderne avec Tailwind CSS
- 🌐 Connexion multi-wallets (Phantom, Solflare)
- 📊 Dashboard temps réel
- 📱 Responsive design
- ⚡ Simulation de routes avant exécution

### 3. SDK TypeScript

**Classe principale :**
```typescript
SwapBackClient
├── simulateRoute()      // Simule une route optimale
├── executeSwap()        // Exécute le swap
├── getUserStats()       // Récupère stats utilisateur
├── lockTokens()         // Verrouille $BACK
├── unlockTokens()       // Déverrouille
└── claimRewards()       // Récupère remises
```

**Utilitaires :**
```typescript
SwapBackUtils
├── calculateBoost()     // Calcule le boost selon lock
├── calculateRebate()    // Calcule la remise
├── formatAmount()       // Formatage
└── toNativeAmount()     // Conversion décimales
```

### 4. Service Oracle

**Endpoints API :**
- `POST /simulate` : Simule une route de swap
- `GET /stats/global` : Stats globales du protocole
- `GET /health` : Health check

**Logique de routage :**
1. Interroge Jupiter API (Metis/Juno)
2. Compare avec routes directes
3. Calcule le NPI
4. Sélectionne le meilleur type (Direct/Aggregator/RFQ/Bundle)
5. Retourne la route optimale

## Mécanisme Économique

### Flux de Valeur

```
Swap Utilisateur
    ↓
Routage Optimal (Jupiter/RFQ/Bundle)
    ↓
NPI Généré (amélioration prix)
    ↓
    ├── 70-80% → Remises Utilisateur 💰
    │   └── Boost possible avec lock $BACK
    │
    └── 20-30% → USDC vers Buyback 🔥
        ↓
        Achat $BACK sur le marché
        ↓
        Burn permanent
```

### Système de Boost

| Niveau | Montant Lock | Durée    | Boost  |
|--------|-------------|----------|--------|
| Bronze | ≥ 100K      | ≥ 90j    | +10%   |
| Silver | ≥ 1M        | ≥ 180j   | +30%   |
| Gold   | ≥ 10M       | ≥ 365j   | +50%   |

## Tokenomics $BACK

### Distribution (1 Milliard de tokens)

| Allocation              | %   | Montant     | Vesting  |
|------------------------|-----|-------------|----------|
| Trésorerie DAO         | 40% | 400M        | DAO      |
| Airdrop usage          | 30% | 300M        | Volume   |
| Liquidité & Équipe     | 20% | 200M        | 24 mois  |
| Partenariats & MM      | 10% | 100M        | 12 mois  |

### Utilités du Token

1. **Remises** : Proportionnelles au montant locké
2. **Boost** : Multiplicateur de remise
3. **Accès** : Fonctionnalités avancées (ordres conditionnels, limites)
4. **Gouvernance** : Vote sur paramètres du protocole

## Technologies Utilisées

### Backend
- **Solana** : Blockchain haute performance
- **Anchor** : Framework Rust pour Solana
- **Token-2022** : Standard avec Transfer Hooks

### Frontend
- **Next.js 14** : Framework React avec App Router
- **Tailwind CSS** : Styling utilitaire
- **Solana Wallet Adapter** : Connexion wallets
- **Recharts** : Visualisations

### Infrastructure
- **Express** : API Oracle
- **Axios** : Client HTTP
- **Jupiter API** : Agrégation DEX
- **TypeScript** : Typage fort partout

## Sécurité

### Mesures Implémentées

- ✅ Validation stricte des comptes
- ✅ Vérification des signers
- ✅ PDAs sécurisés
- ✅ Protection reentrancy
- ✅ Tests unitaires complets

### Audits Prévus

- [ ] Audit externe (pré-mainnet)
- [ ] Bug bounty programme
- [ ] Tests de fuzzing
- [ ] Monitoring temps réel

## Roadmap

### Phase 1 : MVP ✅
- [x] Programmes Anchor fonctionnels
- [x] SDK complet
- [x] Frontend opérationnel
- [x] Service Oracle
- [ ] Intégration Jupiter API
- [ ] Tests complets

### Phase 2 : Alpha (Sem. 7-8)
- [ ] Tests fermés
- [ ] Audit sécurité
- [ ] Optimisations

### Phase 3 : Beta (Sem. 9-10)
- [ ] Beta publique devnet
- [ ] Intégrations wallets
- [ ] Bug bounty

### Phase 4 : Mainnet (Sem. 11+)
- [ ] Déploiement mainnet
- [ ] Airdrop
- [ ] Partenariats

## Métriques de Succès

### KPIs Techniques
- Latence de routage < 500ms
- Uptime Oracle > 99.9%
- Taux de réussite swaps > 95%

### KPIs Business
- Volume mensuel traité
- NPI moyen par swap
- Nombre d'utilisateurs actifs
- $BACK brûlés

## Guide de Démarrage Rapide

### Installation

```bash
# Clone
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack

# Install
npm install

# Build
anchor build

# Test
anchor test

# Dev Frontend
cd app && npm run dev

# Dev Oracle
cd oracle && npm run dev
```

### Commandes Utiles

```bash
# Build complet
./scripts/build.sh devnet

# Deploy devnet
anchor deploy --provider.cluster devnet

# Tests
anchor test
```

## Documentation

- 📖 [README.md](README.md) - Vue d'ensemble
- 🔧 [docs/BUILD.md](docs/BUILD.md) - Guide de construction
- 📚 [docs/TECHNICAL.md](docs/TECHNICAL.md) - Documentation technique
- 🚀 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Guide de déploiement
- 🤝 [CONTRIBUTING.md](CONTRIBUTING.md) - Guide de contribution

## Support & Communauté

- 💬 Discord : [discord.gg/swapback](https://discord.gg/swapback)
- 🐦 Twitter : [@SwapBackProtocol](https://twitter.com/SwapBackProtocol)
- 📧 Email : dev@swapback.io
- 🐛 Issues : [GitHub Issues](https://github.com/BacBacta/SwapBack/issues)

## Licence

MIT License - Voir [LICENSE](LICENSE)

---

**SwapBack - Maximisez vos swaps, minimisez vos frais ! 🚀**

*Dernière mise à jour : Octobre 2025*
