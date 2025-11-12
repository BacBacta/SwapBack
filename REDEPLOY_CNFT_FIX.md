# 🔧 Fix URGENT: Redéployer swapback_cnft pour corriger DeclaredProgramIdMismatch

## 🔴 Problème CRITIQUE identifié

Le programme `26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru` déployé sur devnet a été compilé avec un **ancien** `declare_id!`:
```rust
declare_id!("CzxpYBeKbcA6AJH7yz8ggkJ1cWen3ejKUuikE6stHEaF");  // ❌ Ancien ID
```

Mais le code source actuel (`programs/swapback_cnft/src/lib.rs` ligne 7) déclare:
```rust
declare_id!("26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru");  // ✅ ID actuel
```

**Conséquence**: **TOUTES** les transactions lock/unlock échouent avec:
```
Program log: AnchorError occurred. Error Code: DeclaredProgramIdMismatch. Error Number: 4100. 
Error Message: The declared program id does not match the actual program id.
```

**Cause**: Le binaire déployé (`target/deploy/swapback_cnft.so` du 12 Nov 00:15) a été compilé avec l'ancien `declare_id!`.

**Upgrade Authority**: ✅ Confirmée - `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`

## ✅ Solution IMMÉDIATE: Redéployer le programme

### Étape 1: Environnement de build (machine locale avec Rust)

```bash
# Sur votre machine locale (PAS Codespaces - cargo n'est pas installé)

# 1. Cloner le repo
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack

# 2. Vérifier le declare_id!
grep 'declare_id!' programs/swapback_cnft/src/lib.rs
# Doit afficher: declare_id!("26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru");

# 3. Build avec Anchor (si installé)
anchor build --program-name swapback_cnft

# OU avec cargo directement
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml
```

### Étape 2: Configurer la wallet avec l'upgrade authority

```bash
# Copier votre keypair avec l'upgrade authority vers ~/.config/solana/id.json
# Authority actuelle: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf

# Vérifier
solana address
# Doit afficher: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf

# Vérifier le solde devnet
solana balance --url devnet
# Si < 0.5 SOL, airdrop: solana airdrop 2 --url devnet
```

### Étape 3: Redéployer (upgrade) le programme

```bash
cd SwapBack

# Redéployer le programme (upgrade)
solana program deploy \
    --url devnet \
    --program-id target/deploy/swapback_cnft-keypair.json \
    --upgrade-authority ~/.config/solana/id.json \
    target/deploy/swapback_cnft.so

# Attendez quelques secondes pour la confirmation

# Vérifier le déploiement
solana program show 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru --url devnet
```

### Étape 4: Vérification

```bash
# Le programme doit toujours avoir le même ID
# Program Id: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru
# ProgramData Address: 2FfBSqK6dUZ5W45a3H6XQ137yTuXgA2fPPU17CnpNWivV
# Authority: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf
```

### Étape 5: Tester depuis Vercel

1. **Attendre 30 secondes** (propagation du nouveau binaire)
2. Aller sur https://swap-back-pc5qkn6em-bactas-projects.vercel.app/
3. Tester la fonction **Lock**
4. **Vérifier les logs** - l'erreur `DeclaredProgramIdMismatch` doit avoir disparu

## 📝 Après le redéploiement

1. **Vérifier** que le programme fonctionne:
   ```bash
   solana program show 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru --url devnet
   ```

2. **Tester** une transaction lock depuis l'interface Vercel

3. **Confirmer** que l'erreur `DeclaredProgramIdMismatch` a disparu

## 🎯 Vérification post-déploiement

```bash
# Extraire le declare_id! du programme déployé
solana program dump 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru /tmp/cnft_verify.so --url devnet
strings /tmp/cnft_verify.so | grep "26kzow1K"

# Devrait afficher: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru
```
