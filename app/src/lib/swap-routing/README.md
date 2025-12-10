# Swap Routing Decision Logic

## Overview

Ce module implémente la logique de décision de routing pour les swaps SwapBack.
La fonction principale `decideSwapRoute()` détermine si un swap doit passer par
le router natif SwapBack ou directement via Jupiter.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Swap Request                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    decideSwapRoute(params)                      │
│  ├─ Check: Feature Flag (NEXT_PUBLIC_NATIVE_SWAP_ENABLED)       │
│  ├─ Check: Pair Supported (hasOracleForPair)                    │
│  └─ Check: Jupiter CPI Available                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
        route: "native"              route: "jupiter"
        (SwapBack Router)            (Jupiter Direct)
```

## Reason Codes

| Code | Signification | Action |
|------|---------------|--------|
| `FLAG_DISABLED` | Feature flag `NEXT_PUBLIC_NATIVE_SWAP_ENABLED=false` | Fallback Jupiter |
| `PAIR_UNSUPPORTED` | Paire pas dans `ORACLE_FEED_CONFIGS` | Fallback Jupiter |
| `JUPITER_CPI_UNAVAILABLE` | Données CPI non obtenues depuis API | Fallback Jupiter |
| `NATIVE_ELIGIBLE` | Toutes conditions OK | Route native SwapBack |

## Configuration

### Feature Flag

```bash
# .env.local
NEXT_PUBLIC_NATIVE_SWAP_ENABLED=true  # Activé (défaut)
NEXT_PUBLIC_NATIVE_SWAP_ENABLED=false # Désactivé (fallback Jupiter)
```

### Paires Supportées

Les paires supportées sont définies dans `app/src/config/oracles.ts` via `ORACLE_FEED_CONFIGS`.
Une paire est supportée si elle a un oracle Pyth configuré.

## Utilisation

```typescript
import { decideSwapRoute } from "@/lib/swap-routing";

const decision = decideSwapRoute({
  inputMint: "So11111111111111111111111111111111111111112",
  outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  hasJupiterCpi: true,
});

if (decision.route === "native") {
  // Exécuter via SwapBack Router
} else {
  // Exécuter via Jupiter Direct
  console.log("Reason:", decision.reason);
}
```

## Tests

```bash
cd app && npm run test -- --run decide-swap-route
```

## Notes Techniques

### Pourquoi Jupiter CPI est requis?

Le programme on-chain `swapback_router` utilise `swap_toc` → `process_single_swap`
qui exige un `jupiter_route` valide. Sans cette donnée, l'erreur `MissingJupiterRoute (6021)`
est renvoyée.

Le native-router doit obtenir ces données via `/api/swap/quote` qui retourne `jupiterCpi`
contenant les instructions et comptes nécessaires pour le CPI Jupiter.

### Logs

La décision est loggée au niveau `debug` avec les détails :
- `route`: native | jupiter
- `reason`: code de la raison
- `inputMint`, `outputMint`: tokens impliqués
- `details`: informations supplémentaires

Consulter les logs avec: `logger.debug("useNativeSwap", ...)`

---

*Référence: docs/ai/solana-native-router-a2z.md*
