# 🧪 Guide de Test - Historique des Transactions

## ✅ Fonctionnalités Intégrées

L'historique des transactions enregistre maintenant automatiquement :
- 🔒 **Lock** : Verrouillages de tokens avec niveau et boost
- 🔓 **Unlock** : Déverrouillages de tokens
- 📊 **DCA** : Création de plans DCA automatiques
- 🔄 **Swap** : Swaps classiques (déjà existant)

---

## 📋 Comment Tester

### 1. **Tester Lock-Unlock**

#### Créer un Lock
1. Ouvrez http://localhost:3000
2. Cliquez sur **[DASHBOARD]**
3. Cliquez sur le sous-onglet **[LOCK_UNLOCK]**
4. Remplissez le formulaire :
   - Montant : `1000`
   - Durée : `90 jours` (pour avoir Silver)
5. Cliquez sur **[LOCK TOKENS]**
6. ✅ Une transaction Lock devrait être enregistrée

#### Vérifier dans l'historique
1. Cliquez sur **[TRANSACTION_HISTORY]** (en haut)
2. Cliquez sur le filtre **[LOCK]**
3. ✅ Vous devriez voir :
   - Icône 🔒
   - Type : `[LOCK]`
   - Détails : `LEVEL: Silver`, `DURATION: 90 days`, `BOOST: +30%`

#### Créer un Unlock
1. Retournez sur **[LOCK_UNLOCK]**
2. Cliquez sur **[UNLOCK TOKENS]** (si disponible)
3. ✅ Une transaction Unlock devrait être enregistrée

#### Vérifier dans l'historique
1. Cliquez sur **[TRANSACTION_HISTORY]**
2. Cliquez sur le filtre **[UNLOCK]**
3. ✅ Vous devriez voir :
   - Icône 🔓
   - Type : `[UNLOCK]`
   - Détails : `LEVEL: Silver`

---

### 2. **Tester DCA**

#### Créer un Plan DCA
1. Ouvrez http://localhost:3000
2. Cliquez sur **[DASHBOARD]**
3. Cliquez sur le sous-onglet **[DCA_STRATEGY]**
4. Restez sur l'onglet **[CREATE_DCA]**
5. Remplissez le formulaire :
   - Token d'entrée : `SOL`
   - Token de sortie : `USDC`
   - Montant par ordre : `0.5`
   - Fréquence : `Daily`
   - Nombre d'ordres : `10`
6. Cliquez sur **[CREATE_DCA_PLAN]**
7. ✅ Une transaction DCA devrait être enregistrée

#### Vérifier dans l'historique
1. Cliquez sur **[TRANSACTION_HISTORY]**
2. Cliquez sur le filtre **[DCA]**
3. ✅ Vous devriez voir :
   - Icône 📊
   - Type : `[DCA]`
   - Détails : `INTERVAL: Every 1 days`, `PROGRESS: 0/10 swaps`

---

### 3. **Tester les Filtres**

#### Filtre ALL
1. Ouvrez **[TRANSACTION_HISTORY]**
2. Cliquez sur **[ALL]**
3. ✅ Toutes les transactions (Lock, Unlock, DCA, Swap) sont affichées

#### Filtres Spécifiques
- **[SWAP]** : Affiche seulement les swaps classiques
- **[LOCK]** : Affiche seulement les locks 🔒
- **[UNLOCK]** : Affiche seulement les unlocks 🔓
- **[DCA]** : Affiche seulement les plans DCA 📊

---

## 🎯 Données Affichées

### Pour Lock (🔒)
```
Type: [LOCK]
Montant: X $BACK → 1 cNFT
Détails:
  - LEVEL: Bronze/Silver/Gold
  - DURATION: X days
  - BOOST: +X%
Signature: simXXXXXXXXXXXXX...
```

### Pour Unlock (🔓)
```
Type: [UNLOCK]
Montant: 1 cNFT → X $BACK
Détails:
  - LEVEL: Bronze/Silver/Gold
Signature: simXXXXXXXXXXXXX...
```

### Pour DCA (📊)
```
Type: [DCA]
Montant: X SOL → USDC
Détails:
  - INTERVAL: Every X days
  - PROGRESS: 0/10 swaps
Router: [SWAPBACK]
Signature: simXXXXXXXXXXXXX...
```

---

## 🔍 Détails Étendus

Cliquez sur une transaction pour voir :
- ✅ Signature complète (cliquable pour copier)
- ✅ Lien vers Solscan Explorer
- ✅ Timestamp exact
- ✅ Tous les détails techniques

---

## 💾 Stockage

Les transactions sont stockées dans **localStorage** par wallet :
- Clé : `swapback_history_<WALLET_ADDRESS>`
- Limite : 100 dernières transactions
- Persistant entre les sessions

---

## 🧹 Nettoyage

Pour effacer l'historique :
1. Ouvrez **[TRANSACTION_HISTORY]**
2. Cliquez sur **[CLEAR_ALL]** (bouton rouge en haut à droite)
3. ✅ Tout l'historique est supprimé

---

## 🐛 Troubleshooting

### Problème : Transactions non enregistrées
**Solution** : Vérifiez que le wallet est bien connecté avant d'effectuer une opération

### Problème : Historique vide
**Solutions** :
1. Connectez votre wallet
2. Effectuez au moins une opération (Lock/Unlock/DCA)
3. Vérifiez le filtre sélectionné (ALL/SWAP/LOCK/UNLOCK/DCA)

### Problème : Signatures "sim..."
**Explication** : C'est normal ! En mode simulation (programme non déployé), les signatures sont simulées avec le préfixe "sim"

---

## ✅ Checklist de Test

- [ ] Lock créé et visible dans l'historique
- [ ] Détails Lock affichés (level, duration, boost)
- [ ] Unlock créé et visible dans l'historique
- [ ] Détails Unlock affichés (level)
- [ ] Plan DCA créé et visible dans l'historique
- [ ] Détails DCA affichés (interval, progress)
- [ ] Icônes correctes (🔒 🔓 📊 🔄)
- [ ] Filtre ALL affiche tout
- [ ] Filtre LOCK affiche seulement locks
- [ ] Filtre UNLOCK affiche seulement unlocks
- [ ] Filtre DCA affiche seulement DCA
- [ ] Click sur transaction affiche détails étendus
- [ ] Copie de signature fonctionne
- [ ] Clear All supprime l'historique

---

**Prêt à tester !** 🚀

Si tout fonctionne, vous devriez voir les transactions s'accumuler au fur et à mesure que vous utilisez Lock/Unlock et DCA !
