# 🚨 Fix Déconnexions Codespaces - GUIDE RAPIDE

## Problème identifié
```
Failed to connect to codespace.
14 UNAVAILABLE: No connection established. Last error: null
```

**Cause** : Nouvelle infrastructure réseau GitHub Codespaces nécessite configuration gRPC spécifique.

## ✅ Solution en 1 commande

```bash
bash .devcontainer/fix-connection.sh
```

**Ce script fait automatiquement** :
- ✅ Configure les variables d'environnement gRPC
- ✅ Lance le keepalive
- ✅ Vérifie mémoire et disque
- ✅ Donne les recommandations

## 🔧 Si le problème persiste

### 1. Rechargez le terminal
```bash
source ~/.zshrc
```

### 2. Rechargez VS Code
```
Cmd/Ctrl + R
```

### 3. Rebuild le container (dernier recours)
```
Cmd/Ctrl + Shift + P → "Dev Containers: Rebuild Container"
```

## 📊 Diagnostic

```bash
bash .devcontainer/network-diagnostic.sh
```

Vérifie :
- ✓ DNS et connectivité Internet
- ✓ Variables d'environnement gRPC
- ✓ Ports en écoute
- ✓ Processus lourds (mémoire)
- ✓ Espace disque

## 🛠️ Fichiers modifiés

| Fichier | Description |
|---------|-------------|
| `.devcontainer/devcontainer.json` | Config réseau gRPC + optimisations |
| `.devcontainer/fix-connection.sh` | **Script de correction auto** |
| `.devcontainer/network-diagnostic.sh` | Diagnostic complet |
| `.devcontainer/keepalive.sh` | Maintient la connexion active |
| `.devcontainer/TROUBLESHOOTING.md` | Guide détaillé |
| `~/.zshrc` | Variables d'environnement gRPC |

## ⚙️ Variables critiques ajoutées

```bash
export GRPC_VERBOSITY=error
export GRPC_DNS_RESOLVER=native
export GRPC_TRACE=''
export NO_PROXY=localhost,127.0.0.1
```

## 📖 Documentation complète

Voir `.devcontainer/TROUBLESHOOTING.md` pour :
- Solutions détaillées
- Métriques de performance
- Maintenance préventive
- Support et ressources

## 🎯 Résultat attendu

Après application :
- ✅ Connexion stable sans déconnexions
- ✅ Keepalive actif en arrière-plan
- ✅ Optimisations mémoire appliquées
- ✅ Configuration réseau correcte

---

**Dernière mise à jour** : 23 octobre 2025  
**Commits** : `0f9435c`, `68b8d51`
