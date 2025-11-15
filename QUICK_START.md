# ⚡ QUICK START - Reconstruction Lock/Unlock

## 🎯 EN 3 ÉTAPES SEULEMENT

---

## ✅ Prérequis (1 minute)

```bash
# Vérifier que vous avez tout (sur machine locale, PAS codespace)
solana --version    # Devrait afficher v1.18.26
anchor --version    # Devrait afficher 0.30.1
rustc --version     # Devrait afficher rust stable

# Configurer devnet
solana config set --url https://api.devnet.solana.com

# Obtenir des SOL
solana airdrop 2
```

---

## 🚀 ÉTAPE 1: Déploiement (3 minutes)

```bash
# Sur machine locale dans le dossier SwapBack
./rebuild-lock-unlock.sh
```

**C'est tout !** Le script fait TOUT automatiquement.

À la fin, vous verrez:
```
✅ DÉPLOIEMENT RÉUSSI!
📌 Nouveau Program ID: ABC123...XYZ456
```

**📝 COPIEZ CE PROGRAM ID !**

---

## 🔄 ÉTAPE 2: Mise à jour frontend (30 secondes)

```bash
# Remplacer ABC123...XYZ456 par votre Program ID réel
./update-frontend-program-id.sh ABC123...XYZ456
```

**C'est tout !** Tous les fichiers frontend sont mis à jour automatiquement.

---

## 🏗️ ÉTAPE 3: Initialisation (1 minute)

```bash
# Compiler le script
npm install  # si pas déjà fait

# Initialiser les comptes
ts-node scripts/init-cnft.ts
```

Vous verrez:
```
✅ GlobalState initialisé
✅ CollectionConfig initialisé
✅ INITIALISATION TERMINÉE
```

---

## 🎉 TERMINÉ !

Votre programme lock/unlock est maintenant:
- ✅ Déployé sur devnet
- ✅ Initialisé et prêt
- ✅ Frontend mis à jour

---

## 🧪 Tester (optionnel)

```bash
# Test automatique
ts-node scripts/test-lock-unlock.ts

# OU test frontend
cd app
npm run dev
# Ouvrir http://localhost:3000
```

---

## 📚 En savoir plus

Si vous voulez comprendre ce qui a été fait:
- 📖 `README_RECONSTRUCTION.md` - Vue d'ensemble complète
- 📋 `RECONSTRUCTION_LOCK_UNLOCK_GUIDE.md` - Guide détaillé
- ⚡ `COMMANDES_RAPIDES.md` - Toutes les commandes

---

## ❓ Problème?

```bash
# Recommencer depuis le début
./rebuild-lock-unlock.sh
```

---

## 📊 Récapitulatif temps

| Étape | Durée |
|-------|-------|
| Prérequis | 1 min |
| Déploiement | 3 min |
| Frontend | 30 sec |
| Initialisation | 1 min |
| **TOTAL** | **~6 minutes** 🚀 |

---

**C'est vraiment aussi simple ! 🎉**

Pour plus de détails, consultez les autres guides dans ce dossier.
