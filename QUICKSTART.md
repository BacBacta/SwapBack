# 🚀 Guide de Démarrage Rapide SwapBack

## Installation en 5 Minutes

### Prérequis

Vérifiez que vous avez :

```bash
node --version   # >= 18.0.0
rustc --version  # >= 1.70.0
solana --version # >= 1.18.0
anchor --version # >= 0.30.1
```

### Étape 1 : Clone et Installation

```bash
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack
npm install
```

### Étape 2 : Configuration

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Configurer le wallet Solana
solana config set --url devnet
solana-keygen new  # Si vous n'avez pas de wallet
```

### Étape 3 : Build

```bash
# Build automatique
chmod +x scripts/build.sh
./scripts/build.sh devnet
```

### Étape 4 : Tests

```bash
# Tester les programmes
anchor test
```

### Étape 5 : Lancement

```bash
# Terminal 1 : Oracle
cd oracle && npm run dev

# Terminal 2 : Frontend
cd app && npm run dev
```

Ouvrez http://localhost:3000 🎉

## Commandes Utiles

```bash
# Build programmes
anchor build

# Deploy devnet
anchor deploy --provider.cluster devnet

# Tests
anchor test

# Clean
anchor clean

# Check programs
solana program show <PROGRAM_ID> --url devnet
```

## Prochaines Étapes

1. Lisez le [README.md](README.md) complet
2. Consultez [docs/BUILD.md](docs/BUILD.md) pour plus de détails
3. Explorez [docs/TECHNICAL.md](docs/TECHNICAL.md) pour l'architecture

## Aide

- Discord : https://discord.gg/swapback
- Issues : https://github.com/BacBacta/SwapBack/issues

Bon développement ! 🚀
