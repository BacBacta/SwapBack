# 🔧 Guide de Dépannage Codespaces

## Problème : Déconnexions fréquentes

### Erreur typique
```
Failed to connect to codespace.
14 UNAVAILABLE: No connection established. Last error: null
```

## ✅ Solutions Appliquées

### 1. Configuration réseau gRPC (`.devcontainer/devcontainer.json`)

Les variables d'environnement suivantes ont été ajoutées pour corriger les problèmes de connexion avec la nouvelle infrastructure GitHub Codespaces :

```json
"remoteEnv": {
  "GRPC_VERBOSITY": "error",
  "GRPC_DNS_RESOLVER": "native",
  "GRPC_TRACE": "",
  "NO_PROXY": "localhost,127.0.0.1"
}
```

### 2. Paramètres VS Code optimisés

```json
"settings": {
  "remote.SSH.connectTimeout": 300,
  "remote.autoForwardPorts": false,
  "remote.restoreForwardedPorts": true,
  "terminal.integrated.enablePersistentSessions": true,
  "terminal.integrated.persistentSessionReviveProcess": "onExit"
}
```

### 3. Optimisations mémoire

- rust-analyzer : désactivation `buildScripts` et `procMacro`
- Extensions : affinité configurée pour éviter les conflits
- Node.js : `--max-old-space-size=4096`
- Exclusions : `target/`, `node_modules/`, `.git/objects/`

### 4. Scripts de maintenance

**Keepalive** (`.devcontainer/keepalive.sh`) :
- Maintient une activité toutes les 5 minutes
- Empêche l'auto-shutdown
- Log dans `/tmp/codespaces-keepalive.log`

**Diagnostic** (`.devcontainer/network-diagnostic.sh`) :
- Teste DNS, connectivité, variables gRPC
- Identifie les processus lourds
- Propose des recommandations

## 🚀 Actions Immédiates

### Si vous rencontrez encore des déconnexions :

1. **Rechargez la fenêtre VS Code**
   ```
   Cmd/Ctrl + R
   ```

2. **Reconstruisez le container**
   ```
   Cmd/Ctrl + Shift + P → "Rebuild Container"
   ```

3. **Lancez le diagnostic**
   ```bash
   bash .devcontainer/network-diagnostic.sh
   ```

4. **Vérifiez les variables d'environnement**
   ```bash
   env | grep GRPC
   ```
   
   Si vides, rechargez :
   ```bash
   source ~/.zshrc
   ```

## 🔍 Diagnostic Rapide

### Vérifier l'état du Codespace

```bash
# DNS
nslookup github.com

# Connectivité
ping -c 3 8.8.8.8

# Ports
netstat -tuln | grep -E ':(3000|8080|8899)'

# Mémoire
ps aux --sort=-%mem | head -10

# Disque
df -h /workspaces
```

### Logs importants

```bash
# Keepalive
tail -f /tmp/codespaces-keepalive.log

# VS Code Server
journalctl --user -u vscode-server -f
```

## ⚙️ Configuration de votre machine locale

### Si le problème persiste côté client :

1. **Désactiver VPN/Proxy** temporairement
2. **Vérifier le firewall** (autoriser ports 443, 22, 2000)
3. **Vider le cache VS Code**
   ```bash
   rm -rf ~/.vscode/extensions/*
   ```
4. **Mettre à jour VS Code** vers la dernière version

### Extensions à désactiver si problèmes :

- SonarLint (gourmand en mémoire : 437MB)
- Toute extension non essentielle pendant le dev

## 📊 Métriques Normales

| Métrique | Normal | Attention | Critique |
|----------|--------|-----------|----------|
| Utilisation disque | < 70% | 70-85% | > 85% |
| Mémoire rust-analyzer | < 1.5GB | 1.5-2GB | > 2GB |
| Ping github.com | < 50ms | 50-200ms | > 200ms |
| DNS resolution | < 1s | 1-3s | > 3s |

## 🛠️ Maintenance Préventive

### Quotidiennement
```bash
# Nettoyer les caches
rm -rf node_modules target .next

# Vérifier l'espace
df -h /workspaces
```

### Hebdomadairement
```bash
# Rebuild complet
Cmd+Shift+P → "Rebuild Container"

# Mettre à jour les dépendances
npm update
cargo update
```

## 📞 Support

Si aucune solution ne fonctionne :

1. **GitHub Issues** : https://github.com/github/feedback/discussions
2. **Documentation Codespaces** : https://docs.github.com/codespaces
3. **Status GitHub** : https://www.githubstatus.com/

## 🔗 Ressources

- [Codespaces Troubleshooting](https://docs.github.com/en/codespaces/troubleshooting)
- [gRPC DNS Resolver](https://grpc.github.io/grpc/core/md_doc_naming.html)
- [Dev Container Reference](https://containers.dev/implementors/json_reference/)
