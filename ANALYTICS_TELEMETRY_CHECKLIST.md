# Checklist de validation télémétrie (staging)

## 1. Préparer l'environnement
- Exporter `NEXT_PUBLIC_ANALYTICS_ENABLED=true` avant de lancer Next.js.
- Renseigner `NEXT_PUBLIC_MIXPANEL_TOKEN` avec le token staging (ne pas utiliser celui de prod).
- (Optionnel) Définir `MIXPANEL_SERVER_TOKEN` si vous souhaitez authentifier les événements backend avec un token différent.
- Vérifier que `NODE_ENV=production` (ou utiliser `npm run app:build && npm run app:start` pour reproduire la config Vercel).

```bash
cd app
export NEXT_PUBLIC_ANALYTICS_ENABLED=true
export NEXT_PUBLIC_MIXPANEL_TOKEN=<token_staging>
npm run build && npm run start
```

## 2. Parcours à reproduire
1. Charger `/enhanced-swap` et attendre le rendu complet.
2. Sélectionner deux tokens mock et saisir un montant pour déclencher l'auto-fetch.
3. Appuyer sur "Search" puis ouvrir la prévisualisation.
4. Confirmer le swap (simulé) jusqu'à l'erreur/ succès affiché.
5. Basculer de router (SwapBack ↔ Jupiter) et relancer une recherche.

## 3. Événements attendus (Mixpanel)
| Événement | Attributs clés à vérifier |
|-----------|---------------------------|
| `Page View` | `page = enhanced-swap`, `referrer` le cas échéant |
| `Route Requested` | `source`, `routerPreference`, `mevProtection`, `executionChannel` |
| `Route Result` | `success`, `latencyMs`, `routeVenues`, `errorMessage` si KO |
| `Router Selected` | `router`, `previousRouter`, `priceImpactPct`, `economicsAvailable` |
| `Swap Preview` | `router`, `inputAmount`, `nativeMode`, `provider` |
| `Swap Executed` | `swap_method`, `route_venues`, `slippage_bps`, `success` / `error_message` |
| `Error` | `stage = route-fetch` ou `swap-execution`, contexte associé |
| `Router Comparison Viewed` | `currentRouter`, `recommendedRouter`, `difference`, `percentDifference`, `hasEconomics` |
| `Router Comparison Action` | `selectedRouter`, `actionSource`, `recommendedRouter`, `inputAmount`, `priceImpact` |

> Les écrans `EnhancedSwapInterface` **et** `SwapInterface` (UI classique) déclenchent ces deux événements lors de l'ouverture/comparaison des routes. Tester les deux parcours.

### Événements backend (API Next.js)
| Événement | Description / attributs |
|-----------|------------------------|
| `Quote API Requested` | `inputMint`, `outputMint`, `amount`, `routingStrategy`, `slippageBps`, `hasWallet` |
| `Quote API Success` | `priceImpactPct`, `routePlanLength`, `nativeProvider`, `hasJupiterCpi`, `multiSourceCandidates`, `latencyMs` |
| `Quote API Fallback` | `provider`, `fromCache`, `routingStrategy`, `priceImpactPct`, `latencyMs` |
| `Quote API Validation Error` | `reason` (`missing-fields`, `invalid-amount`, …) |
| `Quote API Error` | `message` ou `reason` (ex: `jupiter-dns`, `Unknown`) |
| `Swap API Requested` | `inputMint`, `outputMint`, `amount`, `mevProtection`, `priorityFee`, `hasWallet` |
| `Swap API Success` | `priceImpactPct`, `routePlanLength`, `hasSwapTransaction`, `prioritizationFeeLamports`, `latencyMs` |
| `Swap API Validation Error` | `reason` (`missing-fields`, `invalid-address`, `invalid-amount`) |
| `Swap API Rate Limited` | `remaining`, `resetAt` |
| `Swap API Error` | `message`, `latencyMs` |

Ces événements utilisent la même clé Mixpanel que le front (paramètre `NEXT_PUBLIC_MIXPANEL_TOKEN`) sauf si `MIXPANEL_SERVER_TOKEN` est défini, auquel cas le backend emploie ce token dédié. Ils ne s'activent que si `NEXT_PUBLIC_ANALYTICS_ENABLED=true`. Vérifier qu'ils arrivent via l'API `/track?strict=1` (requests côté serveur). 

Utiliser un filtre `distinct_id = <wallet_address>` pour isoler la session.

## 4. Vérifications croisées
- Surveiller l'onglet Réseau (XHR/fetch) pour confirmer les appels `https://api.mixpanel.com`.
- Examiner la console : chaque événement logge un emoji 📊 avant l'envoi.
- En cas d'absence côté Mixpanel, vérifier que l'AdBlock est désactivé et que `window.mixpanel` est initialisé.

## 5. Critères de validation
- Tous les événements listés apparaissent en moins de 60s après l'action côté dashboard.
- `latencyMs` reste < 2000ms sur les requêtes routes.
- Aucune erreur `trackError` sans message associé.
- `success=false` uniquement lorsque l'UI affiche l'erreur correspondante.

Documenter toute anomalie directement dans `ANALYTICS_TELEMETRY_CHECKLIST.md` (section Notes) avant passage en prod.

> Pour le plan complet (validation staging, déploiement et monitoring), se référer à `docs/ANALYTICS_ROLLOUT_PLAN.md`.
