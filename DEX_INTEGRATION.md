# 🏦 DEX Utilisés par SwapBack

## 📊 Vue d'Ensemble

SwapBack utilise **3 DEX principaux** sur Solana pour optimiser les routes de swap et obtenir les meilleurs prix :

### 1. 🪐 **Jupiter Aggregator** (Principal)
- **Type** : Agrégateur de liquidités
- **Rôle** : Routes directes (1 étape)
- **Usage** : Swaps simples avec le meilleur prix agrégé
- **API** : `https://quote-api.jup.ag/v6`
- **Avantages** :
  - ✅ Agrège la liquidité de +20 DEX
  - ✅ Meilleur prix garanti
  - ✅ Slippage optimisé
  - ✅ API mature et stable

### 2. 🌊 **Raydium** (Multi-étapes)
- **Type** : AMM (Automated Market Maker)
- **Rôle** : Première étape des routes Aggregator
- **Usage** : Swaps via pools de liquidité
- **API** : `https://api.raydium.io/v2`
- **Avantages** :
  - ✅ Liquidité profonde pour SOL
  - ✅ Frais compétitifs (~0.25%)
  - ✅ Pools USDC/SOL populaires

### 3. 🐋 **Orca** (Multi-étapes)
- **Type** : AMM avec Concentrated Liquidity
- **Rôle** : Deuxième étape des routes Aggregator
- **Usage** : Optimisation des swaps intermédiaires
- **API** : `https://api.orca.so`
- **Avantages** :
  - ✅ Concentrated Liquidity (Whirlpools)
  - ✅ Faible slippage
  - ✅ Frais variables optimisés

## 🛣️ Stratégies de Routing

### Route "Direct" (50% des cas)

```
Input Token → [Jupiter Aggregator] → Output Token
```

**Exemple** : SOL → USDC
- ✅ 1 seule transaction
- ✅ Frais : ~0.5%
- ✅ Temps d'exécution rapide

**Code** :
```typescript
routes = [{
  label: 'Jupiter Aggregator',
  inputMint: 'SOL',
  outputMint: 'USDC',
  fee: '0.005'
}]
```

### Route "Aggregator" (50% des cas)

```
Input Token → [Raydium] → USDC → [Orca] → Output Token
```

**Exemple** : SOL → USDT
- Étape 1 : SOL → USDC via **Raydium** (frais 0.2%)
- Étape 2 : USDC → USDT via **Orca** (frais 0.3%)
- ✅ Meilleur prix total
- ⚠️ 2 transactions (atomiques)

**Code** :
```typescript
routes = [
  {
    label: 'Raydium',
    inputMint: 'SOL',
    outputMint: 'USDC',  // Token intermédiaire
    fee: '0.002'
  },
  {
    label: 'Orca',
    inputMint: 'USDC',
    outputMint: 'USDT',  // Token final
    fee: '0.003'
  }
]
```

## 🔧 Implémentation Actuelle

### Mode Simulation (Oracle API)

**Fichier** : `oracle/src/index.ts`

```typescript
// Simulation avec données mockées
const usesIntermediate = Math.random() > 0.5; // 50/50

if (usesIntermediate) {
  // Route Aggregator : Raydium + Orca
  routes = [
    { label: 'Raydium', ... },
    { label: 'Orca', ... }
  ]
} else {
  // Route Direct : Jupiter
  routes = [
    { label: 'Jupiter Aggregator', ... }
  ]
}
```

**État actuel** : ⚠️ **Données simulées** (mockées)

### Mode Production (À venir)

**Fichier** : `browser-extension/route-optimizer.js`

```javascript
// APIs réelles des DEX
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const RAYDIUM_API = 'https://api.raydium.io/v2';
const ORCA_API = 'https://api.orca.so';

// Récupération parallèle
const [jupiterRoutes, raydiumRoutes, orcaRoutes] = 
  await Promise.allSettled([
    this.getJupiterRoutes(...),
    this.getRaydiumRoutes(...),
    this.getOrcaRoutes(...)
  ]);
```

**État** : 🚧 **En cours de développement** (extension navigateur)

## 📊 Comparaison des DEX

| DEX | Type | Liquidité | Frais | Tokens | Vitesse |
|-----|------|-----------|-------|--------|---------|
| **Jupiter** | Aggregator | ⭐⭐⭐⭐⭐ | 0.3-0.5% | 10,000+ | ⚡⚡⚡ |
| **Raydium** | AMM | ⭐⭐⭐⭐ | 0.25% | 500+ | ⚡⚡ |
| **Orca** | CL-AMM | ⭐⭐⭐⭐ | 0.01-0.3% | 300+ | ⚡⚡⚡ |

## 🎯 Sélection Intelligente

SwapBack choisit automatiquement la meilleure stratégie :

### Critères de Décision

1. **Liquidité disponible**
   - Si pool direct existe → Jupiter
   - Sinon → Raydium + Orca

2. **Prix optimal**
   - Calcul du prix d'impact
   - Comparaison routes directes vs multi-étapes
   - Sélection du meilleur taux

3. **Frais totaux**
   - Frais DEX + frais réseau
   - Optimisation du coût total

4. **Slippage**
   - Vérification tolérance utilisateur
   - Rejet si slippage > limite

## 💡 Exemple Concret

### Swap : 10 SOL → USDT

#### Option 1 : Route Direct (Jupiter)
```
10 SOL → [Jupiter] → 1,498 USDT
Frais: 0.5% (7.5 USDT)
Slippage: 0.3%
Prix final: 1,498 USDT
```

#### Option 2 : Route Aggregator (Raydium + Orca)
```
10 SOL → [Raydium] → 1,497 USDC → [Orca] → 1,501 USDT
Étape 1 frais: 0.2% (3 USDC)
Étape 2 frais: 0.3% (4.5 USDT)
Slippage total: 0.5%
Prix final: 1,501 USDT ✅ Meilleur!
```

**SwapBack choisit** : Option 2 (Aggregator) car meilleur prix final.

## 🔮 Roadmap DEX

### Phase 1 : Actuel ✅
- [x] Simulation Jupiter, Raydium, Orca
- [x] Affichage visuel des routes
- [x] Calcul NPI et rebates

### Phase 2 : En cours 🚧
- [ ] Intégration API Jupiter réelle
- [ ] Intégration API Raydium réelle
- [ ] Intégration API Orca réelle
- [ ] Comparaison routes multiples

### Phase 3 : Futur 🔮
- [ ] Ajout de Meteora
- [ ] Ajout de Phoenix
- [ ] Ajout de Lifinity
- [ ] Smart Order Routing (SOR)
- [ ] Route avec 3+ étapes

## 🔗 Ressources

### Documentation Officielle

- **Jupiter** : https://station.jup.ag/docs
- **Raydium** : https://docs.raydium.io
- **Orca** : https://docs.orca.so

### API Endpoints

#### Jupiter V6
```
GET https://quote-api.jup.ag/v6/quote
POST https://quote-api.jup.ag/v6/swap
```

#### Raydium V2
```
GET https://api.raydium.io/v2/main/pairs
GET https://api.raydium.io/v2/ammV3/pools
```

#### Orca Whirlpools
```
GET https://api.orca.so/v1/whirlpool/list
GET https://api.orca.so/v1/whirlpool/quote
```

## 🧪 Tests

Pour tester les DEX en simulation :

```bash
# Test route Direct (Jupiter)
curl -X POST http://localhost:3003/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint":"So11111111111111111111111111111111111111112",
    "outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inputAmount":"1000000"
  }'

# Test route Aggregator (Raydium + Orca)
# Exécuter plusieurs fois jusqu'à obtenir type: "Aggregator"
```

## 📝 Notes Importantes

⚠️ **Actuellement** : L'application utilise des **données simulées** (mockées) pour le développement.

✅ **Production** : L'intégration des API réelles est en cours dans l'extension navigateur (`browser-extension/`).

🔧 **Tests** : Utilisez le script `./scripts/test-route-display.sh` pour valider le fonctionnement.

---

**Dernière mise à jour** : 13 octobre 2025
