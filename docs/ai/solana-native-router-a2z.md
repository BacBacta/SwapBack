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

## Références Complètes

### A) Router natif A→Z
- https://github.com/okxlabs/DEX-Router-Solana-V1

### B) Solana Core
- https://solana.com/docs/core/cpi
- https://solana.com/docs/core/pda
- https://solana.com/docs/core/transactions
- https://solana.com/docs/rpc/http/simulatetransaction

### C) Versioned TX & ALTs
- https://solana.com/developers/guides/advanced/versions
- https://solana.com/developers/guides/advanced/lookup-tables

### D) Tokens / SPL
- https://spl.solana.com/token
- https://solana.com/docs/tokens

### E) Anchor Errors
- https://www.anchor-lang.com/docs/features/errors

### F) Pyth Network
- https://docs.pyth.network/price-feeds/use-real-time-data/pull-integration/solana
- https://docs.pyth.network/price-feeds/troubleshoot/svm
- https://docs.pyth.network/price-feeds/core/push-feeds/solana
- https://docs.pyth.network/price-feeds/fetch-price-updates
- https://docs.pyth.network/price-feeds/how-pyth-works/hermes
- https://docs.pyth.network/price-feeds/price-feeds

### G) Switchboard
- https://docs.switchboard.xyz/product-documentation/aggregator/how-to-use-the-switchboard-oracle-aggregator
- https://github.com/switchboard-xyz/solana-sdk
- https://docs.switchboard.xyz/

### H) Orca Whirlpools
- https://dev.orca.so/SDKs/Overview/
- https://dev.orca.so/ts/index.html

### I) Meteora DLMM
- https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started

### J) Phoenix
- https://github.com/Ellipsis-Labs/phoenix-v1

### K) Raydium
- https://docs.raydium.io/raydium/traders/trade-api

### L) Next.js / CORS
- https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
- https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request

### M) Copilot Instructions
- https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions

---

*Dernière mise à jour: 10 Décembre 2025*
