# RouterSwap Playbook (Mainnet) — Procédure obligatoire

## A. Triage
Toujours collecter:
- inputMint / outputMint
- amount (base units)
- slippageBps
- instruction index qui fail (ex "Instruction 5")
- logs complets de simulation
- primaryOracle / fallbackOracle réellement passés

## B. Audit oracles
Pour chaque oracle account:
- lire via RPC mainnet
- calculer age (publishTime ou round_open_timestamp)
- vérifier valeur: price != 0, confidence acceptable
- classer: OK / BROKEN / UNKNOWN

## C. Décision
- Si primary OK: paire SUPPORTÉE
- Si primary BROKEN/UNKNOWN: paire NON SUPPORTÉE (bloquer swap natif)
- Fallback Switchboard uniquement si explicitement OK

## D. Correctifs autorisés (sans redeploy)
- update ORACLE_FEED_CONFIGS
- supprimer feeds obsolètes/devnet
- gating client + message UI + fallback Jupiter
- logs/observabilité

## E. Tests obligatoires
- unit tests: mapping + gating + serialization args
- script audit mainnet (oracle-audit)
- script simulate mainnet (simulateTransaction, no broadcast)
- DoD: pas d'erreur 0x1772 sur paires supportées
