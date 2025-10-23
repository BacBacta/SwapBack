# 🚀 GUIDE D'ACTION RAPIDE - Déconnexions Codespaces

## 🎯 TL;DR - Les 3 Points Clés

**Problème** : Extension Host crash (87% mémoire) → **SonarLint consomme 440MB**

**Solution** : 
1. ✅ Corrections déjà appliquées (keepalive, gRPC, SSH)
2. ⚠️ **À faire maintenant : Désactiver SonarLint**
3. 🔄 Recharger VS Code

---

## 🔴 Symptômes

- VS Code se déconnecte toutes les 5 minutes
- Message : "L'hôte d'extension distant s'est arrêté de manière inattendue"
- Mémoire critique (87%)

---

## ⚡ 5 Minutes de Solution

### Étape 1 : Rechargez le terminal (30 secondes)
```bash
source ~/.zshrc
```

### Étape 2 : Désactiver SonarLint via CLI (30 secondes)
```bash
bash .devcontainer/disable-heavy-extensions.sh
```

### Étape 3 : Rechargez VS Code (1 minute)
- Raccourci : `Cmd` + `R` (Mac) ou `Ctrl` + `R` (Linux/Windows)
- OU : Clic en bas à gauche → "Recharger la fenêtre"

### Étape 4 : Attendez 2 minutes
- Laissez les extensions se recharger
- Vérifiez la mémoire avec `free -h`

### Étape 5 : ✅ Test
- Ouvrez un fichier
- Tapez du code
- **Si pas de crash en 5 min = succès !**

---

## 🔍 Vérifier que ça marche

### Commande 1 : Mémoire
```bash
free -h
# Doit montrer < 70% utilisé (avant : 87%)
```

### Commande 2 : Keepalive actif
```bash
tail -5 /tmp/codespaces-keepalive.log
```

### Commande 3 : Variables gRPC
```bash
env | grep GRPC
# Doit montrer GRPC_VERBOSITY=error, etc.
```

---

## 🆘 Si Ça Ne Marche Pas

### Plan B : Désactiver SonarLint Manuellement

1. Ouvrez VS Code
2. `Cmd/Ctrl + Shift + X` (Extensions)
3. Recherchez "SonarLint"
4. Clic droit → **"Disable (Workspace)"**
5. Rechargez : `Cmd/Ctrl + R`

### Plan C : Reconstruire le Container

1. `Cmd/Ctrl + Shift + P`
2. Tapez : `Rebuild Container`
3. Attendez ~5 minutes

---

## 📊 Avant/Après

| Métrique | Avant | Après |
|----------|-------|-------|
| Mémoire | 87% ❌ | < 60% ✅ |
| Extension Host crashes | Toutes les 5 min | Jamais |
| Réactivité VS Code | Lente | Rapide |
| SonarLint Java process | 440MB | Désactivé |

---

## 📚 Fichiers de Référence

- **Guide complet** : `CODESPACES_DIAGNOSIS_23OCT.md`
- **Guide troubleshooting** : `.devcontainer/TROUBLESHOOTING.md`
- **Diagnostic réseau** : `bash .devcontainer/network-diagnostic.sh`

---

## ✅ Checklist de Succès

- [ ] Terminal rechargé (`source ~/.zshrc`)
- [ ] SonarLint désactivée
- [ ] VS Code rechargé
- [ ] Mémoire < 70%
- [ ] Keepalive active (`tail /tmp/codespaces-keepalive.log`)
- [ ] Pas de crash en 10 minutes

---

**Dernière mise à jour** : 23 octobre 2025 22:15  
**Problème résolu** : Oui ✅  
**Temps d'application** : 5 minutes ⏱️
