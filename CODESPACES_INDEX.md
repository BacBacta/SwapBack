# 🆘 INDEX: Déconnexions Codespaces - Guide Complet

## 🎯 Je veux résoudre le problème maintenant

### ⚡ Solution Rapide (5 minutes)
```bash
source ~/.zshrc && bash .devcontainer/disable-heavy-extensions.sh
# Puis: Cmd/Ctrl + R pour recharger VS Code
```
📖 Détail : Voir `QUICK_FIX_DISCONNECT.md`

### 🔧 Solution Complète (10 minutes)
```bash
bash .devcontainer/fix-disconnect-complete.sh
# Puis: Cmd/Ctrl + R pour recharger VS Code
```
📖 Détail : Voir `CODESPACES_FIX_COMPLETE.md`

---

## 📊 Je veux comprendre le problème

### 🔍 Diagnostic détaillé
Fichier : **`CODESPACES_DIAGNOSIS_23OCT.md`**
- Cause racine identifiée
- État actuel du système
- Solutions appliquées
- Actions immédiates

### 📋 Résumé complet
Fichier : **`CODESPACES_FIX_COMPLETE.md`**
- Solutions appliquées
- Fichiers créés/modifiés
- État avant/après
- Prochaines étapes

---

## 🔧 Je veux monitorer la stabilité

### 📈 Monitoring en temps réel
```bash
bash .devcontainer/monitor-stability.sh
```
Affiche:
- Mémoire en % avec graphique
- Disque en % avec graphique
- État du keepalive
- Variables gRPC
- Top 3 processus
- Connectivité
- Alertes et recommandations

### 🔍 Diagnostic réseau complet
```bash
bash .devcontainer/network-diagnostic.sh
```
Teste:
- DNS
- Connectivité Internet
- Variables gRPC
- Ports en écoute
- Processus lourds
- Utilisation disque
- VS Code Server

---

## 🎯 Commandes Utiles par Cas d'Usage

### Cas 1: Les déconnexions continuent
```bash
# Étape 1: Vérifier la mémoire
free -h

# Étape 2: Vérifier SonarLint est bien désactivée
bash .devcontainer/disable-heavy-extensions.sh

# Étape 3: Recharger VS Code
# Cmd/Ctrl + R

# Étape 4: Redémarrer le keepalive
bash .devcontainer/keepalive-enhanced.sh
```

### Cas 2: Mémoire très élevée (> 85%)
```bash
# Identifier les processus gourmands
ps aux --sort=-%mem | head -10

# Nettoyer les caches
rm -rf node_modules target .next

# Arrêter les watchers npm
pkill -f "npm.*watch"

# Relancer les corrections
bash .devcontainer/disable-heavy-extensions.sh
```

### Cas 3: Keepalive inactif
```bash
# Vérifier le PID
cat /tmp/codespaces-keepalive.pid

# Relancer si mort
bash .devcontainer/keepalive-enhanced.sh

# Vérifier les logs
tail -20 /tmp/codespaces-keepalive.log
```

### Cas 4: Variables gRPC non définies
```bash
# Vérifier
env | grep GRPC

# Si vides, charger
source ~/.zshrc

# Ou ajouter manuellement
export GRPC_VERBOSITY=error
export GRPC_DNS_RESOLVER=native
export GRPC_TRACE=''
export NO_PROXY=localhost,127.0.0.1
```

---

## 📚 Fichiers de Documentation

| Fichier | Contenu | Où le lire |
|---------|---------|-----------|
| **QUICK_FIX_DISCONNECT.md** | TL;DR 5 minutes | Premier à lire |
| **CODESPACES_DIAGNOSIS_23OCT.md** | Diagnostic détaillé | Pour comprendre |
| **CODESPACES_FIX_COMPLETE.md** | Résumé complet | Pour vérifier |
| **.devcontainer/TROUBLESHOOTING.md** | Troubleshooting avancé | Pour approfondir |
| **.devcontainer/QUICK_COMMANDS.sh** | One-liners | Pour copier-coller |

---

## 📂 Scripts Créés/Modifiés

| Script | Rôle | Commande |
|--------|------|----------|
| **fix-disconnect-complete.sh** | Correction + diag | `bash .devcontainer/fix-disconnect-complete.sh` |
| **disable-heavy-extensions.sh** | Désactiver SonarLint | `bash .devcontainer/disable-heavy-extensions.sh` |
| **keepalive-enhanced.sh** | Keepalive amélioré | `bash .devcontainer/keepalive-enhanced.sh` |
| **monitor-stability.sh** | Monitoring RT | `bash .devcontainer/monitor-stability.sh` |
| **network-diagnostic.sh** | Diagnostic réseau | `bash .devcontainer/network-diagnostic.sh` |

---

## ✅ Checklist de Résolution

Après avoir suivi la solution rapide/complète:

- [ ] Terminal rechargé (`source ~/.zshrc`)
- [ ] SonarLint désactivée
- [ ] VS Code rechargé (`Cmd/Ctrl + R`)
- [ ] Mémoire vérifiée < 70% (`free -h`)
- [ ] Keepalive actif (`cat /tmp/codespaces-keepalive.pid`)
- [ ] Variables gRPC présentes (`env | grep GRPC`)
- [ ] Pas de crash Extension Host après 10 minutes
- [ ] Système stable (monitoring affiche tous vert)

---

## 🆘 Si Ça Ne Marche Pas

### Plan B: Reconstruire le container
```
Cmd/Ctrl + Shift + P → "Dev Containers: Rebuild Container"
(Attendre ~5 minutes)
```

### Plan C: Désactiver manuellement SonarLint
1. Ouvrez VS Code
2. `Cmd/Ctrl + Shift + X` (Extensions)
3. Cherchez "SonarLint"
4. Clic droit → "Disable (Workspace)"
5. Rechargez VS Code

### Plan D: Vérifier les ressources allouées
```json
{
  "hostRequirements": {
    "memory": "8gb",
    "cpus": 4
  }
}
```

---

## 📞 Support

- **GitHub Codespaces** : https://docs.github.com/codespaces
- **gRPC** : https://grpc.io/docs/
- **Dev Container** : https://containers.dev/

---

## 📊 Résultats Attendus

✅ Codespace stable sans déconnexions  
✅ VS Code réactif et performant  
✅ Mémoire optimisée < 70%  
✅ Extension Host fonctionne  
✅ Connexion réseau stable  

---

**Mise à jour** : 23 octobre 2025  
**Problème** : ✅ Résolu  
**Temps** : ~15 minutes ⏱️

---

## 🚀 Commande Pour Tout Régler (ONE-LINER)

```bash
source ~/.zshrc && bash .devcontainer/disable-heavy-extensions.sh && echo "✅ Fait ! Rechargez VS Code: Cmd/Ctrl + R"
```
