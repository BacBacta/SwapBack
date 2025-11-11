# 🚀 Déployment Automatique via GitHub Actions

## Solution Alternative: Compilation dans le Cloud

Puisque votre machine locale ne permet pas l'installation de Rust/Solana, nous utilisons **GitHub Actions** pour compiler et déployer automatiquement dans le cloud.

## 📋 Configuration Requise (Une seule fois)

### Étape 1: Créer un Secret GitHub pour la Keypair

Vous devez ajouter votre keypair Solana comme secret GitHub:

1. **Obtenir votre keypair de Codespaces**:
   ```bash
   cat ~/.config/solana/id.json
   ```
   
   Ou si vous n'en avez pas, créez-en une nouvelle:
   ```bash
   solana-keygen new -o temp-keypair.json --no-bip39-passphrase
   cat temp-keypair.json
   ```

2. **Copier le contenu du fichier** (doit ressembler à `[123,45,67,...]`)

3. **Aller sur GitHub**:
   - https://github.com/BacBacta/SwapBack/settings/secrets/actions
   - Cliquer sur "New repository secret"
   - Name: `SOLANA_DEVNET_KEYPAIR`
   - Secret: Coller le contenu JSON de la keypair
   - Cliquer "Add secret"

### Étape 2: Obtenir des SOL sur la keypair

```bash
# Avec la keypair configurée
solana config set --url devnet
solana airdrop 2

# Vérifier le solde
solana balance
```

## 🎯 Lancement du Déployment

### Option A: Via l'interface GitHub (Recommandé)

1. Aller sur: https://github.com/BacBacta/SwapBack/actions
2. Cliquer sur "Build and Deploy CNFT Program" dans la liste de gauche
3. Cliquer sur "Run workflow" (bouton bleu à droite)
4. Cocher "Deploy to devnet after build?"
5. Cliquer sur "Run workflow"

GitHub va automatiquement:
- ✅ Installer Rust 1.79.0
- ✅ Installer Solana CLI
- ✅ Installer Anchor CLI
- ✅ Compiler le programme
- ✅ Déployer sur devnet
- ✅ Mettre à jour l'IDL
- ✅ Commit et push les changements

### Option B: Via gh CLI (ligne de commande)

```bash
# Installer gh CLI si nécessaire
# https://cli.github.com/

# Déclencher le workflow
gh workflow run build-and-deploy-cnft.yml \
  -f deploy_to_devnet=true
```

## 📊 Suivi du Déployment

1. Une fois lancé, allez sur: https://github.com/BacBacta/SwapBack/actions
2. Cliquez sur le workflow en cours (avec le point orange)
3. Suivez les logs en temps réel
4. Durée estimée: **5-10 minutes**

Les étapes sont:
- ⏳ Checkout code
- ⏳ Install Rust (2-3 min)
- ⏳ Install Solana (1 min)
- ⏳ Install Anchor (2-3 min)
- ⏳ Build CNFT Program (2-3 min)
- ⏳ Deploy to Devnet (30 sec)
- ⏳ Update IDL and commit (10 sec)

## ✅ Vérification Post-Déployment

Une fois le workflow terminé avec succès (✓ vert):

1. **Vérifier le programme sur Solana Explorer**:
   https://explorer.solana.com/address/DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf?cluster=devnet

2. **Vérifier le commit automatique**:
   Le workflow va créer un commit "chore: Update IDL after program deployment"

3. **Attendre le redéployment Vercel** (~2 minutes)

4. **Tester l'unlock**:
   - Aller sur https://swap-back-556okzq8h-bactas-projects.vercel.app
   - Rafraîchir (Ctrl+F5)
   - Connecter wallet
   - Tenter unlock
   - ✅ L'erreur `DeclaredProgramIdMismatch` doit disparaître!

## 🔍 Dépannage

### Erreur: "Secret SOLANA_DEVNET_KEYPAIR not found"

Assurez-vous d'avoir ajouté le secret GitHub (voir Étape 1 ci-dessus).

### Erreur: "Insufficient funds for deployment"

La keypair n'a pas assez de SOL:
```bash
# Sur Codespaces, avec la même keypair
solana config set --url devnet
solana airdrop 2
# Retry le workflow
```

### Erreur: "Program deployment failed"

Vérifiez que la keypair est l'autorité du programme:
```bash
solana program show DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf --url devnet
# Authority doit correspondre à votre keypair
```

### Le workflow échoue à l'étape "Build CNFT Program"

C'est probablement un problème de dépendances. Essayez de:
1. Supprimer le cache GitHub Actions
2. Re-run le workflow

### L'IDL n'est pas mis à jour

Le workflow commit automatiquement. Si rien ne change, c'est normal (l'IDL était déjà à jour).

## 🎉 Prochaines Étapes

Après un déployment réussi:

1. ✅ Le programme est sur devnet à `DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf`
2. ✅ L'IDL est à jour dans `app/src/idl/swapback_cnft.json`
3. ✅ Vercel redéploie automatiquement
4. ✅ Testez l'unlock sur le dashboard
5. ✅ L'erreur `DeclaredProgramIdMismatch` est résolue!

## 📝 Notes Importantes

- **Première fois**: Le workflow prend ~10 min (installations)
- **Fois suivantes**: ~5 min (cache utilisé)
- **Coût**: Gratuit avec GitHub Actions (2000 min/mois inclus)
- **Sécurité**: La keypair est stockée de manière sécurisée dans les GitHub Secrets

## 🔗 Liens Utiles

- Workflow: https://github.com/BacBacta/SwapBack/actions/workflows/build-and-deploy-cnft.yml
- Secrets GitHub: https://github.com/BacBacta/SwapBack/settings/secrets/actions
- Solana Explorer: https://explorer.solana.com/address/DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf?cluster=devnet
- Dashboard: https://swap-back-556okzq8h-bactas-projects.vercel.app

---

**Besoin d'aide?** Si le workflow échoue, partagez les logs et je vous aiderai à déboguer!
