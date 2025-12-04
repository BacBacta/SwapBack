# Hybrid Routing Scheduler (Cron Runner)

Ce module fournit une brique hors-UI pour séquencer les intents hybrides générés par `/api/swap/quote`. Il s’appuie sur `hybridIntentScheduler` (`app/src/workers/hybridIntentScheduler.ts`) et peut être déclenché par un cron, un worker queue ou un service serverless.

## Principe

1. Récupérer un plan d’exécution depuis l’API (intents `jupiter_best`, `twap_plan`, `internal_liquidity`).
2. Appeler `hybridIntentScheduler.schedulePlan(planId, intents, handler)`.
3. Fournir un handler qui signe/envoie chaque tranche selon le canal (`public`, `jito`, `private-rpc`). Le scheduler découpe automatiquement les intents TWAP en tranches homogènes et séquence les envois (spacing minimal 5s).
4. Le monitor (`protocolMonitor`) consigne la programmation, l’exécution et les erreurs pour suivi admin.

## Exemple de worker

1. Ajoutez vos plans dans `app/data/hybrid-plans.json` (status `"pending"`).
2. Lancez le worker :

```bash
cd app
npm run worker:hybrid
```

Le script `src/scripts/runHybridWorker.ts` importe `startHybridWorker()` et boucle toutes les `HYBRID_WORKER_INTERVAL_MS` ms (15 secondes par défaut). Chaque plan est lu via `hybridPlanStore`, planifié avec `hybridIntentScheduler`, puis exécuté via `ExecutionClient` qui envoie réellement les transactions (public RPC, Jito bundle ou private RPC).

## Commande de test

```
cd app && npx tsx src/scripts/demo-hybrid-scheduler.ts
```

Créez `src/scripts/demo-hybrid-scheduler.ts` et importez le scheduler pour simuler des intents (utile pour QA sans envoyer de transactions).

## Prochaines étapes

- Brancher un vrai fetcher (ex: Supabase table `hybrid_plans`).
- Implémenter `submitIntent` vers Anchor/Jupiter/Jito (le `ExecutionClient` accepte déjà des transactions Base64 par intent).
- Déployer le worker (`npm run worker:hybrid`) sur Fly.io, Cloud Run, Lambda, ou via un cron Kubernetes.
