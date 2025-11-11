# 🚀 Étapes Finales de Déployment

## ✅ Ce qui est DÉJÀ FAIT

1. ✅ Nouvelle keypair générée: `target/deploy/swapback_cnft-keypair.json`
2. ✅ **Nouvelle adresse du programme**: `DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf`
3. ✅ `declare_id!` mis à jour dans `programs/swapback_cnft/src/lib.rs`
4. ✅ `Anchor.toml` mis à jour avec la nouvelle adresse
5. ✅ Seed phrase sauvegardée: `marble erase place noise bunker deer track satoshi rally sick steel cactus`

## ⏳ À FAIRE - Compilation Locale

### Pourquoi compilation locale?

Codespaces a des incompatibilités de toolchain Rust qui empêchent la compilation. La solution est de compiler sur votre machine locale.

### Étapes sur votre machine locale:

```bash
# 1. Cloner le repo (si pas déjà fait)
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack

# 2. Vérifier que les changements sont présents
git pull origin main
head -10 programs/swapback_cnft/src/lib.rs
# Devrait afficher: declare_id!("DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf");

# 3. Installer Rust 1.79 (version Solana recommandée)
rustup install 1.79.0
rustup default 1.79.0

# 4. Compiler le programme
anchor build -p swapback_cnft

# Vérifier le binaire
ls -lh target/deploy/swapback_cnft.so
# Devrait afficher ~300-400 KB
```

### Déployment sur Devnet:

```bash
# 1. Configurer Solana
solana config set --url devnet

# 2. Obtenir des devnet SOL (si besoin)
solana airdrop 2

# 3. Déployer le programme
anchor deploy -p swapback_cnft --provider.cluster devnet

# 4. Noter la signature de transaction affichée!
```

### Mise à jour Frontend:

```bash
# 1. Copier le nouvel IDL
cp target/idl/swapback_cnft.json app/src/idl/

# 2. Mettre à jour la variable d'environnement
echo "NEXT_PUBLIC_CNFT_PROGRAM_ID=DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf" >> app/.env.local

# 3. Commit et push
git add -A
git commit -m "deploy: New CNFT program at DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf"
git push origin main
```

## 🔄 Alternative: Compilation dans Codespaces (Avancé)

Si vous voulez absolument compiler dans Codespaces, voici la méthode avec Docker:

```bash
# Installer Docker dans Codespaces
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo usermod -aG docker codespace

# Compiler avec Anchor verifiable
anchor build --program-name swapback_cnft --verifiable
```

Puis suivre les mêmes étapes de déployment ci-dessus.

## 📊 Vérification Post-Déployment

```bash
# Vérifier le programme déployé
solana program show DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf --url devnet

# Devrait afficher:
# - Program Id: DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf
# - Owner: BPFLoaderUpgradeab1e11111111111111111111111
# - Data Length: ~334400 bytes
# - Last Deployed: <récent>
```

## 🧪 Test Final

1. Attendre le redéployment Vercel (~2 minutes après push)
2. Aller sur https://swap-back-556okzq8h-bactas-projects.vercel.app
3. Rafraîchir avec Ctrl+F5
4. Connecter le wallet
5. Tenter un unlock
6. **L'erreur `DeclaredProgramIdMismatch` doit disparaître!**

## 📝 Notes Importantes

- La keypair du programme est dans `target/deploy/swapback_cnft-keypair.json`
- **NE PAS** supprimer cette keypair - c'est l'autorité de mise à jour du programme
- Seed phrase sauvegardée au cas où: `marble erase place noise bunker deer track satoshi rally sick steel cactus`
- L'ancien programme (`9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`) reste sur devnet mais ne sera plus utilisé

## ❓ Dépannage

### "Insufficient funds for deployment"
```bash
solana airdrop 2 --url devnet
# Retry deploy
```

### "Anchor build failed"
```bash
# Nettoyer et recommencer
cargo clean
rm -rf target
anchor build -p swapback_cnft
```

### "Program deployment failed"
```bash
# Vérifier que vous avez assez de SOL
solana balance --url devnet

# Vérifier le RPC
solana config get

# Essayer avec un RPC différent
solana config set --url https://api.devnet.solana.com
```

### Le dashboard affiche toujours l'ancienne erreur

1. Vérifier que Vercel a bien redéployé
2. Hard refresh (Ctrl+Shift+R ou Cmd+Shift+R)
3. Vider le cache du navigateur
4. Vérifier que `NEXT_PUBLIC_CNFT_PROGRAM_ID` est à jour dans Vercel

## ✅ Checklist Complète

- [x] Keypair générée
- [x] declare_id! mis à jour
- [x] Anchor.toml mis à jour
- [ ] Programme compilé localement
- [ ] Programme déployé sur devnet
- [ ] IDL copié vers app/src/idl/
- [ ] NEXT_PUBLIC_CNFT_PROGRAM_ID mis à jour
- [ ] Changes committés et pushés
- [ ] Vercel redéployé
- [ ] Unlock testé et fonctionnel

---

**Durée estimée**: 20-30 minutes (compilation locale + déployment)
**Coût**: Gratuit sur devnet (SOL airdrop disponible)
