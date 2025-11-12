# 🚀 Guide: Déployer via GitHub Actions

## Configuration initiale (à faire une seule fois)

### 1. Ajouter le secret de la keypair

Allez dans les paramètres de votre repo GitHub:
1. **Settings** → **Secrets and variables** → **Actions**
2. Cliquez sur **New repository secret**
3. Nom: `SOLANA_DEPLOYER_PRIVATE_KEY`
4. Valeur: Le contenu JSON de votre keypair (celle avec l'upgrade authority)

Pour obtenir le contenu de votre keypair:
```bash
# Si vous utilisez la keypair par défaut
cat ~/.config/solana/id.json

# Ou si vous avez une keypair spécifique
cat /chemin/vers/votre/keypair.json
```

**IMPORTANT**: Le secret doit contenir le tableau JSON complet, par exemple:
```json
[123,45,67,89,...]
```

### 2. Vérifier que les keypairs des programmes sont dans le repo

Les fichiers suivants doivent exister dans votre repo:
- `target/deploy/swapback_cnft-keypair.json`
- `target/deploy/swapback_router-keypair.json`

Si manquants, ajoutez-les:
```bash
git add target/deploy/*-keypair.json
git commit -m "Add program keypairs for deployment"
git push
```

## Utilisation

### Déployer via l'interface GitHub

1. Allez sur votre repo: https://github.com/BacBacta/SwapBack
2. Cliquez sur l'onglet **Actions**
3. Dans la liste de gauche, sélectionnez **Deploy Solana Program to Devnet**
4. Cliquez sur **Run workflow** (bouton à droite)
5. Sélectionnez le programme à déployer:
   - `swapback_cnft` (pour corriger le DeclaredProgramIdMismatch)
   - `swapback_router`
6. Cliquez sur **Run workflow** (bouton vert)

### Suivre le déploiement

Le workflow va:
1. ✅ Installer Rust, Solana CLI et Anchor
2. ✅ Vérifier que le `declare_id!` est correct
3. ✅ Compiler le programme avec `anchor build`
4. ✅ Vérifier le solde de la wallet
5. ✅ Déployer sur devnet
6. ✅ Afficher les infos du programme déployé

Temps estimé: **5-10 minutes**

### Vérifier après le déploiement

Une fois le workflow terminé avec succès:
1. Attendez 30 secondes
2. Testez le lock sur https://swap-back-pc5qkn6em-bactas-projects.vercel.app/
3. L'erreur `DeclaredProgramIdMismatch` devrait avoir disparu ✅

## Alternative: Déploiement local (si les secrets sont configurés)

Si vous préférez déployer depuis Codespaces/local:

```bash
# 1. Exporter la keypair en variable d'environnement
export SOLANA_DEPLOYER_PRIVATE_KEY='[123,45,67,...]'

# 2. Créer le fichier keypair
echo "$SOLANA_DEPLOYER_PRIVATE_KEY" > /tmp/deployer.json

# 3. Configurer Solana
solana config set --keypair /tmp/deployer.json
solana config set --url devnet

# 4. Compiler
anchor build --program-name swapback_cnft

# 5. Déployer
solana program deploy \
  --url devnet \
  --program-id target/deploy/swapback_cnft-keypair.json \
  target/deploy/swapback_cnft.so

# 6. Nettoyer
rm /tmp/deployer.json
```

## Troubleshooting

### Erreur: "secret not found"
- Vérifiez que vous avez bien ajouté le secret `SOLANA_DEPLOYER_PRIVATE_KEY` dans les paramètres du repo

### Erreur: "authority mismatch"
- La keypair dans le secret doit correspondre à l'upgrade authority du programme
- Authority attendue: `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`

### Erreur: "insufficient funds"
- La wallet doit avoir au moins 0.5 SOL sur devnet
- Le workflow tente un airdrop automatique, mais il peut échouer
- Solution: faire un airdrop manuel avant de lancer le workflow

### Le workflow échoue à la compilation
- Vérifiez que les dépendances dans `Cargo.toml` sont valides
- Regardez les logs détaillés dans l'onglet Actions

## Prochaines étapes après le déploiement

1. Tester toutes les fonctionnalités (lock, unlock, cNFT)
2. Vérifier les logs de transaction
3. Si tout fonctionne, déployer sur mainnet (créer un nouveau workflow)
