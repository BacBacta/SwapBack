# 🚨 DIAGNOSTIC: Déconnexions Codespaces - 23 octobre 2025

## 🔴 Problème Identifié

**La cause principale** : **Mémoire critique à 87% - Extensions VS Code trop gourmandes**

Le serveur d'extension VS Code s'arrête à cause de la fuite mémoire des extensions, particulièrement :
- 🔴 **SonarLint** : 440MB (Java + analyzers)
- 🔴 **rust-analyzer** : 180MB 
- 🔴 **Extension Host** : ~1.5GB (2 processus)

---

## ✅ Solutions Appliquées

### 1. ✓ Variables gRPC configurées
```
GRPC_VERBOSITY=error
GRPC_DNS_RESOLVER=native
GRPC_TRACE=''
NO_PROXY=localhost,127.0.0.1
```

### 2. ✓ Keepalive lancé
- PID: 97758
- Ping toutes les 3 minutes
- Logs en `/tmp/codespaces-keepalive.log`

### 3. ✓ Configuration SSH keepalive
- ServerAliveInterval: 60s
- ServerAliveCountMax: 10

---

## 🎯 Actions Immédiates - À Faire Maintenant

### Étape 1: Rechargez le terminal
```bash
source ~/.zshrc
```

### Étape 2: Désactiver SonarLint (très gourmand)
```bash
# Dans VS Code:
# Cmd/Ctrl + Shift + P → "Extensions: Show Built-in Extensions"
# Rechercher "SonarLint"
# Clic droit → "Disable (Workspace)"
```

**OU via devcontainer.json** :
```json
{
  "remoteEnv": {
    "DISABLE_SONAR": "1"
  }
}
```

### Étape 3: Optimiser rust-analyzer
```json
{
  "rust-analyzer.checkOnSave": false,
  "rust-analyzer.cargo.loadOutDirsFromCheck": false,
  "rust-analyzer.procMacro.enable": false,
  "rust-analyzer.imports.granularity": "crate"
}
```

### Étape 4: Si problèmes persistent
```bash
# Rechargez VS Code
Cmd/Ctrl + R
```

---

## 📊 État Actuel

| Métrique | Valeur | Status |
|----------|--------|--------|
| Mémoire | 87% (6.9GB/7.9GB) | 🔴 Critique |
| Disque | 30% | ✅ OK |
| DNS | Configuré | ✅ OK |
| Keepalive | Actif | ✅ OK |
| Connexion Internet | Stabil | ✅ OK |

---

## 🔍 Commandes de Diagnostic

### Vérifier le keepalive
```bash
tail -20 /tmp/codespaces-keepalive.log
cat /tmp/codespaces-keepalive.pid
```

### Vérifier les variables gRPC
```bash
env | grep GRPC
```

### Vérifier la mémoire
```bash
free -h
ps aux --sort=-%mem | head -10
```

### Vérifier les connexions
```bash
curl -v https://github.com 2>&1 | head -20
```

---

## 🛠️ Solutions Avancées

### Si déconnexions continuent (99% du problème = mémoire)

**1. Désactiver SonarLint et autres extensions gourmandes**
```bash
# Éditer ~/.vscode-remote/extensions/extensions.json
# Ou utiliser l'interface VS Code → Disable
```

**2. Augmenter les ressources du container**
```json
{
  "hostRequirements": {
    "memory": "8gb",
    "cpus": 4
  }
}
```

**3. Reconstruire complètement**
```bash
Cmd/Ctrl + Shift + P → "Dev Containers: Rebuild Container"
```

---

## 📚 Fichiers Modifiés / Créés

| Fichier | Rôle |
|---------|------|
| `.devcontainer/devcontainer.json` | Config réseau + opt mémoire |
| `.devcontainer/fix-disconnect-complete.sh` | **Script de correction complet** |
| `.devcontainer/keepalive-enhanced.sh` | Keepalive amélioré |
| `~/.zshrc` | Variables gRPC |
| `~/.ssh/config` | SSH keepalive |

---

## 🎯 Résultat Attendu

Après avoir suivi **les étapes immédiates** (surtout désactiver SonarLint) :
- ✅ Connexion stable sans déconnexions
- ✅ Mémoire libérée
- ✅ VS Code réactif
- ✅ Pas plus de "Extension host crashed"

---

## ⏱️ Suivi de la Stabilité

Après les corrections, **observer pendant 10 minutes** :
```bash
# Terminal 1: Suivi mémoire
watch -n 5 'free -h && echo "---" && ps aux --sort=-%mem | head -5'

# Terminal 2: Suivi logs
tail -f /tmp/codespaces-keepalive.log
```

**Critères de succès** :
- [ ] Pas de déconnexions VS Code
- [ ] Mémoire stable < 70%
- [ ] Keepalive ping toutes les 3 min

---

## 📞 Support Supplémentaire

Si les problèmes persiste après désactivation de SonarLint :
1. Vérifier GitHub Status (outages réseau)
2. Vérifier les extensions tierces
3. Vérifier la connexion locale (VPN, firewall)
4. Rebuilder le container

---

**Mise à jour** : 23 octobre 2025 - 22:15  
**Responsable** : GitHub Copilot Assistant
