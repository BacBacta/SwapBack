# Agent Rules — SwapBack RouterSwap (Mainnet)

## Priorités
1) Corriger l'obtention de quotes natives (et/ou la fallback strategy).
2) Corriger les erreurs oracles (0x1772) via config/gating/audit.
3) Assurer que l'app ne dépend plus de données hardcodées en prod.

## Mainnet constraint
- Pas de modifications on-chain sans demande explicite.

## Procédure obligatoire
- Toujours:
  - identifier la paire (mints) + instruction index,
  - capturer logs de simulation,
  - exécuter audit feeds,
  - corriger configuration + gating,
  - valider via simulateTransaction et tests.

## Definition of Done
- simulateTransaction OK (pas 0x1772) sur paires supportées
- paires non supportées: blocage avant signature + fallback Jupiter
- scripts + tests green
