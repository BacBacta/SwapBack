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
- Aucune modification on-chain sans demande explicite.
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

---

## Sources & Références (Swap Router Solana)

> Objectif: sources **fiables** et **priorisées** pour implémenter/valider un swap router natif (CPI directs, v0+LUTs, simulateTransaction, Token-2022, sécurité).
> 
> Rappel: dans ce repo, **Jupiter est désactivé tant que le routeur natif n’a pas été explicitement validé par l’utilisateur** (cf. “🚫 BLOCAGE JUPITER”). Les liens Jupiter ci-dessous servent de **référence industrielle**, pas d’instruction d’activation.

### A) Solana (core / transactions / RPC / tokens)
- https://solana.com/docs/core/cpi — CPI: règles d’invocation inter-programmes.
- https://solana.com/docs/core/pda — PDA: dérivations, seeds, bump, signatures.
- https://solana.com/docs/core/accounts — Accounts: modèles de comptes, ownership, mutabilité.
- https://solana.com/docs/core/fees — Fees & priority fees: frais, compute pricing, priorisation.
- https://solana.com/docs/rpc/http/simulatetransaction — simulateTransaction (RPC): validation avant envoi.
- https://solana.com/docs/rpc — RPC docs (hub): référence RPC complète (HTTP/WebSocket).
- https://solana.com/docs/tokens — Tokens (overview): concepts SPL token et flux usuels.
- https://solana.com/docs/tokens/basics — SPL Token Basics: bases token accounts/ATAs/mints.
- https://solana.com/developers/guides/advanced/lookup-tables — Address Lookup Tables: réduire la taille des tx.
- https://solana.com/developers/guides/advanced/versions — Versioned transactions: v0 message, address table lookups.
- https://solana.com/developers/cookbook/transactions/optimize-compute — Optimize compute: bonnes pratiques compute budget.
- https://docs.rs/solana-compute-budget-interface/latest/solana_compute_budget_interface/enum.ComputeBudgetInstruction.html — ComputeBudgetInstruction API: set CU limit/price.
- https://solana-labs.github.io/solana-program-library/token/js/index.html — @solana/spl-token (TS): ATAs, Token, Token-2022 côté client.
- https://github.com/solana-program/token-2022 — Token-2022 (repo): extensions token, compat, implications.

### B) Anchor (si utilisé)
- https://www.anchor-lang.com/docs/basics/cpi — CPI (Anchor): patterns CPI, Context, AccountInfo.
- https://www.anchor-lang.com/docs/tokens/basics — SPL Tokens (Anchor): comptes token, contraintes, helpers.

### C) Jupiter (pattern industriel d’agrégation)
- https://hub.jup.ag/docs/apis/swap-api — Swap API v6: API d’agrégation et formats.
- https://dev.jup.ag/api-reference — API reference: détails endpoints, paramètres, réponses.
- https://github.com/jup-ag/jupiter-swap-api-client — Client Rust: exemples et intégration.
- https://hub.jup.ag/docs/apis/self-hosted — (optionnel) Self-hosted: héberger l’API côté infra.

### D) Venues (adapters: source de vérité des accounts/IX)
- https://dev.orca.so/ — Orca Whirlpools (hub): docs/SDK.
- https://github.com/orca-so/whirlpools — Orca Whirlpools (repo): source programme.
- https://github.com/orca-so/whirlpools/blob/main/programs/whirlpool/src/instructions/swap.rs — Orca swap instruction (source): ordre/contraintes des comptes.
- https://github.com/orca-so/whirlpool-cpi-sample — Orca CPI sample: exemple CPI minimal.
- https://github.com/raydium-io/raydium-amm/blob/master/program/src/instruction.rs — Raydium AMM instruction set (source): accounts + data.
- https://github.com/raydium-io/raydium-amm-v3/blob/master/programs/amm/src/instructions/swap_router_base_in.rs — Raydium CLMM router (source): route base-in.
- https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions — Meteora DLMM SDK docs (swapQuote): fonctions/ABI côté SDK.
- https://github.com/MeteoraAg/dlmm-sdk — Meteora DLMM SDK repo: code source SDK.
- https://github.com/openbook-dex/openbook-v2 — OpenBook v2: CLOB on-chain.
- https://github.com/Ellipsis-Labs/phoenix-v1 — Phoenix v1 (program): source programme.
- https://github.com/Ellipsis-Labs/phoenix-sdk — Phoenix SDK: décodage market, builders.

### E) Exécution compétitive / MEV (si nécessaire)
- https://docs.jito.wtf/ — Jito docs: bundles, tips, MEV protection.

### F) Sécurité (obligatoire)
- https://github.com/coral-xyz/sealevel-attacks — Sealevel Attacks: patterns d’attaques + mitigations.
- https://solana.com/fr/developers/courses/program-security — Solana Program Security course: fondamentaux sécu.
- https://github.com/crytic/solana-lints — Solana lints (Crytic): lints/analyses statiques.
- https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security — Helius security guide: pratiques et checklists.
- https://canardmandarin.github.io/solana-open-security-standard/ — Solana Open Security Standard (SOSS): standard sécu.

## Policy d’usage des sources (Swap Router)
- Toujours valider l’ordre des comptes + contraintes d’un swap contre la **source primaire** (instruction.rs / IDL / repo du programme).
- Toujours simuler via **simulateTransaction** et ajuster **ComputeBudget** (CU limit + CU price) avant tout envoi.
- Utiliser **v0 + LUTs** dès que les comptes explosent (multi-hop, CLMM, DLMM bin arrays).
- Traiter **Token-2022 / token extensions** comme un cas standard (ATAs avec bon token program, impacts potentiels).
- Pour chaque nouveau DEX: créer un **adapter** documenté (accounts map + builder + tests + simulate script).
- Éviter les sources non officielles/non maintenues; dédupliquer et préférer la “truth source”.

Last reviewed: 2025-12-16
