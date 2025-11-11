# 🚀 Guide Final de Déploiement - Programme CNFT

## ✅ État Actuel

Toutes les préparations techniques sont terminées :
- ✅ Nouvelle keypair générée : `DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf`
- ✅ Code mis à jour avec le nouveau Program ID
- ✅ Workflow GitHub Actions configuré avec Rust 1.75.0
- ✅ Tous les commits poussés sur GitHub

## 📋 Étapes Restantes (À FAIRE MAINTENANT)

### Étape 1 : Configurer le GitHub Secret (OBLIGATOIRE)

**Pourquoi ?** Le workflow a besoin de votre keypair Solana pour déployer le programme.

**Comment faire :**

1. **Ouvrez ce lien :**
   ```
   https://github.com/BacBacta/SwapBack/settings/secrets/actions
   ```

2. **Cliquez sur "New repository secret"** (bouton vert en haut à droite)

3. **Remplissez les champs :**
   - **Name :** `SOLANA_DEVNET_KEYPAIR`
   - **Value :** Copiez-collez exactement ceci :
   ```json
   [121,51,43,44,196,12,42,101,237,153,148,183,28,46,218,217,111,10,96,56,158,226,88,182,52,132,230,180,209,20,234,189,178,73,199,26,102,157,89,95,149,154,12,255,70,196,167,59,203,120,72,235,154,205,183,201,112,177,220,4,54,12,109,12]
   ```

4. **Cliquez sur "Add secret"**

5. **Vérification :** Vous devriez voir `SOLANA_DEVNET_KEYPAIR` dans la liste des secrets

---

### Étape 2 : Lancer le Workflow GitHub Actions

**Comment faire :**

1. **Ouvrez ce lien :**
   ```
   https://github.com/BacBacta/SwapBack/actions/workflows/build-and-deploy-cnft.yml
   ```

2. **Cliquez sur "Run workflow"** (bouton bleu en haut à droite)

3. **Dans la popup qui s'ouvre :**
   - **Branch :** Laissez `main` sélectionné ✅
   - **Deploy to devnet after build? :** Cochez cette case ✅

4. **Cliquez sur "Run workflow"** (bouton vert)

5. **Suivre l'exécution :**
   - Vous serez redirigé vers la page du workflow en cours
   - Ou allez sur : https://github.com/BacBacta/SwapBack/actions

---

### Étape 3 : Attendre la Compilation et le Déploiement

**Durée estimée :** 10-15 minutes

**Étapes du workflow :**

1. ✅ **Checkout code** (~10 sec)
2. ✅ **Install Rust 1.75.0** (~2-3 min)
3. ✅ **Install Solana CLI 1.18.26** (~1 min)
4. ✅ **Install Anchor CLI 0.30.1** (~2-3 min)
5. ✅ **Build CNFT Program** (~2-3 min)
6. ✅ **Setup Solana Keypair** (~5 sec)
7. ✅ **Deploy to Devnet** (~30 sec)
8. ✅ **Update IDL** (~10 sec)
9. ✅ **Upload artifacts** (~10 sec)

**Indicateurs de succès :**
- Toutes les étapes affichent un ✅ vert
- Un nouveau commit apparaît : "chore: Update IDL after program deployment..."
- Le programme est visible sur Solana Explorer

---

### Étape 4 : Vérifier le Déploiement

**Après le succès du workflow :**

1. **Vérifier sur Solana Explorer :**
   ```
   https://explorer.solana.com/address/DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf?cluster=devnet
   ```
   
   Vous devriez voir :
   - Program ID: `DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf`
   - Status: Deployed
   - Last deployed slot: (récent)

2. **Vérifier le commit IDL :**
   ```
   https://github.com/BacBacta/SwapBack/commits/main
   ```
   
   Vous devriez voir un nouveau commit automatique créé par GitHub Actions

3. **Attendre le redéploiement Vercel :**
   - Durée : ~2 minutes
   - Vercel détecte automatiquement le nouveau commit
   - Vérifie sur : https://vercel.com/bactas-projects/swap-back

---

### Étape 5 : Tester la Fonction Unlock

**Une fois Vercel redéployé :**

1. **Ouvrir le dashboard :**
   ```
   https://swap-back-556okzq8h-bactas-projects.vercel.app/dashboard
   ```

2. **Hard refresh (important !) :**
   - **Windows/Linux :** `Ctrl + Shift + R`
   - **Mac :** `Cmd + Shift + R`

3. **Connecter votre wallet :**
   - Utilisez le wallet : `ARFN6HfLS6VUYdKy7gtuBjuW1JjqCkjqrJkMyvvZpAm5`

4. **Naviguer vers la section "Lock/Unlock"**

5. **Cliquer sur "Unlock"**

6. **Vérifier :**
   - ❌ **AVANT :** Erreur `DeclaredProgramIdMismatch`
   - ✅ **APRÈS :** Transaction réussit
   - ✅ Vous recevez : ~802,874 BACK tokens (815,100 - pénalité 1.5%)

---

## 🔧 Commandes de Surveillance (depuis votre terminal)

```bash
# Vérifier les workflows récents
gh run list --limit 10

# Suivre un workflow en temps réel (après l'avoir lancé)
gh run watch

# Voir les logs d'un workflow spécifique
gh run view <RUN_ID> --log

# Vérifier le statut du programme déployé
solana program show DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf --url devnet
```

---

## 🐛 Dépannage

### Le workflow échoue à "Install Anchor"

**Cause :** Problème de compatibilité Rust/time crate
**Solution :** Vérifiez que le workflow utilise bien Rust 1.75.0 (déjà corrigé)

### Le workflow échoue à "Deploy to Devnet"

**Causes possibles :**
- Secret GitHub mal configuré → Vérifiez le format JSON exact
- Pas assez de SOL → Vous avez 11 SOL, donc OK
- Problème de keypair → Vérifiez que le secret correspond au bon wallet

### L'erreur persiste sur le dashboard après déploiement

**Solutions :**
1. Hard refresh (Ctrl+Shift+R)
2. Videz le cache du navigateur
3. Vérifiez que Vercel a bien redéployé
4. Attendez 2-3 minutes supplémentaires

---

## 📊 Résumé des Informations Importantes

**Nouveau Programme CNFT :**
- **Address :** `DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf`
- **Keypair :** `target/deploy/swapback_cnft-keypair.json`
- **Ancien Program ID :** `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` (deprecated)

**Tokens Lockés :**
- **Montant :** 815,100 BACK
- **Pénalité unlock :** 1.5%
- **Montant après unlock :** ~802,874 BACK

**Wallet Utilisateur :**
- **Address :** `ARFN6HfLS6VUYdKy7gtuBjuW1JjqCkjqrJkMyvvZpAm5`
- **Solde devnet :** 11.029174414 SOL

---

## ✅ Checklist Finale

- [ ] Secret `SOLANA_DEVNET_KEYPAIR` ajouté dans GitHub
- [ ] Workflow "Build and Deploy CNFT Program" lancé manuellement
- [ ] Workflow terminé avec succès (toutes les étapes ✅)
- [ ] Programme visible sur Solana Explorer devnet
- [ ] Nouveau commit IDL créé automatiquement
- [ ] Vercel a redéployé l'application
- [ ] Dashboard ouvert et hard refresh effectué
- [ ] Wallet connecté
- [ ] Fonction Unlock testée
- [ ] Tokens BACK reçus avec succès

---

## 🎯 Objectif Final

**Résoudre l'erreur `DeclaredProgramIdMismatch` et récupérer les 815,100 BACK tokens lockés.**

Une fois toutes ces étapes complétées, l'erreur sera définitivement résolue ! 🎉

---

**Dernière mise à jour :** 11 novembre 2025
**Statut :** Prêt pour déploiement
