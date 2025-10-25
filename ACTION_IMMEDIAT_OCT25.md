# 🚀 ACTION IMMÉDIATE - CARGO.LOCK FIX
## Exécuter cette séquence maintenant

---

## ⚡ QUICKSTART (5 MINUTES POUR COMMENCER)

### Copier-coller cette commande complète:

```bash
# Installer Rust 1.79
rustup install 1.79.0 && \
rustup override set 1.79.0 && \

# Vérifier
rustc --version && cargo --version && \

# Nettoyer
rm -f Cargo.lock && rm -rf target && \

# Installer Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)" && \

# Installer cargo-build-sbf
cargo install cargo-build-sbf
```

Après cette commande, continuez avec:

```bash
# Build Router
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml --release

# Build Buyback
cargo build-sbf --manifest-path programs/swapback_buyback/Cargo.toml --release

# Build cNFT
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml --release

# Copier binaires
mkdir -p target/deploy && \
cp target/sbf-solana-solana/release/swapback_router.so target/deploy/ && \
cp target/sbf-solana-solana/release/swapback_buyback.so target/deploy/ && \
cp target/sbf-solana-solana/release/swapback_cnft.so target/deploy/

# Vérifier
ls -lh target/deploy/swapback_*.so
```

---

## 📋 ÉTAPES DÉTAILLÉES

### 1️⃣ Installer Rust 1.79

```bash
rustup install 1.79.0
rustup override set 1.79.0
```

**Cible:** Installer la version 1.79.0 compatible avec Solana BPF

### 2️⃣ Vérifier les versions

```bash
rustc --version
cargo --version
```

**Cible:** Vérifier que vous êtes en 1.79.0

### 3️⃣ Supprimer le problème Cargo.lock v4

```bash
rm -f Cargo.lock
rm -rf target/
```

**Cible:** Supprimer les fichiers cache qui causent le conflit

### 4️⃣ Installer outils Solana

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"
```

**Cible:** Obtenir solana CLI et cargo-build-sbf

### 5️⃣ Installer cargo-build-sbf

```bash
cargo install cargo-build-sbf
```

**Cible:** Installer le compilateur Solana BPF

### 6️⃣ Compiler Router

```bash
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml --release
```

**Cible:** Générer swapback_router.so

### 7️⃣ Compiler Buyback

```bash
cargo build-sbf --manifest-path programs/swapback_buyback/Cargo.toml --release
```

**Cible:** Générer swapback_buyback.so

### 8️⃣ Compiler cNFT

```bash
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml --release
```

**Cible:** Générer swapback_cnft.so

### 9️⃣ Organiser les binaires

```bash
mkdir -p target/deploy
cp target/sbf-solana-solana/release/swapback_router.so target/deploy/
cp target/sbf-solana-solana/release/swapback_buyback.so target/deploy/
cp target/sbf-solana-solana/release/swapback_cnft.so target/deploy/
```

**Cible:** Placer les .so dans le dossier attendu

### 🔟 Vérifier le succès

```bash
ls -lh target/deploy/swapback_*.so
```

**Attendu:**
```
-rw-r--r-- 1 user user 278K Oct 25 10:30 target/deploy/swapback_router.so
-rw-r--r-- 1 user user 283K Oct 25 10:31 target/deploy/swapback_buyback.so
-rw-r--r-- 1 user user 245K Oct 25 10:32 target/deploy/swapback_cnft.so
```

---

## 🎯 ÉTAPES SUIVANTES (Après BUILD RÉUSSI)

### Préparer le déploiement

```bash
# Vérifier wallet
solana address --url devnet

# Vérifier solde
solana balance --url devnet

# Airdrop SOL si < 1 SOL
solana airdrop 5 --url devnet
```

### Déployer sur devnet

```bash
# Router
solana deploy target/deploy/swapback_router.so --url devnet

# Buyback
solana deploy target/deploy/swapback_buyback.so --url devnet

# cNFT
solana deploy target/deploy/swapback_cnft.so --url devnet
```

### Valider le déploiement

```bash
# Explorer le Router
https://explorer.solana.com/address/3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap?cluster=devnet

# Explorer le Buyback
https://explorer.solana.com/address/46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU?cluster=devnet
```

### Lancer les tests

```bash
npm run test:integration
```

---

## ✅ CHECKLIST DE SUCCÈS

- [ ] **Rust 1.79.0** - Vérifié avec `rustc --version`
- [ ] **Cargo.lock** - Supprimé avec `rm -f Cargo.lock`
- [ ] **Target** - Supprimé avec `rm -rf target`
- [ ] **Solana CLI** - Installé (sh -c "$(curl...)")
- [ ] **cargo-build-sbf** - Installé avec `cargo install`
- [ ] **swapback_router.so** - Compilé (278 KB)
- [ ] **swapback_buyback.so** - Compilé (283 KB)
- [ ] **swapback_cnft.so** - Compilé (245 KB)
- [ ] **target/deploy/** - Contient les 3 .so
- [ ] **Wallet préparé** - SOL sur le solde
- [ ] **Programs déployés** - Sur devnet
- [ ] **Tests passent** - `npm run test:integration` ✓

---

## 🆘 SI ERREUR

### Erreur: "cannot find command"

```bash
# Ajouter Solana au PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Vérifier
solana --version
```

### Erreur: "Cargo.lock" toujours là

```bash
# Force delete
rm -fv Cargo.lock

# Clean
cargo clean

# Recommencer build
cargo build-sbf ...
```

### Erreur: "permission denied"

```bash
# Donner permission
chmod +x ~/.local/share/solana/install/active_release/bin/solana

# Ou réinstaller
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
```

---

## 📊 TEMPS ESTIMÉ

| Étape | Temps |
|-------|-------|
| Rust 1.79 + Solana | 10 min |
| cargo-build-sbf | 5 min |
| Build 3 programs | 20 min |
| Copier + vérifier | 2 min |
| **TOTAL** | **~37 min** |

---

## 🎉 RÉSULTAT

Après ces étapes:

✅ **Build réussi** - Pas d'erreurs Cargo.lock  
✅ **Programs compilés** - 3 .so files (278/283/245 KB)  
✅ **Prêt pour devnet** - Binaires dans target/deploy/  
✅ **Prêt pour tests** - 6 tests on-chain débloqués  
✅ **Prêt pour beta** - MVP launch possible  

---

## 🔗 RESSOURCES

- **Full Guide:** [CARGO_LOCK_FIX_GUIDE.md](CARGO_LOCK_FIX_GUIDE.md)
- **Status Report:** [ETAT_DEVELOPPEMENT_COMPLET_OCT2025.md](ETAT_DEVELOPPEMENT_COMPLET_OCT2025.md)
- **Official Docs:** https://docs.solana.com/cli/build

---

**Status:** 🟡 PRÊT À EXÉCUTER  
**Durée:** ~40 minutes  
**Difficulté:** ⭐⭐ Facile  

**Commencez maintenant! →**

