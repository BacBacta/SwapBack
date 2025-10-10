# Comment Construire cet Espace de Travail

## 🚀 Guide de Construction SwapBack

Ce guide vous accompagne étape par étape pour construire le projet SwapBack.

### Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** >= 18.0.0
- **Rust** >= 1.70.0
- **Solana CLI** >= 1.18.0
- **Anchor CLI** >= 0.30.1

#### Installation des outils

```bash
# Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Installer Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Installer Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1
```

### Structure du Projet

```
SwapBack/
├── programs/           # Programmes Solana (Rust/Anchor)
├── app/               # Frontend Next.js
├── sdk/               # SDK TypeScript
├── oracle/            # Service Oracle
├── tests/             # Tests Anchor
└── docs/              # Documentation
```

### Étapes de Construction

#### 1. Cloner et Installer les Dépendances

```bash
# Cloner le repo
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack

# Installer les dépendances racine
npm install
```

#### 2. Build les Programmes Anchor

```bash
# Build les programmes Solana
anchor build

# Vérifier la compilation
ls -lh target/deploy/*.so
```

**Sortie attendue :**
```
swapback_router.so
swapback_buyback.so
```

#### 3. Générer les Types TypeScript

Anchor génère automatiquement les types TypeScript à partir des IDL :

```bash
# Les types sont dans target/types/
ls target/types/
```

#### 4. Build le SDK

```bash
cd sdk
npm install
npm run build

# Vérifier
ls dist/
```

#### 5. Build l'Oracle

```bash
cd ../oracle
npm install
npm run build

# Vérifier
ls dist/
```

#### 6. Build le Frontend

```bash
cd ../app
npm install
npm run build

# Vérifier
ls .next/
```

### Tests

#### Tests Unitaires des Programmes

```bash
# Retour à la racine
cd ..

# Lancer les tests Anchor
anchor test

# Tests sur devnet (plus lent mais plus réaliste)
anchor test --provider.cluster devnet
```

#### Tests du SDK

```bash
cd sdk
npm test
```

### Lancement en Développement

#### Terminal 1 : Validateur Local

```bash
# Démarrer un validateur local Solana
solana-test-validator
```

#### Terminal 2 : Oracle Service

```bash
cd oracle
npm run dev
```

L'oracle sera disponible sur `http://localhost:3001`

#### Terminal 3 : Frontend

```bash
cd app
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

### Déploiement

#### Sur Devnet

```bash
# Configuration
solana config set --url devnet

# Airdrop de SOL pour les frais
solana airdrop 2

# Déploiement
anchor deploy --provider.cluster devnet
```

#### Sur Mainnet

⚠️ **Attention** : Ne déployez sur mainnet qu'après un audit de sécurité complet !

Consultez [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) pour le guide détaillé.

### Scripts Utiles

#### Build Complet

```bash
# Utiliser le script de build automatisé
chmod +x scripts/build.sh
./scripts/build.sh devnet
```

#### Nettoyage

```bash
# Nettoyer les artefacts de build
anchor clean
rm -rf target/
cd app && rm -rf .next/ && cd ..
cd sdk && rm -rf dist/ && cd ..
cd oracle && rm -rf dist/ && cd ..
```

### Résolution de Problèmes

#### Erreur : "Program size exceeds limit"

Les programmes Solana sont limités à 10 MB.

**Solution :**
```bash
# Optimiser le build
anchor build -- --features mainnet
```

#### Erreur : "Insufficient funds"

**Solution :**
```bash
# Sur devnet
solana airdrop 2 --url devnet

# Sur mainnet, transférer du SOL vers votre wallet
```

#### Erreur de compilation TypeScript dans l'app

**Solution :**
```bash
cd app
rm -rf node_modules package-lock.json
npm install
```

### Variables d'Environnement

Créez un fichier `.env` à la racine :

```bash
cp .env.example .env
```

Puis configurez :

```env
SOLANA_RPC=https://api.devnet.solana.com
JUPITER_API=https://quote-api.jup.ag/v6
ORACLE_ENDPOINT=http://localhost:3001
NEXT_PUBLIC_NETWORK=devnet
```

### Documentation Complète

- [README.md](README.md) - Vue d'ensemble du projet
- [docs/TECHNICAL.md](docs/TECHNICAL.md) - Documentation technique
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Guide de déploiement

### Support

- Discord : [discord.gg/swapback](https://discord.gg/swapback)
- Twitter : [@SwapBackProtocol](https://twitter.com/SwapBackProtocol)
- Issues : [GitHub Issues](https://github.com/BacBacta/SwapBack/issues)

---

**Bon build ! 🚀**
