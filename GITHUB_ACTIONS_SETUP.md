# 🚀 Guide de Déploiement via GitHub Actions

## ✅ Configuration Actuelle

- ✅ Workflow GitHub Actions créé : `.github/workflows/build-and-deploy-cnft.yml`
- ✅ Rust 1.76.0 configuré (compatible avec toutes les dépendances)
- ✅ Anchor CLI 0.30.1
- ✅ Solana CLI 1.18.26
- ✅ Programme ID : `DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf`

---

## 📋 Étape 1 : Configurer le Secret GitHub

### 1.1 Accéder aux Secrets
Ouvrez ce lien dans votre navigateur :
```
https://github.com/BacBacta/SwapBack/settings/secrets/actions
```

### 1.2 Vérifier si le secret existe déjà
- Cherchez `SOLANA_DEVNET_KEYPAIR` dans la liste
- ✅ Si présent : passez à l'Étape 2
- ❌ Si absent : continuez ci-dessous

### 1.3 Créer les secrets (si nécessaire)

#### Secret 1: DEVNET_WALLET
1. Cliquez sur **"New repository secret"**
2. **Name :** `DEVNET_WALLET`
3. **Value :** Copiez EXACTEMENT cette ligne (sans guillemets ni crochets supplémentaires) :
```
[90,26,218,77,239,187,24,160,170,87,205,64,8,18,240,143,187,138,116,91,122,90,31,210,209,253,191,253,32,251,224,81,180,195,214,219,68,27,121,67,47,86,39,53,229,178,235,253,76,3,234,196,203,138,156,142,148,236,168,23,35,45,59,40]
```
4. Cliquez sur **"Add secret"**

#### Secret 2: DEVNET_PROGRAM_KEYPAIR
1. Cliquez sur **"New repository secret"**
2. **Name :** `DEVNET_PROGRAM_KEYPAIR`
3. **Value :** Copiez EXACTEMENT cette ligne (sans guillemets ni crochets supplémentaires) :
```
[105,157,116,248,125,206,122,152,241,21,111,208,7,196,211,254,254,239,9,186,171,17,33,41,152,151,15,15,26,24,124,235,226,101,16,60,73,102,207,168,206,145,222,74,199,81,16,207,37,19,98,222,236,89,120,111,92,190,193,238,44,71,132,71]
```
4. Cliquez sur **"Add secret"**

⚠️ **IMPORTANT :** 
- Ne modifiez PAS le format des keypairs
- N'ajoutez PAS de guillemets supplémentaires
- Les deux secrets sont nécessaires pour le déploiement

---

## 📋 Étape 2 : Lancer le Workflow

### 2.1 Accéder au Workflow
Ouvrez ce lien :
```
https://github.com/BacBacta/SwapBack/actions/workflows/deploy-devnet.yml
```

### 2.2 Déclencher le Workflow
1. Cliquez sur le bouton **"Run workflow"** (en haut à droite, bouton bleu)
2. **Branch :** Laissez `main` sélectionné ✅
3. **confirm_deployment :** Saisissez `true` ✅
4. Cliquez sur **"Run workflow"**

Le workflow va automatiquement :
- ✅ Installer Solana CLI v1.18.26
- ✅ Charger les keypairs depuis les secrets
- ✅ Vérifier le binaire compilé (swapback_cnft.so)
- ✅ Vérifier le solde du wallet
- ✅ Déployer le programme sur devnet
- ✅ Générer un rapport de déploiement4. Cliquez sur **"Run workflow"** (bouton vert)

### 2.3 Monitorer l'Exécution
- La page devrait se rafraîchir et afficher un nouveau workflow en cours
- Cliquez dessus pour voir les détails
- Durée estimée : **8-10 minutes**

---

## 📊 Étape 3 : Vérifier le Succès

### 3.1 Étapes du Workflow (toutes doivent être ✅)
- ✅ Checkout code (~10 sec)
- ✅ Install Rust 1.76.0 (~2-3 min)
- ✅ Install Solana CLI (~1 min)
- ✅ Install Anchor CLI (~3-5 min)
- ✅ Build program (~2-3 min)
- ✅ **Deploy to devnet** (~30 sec) ← Le plus important !
- ✅ Commit IDL (~10 sec)
- ✅ Upload artifacts (~10 sec)

### 3.2 Indicateurs de Succès
✅ Toutes les étapes ont des checkmarks verts
✅ Message dans les logs : "Program deployed successfully"
✅ Adresse affichée : `DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf`
✅ Un nouveau commit apparaît : "chore: Update IDL after program deployment"

### 3.3 Vérifier sur Solana Explorer
Ouvrez ce lien pour vérifier le déploiement :
```
https://explorer.solana.com/address/DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf?cluster=devnet
```

Vous devriez voir :
- ✅ Program account existe
- ✅ Transaction de déploiement récente
- ✅ Balance > 0 SOL

---

## 📋 Étape 4 : Attendre la Redéploiement Vercel

### 4.1 Vercel Auto-Redeploy
Après que GitHub Actions ait commité l'IDL :
- Vercel détecte automatiquement le changement
- Lance un nouveau déploiement (~2-3 minutes)
- Met à jour le frontend avec le nouveau programme

### 4.2 Vérifier le Déploiement Vercel
Accédez au dashboard Vercel :
```
https://vercel.com/bactas-projects/swap-back
```

Attendez que le statut soit : **"Ready"** ✅

---

## 📋 Étape 5 : Tester l'Unlock

### 5.1 Ouvrir le Dashboard
```
https://swap-back-556okzq8h-bactas-projects.vercel.app/dashboard
```

### 5.2 Hard Refresh du Navigateur
⚠️ **CRUCIAL** pour charger le nouveau code :

**Windows/Linux :**
```
Ctrl + Shift + R
```

**Mac :**
```
Cmd + Shift + R
```

Ou ouvrez dans une fenêtre privée/incognito

### 5.3 Connecter le Wallet
- Cliquez sur "Connect Wallet"
- Sélectionnez votre wallet
- Connectez-vous avec : `ARFN6HfLS6VUYdKy7gtuBjuW1JjqCkjqrJkMyvvZpAm5`

### 5.4 Tester l'Unlock
1. Naviguez vers la section Lock/Unlock
2. Vous devriez voir vos tokens lockés : **815,100 BACK**
3. Cliquez sur **"Unlock"**
4. Confirmez la transaction dans votre wallet

### 5.5 Vérification du Succès
✅ **AVANT :** Erreur `DeclaredProgramIdMismatch`
✅ **APRÈS :** Transaction réussie !
✅ **Tokens reçus :** ~802,874 BACK (815,100 - 1.5% pénalité de unlock anticipé)
✅ **Balance wallet :** Augmentée du montant attendu

---

## 🐛 Troubleshooting

### Problème 1 : Workflow échoue à "Install Rust"
**Solution :** Vérifiez les logs - peut-être un problème réseau temporaire. Re-lancez le workflow.

### Problème 2 : Workflow échoue à "Deploy to devnet"
**Causes possibles :**
- ❌ Secret `SOLANA_DEVNET_KEYPAIR` mal configuré → Vérifiez le format exact
- ❌ Pas assez de SOL sur le wallet → Vérifiez le solde (devrait avoir ~11 SOL)
- ❌ Case "Deploy to devnet" non cochée → Re-lancez en cochant la case

### Problème 3 : Dashboard montre toujours l'erreur
**Solutions :**
1. Attendez 2-3 minutes pour le redéploiement Vercel
2. Faites un **hard refresh** (Ctrl+Shift+R)
3. Videz le cache du navigateur complètement
4. Essayez en fenêtre privée/incognito
5. Vérifiez que Vercel deployment est "Ready"

### Problème 4 : Transaction unlock échoue
**Solutions :**
1. Vérifiez que vous êtes connecté au bon wallet
2. Vérifiez que vous avez du SOL pour les frais (~0.00005 SOL)
3. Vérifiez le message d'erreur exact dans la console du navigateur (F12)
4. Vérifiez sur Solana Explorer que le programme est bien déployé

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs GitHub Actions en détail
2. Vérifiez Solana Explorer pour le statut du programme
3. Vérifiez Vercel pour le statut du déploiement frontend
4. Vérifiez la console du navigateur (F12) pour les erreurs JavaScript

---

## ✅ Checklist Finale

Avant de tester :
- [ ] Secret GitHub configuré correctement
- [ ] Workflow lancé avec "Deploy to devnet" coché
- [ ] Toutes les étapes du workflow en vert ✅
- [ ] Programme visible sur Solana Explorer
- [ ] Vercel deployment "Ready"
- [ ] Hard refresh du navigateur effectué
- [ ] Wallet connecté avec le bon compte

Si tous les points sont cochés, l'unlock devrait fonctionner ! 🎉

---

**Durée totale estimée du processus complet : 15-20 minutes**
