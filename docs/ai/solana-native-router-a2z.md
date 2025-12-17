# Solana Native Router A→Z — Documentation Obligatoire

> **SCOPE**: Ce document est la référence obligatoire pour toute tâche liée au RouterSwap natif, 
> construction de transactions, CPI, oracles (Pyth/Switchboard), intégrations DEX, et CORS/proxy Next.js.

---

## 1. Scope & Règles MAINNET

### Contraintes NON NÉGOCIABLES

| Règle | Description |
|-------|-------------|
| **MAINNET ONLY** | Le programme `swapback_router` est déployé sur Solana MAINNET. Aucune modification on-chain sans demande explicite. |
| **NO HARDCODE** | Interdit de hardcoder des prix/quotes en production (sauf mocks en tests). |
| **NO SILENT FALLBACK** | Interdit de fallback silencieusement vers un oracle par défaut pour une paire inconnue. |
| **SIMULATE FIRST** | Toute transaction DOIT être validée via `simulateTransaction` avant envoi réel. |

### Program IDs (Mainnet)

```
ROUTER_PROGRAM_ID: APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN
BUYBACK_PROGRAM_ID: 7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ
CNFT_PROGRAM_ID: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru
```

---

## 2. Architecture d'un Router Natif

### Pipeline de Swap

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐    ┌──────┐
│ Quote Layer │ → │ Route Select │ → │ TX Builder  │ → │ Simulate │ → │ Send │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────┘    └──────┘
      ↓                   ↓                   ↓                ↓
  DEX APIs          Score/NPI          Versioned TX      RPC Check
  Oracles           Best venue          ALTs/CU           No errors
```

### Référence d'implémentation

> **A) Router natif A→Z (référence d'implémentation)**
> - https://github.com/okxlabs/DEX-Router-Solana-V1

---

## 3. Construction de Transactions

### Versioned Transactions & Address Lookup Tables

Les transactions modernes sur Solana utilisent le format V0 avec ALTs pour réduire la taille.

> **C) Solana — Versioned Transactions & Address Lookup Tables**
> - https://solana.com/developers/guides/advanced/versions
> - https://solana.com/developers/guides/advanced/lookup-tables

### CPI (Cross-Program Invocation) & PDAs

> **B) Solana — CPI / PDA / Transactions / Simulation**
> - https://solana.com/docs/core/cpi
> - https://solana.com/docs/core/pda
> - https://solana.com/docs/core/transactions
> - https://solana.com/docs/rpc/http/simulatetransaction

### Compute Budget

```typescript
// Toujours inclure compute budget pour éviter out-of-compute
ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
```

### Anchor Errors

> **E) Anchor — erreurs custom**
> - https://www.anchor-lang.com/docs/features/errors

Codes d'erreur courants:
- `0x1771` (6001): `InvalidOraclePrice` — Prix oracle invalide
- `0x1772` (6002): `StaleOracleData` — Données oracle périmées
- `0x1773` (6003): `OracleConfidenceTooWide` — Intervalle de confiance trop large

---

## 4. Tokens / ATAs & SPL Token

> **D) Tokens / SPL**
> - https://spl.solana.com/token
> - https://solana.com/docs/tokens

### Création d'ATA (Associated Token Account)

```typescript
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

const ata = await getAssociatedTokenAddress(mint, owner);
// Vérifier si existe avant de créer
```

### Wrapped SOL

Pour swapper SOL natif, il faut:
1. Créer un ATA WSOL temporaire
2. Transférer + sync native
3. Effectuer le swap
4. Close account pour récupérer le SOL

---

## 5. Oracles (Pyth & Switchboard)

### 5.1 Pyth Network

#### Pull Integration (recommandé pour swaps)

> **F) Pyth — Solana pull integration + troubleshoot + push feeds + Hermes**
> - https://docs.pyth.network/price-feeds/use-real-time-data/pull-integration/solana
> - https://docs.pyth.network/price-feeds/troubleshoot/svm
> - https://docs.pyth.network/price-feeds/core/push-feeds/solana
> - https://docs.pyth.network/price-feeds/fetch-price-updates
> - https://docs.pyth.network/price-feeds/how-pyth-works/hermes
> - https://docs.pyth.network/price-feeds/price-feeds

#### Push Feeds (sponsorisés)

Les Push Feeds sont des comptes `PriceUpdateV2` mis à jour automatiquement par Pyth Data Association.

**Program ID Push Oracle**: `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`

**Dérivation d'adresse PDA**:
```typescript
const [pda] = PublicKey.findProgramAddressSync(
  [shardBuffer, feedIdBuffer],  // shard (2 bytes LE) + feedId (32 bytes)
  PYTH_PUSH_ORACLE_PROGRAM_ID
);
```

#### Staleness & Confidence

```typescript
const MAX_STALENESS_SECS = 300;  // 5 minutes max
const MAX_CONFIDENCE_BPS = 500;  // 5% max

// Vérification
const ageSeconds = now - publishTime;
if (ageSeconds > MAX_STALENESS_SECS) throw new Error("StaleOracleData");
if (confidenceBps > MAX_CONFIDENCE_BPS) throw new Error("OracleConfidenceTooWide");
```

### 5.2 Switchboard (DEPRECATED)

> ⚠️ **Switchboard V2 est EOL (End of Life) depuis Novembre 2024**
> Migration vers Switchboard OnDemand requise.

> **G) Switchboard — aggregator (staleness)**
> - https://docs.switchboard.xyz/product-documentation/aggregator/how-to-use-the-switchboard-oracle-aggregator
> - https://github.com/switchboard-xyz/solana-sdk
> - https://docs.switchboard.xyz/

---

## 6. Intégrations DEX

### 6.1 Orca Whirlpools

> **H) Orca Whirlpools**
> - https://dev.orca.so/SDKs/Overview/
> - https://dev.orca.so/ts/index.html

**Endpoint API**: `https://api.mainnet.orca.so/v1/quote`

```typescript
const response = await fetch(
  `https://api.mainnet.orca.so/v1/quote?` +
  `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippage=0.5`
);
```

### 6.2 Meteora DLMM

> **I) Meteora DLMM**
> - https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started

**Note**: L'API Meteora requiert l'adresse de la paire DLMM, pas les mints directement.
Utiliser le SDK TypeScript pour les quotes précises.

### 6.3 Phoenix (CLOB)

> **J) Phoenix**
> - https://github.com/Ellipsis-Labs/phoenix-v1

**Note**: Phoenix n'a pas d'API REST publique. Utiliser le SDK on-chain uniquement.

### 6.4 Raydium

> **K) Raydium**
> - https://docs.raydium.io/raydium/traders/trade-api

**Endpoint API**: `https://transaction-v1.raydium.io/compute/swap-base-in`

```typescript
const response = await fetch(
  `https://transaction-v1.raydium.io/compute/swap-base-in?` +
  `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`
);
```

### Compatibilité DEX

| DEX | API Quote | SDK Required | Notes |
|-----|-----------|--------------|-------|
| Raydium | ✅ REST | Non | `transaction-v1.raydium.io` |
| Orca | ✅ REST | Non | `api.mainnet.orca.so` |
| Meteora | ⚠️ Partiel | Oui | Requiert pair address |
| Phoenix | ❌ | Oui | On-chain SDK only |

---

## 7. CORS / Next.js Proxy

> **L) Next.js / CORS**
> - https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
> - https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
> - https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request

### Configuration CORS Next.js

```javascript
// next.config.js
async headers() {
  return [
    {
      source: "/api/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type" },
      ],
    },
  ];
}
```

### Proxy API Routes

Pour éviter CORS côté client, proxifier les appels DEX via `/api/`:

```typescript
// app/api/venue-quotes/route.ts
export async function GET(request: Request) {
  // Appeler les DEX APIs côté serveur
  const quotes = await Promise.allSettled([
    fetchRaydiumQuote(...),
    fetchOrcaQuote(...),
  ]);
  return Response.json({ quotes });
}
```

---

## 8. Checklist "Avant toute modification RouterSwap/Oracles"

### MUST DO (Obligatoire)

- [ ] Ouvrir ce document (`docs/ai/solana-native-router-a2z.md`)
- [ ] Identifier les mints concernés (inputMint, outputMint)
- [ ] Vérifier que les oracles existent pour la paire (`ORACLE_FEED_CONFIGS`)
- [ ] Exécuter `pnpm oracle:audit:mainnet` et vérifier le rapport
- [ ] Simuler la transaction via `simulateTransaction` avant envoi
- [ ] Tester sur au moins 2 paires supportées
- [ ] Vérifier que les paires non supportées sont bloquées côté client

### MUST NOT DO (Interdit)

- [ ] Hardcoder des prix/quotes en production
- [ ] Fallback silencieux vers un oracle par défaut
- [ ] Augmenter `maxStalenessSecs` pour masquer un feed mort
- [ ] Modifier un endpoint DEX sans consulter la doc officielle
- [ ] Envoyer une transaction sans `simulateTransaction` préalable

### Definition of Done (DoD)

- [ ] `simulateTransaction` OK (pas d'erreur 0x1771/0x1772) sur paires supportées
- [ ] Paires non supportées: blocage avant signature + message UI + fallback Jupiter
- [ ] Tests unitaires passent
- [ ] Scripts d'audit passent
- [ ] Au moins 1 lien de cette doc cité dans le PR/commit

---

## 9. Policy d'usage des sources (OBLIGATOIRE)

1. **Validation contre source primaire** : Toujours valider les comptes/contraintes d'un swap contre la source primaire (instruction.rs / IDL / repo du programme DEX).
2. **Simulation obligatoire** : Toujours exécuter `simulateTransaction` et ajuster `ComputeBudget` (setComputeUnitLimit / setComputeUnitPrice) avant envoi réel.
3. **Versioned TX + LUTs** : Utiliser v0 + Address Lookup Tables dès que le nombre de comptes dépasse ~30 (multi-hop, CLMM, venues complexes).
4. **Token-2022 / Extensions** : Traiter Token-2022 et ses extensions (transfer fees, interest-bearing, etc.) comme cas standard — impacts possibles sur montants reçus et compatibilité ATA.
5. **Adapters par venue** : Pour chaque nouveau DEX intégré, créer un adapter documenté avec : accounts map, instruction builder, tests de simulation.
6. **Sécurité** : Consulter les ressources de sécurité (Sealevel Attacks, Solana lints) avant tout déploiement mainnet.

---

## Références Complètes (Swap Router Solana)

### A) Solana Core — Transactions / RPC / Tokens

| Source | Description |
|--------|-------------|
| [CPI](https://solana.com/docs/core/cpi) | Cross-Program Invocation : comment invoquer un programme depuis un autre |
| [PDA](https://solana.com/docs/core/pda) | Program Derived Addresses : dérivation d'adresses déterministes |
| [Accounts](https://solana.com/docs/core/accounts) | Modèle de comptes Solana (ownership, rent, data) |
| [Fees & Priority Fees](https://solana.com/docs/core/fees) | Calcul des frais, priority fees, compute budget |
| [simulateTransaction (RPC)](https://solana.com/docs/rpc/http/simulatetransaction) | Simuler une transaction avant envoi |
| [RPC Docs (hub)](https://solana.com/docs/rpc) | Documentation complète de l'API RPC Solana |
| [Tokens (overview)](https://solana.com/docs/tokens) | Vue d'ensemble des tokens SPL |
| [SPL Token Basics](https://solana.com/docs/tokens/basics) | Fondamentaux SPL Token (mint, ATA, transfer) |
| [Address Lookup Tables](https://solana.com/developers/guides/advanced/lookup-tables) | Réduire la taille des transactions avec LUTs |
| [Versioned Transactions](https://solana.com/developers/guides/advanced/versions) | Transactions v0 et legacy |
| [Optimize Compute (Cookbook)](https://solana.com/developers/cookbook/transactions/optimize-compute) | Bonnes pratiques pour optimiser le compute |
| [ComputeBudgetInstruction (Rust API)](https://docs.rs/solana-compute-budget-interface/latest/solana_compute_budget_interface/enum.ComputeBudgetInstruction.html) | API Rust pour set compute limit/price |
| [@solana/spl-token (TS)](https://solana-labs.github.io/solana-program-library/token/js/index.html) | SDK TypeScript SPL Token |
| [Token-2022 (repo)](https://github.com/solana-program/token-2022) | Programme Token-2022 avec extensions |

### B) Anchor Framework

| Source | Description |
|--------|-------------|
| [CPI (Anchor)](https://www.anchor-lang.com/docs/basics/cpi) | Invocations cross-program avec Anchor |
| [SPL Tokens (Anchor)](https://www.anchor-lang.com/docs/tokens/basics) | Gestion des tokens SPL dans Anchor |
| [Errors (Anchor)](https://www.anchor-lang.com/docs/features/errors) | Gestion des erreurs custom Anchor |

### C) Jupiter — Pattern Agrégation (référence industrielle)

| Source | Description |
|--------|-------------|
| [Swap API v6](https://hub.jup.ag/docs/apis/swap-api) | API de swap Jupiter (quote + swap) |
| [API Reference](https://dev.jup.ag/api-reference) | Référence complète API Jupiter |
| [Client Rust](https://github.com/jup-ag/jupiter-swap-api-client) | Client Rust officiel Jupiter |
| [Self-hosted (optionnel)](https://hub.jup.ag/docs/apis/self-hosted) | Héberger son propre nœud Jupiter |

### D) Venues DEX — Instructions Sources

| Venue | Source | Description |
|-------|--------|-------------|
| **Orca Whirlpools** | [Hub](https://dev.orca.so/) | Documentation développeur Orca |
| | [Repo](https://github.com/orca-so/whirlpools) | Code source Whirlpools |
| | [swap.rs](https://github.com/orca-so/whirlpools/blob/main/programs/whirlpool/src/instructions/swap.rs) | Instruction swap (source vérité) |
| | [CPI Sample](https://github.com/orca-so/whirlpool-cpi-sample) | Exemple d'intégration CPI |
| **Raydium AMM** | [instruction.rs](https://github.com/raydium-io/raydium-amm/blob/master/program/src/instruction.rs) | Instructions AMM v4 (source vérité) |
| **Raydium CLMM** | [swap_router.rs](https://github.com/raydium-io/raydium-amm-v3/blob/master/programs/amm/src/instructions/swap_router_base_in.rs) | Instruction swap router CLMM |
| | [Trade API](https://docs.raydium.io/raydium/traders/trade-api) | API REST Raydium |
| **Meteora DLMM** | [SDK Docs](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions) | Fonctions SDK (swapQuote, etc.) |
| | [SDK Repo](https://github.com/MeteoraAg/dlmm-sdk) | Code source SDK DLMM |
| **Phoenix** | [Program v1](https://github.com/Ellipsis-Labs/phoenix-v1) | Code source programme Phoenix |
| | [SDK](https://github.com/Ellipsis-Labs/phoenix-sdk) | SDK TypeScript/Rust Phoenix |
| **OpenBook v2** | [Repo](https://github.com/openbook-dex/openbook-v2) | Orderbook DEX (successeur Serum) |

### E) Oracles

| Source | Description |
|--------|-------------|
| [Pyth Pull Integration](https://docs.pyth.network/price-feeds/use-real-time-data/pull-integration/solana) | Intégration Pyth pull model |
| [Pyth Push Feeds](https://docs.pyth.network/price-feeds/core/push-feeds/solana) | Push feeds sponsorisés (PriceUpdateV2) |
| [Pyth Troubleshoot SVM](https://docs.pyth.network/price-feeds/troubleshoot/svm) | Debug erreurs Pyth sur Solana |
| [Pyth Hermes](https://docs.pyth.network/price-feeds/how-pyth-works/hermes) | Architecture Hermes (off-chain) |
| [Switchboard Aggregator](https://docs.switchboard.xyz/product-documentation/aggregator/how-to-use-the-switchboard-oracle-aggregator) | Utilisation aggregators Switchboard |
| [Switchboard SDK](https://github.com/switchboard-xyz/solana-sdk) | SDK Solana Switchboard |

### F) Exécution Compétitive / MEV

| Source | Description |
|--------|-------------|
| [Jito Docs](https://docs.jito.wtf/) | Bundles, tips, MEV protection |

### G) Sécurité (OBLIGATOIRE)

| Source | Description |
|--------|-------------|
| [Sealevel Attacks](https://github.com/coral-xyz/sealevel-attacks) | Catalogue des vulnérabilités Solana (exemples) |
| [Solana Program Security Course](https://solana.com/fr/developers/courses/program-security) | Cours officiel sécurité programmes |
| [Solana Lints (Crytic)](https://github.com/crytic/solana-lints) | Linters sécurité Trail of Bits |
| [Helius Security Guide](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security) | Guide pratique sécurité Helius |
| [Solana Open Security Standard (SOSS)](https://canardmandarin.github.io/solana-open-security-standard/) | Standard de sécurité communautaire |

### H) Tooling / Infra

| Source | Description |
|--------|-------------|
| [Next.js Headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers) | Configuration CORS Next.js |
| [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) | Référence CORS |
| [Copilot Instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) | Configuration instructions repo |

### I) Références Internes SwapBack

| Fichier | Description |
|---------|-------------|
| `docs/agent/REFERENCE_LIBRARY.md` | Bibliothèque de référence oracles/endpoints |
| `docs/agent/ROUTER_SWAP_PLAYBOOK.md` | Playbook procédure RouterSwap |
| `docs/agent/WORKFLOW_CHECKLIST.md` | Checklist workflow agent |

---

*Last reviewed: 2025-12-16*
