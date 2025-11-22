# Observabilité & Sécurité du routeur SwapBack

Mise à jour du 21 novembre 2025.

## Journaux structurés

- Les services `RouteOptimizationEngine` et `IntelligentOrderRouter` publient désormais des évènements structurés (`[swapback][route-engine]|[intelligent-router]`).
- Évènements principaux :
  - `routes_ranked`: Top 3 routes évaluées avec coûts attendus, ratio effectif, risque MEV.
  - `plan_built`: Plan atomique construit avec découpe par legs et nombre de fallbacks.
  - `plan_monitor_steady`: Boucle de surveillance qui confirme qu’aucun rebalance n’est nécessaire.
  - `plan_rebuilt`: Nouveau plan généré suite à dérive de liquidité (inclus les diffs).
- Les payloads sont au format JSON sérialisable pour ingestion facile par un collecteur (p.ex. pino, Datadog, ELK).

## Validation on-chain renforcée

- `create_dca_plan` refuse désormais :
  - les montants minimum de sortie égaux à zéro,
  - les plans avec mêmes mints d’entrée/sortie,
  - les montants par swap dépassant la limite `MAX_SINGLE_SWAP_LAMPORTS`.
- Les tests unitaires (`programs/swapback_router/src/tests.rs`) couvrent ces validations pour éviter les régressions.

## Utilisation

- Les journaux apparaissent sur stdout en local (`console.info|warn`). En production, configurer le runtime pour rediriger vers votre stack d’observabilité.
- Les limites de montants peuvent être ajustées dans `programs/swapback_router/src/lib.rs` en fonction de l’appétence risque.
