---
applyTo: "app/src/app/api/**,app/next.config.*,middleware.ts"
---

# Instructions API / Proxy / CORS

## Règles
- Toujours répondre aux préflights OPTIONS sur /api/*.
- CORS: origines autorisées explicites en prod (pas `*` avec credentials).
- Proxy interne:
  - allowlist des domaines,
  - logging des erreurs upstream,
  - pas de proxy "public" tiers.

## Interdits
- Interdit: désactiver CORS globalement.
- Interdit: contourner via services proxy publics.
