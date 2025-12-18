# Workflow Checklist — PR RouterSwap

## Avant code
- [ ] Lire docs/agent/REFERENCE_LIBRARY.md
- [ ] CI/RPC: définir `SOLANA_RPC_URL` vers un RPC **indexé** (public RPC = risque 429/flaky)
- [ ] Reproduire + capturer logs simulation
- [ ] Identifier mints + oracles réellement passés

## Pendant
- [ ] Exécuter audit mainnet feeds (OK/BROKEN/UNKNOWN)
- [ ] Mettre à jour ORACLE_FEED_CONFIGS (supprimer obsolètes)
- [ ] Implémenter gating (bloquer natif si oracle invalide)
- [ ] Ajouter tests + scripts

## Avant merge
- [ ] simulateTransaction mainnet: OK (>=2 paires supportées)
- [ ] paire non supportée: bloquée avant signature + fallback Jupiter
- [ ] CI: re-run `scripts/simulate-native-swap.ts` avec `SOLANA_RPC_URL` (éviter les 429)
- [ ] lint/test/build OK
- [ ] diff minimal + notes de release
