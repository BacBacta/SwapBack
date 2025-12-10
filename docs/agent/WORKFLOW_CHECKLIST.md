# Workflow Checklist — PR RouterSwap

## Avant code
- [ ] Lire docs/agent/REFERENCE_LIBRARY.md
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
- [ ] lint/test/build OK
- [ ] diff minimal + notes de release
