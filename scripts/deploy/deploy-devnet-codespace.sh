#!/bin/bash
# Script complet de déploiement dans le codespace

set -e

# Ajouter les chemins au PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
export TMPDIR=/tmp
export CARGO_TARGET_DIR=/tmp/cargo-target
export RUSTFLAGS='-C target-cpu=generic -C opt-level=1'

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         DÉPLOIEMENT SWAPBACK CNFT SUR DEVNET                ║"
echo "║              Dans le Codespace                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Étape 1: Vérifier les outils
echo -e "${BLUE}📋 Étape 1: Vérification des outils${NC}"
echo "===================================="
echo ""

echo -e "${YELLOW}Solana:${NC}"
solana --version
echo ""

echo -e "${YELLOW}Rust:${NC}"
rustc --version
echo ""

echo -e "${YELLOW}Cargo:${NC}"
cargo --version
echo ""

# Étape 2: Vérifier la configuration Solana
echo -e "${BLUE}⚙️  Étape 2: Configuration Solana${NC}"
echo "=================================="
echo ""

solana config get
echo ""

# Étape 3: Vérifier le wallet et solde
echo -e "${BLUE}💰 Étape 3: Vérification du wallet${NC}"
echo "===================================="
echo ""

WALLET=$(solana config get | grep "Keypair Path" | awk '{print $3}')
echo "Wallet: $WALLET"

BALANCE=$(solana balance --url devnet)
echo "Solde: $BALANCE"
echo ""

# Vérifier si on a assez de SOL
BALANCE_LAMPORTS=$(solana balance --lamports --url devnet)
if [ "$BALANCE_LAMPORTS" -lt 500000000 ]; then
    echo -e "${YELLOW}⚠️  Solde faible (< 0.5 SOL)${NC}"
    echo "Tentative d'airdrop..."
    solana airdrop 2 --url devnet || echo "Airdrop échoué (rate limit)"
    echo ""
fi

# Étape 4: Build et déploiement
echo -e "${BLUE}🚀 Étape 4: Build et déploiement${NC}"
echo "=================================="
echo ""

cd /workspaces/SwapBack

# Vérifier que les fichiers existent
if [ ! -f "programs/swapback_cnft/src/lib.rs" ]; then
    echo -e "${RED}❌ Fichier lib.rs non trouvé${NC}"
    exit 1
fi

echo "📝 Vérification du code Rust..."
head -20 programs/swapback_cnft/src/lib.rs | grep "declare_id"
echo ""

echo "🔨 Build du programme..."
echo "(Cela peut prendre 5-10 minutes la première fois)"
echo ""

export TMPDIR=/tmp
export CARGO_TARGET_DIR=/tmp/cargo-target
export RUSTFLAGS='-C target-cpu=generic -C opt-level=1'

# Build seulement (sans déployer)
cargo build --release \
    --package swapback_cnft \
    --target sbf-solana-solana \
    2>&1 | tail -30

echo ""
echo -e "${GREEN}✅ Build réussi!${NC}"
echo ""

# Étape 5: Générer keypair du programme
echo -e "${BLUE}🔑 Étape 5: Génération de la keypair du programme${NC}"
echo "=================================================="
echo ""

mkdir -p target/deploy

solana-keygen new --no-bip39-passphrase -o target/deploy/swapback_cnft-keypair.json --force

NEW_PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo -e "${GREEN}✅ Nouvelle keypair générée${NC}"
echo -e "${YELLOW}📌 Nouveau Program ID: $NEW_PROGRAM_ID${NC}"
echo ""

# Étape 6: Mettre à jour le code avec le nouveau Program ID
echo -e "${BLUE}📝 Étape 6: Mise à jour du declare_id${NC}"
echo "======================================"
echo ""

sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${NEW_PROGRAM_ID}\")/" programs/swapback_cnft/src/lib.rs

# Vérifier
echo "Nouvelle déclaration:"
head -20 programs/swapback_cnft/src/lib.rs | grep "declare_id"
echo ""

# Étape 7: Mettre à jour Anchor.toml
echo -e "${BLUE}📋 Étape 7: Mise à jour d'Anchor.toml${NC}"
echo "======================================"
echo ""

cp Anchor.toml Anchor.toml.backup-$(date +%Y%m%d-%H%M%S)

sed -i "/\[programs.devnet\]/,/^swapback_cnft = \"/ s/swapback_cnft = \"[^\"]*\"/swapback_cnft = \"${NEW_PROGRAM_ID}\"/" Anchor.toml

# Vérifier
echo "Anchor.toml devnet:"
grep -A 5 "\[programs.devnet\]" Anchor.toml | head -6
echo ""

# Étape 8: Rebuilder avec le nouveau ID
echo -e "${BLUE}🔨 Étape 8: Rebuilder avec le nouveau Program ID${NC}"
echo "================================================="
echo ""

cargo build --release \
    --package swapback_cnft \
    --target sbf-solana-solana \
    2>&1 | tail -20

echo ""
echo -e "${GREEN}✅ Rebuild réussi!${NC}"
echo ""

# Étape 9: Déployer
echo -e "${BLUE}🚀 Étape 9: Déploiement sur devnet${NC}"
echo "==================================="
echo ""

echo "Déploiement en cours..."
solana deploy \
    --program-id target/deploy/swapback_cnft-keypair.json \
    target/sbf-solana-solana/release/swapback_cnft.so \
    --url https://api.devnet.solana.com

echo ""
echo -e "${GREEN}✅ Déploiement réussi!${NC}"
echo ""

# Étape 10: Mettre à jour le frontend
echo -e "${BLUE}🔄 Étape 10: Mise à jour du frontend${NC}"
echo "====================================="
echo ""

chmod +x update-frontend-program-id.sh
./update-frontend-program-id.sh "$NEW_PROGRAM_ID"

echo ""

# Affichage du résumé
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT RÉUSSI ! ✅                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📌 Nouveau Program ID: $NEW_PROGRAM_ID${NC}"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1️⃣  Initialiser les comptes:"
echo "   ts-node scripts/init-cnft.ts"
echo ""
echo "2️⃣  Tester le système:"
echo "   ts-node scripts/test-lock-unlock.ts"
echo ""
echo "3️⃣  Vérifier sur l'explorer:"
echo "   https://explorer.solana.com/address/$NEW_PROGRAM_ID?cluster=devnet"
echo ""
echo -e "${GREEN}🎉 Votre programme cNFT est maintenant déployé sur devnet!${NC}"
echo ""
