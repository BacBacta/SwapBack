---
applyTo: "app/src/lib/native-router/**,app/src/hooks/**useNativeSwap**,app/src/app/api/**"
---

# Instructions RouterSwap (Mainnet)

## Obligatoire
- Toute tentative de swap natif doit:
  1) vérifier existence d'oracles valides pour la paire (primary au minimum),
  2) refuser avant signature si oracle manquant / invalid / stale,
  3) fournir un message UI clair + fallback Jupiter (si activé).

## Logs / Observabilité
- Logguer au niveau debug:
  - inputMint/outputMint
  - amount (base units)
  - slippageBps
  - primaryOracle/fallbackOracle pubkeys
  - maxStalenessSecs appliqué
  - RPC endpoint

## Interdits
- Ne jamais utiliser un oracle par défaut pour une paire inconnue.
- Ne jamais construire une instruction on-chain si la paire est "UNSUPPORTED".
- Ne jamais transformer une erreur oracle en "success" côté UI.

## Validation requise
- Au moins 2 paires "supportées" doivent passer `simulateTransaction` sur mainnet sans 0x1772.
- Une paire non supportée doit échouer côté client (avant signature), avec message explicite.
