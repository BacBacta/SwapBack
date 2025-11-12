#!/bin/bash
set -e

echo "🚀 =================================================="
echo "🚀 INSTALLATION PROPRE FROM SCRATCH"
echo "🚀 =================================================="
echo ""

# ==================================================
# CONFIGURATION DES VERSIONS
# ==================================================
RUST_VERSION="1.75.0"
SOLANA_VERSION="1.18.26"
ANCHOR_VERSION="0.30.1"

echo "📦 Versions à installer :"
echo "  • Rust:   $RUST_VERSION   (compatible avec time crate)"
echo "  • Solana: $SOLANA_VERSION (stable pour Anchor 0.30.1)"
echo "  • Anchor: $ANCHOR_VERSION (dernière version stable)"
echo ""
echo "⏱️  Temps estimé : 10-15 minutes"
echo ""
read -p "Continuer ? (y/n) : " confirm

if [ "$confirm" != "y" ]; then
    echo "❌ Installation annulée"
    exit 1
fi

# ==================================================
# ÉTAPE 1 : INSTALLATION DE RUST
# ==================================================
echo ""
echo "🦀 [1/5] Installation de Rust $RUST_VERSION..."
echo ""

# Définir les variables pour l'installation utilisateur
export RUSTUP_HOME="$HOME/.rustup"
export CARGO_HOME="$HOME/.cargo"

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- \
    -y \
    --default-toolchain $RUST_VERSION \
    --profile minimal \
    --no-modify-path

# Charger l'environnement Rust
export PATH="$HOME/.cargo/bin:$PATH"
source "$HOME/.cargo/env"

# Installer les composants nécessaires
rustup component add rustfmt clippy

# Vérification
echo ""
echo "✅ Rust installé :"
rustc --version
cargo --version
echo ""

# ==================================================
# ÉTAPE 2 : INSTALLATION DE SOLANA CLI
# ==================================================
echo ""
echo "☀️  [2/5] Installation de Solana CLI $SOLANA_VERSION..."
echo ""

sh -c "$(curl -sSfL https://release.solana.com/v$SOLANA_VERSION/install)"

# Ajouter au PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Configuration devnet
solana config set --url devnet

# Générer une keypair si elle n'existe pas
if [ ! -f ~/.config/solana/id.json ]; then
    echo "  → Génération d'une nouvelle keypair Solana..."
    solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
fi

# Vérification
echo ""
echo "✅ Solana CLI installé :"
solana --version
solana-keygen --version
cargo-build-sbf --version
echo ""

# ==================================================
# ÉTAPE 3 : INSTALLATION D'ANCHOR CLI
# ==================================================
echo ""
echo "⚓ [3/5] Installation d'Anchor CLI $ANCHOR_VERSION..."
echo ""
echo "  ⏳ Cette étape peut prendre 5-10 minutes..."
echo ""

# Installer via cargo (méthode la plus fiable)
cargo install --git https://github.com/coral-xyz/anchor \
    --tag v$ANCHOR_VERSION \
    anchor-cli \
    --locked \
    --force

# Vérification
echo ""
echo "✅ Anchor CLI installé :"
anchor --version
echo ""

# ==================================================
# ÉTAPE 4 : INSTALLATION DES DÉPENDANCES NODE.JS
# ==================================================
echo ""
echo "📦 [4/5] Installation des dépendances Node.js..."
echo ""

cd /workspaces/SwapBack/app

if [ -f "package.json" ]; then
    npm install
    echo "✅ Dépendances Node.js installées"
else
    echo "⚠️  package.json introuvable - skip"
fi

echo ""

# ==================================================
# ÉTAPE 5 : CONFIGURATION DU PROJET
# ==================================================
echo ""
echo "⚙️  [5/5] Configuration du projet SwapBack..."
echo ""

cd /workspaces/SwapBack

# Créer les répertoires nécessaires
mkdir -p target/deploy
mkdir -p .anchor

# Vérifier que la keypair du programme existe
CNFT_KEYPAIR="target/deploy/swapback_cnft-keypair.json"
if [ ! -f "$CNFT_KEYPAIR" ]; then
    echo "  ⚠️  Keypair du programme CNFT manquante"
    echo "  → Génération d'une nouvelle keypair..."
    solana-keygen new --no-bip39-passphrase -o "$CNFT_KEYPAIR"
    PROGRAM_ID=$(solana-keygen pubkey "$CNFT_KEYPAIR")
    echo "  ✅ Nouvelle keypair créée"
    echo "  → Program ID: $PROGRAM_ID"
    echo ""
    echo "  ⚠️  IMPORTANT : Mettez à jour ce Program ID dans :"
    echo "      - programs/swapback_cnft/src/lib.rs (declare_id)"
    echo "      - Anchor.toml ([programs.devnet])"
    echo "      - app/src/idl/swapback_cnft.json"
    echo "      - app/.env.local (NEXT_PUBLIC_CNFT_PROGRAM_ID)"
else
    echo "  ✅ Keypair du programme CNFT présente"
    # Afficher l'adresse
    PROGRAM_ID=$(solana-keygen pubkey "$CNFT_KEYPAIR")
    echo "  → Program ID: $PROGRAM_ID"
fi

# Créer un fichier .env.local si inexistant
if [ ! -f "app/.env.local" ]; then
    echo "  → Création de app/.env.local..."
    cat > app/.env.local << EOF
# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Program IDs
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_CNFT_PROGRAM_ID=$PROGRAM_ID

# Token
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR

# Infrastructure
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom

# Fees
NEXT_PUBLIC_PLATFORM_FEE_BPS=20
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=0.20
EOF
    echo "  ✅ .env.local créé"
else
    echo "  ✅ .env.local existe déjà"
fi

echo ""

# ==================================================
# RÉSUMÉ FINAL
# ==================================================
echo ""
echo "🎉 =================================================="
echo "🎉 INSTALLATION TERMINÉE AVEC SUCCÈS !"
echo "🎉 =================================================="
echo ""
echo "📊 Récapitulatif des versions installées :"
echo ""
rustc --version
cargo --version
solana --version
cargo-build-sbf --version | head -n 2
anchor --version
node --version
npm --version
echo ""
echo "📁 Répertoires créés :"
echo "  • ~/.rustup"
echo "  • ~/.cargo"
echo "  • ~/.local/share/solana"
echo "  • ~/.config/solana"
echo "  • /workspaces/SwapBack/target"
echo "  • /workspaces/SwapBack/.anchor"
echo ""
echo "🎯 Prochaines étapes :"
echo ""
echo "  1. Compiler le programme :"
echo "     anchor build -p swapback_cnft"
echo ""
echo "  2. Déployer sur devnet :"
echo "     anchor deploy --provider.cluster devnet --program-name swapback_cnft"
echo ""
echo "  3. Mettre à jour l'IDL dans app/src/idl/"
echo ""
echo "  4. Lancer le frontend :"
echo "     cd app && npm run dev"
echo ""
echo "✅ Votre environnement est maintenant propre et prêt !"
echo ""
