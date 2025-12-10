# SwapBack Repository Cleanup Report

**Date**: December 10, 2025  
**Author**: GitHub Copilot  
**Objectif**: Réduire espace disque et consommation CPU VS Code

---

## PHASE 0 — BASELINE (AVANT)

### Taille totale du repo
```
9.8G    Total
```

### Répartition par dossier principal
| Dossier | Taille | Notes |
|---------|--------|-------|
| `target/` | 7.1G | Artefacts de build Rust/Anchor |
| `node_modules/` | 1.8G | Dépendances Node.js |
| `app/.next/` | 563M | Build Next.js |
| `.anchor/test-ledger/` | 67M | Ledger de test Anchor |
| `test-ledger/` | 42M | Ledger de test legacy |
| `.git/` | 49M | Historique Git |
| `logs/` | 100K | Logs d'exécution |
| `tmp/` | 16K | Fichiers temporaires |

### Gros fichiers (>20MB hors node_modules)
- `target/debug/deps/` : Contient des .so et .rlib de 20-77MB
- `.anchor/test-ledger/rocksdb/` : 59MB de logs RocksDB
- `test-ledger/rocksdb/` : 39MB de logs RocksDB

### Fichiers trackés par Git dans build/caches
✅ **AUCUN** — Les dossiers `target/`, `.next/`, `dist/`, `build/`, `coverage/` ne sont PAS trackés par Git.

### Configuration actuelle
| Fichier | État |
|---------|------|
| `.gitignore` | ✅ Bien configuré (target, .next, node_modules ignorés) |
| `.vscode/settings.json` | ✅ Optimisé (watchers exclus, mémoire limitée) |
| `tsconfig.json` | ✅ Exclude correct (node_modules, .next, target) |
| `.eslintignore` | ✅ Complet |
| `.prettierignore` | ✅ Complet |

---

## PHASE 1 — NETTOYAGE RÉALISÉ

### A) Git Hygiene
✅ **Déjà propre** — Aucun artefact de build n'est tracké par Git.

### B) Réduction indexation VS Code
✅ **Déjà optimisé** — `.vscode/settings.json` contient déjà:
- `files.watcherExclude`: node_modules, .next, target, dist, build
- `search.exclude`: idem
- `typescript.tsserver.maxTsServerMemory`: 512MB
- `rust-analyzer.checkOnSave.enable`: false

### C) Optimisation TypeScript/ESLint
✅ **Déjà configuré** — `tsconfig.json` exclut correctement les dossiers de build.

### D) Scripts de nettoyage ajoutés
✅ **AJOUTÉ** dans `package.json`:
```json
{
  "clean": "rm -rf .next dist build coverage .turbo .cache",
  "clean:anchor": "rm -rf target .anchor/test-ledger test-ledger",
  "clean:all": "npm run clean && npm run clean:anchor"
}
```

---

## PHASE 2 — ÉLÉMENTS CANDIDATS À SUPPRESSION

### ⚠️ Fichiers temporaires à la racine (non supprimés)

| Fichier | Taille | Recommandation |
|---------|--------|----------------|
| `oracle_audit_report.json` | 3.3KB | Peut être déplacé vers `logs/` |
| `test-results-comprehensive.json` | 27KB | Peut être déplacé vers `logs/` |
| `check-*.js` (5 fichiers) | ~18KB | Scripts de debug, pourraient être dans `scripts/` |
| `devnet-*.json` | ~0.5KB | Keypairs devnet - garder mais sécuriser |
| `mainnet-deploy-keypair.json` | 0.2KB | ⚠️ SENSIBLE - ne pas supprimer |
| `VERCEL_ENV_VARS.txt` | 5.6KB | Info sensible potentielle |
| `tsconfig.tsbuildinfo` | 362KB | Peut être ignoré par Git |

### ⚠️ Dossiers legacy/archive (non supprimés)

| Dossier | Taille | Recommandation |
|---------|--------|----------------|
| `archive/` | 536KB | Contient backups et .so - garder |
| `backups/` | 12KB | Contient README sécurité - garder |
| `test-ledger/` | 42MB | Peut être supprimé (régénéré) |
| `.anchor/test-ledger/` | 67MB | Peut être supprimé (régénéré) |

### ⚠️ Fichiers .archived et .old

| Fichier | Recommandation |
|---------|----------------|
| `sdk/src/config/switchboard-feeds.ts.archived` | Garder pour référence |
| `app/src/sdk/config/switchboard-feeds.ts.archived` | Garder pour référence |
| `app/src/components/DCAClient.tsx.old` | Peut être supprimé si non utilisé |
| `.next/cache/webpack/*.old` | Supprimé automatiquement par clean |

---

## ACTIONS RÉALISÉES

### 1. Scripts de nettoyage ajoutés ✅
```bash
# Nettoyage des builds Next.js/TypeScript
npm run clean

# Nettoyage des builds Anchor/Rust  
npm run clean:anchor

# Nettoyage complet
npm run clean:all
```

### 2. Mise à jour .gitignore ✅
Ajout de:
- `tsconfig.tsbuildinfo`
- `oracle_audit_report.json`
- `test-results-comprehensive.json`

### 3. Nettoyage test-ledger ✅
```bash
rm -rf test-ledger .anchor/test-ledger
```
**Économie**: ~109MB

---

## PHASE 3 — RÉSULTATS (APRÈS)

### Taille après nettoyage
```
AVANT: 9.8G
APRÈS: ~9.7G (après suppression test-ledger)
```

**Note**: La majorité de l'espace est occupée par:
- `target/` (7.1G) — Nécessaire pour le développement Rust
- `node_modules/` (1.8G) — Nécessaire pour le runtime

Ces dossiers ne peuvent pas être supprimés sans impacter le développement.

### Impact VS Code
| Métrique | Avant | Après |
|----------|-------|-------|
| Fichiers surveillés | ✅ Déjà optimisé | Idem |
| Mémoire TypeScript | 512MB max | Idem |
| Indexation | Exclusions en place | Idem |

### Validation
- [x] `npm install` ✅
- [x] `npm run lint` (app) ✅ No errors
- [x] `npm run build` (Next.js) ✅ Build successful
- [x] `npm run test:unit` ⚠️ 290 passed, 7 failed (pré-existants)

**Note**: Les 7 tests échoués sont dans `oracle-price-service.test.ts` et pré-existaient avant ce nettoyage.

---

## RECOMMANDATIONS NON IMPLÉMENTÉES

### 1. Réorganisation fichiers racine
**Pourquoi non fait**: Risque de casser des références.
**Recommandation future**:
- Déplacer `check-*.js` vers `scripts/debug/`
- Déplacer `*.json` temporaires vers `logs/`

### 2. Suppression target/ complet
**Pourquoi non fait**: Rebuild complet Rust = 30+ minutes.
**Recommandation**: Utiliser `npm run clean:anchor` avant commit si espace critique.

### 3. Nettoyage fichiers .old/.archived
**Pourquoi non fait**: Peuvent servir de référence.
**Recommandation**: Supprimer après 30 jours si non utilisés.

---

## ROLLBACK

Si problème après ce nettoyage:
```bash
# Restaurer les exclusions .gitignore (si modifié)
git checkout HEAD -- .gitignore

# Régénérer test-ledger
anchor test

# Supprimer les scripts clean du package.json
git checkout HEAD -- package.json
```

---

## RÉSUMÉ

| Action | Économie | Risque |
|--------|----------|--------|
| Suppression test-ledger | ~109MB | Aucun (régénéré) |
| Scripts clean ajoutés | Facilite maintenance | Aucun |
| .gitignore mis à jour | Évite commits accidentels | Aucun |

**Conclusion**: Le repo était déjà bien configuré. Les optimisations principales sont:
1. Scripts de nettoyage pour maintenance
2. Suppression des test-ledger (109MB)
3. Gitignore renforcé pour fichiers temporaires
