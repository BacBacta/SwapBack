# Architecture Complète SwapBack

## Vue d'Ensemble

SwapBack est un protocole DeFi complet sur Solana qui combine un système de lock/unlock de tokens avec une intégration wallet universelle pour optimiser les swaps à travers toutes les plateformes.

## Composants Principaux

### 1. Programmes Solana (Anchor)

#### SwapBack Router (`swapback_router`)
- **Fonctionnalités**: `lock_back()`, `unlock_back()`
- **Rôle**: Gestion des locks/unlocks de $BACK tokens
- **Intégration CPI**: Appelle le programme cNFT pour mettre à jour les états

#### SwapBack cNFT (`swapback_cnft`)
- **Fonctionnalités**: `user_nft()`, `lock_state()`
- **Rôle**: Gestion des compressed NFTs pour les niveaux Bronze/Silver/Gold
- **Boosts**: +5%/+10%/+20% sur les rebates

#### SwapBack Buyback (`swapback_buyback`)
- **Fonctionnalités**: Mécanisme d'achat automatique de tokens
- **Rôle**: Stabilité et liquidité du protocole

### 2. Interface Utilisateur (Next.js + TypeScript)

#### Pages
- `/`: Dashboard avec statistiques et cNFT
- `/lock`: Interface de lock de tokens
- `/unlock`: Interface d'unlock de tokens
- `/swap`: Interface de swap optimisé (futur)

#### Composants
- `LockInterface.tsx`: Formulaire de lock avec calcul des rewards
- `UnlockInterface.tsx`: Formulaire d'unlock avec pénalités
- `Dashboard.tsx`: Affichage des cNFT et statistiques
- `WalletProvider.tsx`: Connexion wallet Solana

#### Hooks
- `useCNFT.ts`: Récupération des données cNFT depuis la blockchain

### 3. Extension Navigateur (Chrome Manifest V3)

#### Architecture
- **Manifest.json**: Configuration et permissions
- **Content.js**: Injection d'UI sur les sites de wallets
- **Background.js**: Logique métier et appels API
- **Route-optimizer.js**: Optimisation des routes de swap

#### Fonctionnement
1. **Détection**: Extension détecte les swaps sur phantom.app, solflare.com, etc.
2. **Interception**: Intercepte les clics sur les boutons de swap
3. **Optimisation**: Compare les routes via Jupiter, Raydium, Orca
4. **Recommandation**: Propose la route avec le meilleur "coût réel" (coût - rebates)
5. **Exécution**: Route la transaction via SwapBack Router pour capturer les rebates

#### Algorithme d'Optimisation

```javascript
// Calcul du coût réel = coût du swap - rebates SwapBack
trueCost = swapCost - (swapCost * rebateRate)

// rebateRate = 0.3% base + boost cNFT (0% à 20%)
rebateRate = 0.003 + userBoost

// Comparaison multi-DEX en parallèle
routes = await Promise.all([
  getJupiterRoutes(),
  getRaydiumRoutes(),
  getOrcaRoutes()
])

// Sélection de la route avec le trueCost le plus bas
bestRoute = routes.sort((a,b) => a.trueCost - b.trueCost)[0]
```

### 4. API Backend (Node.js/Express)

#### Endpoints
- `GET /user/:wallet/cnft`: Récupération du niveau cNFT et boost
- `POST /quote`: Génération de devis optimisés
- `POST /swap`: Exécution de swap via SwapBack Router

#### Intégrations
- **Solana Web3.js**: Connexion blockchain
- **Jupiter API**: Routes de swap
- **Raydium API**: Routes de swap
- **Orca API**: Routes de swap

## Flux Utilisateur Complet

### Scénario 1: Lock/Unlock Classique
1. Utilisateur se connecte sur swapback.app
2. Navigue vers /lock
3. Saisit montant de $BACK à locker
4. Transaction via SwapBack Router
5. Reçoit cNFT avec niveau approprié

### Scénario 2: Swap Optimisé via Extension
1. Utilisateur fait un swap sur phantom.app
2. Extension SwapBack détecte l'action
3. Affiche notification "SwapBack peut économiser X% sur ce swap"
4. Si accepté, redirige vers devis optimisé
5. Transaction exécutée via SwapBack Router
6. Utilisateur reçoit rebates + boost cNFT

## Économie Token

### $BACK Token
- **Supply**: 1,000,000,000 $BACK
- **Distribution**: 40% communauté, 30% trésorerie, 20% équipe, 10% liquidity
- **Utilité**: Gouvernance, staking, rebates

### Système de Rebates
- **Base**: 0.3% sur tous les swaps routés via SwapBack
- **Boost cNFT**: +5%/+10%/+20% selon niveau
- **Calcul**: `rebate = swapAmount * (0.003 + userBoost)`

### Niveaux cNFT
- **Bronze**: Lock 1,000 $BACK → +5% boost
- **Silver**: Lock 10,000 $BACK → +10% boost
- **Gold**: Lock 100,000 $BACK → +20% boost

## Déploiement et Infrastructure

### Environnements
- **Devnet**: Tests et développement
- **Mainnet**: Production

### Monitoring
- **Logs**: Winston pour les APIs
- **Métriques**: Prometheus/Grafana
- **Alertes**: Discord/Slack pour les erreurs

### Sécurité
- **Audits**: Certik ou équivalent avant mainnet
- **Tests**: 100% couverture, fuzzing
- **Rate Limiting**: Protection contre les abus

## Roadmap

### Phase 1 (Actuelle - 97% ✅)
- Programmes Solana déployés
- Interface Lock/Unlock complète
- Extension foundation créée
- Route optimizer implémenté

### Phase 2 (Prochaine)
- API backend pour quotes
- Tests extension avec wallets réels
- Bubblegum CPI implementation
- UI notifications améliorées

### Phase 3 (Production)
- Déploiement mainnet
- Publication Chrome Web Store
- Campagnes marketing
- Intégrations partenaires

## KPIs de Succès

- **Adoption**: 10,000 utilisateurs actifs
- **Volume**: $1M+ de swaps optimisés/mois
- **Rebates**: $50K+ distribués/mois
- **Retention**: 70% des utilisateurs avec cNFT actif

## Risques et Mitigation

### Risques Techniques
- **Congestion Solana**: Fallback vers routes alternatives
- **API DEX down**: Cache local + retry logic
- **Extension bloquée**: Mises à jour régulières

### Risques Économiques
- **Volatilité $BACK**: Mécanismes de stabilisatio
- **Adoption lente**: Marketing ciblé + incentives
- **Concurrence**: Différenciation par rebates + cNFT

Cette architecture fait de SwapBack non seulement un protocole DeFi standalone, mais aussi un **optimiseur universel de swaps** qui s'intègre de manière transparente dans l'écosystème Solana existant.