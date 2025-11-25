# 📊 Phase 7 - RFQ Privés - Analyse de l'Existant
**Date:** 24 Novembre 2025

---

## 🎯 Objectif Phase 7 - Intégration RFQ Privés

Implémenter un système de **Request for Quote (RFQ)** avec market makers privés pour obtenir les meilleurs prix possibles, avec compétition et fallback automatique.

### Composants requis
1. ✅ API RFQ market makers (Jupiter → Metis/Juno/autres)
2. ⏸️ Logique de compétition prix (multi-sources)
3. ⏸️ Timeout et fallback Jupiter
4. ⏸️ Tests avec market makers devnet

---

## ✅ EXISTANT: Infrastructure RFQ Partielle

### 1. Types & Configuration ✅

**Fichier:** `sdk/src/types/smart-router.ts`

```typescript
export enum VenueType {
  AMM = "amm",    // ✅ Automated Market Maker
  CLOB = "clob",  // ✅ Central Limit Order Book
  RFQ = "rfq",    // ✅ Request for Quote (aggregators)
}

export enum VenueName {
  // AMMs
  ORCA = "orca",
  RAYDIUM = "raydium",
  METEORA = "meteora",
  LIFINITY = "lifinity",

  // CLOBs
  PHOENIX = "phoenix",
  OPENBOOK = "openbook",

  // Aggregators (RFQ)
  JUPITER = "jupiter",  // ✅ Implémenté
  METIS = "metis",      // ⏸️ TODO: À implémenter
}
```

**Status:** ✅ Types définis, architecture prête

---

### 2. Jupiter RFQ Integration ✅

**Fichier:** `sdk/src/services/LiquidityDataCollector.ts` (ligne 565)

```typescript
/**
 * Fetch quote from Jupiter v6 API
 * @see https://station.jup.ag/docs/apis/swap-api
 */
private async fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  inputAmount: number
): Promise<LiquiditySource | null> {
  try {
    const amountInSmallestUnit = Math.floor(inputAmount * 1e9);

    // Jupiter v6 Quote API
    const url = new URL("https://quote-api.jup.ag/v6/quote");
    url.searchParams.append("inputMint", inputMint);
    url.searchParams.append("outputMint", outputMint);
    url.searchParams.append("amount", amountInSmallestUnit.toString());
    url.searchParams.append("slippageBps", "50"); // 0.5% slippage
    url.searchParams.append("onlyDirectRoutes", "false");

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(`Jupiter API returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Parse Jupiter response
    const outputAmount = Number(data.outAmount) / 1e9;
    const priceImpactPct = Number(data.priceImpactPct ?? 0);
    const routePlan = data.routePlan ?? [];

    // Extract route from Jupiter's route plan
    const route: string[] = [inputMint];
    for (const step of routePlan) {
      if (step.swapInfo?.outputMint) {
        route.push(step.swapInfo.outputMint);
      }
    }

    return {
      venue: VenueName.JUPITER,
      venueType: VenueType.RFQ,
      tokenPair: [inputMint, outputMint],
      depth: outputAmount * 10, // Deep aggregated liquidity
      effectivePrice: inputAmount / outputAmount,
      feeAmount: inputAmount - inputAmount / (inputAmount / outputAmount),
      slippagePercent: priceImpactPct / 100,
      route,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Jupiter API error:", error);
    return null;
  }
}
```

**Status:** ✅ Jupiter implémenté et fonctionnel

---

### 3. RFQ Liquidity Fetcher ⏸️ (Partiel)

**Fichier:** `sdk/src/services/LiquidityDataCollector.ts` (ligne 539)

```typescript
/**
 * Fetch RFQ (Jupiter, Metis) quote
 * These are aggregators that already do routing
 */
private async fetchRFQLiquidity(
  venue: VenueName,
  inputMint: string,
  outputMint: string,
  inputAmount: number
): Promise<LiquiditySource | null> {
  // Jupiter v6 API integration
  if (venue === VenueName.JUPITER) {
    try {
      return await this.fetchJupiterQuote(inputMint, outputMint, inputAmount);
    } catch (error) {
      console.error("Jupiter API error:", error);
      return null;
    }
  }

  // ⚠️ MANQUANT: Metis et autres market makers
  // TODO: Implement Metis and other aggregator APIs
  console.warn(`RFQ venue ${venue} not yet implemented`);
  return null;
}
```

**Status:** ⏸️ Jupiter OK, Metis et market makers TODO

---

### 4. Configuration Venues ✅

**Fichier:** `sdk/src/services/LiquidityDataCollector.ts` (ligne 116)

```typescript
const DEFAULT_VENUE_CONFIGS: Record<VenueName, VenueConfig> = {
  // ... AMMs et CLOBs ...

  // Aggregators - Lower priority (use as fallback)
  [VenueName.JUPITER]: {
    name: VenueName.JUPITER,
    type: VenueType.RFQ,
    enabled: true,
    priority: 50,      // ⚠️ Priorité moyenne
    feeRate: 0.0,
    minTradeSize: 1,
    maxSlippage: 0.02,
  },
  [VenueName.METIS]: {
    name: VenueName.METIS,
    type: VenueType.RFQ,
    enabled: true,
    priority: 45,      // ⚠️ Priorité plus basse que Jupiter
    feeRate: 0.0,
    minTradeSize: 1,
    maxSlippage: 0.02,
  },
};
```

**Status:** ✅ Config prête, mais Metis non implémenté

---

## ❌ MANQUANT: Composants à Implémenter

### 1. Metis API Integration ❌

**Besoin:**
- Service `MetisService.ts` similaire à `JupiterService.ts`
- API endpoint: À déterminer (Metis API documentation)
- Quote format: À adapter au format `LiquiditySource`

**Fichier à créer:** `sdk/src/services/MetisService.ts`

```typescript
// Structure proposée
export interface MetisQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}

export interface MetisQuoteResponse {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  marketMaker: string;  // Nom du market maker qui fournit la quote
  expiresAt: number;    // Timestamp d'expiration de la quote
}

export class MetisService {
  private baseUrl: string;
  private timeout: number;

  async getQuote(request: MetisQuoteRequest): Promise<MetisQuoteResponse>;
  async getMarketMakers(): Promise<string[]>;  // Liste des MM disponibles
}
```

---

### 2. Market Makers Privés ❌

**Market Makers populaires sur Solana:**
- **Wintermute** - Market maker institutionnel
- **B2C2** - Liquidité crypto professionnelle
- **Hidden Road** - Market maker DeFi
- **GSR** - Trading et liquidité
- **Jump Trading** - High-frequency trading

**Besoin:**
- Authentification (API keys)
- Endpoints privés (RFQ endpoints)
- Rate limiting par market maker
- Fallback si MM non disponible

**Fichier à créer:** `sdk/src/services/PrivateMarketMakerService.ts`

```typescript
export interface MarketMakerConfig {
  name: string;
  apiUrl: string;
  apiKey: string;
  timeout: number;
  enabled: boolean;
  priority: number;  // Pour l'ordre de requête
}

export class PrivateMarketMakerService {
  private marketMakers: Map<string, MarketMakerConfig>;

  // Requête broadcast à tous les MM
  async requestQuotes(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<MarketMakerQuote[]>;

  // Attendre la meilleure quote ou timeout
  async getBestQuote(
    quotes: MarketMakerQuote[],
    timeoutMs: number
  ): Promise<MarketMakerQuote | null>;
}
```

---

### 3. Logique de Compétition Prix ❌

**Besoin:**
- Comparer quotes de multiples sources en parallèle
- Scoring system (prix + slippage + fees + fiabilité)
- Choisir le meilleur quote globalement

**Fichier à créer:** `sdk/src/services/RFQCompetitionService.ts`

```typescript
export interface CompetitiveQuote {
  source: VenueName | string;  // Jupiter, Metis, ou nom du MM
  inputAmount: number;
  outputAmount: number;
  effectivePrice: number;
  priceImpact: number;
  fees: number;
  slippage: number;
  route?: string[];
  expiresAt: number;
  reliability: number;  // Score de fiabilité (0-100)
}

export class RFQCompetitionService {
  // Lancer requêtes en parallèle vers toutes les sources
  async fetchAllQuotes(
    inputMint: string,
    outputMint: string,
    amount: number,
    sources: VenueName[]
  ): Promise<CompetitiveQuote[]>;

  // Calculer le score de chaque quote
  private calculateScore(quote: CompetitiveQuote): number;

  // Retourner la meilleure quote
  async getBestQuote(
    quotes: CompetitiveQuote[]
  ): Promise<CompetitiveQuote>;

  // Logique de scoring
  // Score = (outputAmount / maxOutput) * 70
  //       + (100 - priceImpact) * 15
  //       + reliability * 10
  //       + (100 - slippage) * 5
}
```

---

### 4. Timeout et Fallback ❌

**Besoin:**
- Timeout configurable par source (ex: 2s pour Jupiter, 3s pour Metis)
- Fallback automatique vers Jupiter si RFQ privés échouent
- Retry logic avec exponential backoff
- Circuit breaker si une source échoue trop souvent

**Fichier à modifier:** `sdk/src/services/LiquidityDataCollector.ts`

```typescript
// Ajouter dans LiquidityDataCollector
private readonly RFQ_TIMEOUTS = {
  [VenueName.JUPITER]: 2000,   // 2 secondes
  [VenueName.METIS]: 3000,     // 3 secondes
  PRIVATE_MM: 2500,            // 2.5 secondes
};

private readonly FALLBACK_ORDER = [
  VenueName.JUPITER,  // Fallback principal
  VenueName.METIS,    // Fallback secondaire
];

async fetchWithTimeout(
  fetchFn: () => Promise<any>,
  timeoutMs: number
): Promise<any | null> {
  return Promise.race([
    fetchFn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]).catch(error => {
    console.warn('Fetch timeout:', error);
    return null;
  });
}

async fetchRFQWithFallback(
  venue: VenueName,
  inputMint: string,
  outputMint: string,
  inputAmount: number
): Promise<LiquiditySource | null> {
  // Essayer la source primaire avec timeout
  const timeout = this.RFQ_TIMEOUTS[venue];
  let result = await this.fetchWithTimeout(
    () => this.fetchRFQLiquidity(venue, inputMint, outputMint, inputAmount),
    timeout
  );

  // Si échec, essayer les fallbacks
  if (!result) {
    for (const fallbackVenue of this.FALLBACK_ORDER) {
      if (fallbackVenue === venue) continue; // Skip même source
      
      result = await this.fetchWithTimeout(
        () => this.fetchRFQLiquidity(fallbackVenue, inputMint, outputMint, inputAmount),
        this.RFQ_TIMEOUTS[fallbackVenue]
      );

      if (result) {
        console.log(`✅ Fallback to ${fallbackVenue} successful`);
        break;
      }
    }
  }

  return result;
}
```

---

### 5. Tests Market Makers Devnet ❌

**Besoin:**
- Scripts de test avec market makers devnet
- Mock market makers pour tests unitaires
- Validation des quotes reçues
- Tests de timeout et fallback

**Fichier à créer:** `scripts/test-rfq-private.js`

```javascript
const { Connection, PublicKey } = require('@solana/web3.js');
const { RFQCompetitionService } = require('../sdk/src/services/RFQCompetitionService');

// Test avec market makers devnet
async function testPrivateRFQ() {
  const connection = new Connection('https://api.devnet.solana.com');
  const rfqService = new RFQCompetitionService(connection);

  const testPairs = [
    ['SOL', 'USDC'],
    ['USDC', 'USDT'],
    ['SOL', 'BONK'],
  ];

  for (const [input, output] of testPairs) {
    console.log(`\n🔍 Testing ${input} → ${output}`);

    // Fetch quotes from all sources
    const quotes = await rfqService.fetchAllQuotes(
      getTokenMint(input),
      getTokenMint(output),
      1_000_000,  // 1 token (assuming 6 decimals)
      [VenueName.JUPITER, VenueName.METIS]
    );

    console.log(`   ✅ Received ${quotes.length} quotes`);

    // Compare quotes
    const bestQuote = await rfqService.getBestQuote(quotes);
    console.log(`   🏆 Best quote: ${bestQuote.source}`);
    console.log(`      Output: ${bestQuote.outputAmount}`);
    console.log(`      Price: ${bestQuote.effectivePrice}`);
    console.log(`      Slippage: ${bestQuote.slippage}%`);
  }
}

// Test timeout et fallback
async function testTimeoutFallback() {
  console.log('\n⏱️ Testing timeout and fallback...');

  // Simuler timeout sur Metis
  const collector = new LiquidityDataCollector(connection);
  
  // Désactiver Metis temporairement
  const result = await collector.fetchRFQWithFallback(
    VenueName.METIS,
    SOL_MINT,
    USDC_MINT,
    1_000_000
  );

  if (result && result.venue === VenueName.JUPITER) {
    console.log('✅ Fallback to Jupiter successful');
  } else {
    console.log('❌ Fallback failed');
  }
}

testPrivateRFQ().then(() => testTimeoutFallback());
```

---

## 📋 Plan d'Implémentation Phase 7

### Étape 1: Metis API Integration (2-3h)
```bash
# Créer le service Metis
touch sdk/src/services/MetisService.ts
touch sdk/src/services/MetisService.test.ts

# Implémenter:
# - API endpoints Metis
# - Quote fetching
# - Error handling
# - Rate limiting
```

### Étape 2: Private Market Makers (3-4h)
```bash
# Créer le service MM privé
touch sdk/src/services/PrivateMarketMakerService.ts
touch sdk/src/config/market-makers.ts

# Implémenter:
# - Configuration MM (API keys, endpoints)
# - Broadcast quotes à tous les MM
# - Aggregation des réponses
# - Authentication & security
```

### Étape 3: Logique de Compétition (2-3h)
```bash
# Créer le service de compétition
touch sdk/src/services/RFQCompetitionService.ts
touch sdk/src/services/RFQCompetitionService.test.ts

# Implémenter:
# - Parallel quote fetching
# - Scoring system
# - Best quote selection
# - Comparaison multi-sources
```

### Étape 4: Timeout et Fallback (2h)
```bash
# Modifier LiquidityDataCollector
# Ajouter:
# - fetchWithTimeout()
# - fetchRFQWithFallback()
# - Circuit breaker pattern
# - Retry logic avec exponential backoff
```

### Étape 5: Tests Devnet (2-3h)
```bash
# Créer scripts de test
touch scripts/test-rfq-private.js
touch scripts/test-rfq-competition.js
touch scripts/test-rfq-fallback.js

# Tests:
# - Jupiter vs Metis comparison
# - Private MM quotes
# - Timeout scenarios
# - Fallback behavior
# - Best quote selection
```

### Étape 6: Documentation (1h)
```bash
# Documenter:
# - Architecture RFQ
# - Market makers supportés
# - Flow de compétition
# - Configuration API keys
# - Troubleshooting
```

**Temps total estimé:** 12-16 heures

---

## 🎯 Critères de Succès Phase 7

### Fonctionnels
- ✅ Jupiter integration fonctionnelle
- ⏸️ Metis API intégrée et testée
- ⏸️ Au moins 2 market makers privés intégrés (Wintermute, B2C2)
- ⏸️ Compétition prix fonctionnelle avec scoring
- ⏸️ Timeout < 3s avec fallback automatique
- ⏸️ Tests devnet passent à 100%

### Techniques
- ⏸️ Code coverage > 80% pour services RFQ
- ⏸️ Rate limiting implémenté (éviter ban API)
- ⏸️ Circuit breaker si source échoue > 3 fois
- ⏸️ Logs détaillés pour debugging
- ⏸️ Métriques: quote success rate, latency, best source frequency

### Business
- ⏸️ Prix meilleurs que Jupiter seul dans > 30% des cas
- ⏸️ Latency totale < 3s (parallélisation)
- ⏸️ Fallback réussit à 100% si RFQ privés échouent
- ⏸️ Documentation complète pour onboarding nouveaux MM

---

## 📊 État Actuel vs Objectif

| Composant | Status Actuel | Objectif Phase 7 | Gap |
|-----------|---------------|------------------|-----|
| **Jupiter API** | ✅ Fonctionnel | ✅ Optimisé | Optimisations mineures |
| **Metis API** | ❌ Non implémenté | ✅ Intégré | Service complet à créer |
| **Private MM** | ❌ Non implémenté | ✅ 2+ MM intégrés | Services + auth à créer |
| **Compétition** | ❌ Non implémenté | ✅ Scoring avancé | Service complet à créer |
| **Timeout/Fallback** | ⚠️ Basique | ✅ Robuste avec retry | Circuit breaker + metrics |
| **Tests Devnet** | ⚠️ Jupiter only | ✅ All sources | Scripts complets à créer |

**Progrès global:** 20% (Jupiter OK, reste à implémenter)

---

## 🚀 Prochaines Actions

### Immédiat (Aujourd'hui)
1. ✅ Analyser l'existant (fait)
2. 🔄 Implémenter MetisService.ts
3. 🔄 Créer configuration market makers

### Court terme (Cette semaine)
4. Implémenter RFQCompetitionService
5. Ajouter timeout et fallback robustes
6. Créer tests devnet RFQ

### Validation
7. Tests E2E avec tous les market makers
8. Benchmarks: SwapBack vs Jupiter vs Metis
9. Documentation et guides d'intégration

---

**Rapport créé le:** 24 Novembre 2025  
**Par:** GitHub Copilot  
**Status:** 🟡 **ANALYSE COMPLÈTE - IMPLÉMENTATION REQUISE**
