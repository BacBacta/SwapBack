# 🔧 Fix VS Code Desktop → Remote Disconnection

**Problème** : VS Code Desktop se déconnecte fréquemment du Codespace distant  
**Cause** : Timeouts SSH, connexion réseau instable, extensions lourdes côté serveur  
**Solution** : Configuration keepalive, optimisation serveur remote, désactivation auto-reconnect

---

## ✅ Corrections Appliquées Automatiquement

### 1. Configuration SSH Keepalive (Côté Serveur)

**Fichier** : `~/.ssh/config`

```ssh
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 10
    TCPKeepAlive yes
```

**Effet** :
- Ping toutes les 60 secondes pour maintenir la connexion active
- Tolère 10 pings échoués avant de déconnecter (= 10 minutes de tolérance)
- TCP keepalive activé

---

### 2. Configuration VS Code Remote (Côté Client)

**Fichier** : `.vscode/settings.json`

```json
{
  "remote.SSH.connectTimeout": 600,
  "remote.SSH.serverAliveInterval": 60,
  "remote.SSH.serverAliveCountMax": 10,
  "remote.SSH.keepAlive": true,
  "remote.SSH.useFlock": false,
  "remote.SSH.lockfilesInTmp": true,
  "remote.SSH.remoteServerListenOnSocket": true,
  "remote.downloadExtensionsLocally": false
}
```

**Effet** :
- Timeout de connexion augmenté à 10 minutes (au lieu de 5)
- Keepalive SSH activé côté VS Code
- Évite les conflits de verrous (flock) qui peuvent bloquer
- Extensions téléchargées directement sur le serveur (moins de transferts réseau)

---

### 3. Keepalive Automatique (Côté Serveur)

**Script** : `.devcontainer/keepalive-enhanced.sh` (démarré automatiquement)

- Maintient une activité légère toutes les 3 minutes
- Log discret dans `/tmp/codespaces-keepalive.log`
- Empêche l'idle timeout du Codespace

**Vérifier le statut** :
```bash
# Vérifier si le keepalive est actif
ps aux | grep keepalive

# Voir les logs
tail -f /tmp/codespaces-keepalive.log
```

---

## 🔍 Diagnostic Supplémentaire

### Côté VS Code Desktop (votre machine locale)

#### 1. Vérifier les extensions VS Code Desktop

Certaines extensions côté client peuvent causer des problèmes de connexion :

```
Cmd/Ctrl + Shift + X → Rechercher "Remote" → Désactiver temporairement :
- Remote - Containers (sauf si nécessaire)
- Remote - SSH (NE PAS désactiver)
- Remote - WSL (si vous n'utilisez pas WSL)
```

#### 2. Vérifier votre connexion réseau locale

**Test de stabilité réseau** :
```bash
# Dans un terminal local (pas dans VS Code)
ping -c 100 github.com

# Si perte de paquets > 5%, problème réseau local
```

**Solutions si réseau instable** :
- Passer en Ethernet au lieu de WiFi
- Redémarrer votre routeur
- Vérifier firewall/antivirus (peut bloquer connexions SSH)

#### 3. Logs VS Code Desktop

**Localisation des logs** :
- **macOS** : `~/Library/Application Support/Code/logs/`
- **Windows** : `%APPDATA%\Code\logs\`
- **Linux** : `~/.config/Code/logs/`

**Voir les logs Remote-SSH** :
```
Cmd/Ctrl + Shift + P → "Remote-SSH: Show Log"
```

**Chercher les erreurs** :
```
"Connection timeout"
"Socket closed"
"Authentication failed"
"ECONNRESET"
```

---

## 🚨 Actions Immédiates si Déconnexion

### 1. Rechargez la fenêtre VS Code
```
Cmd/Ctrl + Shift + P → "Developer: Reload Window"
```

### 2. Reconnectez manuellement
```
Cmd/Ctrl + Shift + P → "Remote-SSH: Connect to Host..."
→ Sélectionnez votre Codespace
```

### 3. Nettoyez le cache VS Code Remote

**Sur votre machine locale** :
```bash
# macOS/Linux
rm -rf ~/.vscode/extensions/*-lock.json
rm -rf ~/.vscode-server/

# Windows
del /q %USERPROFILE%\.vscode\extensions\*-lock.json
rmdir /s /q %USERPROFILE%\.vscode-server
```

**Puis reconnectez** : VS Code recréera le serveur remote

---

## 🔧 Paramètres Avancés (si problème persiste)

### Option 1 : Augmenter les timeouts SSH (votre `~/.ssh/config` local)

**Sur votre machine locale**, éditez `~/.ssh/config` :

```ssh
Host *.github.dev
    ServerAliveInterval 30
    ServerAliveCountMax 20
    TCPKeepAlive yes
    Compression yes
    ConnectionAttempts 5
    ConnectTimeout 600
```

**Effet** :
- Ping toutes les 30 secondes (plus fréquent)
- Tolère 20 échecs (= 10 minutes)
- Compression activée (moins de bande passante)
- 5 tentatives de reconnexion automatique

### Option 2 : Désactiver multiplexing SSH

Ajoutez dans `~/.ssh/config` (votre machine) :

```ssh
Host *.github.dev
    ControlMaster no
    ControlPath none
```

**Effet** : Chaque connexion est indépendante (évite bugs de multiplexing)

### Option 3 : Forcer IPv4

Ajoutez dans `~/.ssh/config` (votre machine) :

```ssh
Host *.github.dev
    AddressFamily inet
```

**Effet** : Force IPv4 au lieu d'IPv6 (peut résoudre problèmes DNS)

---

## 📊 Monitoring en Temps Réel

### Script de monitoring (côté serveur)

```bash
bash .devcontainer/monitor-stability.sh
```

**Affiche** :
- Mémoire utilisée
- Processus gourmands
- État du keepalive
- État de la connexion réseau
- Refreshed toutes les 60 secondes

### Vérifier la charge serveur

```bash
# Mémoire
free -h

# Processus lourds
ps aux --sort=-%mem | head -10

# Si mémoire > 85%, libérer :
pkill -f "npm.*--watch"  # Arrête watchers npm
```

---

## 🎯 Checklist de Résolution

- [x] Configuration SSH keepalive serveur (`.ssh/config`)
- [x] Configuration VS Code Remote settings (`.vscode/settings.json`)
- [x] Keepalive automatique démarré (`keepalive-enhanced.sh`)
- [x] Extensions lourdes désactivées (SonarLint, etc.)
- [ ] **Rechargez VS Code Desktop** : `Cmd/Ctrl + R`
- [ ] **Testez pendant 15 minutes** sans déconnexion
- [ ] Si déconnexion persiste :
  - [ ] Vérifiez logs Remote-SSH (`Cmd/Ctrl + Shift + P → "Remote-SSH: Show Log"`)
  - [ ] Nettoyez cache VS Code Remote (voir section ci-dessus)
  - [ ] Ajoutez config SSH locale (`~/.ssh/config` sur votre machine)
  - [ ] Redémarrez VS Code Desktop complètement

---

## 🆘 Plan B (Si Déconnexions Persistent)

### 1. Reconstruire le Container

```
Cmd/Ctrl + Shift + P → "Dev Containers: Rebuild Container"
```

**Effet** : Réinitialise complètement le serveur remote

### 2. Vérifier GitHub Codespaces Status

Aller sur : https://www.githubstatus.com/

**Vérifier** :
- Codespaces API : Opérationnel ✅
- GitHub.dev : Opérationnel ✅

Si problèmes GitHub, attendre résolution

### 3. Passer à une Machine Plus Puissante

```
GitHub → Codespaces → Votre Codespace → "..." → Change machine type
→ Choisir : 4-core, 16GB RAM (au lieu de 2-core, 8GB)
```

**Effet** : Plus de ressources = moins de déconnexions dues à la mémoire

### 4. Utiliser VS Code dans le Navigateur (temporaire)

```
https://github.dev/BacBacta/SwapBack
```

**Avantages** :
- Pas de déconnexion SSH
- Connexion directe via WebSocket
- Moins de ressources locales utilisées

**Inconvénients** :
- Pas de terminal complet
- Certaines extensions indisponibles

---

## 📚 Ressources

- **GitHub Codespaces Troubleshooting** : https://docs.github.com/en/codespaces/troubleshooting
- **VS Code Remote SSH** : https://code.visualstudio.com/docs/remote/ssh
- **SSH Keepalive Guide** : https://www.bjornjohansen.com/ssh-timeout

---

## ✅ Résumé des Actions

| Action | Statut | Effet |
|--------|--------|-------|
| SSH keepalive serveur | ✅ Appliqué | Ping toutes les 60s |
| VS Code Remote settings | ✅ Appliqué | Timeout 10min, keepalive activé |
| Keepalive automatique | ✅ Actif | Activité toutes les 3min |
| Extensions optimisées | ✅ Appliqué | SonarLint désactivé, rust-analyzer optimisé |
| Config SSH locale | ⚠️ À faire | Éditez `~/.ssh/config` sur votre machine |
| Rechargez VS Code Desktop | ⚠️ À faire | `Cmd/Ctrl + R` |

---

**🎯 Prochaine étape recommandée** :

1. **Sur votre machine locale**, éditez `~/.ssh/config` :
   ```bash
   # macOS/Linux
   nano ~/.ssh/config
   
   # Windows (PowerShell)
   notepad $env:USERPROFILE\.ssh\config
   ```

2. **Ajoutez** :
   ```ssh
   Host *.github.dev
       ServerAliveInterval 30
       ServerAliveCountMax 20
       TCPKeepAlive yes
       Compression yes
   ```

3. **Rechargez VS Code Desktop** : `Cmd/Ctrl + R`

4. **Testez pendant 15 minutes**

Si tout fonctionne → Problème résolu ✅  
Si déconnexion persiste → Voir "Plan B" ci-dessus
