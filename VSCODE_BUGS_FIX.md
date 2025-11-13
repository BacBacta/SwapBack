# Résolution des Bugs VS Code

**Date**: 2025-11-13
**Problèmes résolus**: Multiples serveurs ESLint, erreurs GitHub Actions

## 🐛 Problèmes Identifiés

### 1. Serveurs ESLint en Double
**Symptômes**: VS Code lent, mémoire élevée, erreurs ESLint intermittentes

**Cause**: 4 serveurs ESLint tournaient simultanément

**Solution**: `./cleanup-vscode.sh` puis recharger VS Code

### 2. Erreur Syntaxe pr-ci.yml (Ligne 272)
```yaml
# ❌ Avant
*Last updated: ${{ new Date().toISOString() }}*

# ✅ Après  
*Last updated: ${{ github.event.head_commit.timestamp }}*
```

### 3. Secrets Manquants GitHub Actions
**Solution**: Remplacé par variables standard
- `main-ci.yml`: `NEXT_PUBLIC_SOLANA_RPC_URL: https://api.devnet.solana.com`
- `release-deploy.yml`: `PROD_SOLANA_RPC_URL` avec fallback

## 🛠️ Script de Nettoyage

**Usage**: `./cleanup-vscode.sh`

**Actions**:
- Arrête serveurs ESLint en double
- Nettoie serveurs TypeScript zombies
- Tue processus Next.js zombies
- Affiche utilisation mémoire

## ✅ Résultat

- ✅ Processus en double nettoyés
- ✅ Workflows GitHub Actions corrigés
- ✅ Script maintenance créé
