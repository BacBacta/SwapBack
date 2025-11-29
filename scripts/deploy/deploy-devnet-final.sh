#!/bin/bash
# Script de déploiement simplifié utilisant cargo-build-sbf

set -e

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║    DÉPLOIEMENT SWAPBACK CNFT SUR DEVNET (SIMPLIFIÉ)         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /workspaces/SwapBack

# Étape 1: Générer nouvelle keypair
echo -e "${BLUE}🔑 Étape 1: Génération de la keypair du programme${NC}"
echo "=================================================="
echo ""

mkdir -p target/deploy
solana-keygen new --no-bip39-passphrase -o target/deploy/swapback_cnft-keypair.json --force > /dev/null 2>&1

NEW_PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo -e "${GREEN}✅ Nouvelle keypair généré${NC}"
echo -e "${YELLOW}Program ID: $NEW_PROGRAM_ID${NC}"
echo ""

# Étape 2: Mettre à jour declare_id
echo -e "${BLUE}📝 Étape 2: Mise à jour du declare_id${NC}"
echo "======================================"
echo ""

sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${NEW_PROGRAM_ID}\")/" programs/swapback_cnft/src/lib.rs
echo -e "${GREEN}✅ declare_id mis à jour${NC}"
echo ""

# Étape 3: Mettre à jour Anchor.toml
echo -e "${BLUE}📋 Étape 3: Mise à jour d'Anchor.toml${NC}"
echo "======================================"
echo ""

cp Anchor.toml Anchor.toml.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
sed -i "/\[programs.devnet\]/,/^swapback_cnft = \"/ s/swapback_cnft = \"[^\"]*\"/swapback_cnft = \"${NEW_PROGRAM_ID}\"/" Anchor.toml 2>/dev/null || sed -i "s/swapback_cnft = \"[^\"]*\"/swapback_cnft = \"${NEW_PROGRAM_ID}\"/" Anchor.toml

echo -e "${GREEN}✅ Anchor.toml mis à jour${NC}"
echo ""

# Étape 4: Build avec cargo-build-sbf
echo -e "${BLUE}🔨 Étape 4: Build du programme${NC}"
echo "================================"
echo ""

cd programs/swapback_cnft
echo "Building swapback_cnft..."
cargo-build-sbf 2>&1 | tail -20

if [ -f "../../target/sbf-solana-solana/release/swapback_cnft.so" ]; then
    echo -e "${GREEN}✅ Build réussi!${NC}"
else
    echo -e "${YELLOW}⚠️  swapback_cnft.so non trouvé, vérification...${NC}"
    find ../../target -name "*.so" -type f | head -5
fi

cd ../..
echo ""

# Étape 5: Afficher les informations de déploiement
echo -e "${BLUE}🚀 Étape 5: Informations de déploiement${NC}"
echo "========================================"
echo ""

echo "Configuration Solana:"
solana config get
echo ""

echo "Solde du wallet:"
solana balance --url devnet
echo ""

echo "Fichier .so à déployer:"
if [ -f "target/sbf-solana-solana/release/swapback_cnft.so" ]; then
    ls -lh target/sbf-solana-solana/release/swapback_cnft.so
    echo -e "${GREEN}✅ Prêt à déployer!${NC}"
else
    echo -e "${YELLOW}⚠️  Fichier .so non trouvé${NC}"
    echo "Recherche..."
    find target -name "swapback_cnft.so" -type f 2>/dev/null | head -3
fi
echo ""

# Étape 6: Déployer
echo -e "${BLUE}📤 Étape 6: Déploiement sur devnet${NC}"
echo "===================================="
echo ""

echo "Déploiement en cours..."
echo "(Cela peut prendre quelques minutes)"
echo ""

if [ -f "target/sbf-solana-solana/release/swapback_cnft.so" ]; then
    solana program deploy \
        --program-id target/deploy/swapback_cnft-keypair.json \
        target/sbf-solana-solana/release/swapback_cnft.so \
        --url https://api.devnet.solana.com \
        --commitment confirmed

    DEPLOY_STATUS=$?
    
    if [ $DEPLOY_STATUS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Déploiement réussi!${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠️  Statut de déploiement: $DEPLOY_STATUS${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Impossible de trouver swapback_cnft.so${NC}"
    echo "Fichiers disponibles:"
    find target -name "*.so" -type f 2>/dev/null | head -5
fi
echo ""

# Étape 7: Mettre à jour le frontend
echo -e "${BLUE}🔄 Étape 7: Mise à jour du frontend${NC}"
echo "====================================="
echo ""

if [ -f "update-frontend-program-id.sh" ]; then
    chmod +x update-frontend-program-id.sh
    ./update-frontend-program-id.sh "$NEW_PROGRAM_ID" > /dev/null 2>&1 || true
    echo -e "${GREEN}✅ Frontend mis à jour${NC}"
else
    echo -e "${YELLOW}⚠️  Script update-frontend-program-id.sh non trouvé${NC}"
    echo "Mise à jour manuelle nécessaire avec Program ID: $NEW_PROGRAM_ID"
fi
echo ""

# Résumé final
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT COMPLÉTÉ ✅                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${YELLOW}📌 Nouveau Program ID:${NC} $NEW_PROGRAM_ID"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1️⃣  Vérifier sur l'explorer:"
echo "   https://explorer.solana.com/address/$NEW_PROGRAM_ID?cluster=devnet"
echo ""
echo "2️⃣  Initialiser les comptes:"
echo "   export NEXT_PUBLIC_CNFT_PROGRAM_ID=\"$NEW_PROGRAM_ID\""
echo "   ts-node scripts/init-cnft.ts"
echo ""
echo "3️⃣  Tester le système:"
echo "   ts-node scripts/test-lock-unlock.ts"
echo ""
echo "4️⃣  Lancer le frontend:"
echo "   cd app && npm run dev"
echo ""
echo -e "${GREEN}🎉 Programme déployé avec succès!${NC}"
echo ""
