# Migration vers Anchor 0.28.0

## Statut

🔄 **Installation en cours** de Anchor CLI 0.28.0 via cargo

## Raison de la migration

La version Anchor 0.32.1 génère des fichiers `Cargo.lock` en version 4, incompatibles avec le toolchain BPF de Solana qui utilise Rust 1.75.0 (ne supporte que Cargo.lock v3).

Anchor 0.28.0 utilise une version de Rust compatible et devrait générer des Cargo.lock v3.

## Changements à effectuer après installation

### 1. Mettre à jour `Anchor.toml`

```toml
[toolchain]
anchor_version = "0.28.0"  # Actuellement 0.32.1
```

### 2. Mettre à jour `programs/swapback_router/Cargo.toml`

```toml
[dependencies]
anchor-lang = "0.28.0"     # Actuellement 0.32.1
anchor-spl = "0.28.0"      # Actuellement 0.32.1
```

### 3. Mettre à jour `programs/swapback_buyback/Cargo.toml`

```toml
[dependencies]
anchor-lang = "0.28.0"     # Actuellement 0.32.1
anchor-spl = "0.28.0"      # Actuellement 0.32.1
```

### 4. Nettoyer et rebuilder

```bash
cd /workspaces/SwapBack
anchor clean
rm -f Cargo.lock
rm -f programs/swapback_router/Cargo.lock
rm -f programs/swapback_buyback/Cargo.lock
anchor build
```

## Différences API potentielles

Anchor 0.28.0 → 0.32.1 peut avoir quelques changements d'API mineurs :

### Changements connus à vérifier

1. **Syntaxe des contraintes** : Généralement stable
2. **Types SPL** : Peuvent avoir changé dans `anchor-spl`
3. **Macros derive** : Généralement compatibles

### Compatibilité du code actuel

✅ Notre code utilise des patterns standards :
- `#[program]` et `#[derive(Accounts)]`
- Contraintes basiques : `mut`, `signer`, `has_one`
- Types SPL standard : `TokenAccount`, `Mint`, `Token`

**Probabilité de compatibilité : HAUTE** (95%+)

## Timeline estimée

1. ⏳ Installation Anchor CLI 0.28.0 : 5-10 min (en cours)
2. ✏️ Mise à jour des fichiers de config : 1 min
3. 🔨 Clean + Build : 2-5 min
4. ✅ Tests : 2 min

**Total : ~15-20 minutes**

## Plan B si problèmes

Si Anchor 0.28.0 a des incompatibilités API :

### Option 1 : Ajustements mineurs
- Consulter le CHANGELOG : https://github.com/coral-xyz/anchor/releases/tag/v0.28.0
- Adapter les quelques lignes nécessaires

### Option 2 : Compilation directe avec cargo build-sbf
```bash
cd programs/swapback_router
cargo build-sbf --manifest-path Cargo.toml
cd ../swapback_buyback
cargo build-sbf --manifest-path Cargo.toml
```

### Option 3 : Docker avec image officielle Anchor
```bash
docker run --rm -v $(pwd):/workspaces projectserum/build:v0.28.0 \
  anchor build
```

## Vérification après build

```bash
# Vérifier que les .so ont été générés
ls -lh target/deploy/*.so

# Devrait afficher :
# swapback_router.so
# swapback_buyback.so

# Tester
anchor test
```

## Notes

- 🔐 Wallet déjà configuré : `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`
- 🌐 Network : devnet
- 💾 Backup du code : `/tmp/swapback_backup_20251011_135231`
- 📋 Documentation complète dans `INDEX.md`
