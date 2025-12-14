# SwapBack — Instructions Globales (Copilot Chat)

## Architecture CRITIQUE : VRAI DEX ROUTER (pas wrapper Jupiter)
- SwapBack Router doit faire des **CPI directs vers les DEX** (Orca Whirlpool, Raydium CLMM, etc.)
- **INTERDIT** : Exiger jupiter_route comme dépendance obligatoire pour les swaps
- Le mode "native swap" doit fonctionner **sans Jupiter** via CPI direct vers les pools DEX

## 🚫 BLOCAGE JUPITER — CONDITION STRICTE
**L'utilisation de Jupiter comme fallback ou option est conditionnée par la réussite du router natif.**

**TANT QUE l'utilisateur ne confirme pas explicitement que:**
1. Le routeur natif est fonctionnel
2. Les swaps passent avec succès via CPI direct vers les DEX

**L'agent ne devra AUCUNEMENT:**
- Définir Jupiter comme option ou fallback
- Proposer Jupiter comme alternative
- Implémenter du code utilisant Jupiter
- Suggérer d'activer Jupiter

**Seuls les DEX natifs sont autorisés:** Orca Whirlpool, Raydium CLMM, Meteora, Phoenix, Lifinity, Sanctum, Saber

## Contrainte MAINNET
- Le programme `swapback_router` est déployé sur Solana MAINNET.
- Modifications on-chain autorisées pour implémenter le vrai DEX router.
- Tester via simulateTransaction avant tout déploiement.

## Règles anti-régression
- Interdit: hardcoder des prix/quotes (sauf mocks en tests).
- Interdit: fallback silencieux vers un oracle par défaut (ex SOL/USD) pour une paire inconnue.
- Interdit: augmenter artificiellement `maxStalenessSecs` pour masquer un feed mort/obsolète.
- Interdit: changer un endpoint DEX/Jupiter sans doc officielle (voir `docs/agent/REFERENCE_LIBRARY.md`).

## Procédure obligatoire RouterSwap
Pour toute tâche liée à RouterSwap:
1) Reproduire/Isoler: mints, amount, slippage, instruction index, logs de simulation.
2) Logguer explicitement les pubkeys oracles réellement passées: primary + fallback.
3) Exécuter l'audit oracles mainnet (script) et classer OK/BROKEN/UNKNOWN.
4) Corriger via:
   - mapping `ORACLE_FEED_CONFIGS` + suppression feeds obsolètes,
   - gating: bloquer native swap si oracle absent/invalide/stale,
   - fallback UX: proposer Jupiter si paire non supportée.
5) Ajouter/mettre à jour tests + script simulateTransaction.
6) Produire un diff minimal + checklist "Definition of Done".

## Sources obligatoires
- Toujours consulter `docs/agent/REFERENCE_LIBRARY.md` avant toute décision sur oracles, RPC, endpoints, CORS.
- Toujours suivre `docs/agent/ROUTER_SWAP_PLAYBOOK.md` et `docs/agent/WORKFLOW_CHECKLIST.md`.

---

## DOCUMENTATION OBLIGATOIRE — SOLANA NATIVE ROUTER A→Z (MUST)

### Règle de consultation obligatoire

**MUST**: Pour toute tâche touchant RouterSwap, construction de transaction, CPI vers DEX, oracles (Pyth/Switchboard), CORS/proxy, l'agent DOIT ouvrir et suivre:
- `docs/ai/solana-native-router-a2z.md`

**MUST NOT**: "Deviner" un endpoint, un format de compte oracle, une règle de staleness, ou une structure de transaction sans vérification dans cette doc.

**MUST**: Dans toute PR/commit lié RouterSwap/Oracles, l'agent DOIT coller au moins 1 lien exact consulté depuis `docs/ai/solana-native-router-a2z.md`.

### Scope d'application

Cette règle s'applique à toute modification dans:
- `programs/**/swapback_router/**`
- `app/**/native-router/**`
- `app/**/useNativeSwap*`
- `scripts/**oracle**`
- `app/src/config/oracles.ts`
- `sdk/src/config/**`

### Definition of Done (DoD)

- Les fichiers d'instructions sont listés dans "References" des réponses Copilot Chat.
- `docs/ai/solana-native-router-a2z.md` contient tous les liens officiels.
- Toute PR cite au moins 1 lien consulté.

### Tests de conformité

Pour vérifier que Copilot utilise bien ces instructions:
1. Poser une question sur RouterSwap/Oracles
2. Vérifier que la section "References" affiche ce fichier d'instructions
3. Vérifier que la réponse mentionne `docs/ai/solana-native-router-a2z.md`

### Lien de référence

- Mécanisme officiel Copilot instructions: https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions
