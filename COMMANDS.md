# 🚀 Commandes Utiles - SwapBack Router

Guide de référence rapide pour le développement et les tests.

---

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Nettoyer et réinstaller si problèmes
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

---

## 🔨 Build

### Build du Programme Solana

```bash
# Build avec cargo-build-sbf (recommandé)
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml

# Build avec Anchor (nécessite IDL)
anchor build --program-name swapback_router

# Vérifier le binaire généré
ls -lh target/deploy/swapback_router.so
```

### Build TypeScript

```bash
# Build SDK
cd sdk && npm run build

# Build App Next.js
cd app && npm run build
```

---

## 🧪 Tests

### Exécuter Tous les Tests

```bash
# Lancer tous les tests
npm test

# Lancer avec verbose
npm test -- --reporter=verbose

# Lancer un fichier spécifique
npm test tests/swapback_router.test.ts

# Mode watch
npm test -- --watch
```

### Tests par Catégorie

```bash
# Tests unitaires uniquement
npm test tests/swapback_router.test.ts

# Tests d'intégration DEX
npm test tests/dex-integration.test.ts

# Tests de circuit breaker
npm test tests/circuit-breaker.test.ts

# Tests API Next.js
npm test app/tests/

# Tests SDK
npm test sdk/test/
```

### Tests On-Chain (Devnet)

```bash
# Activer les tests on-chain
export RUN_ON_CHAIN_TESTS=true
npm test tests/on-chain-integration.test.ts

# Avec localnet
solana-test-validator &
export RUN_ON_CHAIN_TESTS=true
npm test
```

---

## 🧹 Nettoyage

### Nettoyage Standard

```bash
# Nettoyer les builds Rust
cargo clean

# Nettoyer les builds Anchor
anchor clean

# Nettoyer node_modules
rm -rf node_modules

# Nettoyage complet
rm -rf target node_modules .anchor
```

### Libérer de l'Espace Disque

```bash
# Supprimer les caches
rm -rf ~/.cargo/registry/cache
rm -rf ~/.cargo/git/checkouts
rm -rf ~/.npm/_cacache

# Supprimer les builds non essentiels
rm -rf target/debug
rm -rf target/release
rm -rf target/sbpf-solana-solana/deps
rm -rf target/sbpf-solana-solana/build

# Vérifier l'espace disponible
df -h /workspaces
```

---

## 🔍 Diagnostic

### Vérifier les Versions

```bash
# Versions installées
anchor --version
solana --version
cargo --version
rustc --version
node --version
npm --version

# Versions dans le projet
cat Anchor.toml | grep anchor_version
cargo tree -p anchor-lang | head -5
```

### Vérifier l'État du Programme

```bash
# Vérifier le binaire
ls -lh target/deploy/*.so

# Vérifier l'IDL
ls -lh target/idl/*.json
cat target/idl/swapback_router.json | jq '.instructions[].name'

# Vérifier les types
ls -lh target/types/*.ts
```

### Debug des Tests

```bash
# Voir les tests skippés
npm test 2>&1 | grep -A 2 "skipped"

# Voir les erreurs détaillées
ANCHOR_LOG=true npm test

# Debug un test spécifique
npm test -- --grep "should initialize"
```

---

## 🌐 Solana CLI

### Configuration

```bash
# Configurer le cluster
solana config set --url devnet
solana config set --url localnet
solana config set --url mainnet-beta

# Vérifier la configuration
solana config get

# Créer un wallet de test
solana-keygen new -o ~/.config/solana/test-wallet.json
```

### Déploiement

```bash
# Airdrop sur devnet
solana airdrop 2

# Déployer le programme
anchor deploy --provider.cluster devnet

# Vérifier le programme déployé
solana program show <PROGRAM_ID>
```

### Localnet

```bash
# Lancer localnet
solana-test-validator

# Lancer avec logs
solana-test-validator --log

# Réinitialiser
solana-test-validator --reset
```

---

## 🔧 Développement

### Watcher en Développement

```bash
# Terminal 1: Watch TypeScript
cd sdk && npm run build -- --watch

# Terminal 2: Watch Tests
npm test -- --watch

# Terminal 3: Dev server Next.js
cd app && npm run dev
```

### Linting et Formatting

```bash
# Linter Rust
cargo clippy --all-targets --all-features

# Formatter Rust
cargo fmt

# Linter TypeScript
npm run lint

# Formatter TypeScript
npm run format
```

---

## 📊 Analyse

### Couverture des Tests

```bash
# Avec couverture
npm test -- --coverage

# Rapport HTML
npm test -- --coverage --reporter=html
```

### Analyse de Dépendances

```bash
# Arbre de dépendances Rust
cargo tree

# Dépendances d'un package spécifique
cargo tree -p anchor-lang

# Dépendances inversées
cargo tree -i getrandom

# Dépendances npm
npm list --depth=0
```

### Analyse du Binaire

```bash
# Taille du binaire
ls -lh target/deploy/swapback_router.so

# Informations détaillées
file target/deploy/swapback_router.so

# Symboles exportés (si non-stripped)
objdump -t target/deploy/swapback_router.so | head -20
```

---

## 🐛 Troubleshooting

### Problème: Tests Skippés

```bash
# Vérifier que l'IDL existe
ls -lh target/idl/swapback_router.json

# Vérifier que le binaire existe
ls -lh target/deploy/swapback_router.so

# Reconstruire tout
cargo clean
anchor build
npm test
```

### Problème: Erreur Getrandom

```bash
# Vérifier la version de getrandom
cargo tree -i getrandom

# Vérifier le stub custom
cat programs/swapback_router/src/getrandom_stub.rs

# Rebuild avec logs
RUST_BACKTRACE=1 cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml
```

### Problème: Espace Disque Plein

```bash
# Voir l'utilisation
df -h /workspaces
du -sh target node_modules

# Nettoyage agressif
rm -rf target/debug target/release
rm -rf ~/.cargo/registry/cache
rm -rf node_modules
npm install
```

### Problème: Anchor Version Mismatch

```bash
# Vérifier les versions
anchor --version
cat Anchor.toml | grep anchor_version

# Changer de version CLI
avm use 0.30.1
anchor --version

# Rebuild après changement
cargo clean
anchor build
```

---

## 🎯 Workflows Communs

### Workflow: Nouveau Test

```bash
# 1. Créer le fichier de test
touch tests/my-new-test.test.ts

# 2. Écrire le test avec vitest
# (voir exemples dans tests/)

# 3. Lancer le test
npm test tests/my-new-test.test.ts

# 4. Vérifier la couverture
npm test -- --coverage
```

### Workflow: Modifier le Programme

```bash
# 1. Modifier le code Rust
vim programs/swapback_router/src/lib.rs

# 2. Rebuild
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml

# 3. Si changement d'interface, mettre à jour l'IDL
# (manuellement ou via anchor build)

# 4. Lancer les tests
npm test tests/swapback_router.test.ts
```

### Workflow: Pull Request

```bash
# 1. Créer une branche
git checkout -b feature/my-feature

# 2. Faire les modifications

# 3. Lancer tous les tests
npm test

# 4. Linter
cargo clippy
npm run lint

# 5. Formatter
cargo fmt
npm run format

# 6. Commit et push
git add .
git commit -m "feat: my new feature"
git push origin feature/my-feature
```

---

## 📚 Ressources

### Documentation

```bash
# Doc Anchor
open https://www.anchor-lang.com/docs

# Doc Solana
open https://solana.com/docs

# Doc Vitest
open https://vitest.dev
```

### Outils Utiles

```bash
# Explorer Solana
open https://explorer.solana.com

# Solana Playground
open https://beta.solpg.io

# Anchor Playground
open https://www.anchor-lang.com/playground
```

---

## 💡 Astuces

### Performance Build

```bash
# Build parallèle
cargo build-sbf -j $(nproc)

# Build avec cache
export CARGO_TARGET_DIR=/tmp/cargo-target
```

### Debug Avancé

```bash
# Logs Anchor verbeux
export ANCHOR_LOG=true
npm test

# Backtrace Rust complet
export RUST_BACKTRACE=full
cargo build-sbf

# Debug Solana transactions
solana logs --url devnet
```

### CI/CD

```bash
# Script pour CI (exemple)
#!/bin/bash
set -e

# Build
cargo build-sbf
npm install
npm run build

# Tests
npm test

# Lint
cargo clippy -- -D warnings
npm run lint

echo "✅ CI checks passed"
```

---

**Dernière mise à jour**: 18 octobre 2025
