# 🔧 Guide de Recompilation et Redéployment

## Problème
Le programme déployé à `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` contient `declare_id!("FsD6D5y...")` dans son bytecode, causant `DeclaredProgramIdMismatch`.

## Solution : Recompiler avec le bon Program ID

### Étape 1: Installer Solana Build Tools

```bash
# Installer solana-install (si pas déjà fait)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Ajouter au PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Vérifier version
solana --version  # Devrait afficher v1.18.x ou plus récent
```

### Étape 2: Build avec Anchor

```bash
cd /workspaces/SwapBack

# Le declare_id! est maintenant correct dans lib.rs
cat programs/swapback_cnft/src/lib.rs | head -10
# Devrait afficher: declare_id!("9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq");

# Build uniquement swapback_cnft
anchor build -p swapback_cnft

# Vérifier le binaire généré
ls -lh target/deploy/swapback_cnft.so
```

### Étape 3: Redéployer sur Devnet

```bash
# Se connecter au devnet
solana config set --url devnet

# Vérifier la clé d'autorité
solana address
# Devrait être: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf

# Redéployer (upgrade du programme existant)
anchor upgrade target/deploy/swapback_cnft.so \
  --program-id 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq \
  --provider.cluster devnet

# OU si anchor upgrade échoue:
solana program deploy target/deploy/swapback_cnft.so \
  --program-id 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq \
  --url devnet
```

### Étape 4: Vérifier le Déployment

```bash
# Vérifier le programme
solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq --url devnet

# Copier l'IDL vers l'app
cp target/idl/swapback_cnft.json app/src/idl/

# Commit et push
git add target/idl/swapback_cnft.json app/src/idl/swapback_cnft.json
git commit -m "chore: Update IDL after program redeployment"
git push origin main
```

### Étape 5: Tester l'Unlock

1. Attendre le redéployment Vercel (~2 minutes)
2. Rafraîchir le dashboard (Ctrl+F5)
3. Tenter unlock
4. Vérifier les logs console - l'erreur DeclaredProgramIdMismatch devrait disparaître

## Alternative: Déployer à une nouvelle adresse

Si les étapes ci-dessus échouent, on peut déployer à une **nouvelle adresse**:

```bash
# Générer une nouvelle keypair
solana-keygen new -o target/deploy/swapback_cnft-keypair.json

# Obtenir la nouvelle adresse
solana address -k target/deploy/swapback_cnft-keypair.json
# Exemple output: NEW_PROGRAM_ID

# Mettre à jour declare_id! dans lib.rs avec NEW_PROGRAM_ID
sed -i 's/9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq/NEW_PROGRAM_ID/g' programs/swapback_cnft/src/lib.rs

# Mettre à jour Anchor.toml
sed -i 's/9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq/NEW_PROGRAM_ID/g' Anchor.toml

# Build et deploy
anchor build -p swapback_cnft
anchor deploy -p swapback_cnft --provider.cluster devnet

# Mettre à jour l'environnement frontend
echo "NEXT_PUBLIC_CNFT_PROGRAM_ID=NEW_PROGRAM_ID" >> app/.env.local

# Commit
git add -A
git commit -m "deploy: New CNFT program address NEW_PROGRAM_ID"
git push origin main
```

## Dépannage

### Erreur: "lock file version 4 requires `-Znext-lockfile-bump`"
```bash
rm Cargo.lock
cargo update
```

### Erreur: "rustc 1.76 or newer required"
```bash
rustup update stable
rustup default stable
rustc --version  # Devrait afficher 1.91.x
```

### Erreur: "insufficient funds for deployment"
```bash
# Obtenir des devnet SOL
solana airdrop 2 --url devnet
solana balance --url devnet
```

### Le programme déployé est trop ancien
```bash
# Vérifier le slot
solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq --url devnet | grep "Last Deployed"

# Si trop ancien (>1h), redéployer
anchor upgrade target/deploy/swapback_cnft.so \
  --program-id 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
```

## État Actuel

- ✅ Code Rust modifié avec bon `declare_id!`
- ✅ Frontend modifié avec `signTransaction`
- ❌ Programme sur devnet contient encore ancien ID
- ⏳ Nécessite recompilation + redéployment

## Checklist

- [ ] Solana CLI installé et configuré
- [ ] `anchor build -p swapback_cnft` réussit
- [ ] Programme redéployé sur devnet
- [ ] IDL copié vers app/src/idl/
- [ ] Commit et push effectués
- [ ] Vercel redéployé
- [ ] Unlock testé et fonctionnel

---

**Note**: Cette erreur `DeclaredProgramIdMismatch` est spécifique à Anchor qui vérifie que le `declare_id!()` dans le code Rust correspond à l'adresse où le programme est déployé. C'est une protection contre les erreurs de déployment.
