# ✅ VS Code Desktop → Remote : Déconnexions Corrigées

**Date** : 28 octobre 2025  
**Problème** : VS Code Desktop se déconnecte fréquemment du Codespace  
**Solution** : Configuration SSH keepalive + optimisations Remote settings

---

## 🎯 Actions Appliquées Automatiquement (Côté Serveur)

✅ Configuration SSH keepalive serveur (`~/.ssh/config`)  
✅ Optimisation VS Code Remote settings (`.vscode/settings.json`)  
✅ Optimisation devcontainer settings (`.devcontainer/devcontainer.json`)  
✅ Keepalive automatique démarré (`.devcontainer/keepalive-enhanced.sh`)  
✅ Extensions lourdes désactivées (SonarLint, optimisations rust-analyzer)

---

## ⚠️ ACTIONS REQUISES DE VOTRE PART (Côté Client - Votre Machine)

### 1️⃣ Exécutez le script de configuration client

**Sur votre machine locale** (PAS dans VS Code Remote), ouvrez un terminal et exécutez :

#### macOS / Linux
```bash
# Téléchargez le script depuis le Codespace
curl -o /tmp/fix-vscode-remote.sh https://raw.githubusercontent.com/BacBacta/SwapBack/main/CLIENT_SIDE_FIX.sh

# Ou copiez-le manuellement depuis le Codespace :
# Fichier: /workspaces/SwapBack/CLIENT_SIDE_FIX.sh

# Puis exécutez-le
bash /tmp/fix-vscode-remote.sh
```

#### Windows (PowerShell)
```powershell
# Téléchargez et exécutez
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BacBacta/SwapBack/main/CLIENT_SIDE_FIX.sh" -OutFile "$env:TEMP\fix-vscode-remote.sh"
bash "$env:TEMP\fix-vscode-remote.sh"
```

#### OU Configuration manuelle

Si vous préférez configurer manuellement, éditez `~/.ssh/config` sur votre machine :

```bash
# macOS/Linux
nano ~/.ssh/config

# Windows (PowerShell)
notepad $env:USERPROFILE\.ssh\config
```

**Ajoutez** :
```ssh
# VS Code Remote → GitHub Codespaces - Connexion stable
Host *.github.dev
    ServerAliveInterval 30
    ServerAliveCountMax 20
    TCPKeepAlive yes
    Compression yes
    ConnectionAttempts 5
    ConnectTimeout 600
```

---

### 2️⃣ Rechargez VS Code Desktop

**Méthode 1** : Raccourci clavier
- **macOS** : `Cmd + R`
- **Windows/Linux** : `Ctrl + R`

**Méthode 2** : Menu
```
Cmd/Ctrl + Shift + P → "Developer: Reload Window"
```

---

### 3️⃣ Testez pendant 15 minutes

- Travaillez normalement dans VS Code
- Si aucune déconnexion → ✅ Problème résolu !
- Si déconnexion persiste → Voir section "Plan B" ci-dessous

---

## 📊 Vérification Rapide

### Côté Serveur (dans le Codespace)

```bash
# Vérifier le keepalive
ps aux | grep keepalive

# Voir les logs keepalive
tail -f /tmp/codespaces-keepalive.log

# Vérifier la mémoire
free -h
```

### Côté Client (sur votre machine)

```bash
# Vérifier la config SSH
cat ~/.ssh/config | grep -A 10 "github.dev"

# Voir les logs VS Code Remote
# Cmd/Ctrl + Shift + P → "Remote-SSH: Show Log"
```

---

## 🆘 Plan B (Si Déconnexions Persistent)

### Option 1 : Nettoyer le cache VS Code Remote

**Sur votre machine locale** :
```bash
# macOS/Linux
rm -rf ~/.vscode-server/
rm -rf ~/.vscode/extensions/*-lock.json

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:USERPROFILE\.vscode-server"
Remove-Item -Force "$env:USERPROFILE\.vscode\extensions\*-lock.json"
```

Puis **reconnectez** au Codespace.

### Option 2 : Vérifier votre réseau local

```bash
# Test de stabilité réseau
ping -c 100 github.com

# Si perte de paquets > 5% :
# → Passer en Ethernet au lieu de WiFi
# → Redémarrer votre routeur
# → Vérifier firewall/antivirus
```

### Option 3 : Utiliser VS Code dans le navigateur (temporaire)

```
https://github.dev/BacBacta/SwapBack
```

Pas de déconnexion SSH, mais fonctionnalités limitées.

### Option 4 : Reconstruire le Container

```
Cmd/Ctrl + Shift + P → "Dev Containers: Rebuild Container"
```

### Option 5 : Augmenter les ressources Codespace

```
GitHub → Codespaces → Votre Codespace → "..." → Change machine type
→ 4-core, 16GB RAM
```

---

## 📚 Documentation Complète

Pour plus de détails, consultez :
- **Guide complet** : `VSCODE_DESKTOP_DISCONNECT_FIX.md`
- **Logs de correction** : `/tmp/codespaces-fix-*.log`
- **Config appliquées** :
  - `.vscode/settings.json`
  - `.devcontainer/devcontainer.json`
  - `~/.ssh/config`

---

## ✅ Résumé

| Paramètre | Avant | Après |
|-----------|-------|-------|
| SSH Timeout | 300s (5 min) | 600s (10 min) |
| SSH Keepalive | ❌ Non configuré | ✅ 60s (serveur) / 30s (client) |
| ServerAliveCountMax | 3 (3 min) | 10 serveur / 20 client (10-20 min) |
| Compression SSH | ❌ | ✅ |
| Extensions optimisées | ❌ | ✅ SonarLint désactivé |
| Keepalive automatique | ❌ | ✅ Toutes les 3 min |

---

**🎯 Effet attendu** :
- Connexion VS Code Desktop ↔ Remote stable pendant plusieurs heures
- Tolérance aux micro-coupures réseau (jusqu'à 10-20 minutes)
- Moins de charge serveur (extensions optimisées)

**⏱️ Durée de test recommandée** : 15-30 minutes sans déconnexion

---

**Date de correction** : 28 octobre 2025  
**Fichiers modifiés** :
- ✅ `.vscode/settings.json`
- ✅ `.devcontainer/devcontainer.json`
- ✅ `~/.ssh/config` (serveur)
- ⚠️ `~/.ssh/config` (client - à faire manuellement)

**Scripts créés** :
- 📄 `CLIENT_SIDE_FIX.sh` - Configuration automatique côté client
- 📄 `VSCODE_DESKTOP_DISCONNECT_FIX.md` - Guide complet

---

**🚀 Prochaine étape** : Exécutez `CLIENT_SIDE_FIX.sh` sur votre machine locale, puis rechargez VS Code Desktop !
