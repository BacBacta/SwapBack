---
applyTo: "app/src/config/oracles.ts,sdk/src/config/**,scripts/**oracle**"
---

# Instructions Oracles (Mainnet)

## Règle d'or
- Toute modification de feed oracle doit être justifiée par:
  - un audit mainnet (publishTime / round timestamp),
  - et un statut OK/BROKEN/UNKNOWN documenté.

## Audit obligatoire
- Maintenir un script `scripts/oracle-audit.mainnet.ts` qui:
  - parcourt `ORACLE_FEED_CONFIGS`,
  - vérifie la fraîcheur et la validité des feeds Pyth/Switchboard,
  - génère `oracle_audit_report.json`.

## Politique de support
- Si un token/pair n'a pas de feed fiable:
  - ne pas "inventer" un fallback,
  - marquer la paire UNSUPPORTED,
  - imposer le fallback Jupiter (ou blocage).

## Interdits
- Interdit: conserver des feeds Switchboard inactifs (âge >> minutes/heures).
- Interdit: garder des feeds devnet/testnet en mainnet.
- Interdit: contourner staleness/confidence côté client.
