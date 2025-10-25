# 🔧 RÉSOLUTION CARGO.LOCK v4 - GUIDE D'ACTION
## SwapBack - 25 Octobre 2025

---

## 🎯 RÉSUMÉ DU PROBLÈME

**Cause:** Conflit entre Rust 1.90.0 (génère Cargo.lock v4) et Anchor BPF (supporte v3)  
**Symptôme:** `anchor build` échoue avec erreur de version Cargo.lock  
**Impact:** Empêche la compilation et le déploiement des programmes Solana  
**Durée résolution:** 30 minutes avec cette solution

---

## ✅ SOLUTION FINALE (RECOMMANDÉE)

### Option A: Build Direct avec Rust 1.79 (30 min)

**Cette approche contourne Anchor et utilise Rust toolchain + cargo-build-sbf**

```bash
# 1. Installer Rust 1.79.0 (stable, compatible avec BPF)
rustup install 1.79.0
rustup override set 1.79.0

# 2. Vérifier les versions
rustc --version  # Should be 1.79.x
cargo --version  # Should be 1.xx

# 3. Supprimer Cargo.lock v4
rm -f Cargo.lock

# 4. Supprimer cache
rm -rf target/

# 5. Installer outils Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"

# 6. Installer cargo-build-sbf
cargo install cargo-build-sbf

# 7. Compiler programs
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml --release
cargo build-sbf --manifest-path programs/swapback_buyback/Cargo.toml --release
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml --release

# 8. Copier binaires au bon endroit
mkdir -p target/deploy
cp target/sbf-solana-solana/release/*.so target/deploy/

# 9. Vérifier
ls -lh target/deploy/swapback_*.so
```

**Avantage:** Directement compatible avec Solana, pas de problèmes Anchor  
**Résultat:** Binaires dans `target/deploy/` prêts pour déploiement

---

### Option B: Utiliser le script d'automatisation

```bash
# Rendre exécutable
chmod +x /workspaces/SwapBack/fix-build-final.sh

# Exécuter
./fix-build-final.sh

# Cela fera automatiquement toutes les étapes ci-dessus
```

---

### Option C: Downgrade Anchor (15 min)

Si vous tenez absolument à utiliser Anchor :

```bash
# 1. Installer Anchor 0.29.0
avm install 0.29.0
avm use 0.29.0

# 2. Supprimer Cargo.lock
rm -f Cargo.lock

# 3. Build et deploy
anchor build
anchor deploy --provider.cluster devnet
```

---

### Option D: Docker Build (15 min)

```bash
# Si vous avez Docker disponible
docker pull projectserum/build:latest

docker run --rm -v $(pwd):/workdir projectserum/build:latest \
    anchor build --skip-local-validator

# Binaires seront dans target/deploy/
```

---

## 📋 ÉTAPES DÉTAILLÉES (Option A - Recommandée)

### Étape 1: Installer Rust 1.79

```bash
rustup install 1.79.0
```

**Sortie attendue:**
```
downloading target for x86_64-unknown-linux-gnu
      Compiling ... (plusieurs packages)
    Finished installation. Type `rustup --version` to check.
```

### Étape 2: Activer Rust 1.79

```bash
rustup override set 1.79.0
```

**Sortie attendue:**
```
info: override toolchain for '/workspaces/SwapBack' set to '1.79.0-x86_64-unknown-linux-gnu'
```

### Étape 3: Vérifier les versions

```bash
rustc --version
cargo --version
```

**Sortie attendue:**
```
rustc 1.79.0 (129f3b996 2024-06-10)
cargo 1.79.0 (590c3217a 2024-06-03)
```

### Étape 4: Supprimer Cargo.lock v4

```bash
rm -f Cargo.lock
```

### Étape 5: Nettoyer le cache

```bash
rm -rf target/
```

### Étape 6: Installer Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
```

**Sortie attendue:**
```
downloading Solana 1.18.22
✓ installed /home/user/.local/share/solana
```

### Étape 7: Installer cargo-build-sbf

```bash
cargo install cargo-build-sbf
```

**Sortie attendue:**
```
Downloading crates ...
Compiling cargo-build-sbf ...
Finished release profile ...
Installed binary ...
```

### Étape 8: Compiler Router Program

```bash
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml --release
```

**Sortie attendue:**
```
Compiling swapback_router ...
Finished release ...
Deployed as: target/sbf-solana-solana/release/swapback_router.so
```

### Étape 9: Compiler Buyback Program

```bash
cargo build-sbf --manifest-path programs/swapback_buyback/Cargo.toml --release
```

### Étape 10: Compiler cNFT Program

```bash
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml --release
```

### Étape 11: Copier binaires

```bash
mkdir -p target/deploy
cp target/sbf-solana-solana/release/swapback_router.so target/deploy/
cp target/sbf-solana-solana/release/swapback_buyback.so target/deploy/
cp target/sbf-solana-solana/release/swapback_cnft.so target/deploy/
```

### Étape 12: Vérifier les binaires

```bash
ls -lh target/deploy/swapback_*.so
```

**Sortie attendue:**
```
-rw-r--r-- 1 user user 278K Oct 25 10:30 target/deploy/swapback_router.so
-rw-r--r-- 1 user user 283K Oct 25 10:31 target/deploy/swapback_buyback.so
-rw-r--r-- 1 user user 245K Oct 25 10:32 target/deploy/swapback_cnft.so
```

---

## 🚀 APRÈS LE BUILD

### Étape 13: Préparer le déploiement

```bash
# 1. Vérifier le wallet
solana address --url devnet

# 2. Vérifier le solde
solana balance --url devnet

# 3. Airdrop SOL si nécessaire
solana airdrop 5 --url devnet
```

### Étape 14: Déployer sur devnet

**Option A: Avec Solana CLI**

```bash
# Router
solana deploy target/deploy/swapback_router.so \
  --url devnet \
  --keypair ~/.config/solana/id.json

# Buyback
solana deploy target/deploy/swapback_buyback.so \
  --url devnet \
  --keypair ~/.config/solana/id.json

# cNFT
solana deploy target/deploy/swapback_cnft.so \
  --url devnet \
  --keypair ~/.config/solana/id.json
```

**Option B: Avec Anchor (si disponible)**

```bash
anchor deploy --provider.cluster devnet
```

### Étape 15: Vérifier le déploiement

```bash
# Vérifier Router
solana program show 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap --url devnet

# Vérifier Buyback
solana program show 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU --url devnet

# Explorer
# https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet
```

---

## ✅ CHECKLIST DE VALIDATION

- [ ] Rust 1.79.0 installé et activé
- [ ] Cargo.lock supprimé
- [ ] Target directory supprimé
- [ ] Solana CLI v1.18.22+ installé
- [ ] cargo-build-sbf installé
- [ ] swapback_router.so compilé (278KB)
- [ ] swapback_buyback.so compilé (283KB)
- [ ] swapback_cnft.so compilé (245KB)
- [ ] Binaires copiés dans target/deploy/
- [ ] Wallet préparé et approvisionné
- [ ] Programs déployés sur devnet
- [ ] Explorer montre les programs OK

---

## 🆘 TROUBLESHOOTING

### Problème: "command not found: cargo-build-sbf"

**Solution:**
```bash
cargo install cargo-build-sbf
```

### Problème: "cannot find crate `getrandom`"

**Cause:** Conflit Cargo.lock  
**Solution:**
```bash
rm -f Cargo.lock
cargo clean
cargo build-sbf ...
```

### Problème: "wrong version of solana"

**Cause:** Version Solana incompatible  
**Solution:**
```bash
# Installer Solana 1.18.22
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"

# Ajouter au PATH
export PATH="/home/user/.local/share/solana/install/active_release/bin:$PATH"
```

### Problème: "insufficient lamports"

**Cause:** Pas assez de SOL pour le déploiement  
**Solution:**
```bash
solana airdrop 5 --url devnet
```

### Problème: Build très lent

**Cause:** Première compilation ou pas assez de CPU  
**Solution:** Utiliser `-j` pour paralléliser
```bash
cargo build-sbf --manifest-path ... -j 4
```

---

## 📞 COMMANDES UTILES

```bash
# Vérifier versions
rustc --version
cargo --version
solana --version

# Nettoyer
rm -f Cargo.lock
rm -rf target/

# Build programs
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml --release

# Copier binaires
cp target/sbf-solana-solana/release/*.so target/deploy/

# Vérifier binaires
ls -lh target/deploy/

# Déployer
solana deploy target/deploy/swapback_router.so --url devnet

# Vérifier déploiement
solana program show <PROGRAM_ID> --url devnet
```

---

## 📊 TIMELINE ESTIMÉE

| Étape | Temps |
|-------|-------|
| Installer Rust 1.79 | 5 min |
| Nettoyer Cargo.lock | 1 min |
| Installer Solana CLI | 5 min |
| Installer cargo-build-sbf | 3 min |
| Compiler Router | 5 min |
| Compiler Buyback | 5 min |
| Compiler cNFT | 5 min |
| Copier binaires | 1 min |
| Préparer déploiement | 5 min |
| Déployer sur devnet | 5 min |
| **TOTAL** | **~45 min** |

---

## 🎯 RÉSULTAT ATTENDU

Après ces étapes, vous aurez:

✅ **Programs compilés:**
- `target/deploy/swapback_router.so` (278 KB)
- `target/deploy/swapback_buyback.so` (283 KB)
- `target/deploy/swapback_cnft.so` (245 KB)

✅ **Programs déployés sur devnet:**
- Router: `3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap`
- Buyback: `46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU`
- cNFT: `ENbA46Rq9yFdp63WwmVm4tykcjmaukWs6T2ScGr9x7zB`

✅ **Prêt pour:**
- Tests on-chain (6 tests débloqués)
- Validation de routage
- Beta launch

---

## 🔗 LIENS UTILES

- [Solana Build Docs](https://docs.solana.com/cli/build)
- [Anchor CLI Docs](https://docs.rs/anchor-cli/latest/anchor_cli/)
- [Cargo BPF Guide](https://github.com/solana-labs/cargo-build-sbf)
- [SwapBack Repo](https://github.com/BacBacta/SwapBack)

---

**Créé:** 25 Octobre 2025  
**Version:** 1.0  
**Status:** ✅ Prêt à exécuter  

