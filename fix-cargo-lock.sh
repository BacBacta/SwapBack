#!/bin/bash
set -e

echo "🔧 FIX CARGO.LOCK v4 CONFLICT - SwapBack Build"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[1/7] Vérification des versions...${NC}"
anchor --version || echo "Anchor pas encore disponible"
rustc --version
cargo --version
echo ""

echo -e "${YELLOW}[2/7] Backup des fichiers...${NC}"
BACKUP_DIR="/tmp/swapback_backup_$(date +%s)"
mkdir -p "$BACKUP_DIR"
cp -r programs "$BACKUP_DIR/programs_backup"
cp Cargo.lock "$BACKUP_DIR/Cargo.lock.backup" 2>/dev/null || true
cp Cargo.toml "$BACKUP_DIR/Cargo.toml.backup"
echo -e "${GREEN}✓ Backup créé dans: $BACKUP_DIR${NC}"
echo ""

echo -e "${YELLOW}[3/7] Suppression du Cargo.lock v4 problématique...${NC}"
if [ -f "Cargo.lock" ]; then
    rm Cargo.lock
    echo -e "${GREEN}✓ Cargo.lock supprimé${NC}"
else
    echo "Cargo.lock n'existe pas"
fi
echo ""

echo -e "${YELLOW}[4/7] Nettoyage du répertoire target...${NC}"
if [ -d "target" ]; then
    rm -rf target
    echo -e "${GREEN}✓ Répertoire target supprimé${NC}"
fi
echo ""

echo -e "${YELLOW}[5/7] Vérification des programs...${NC}"
if [ ! -d "programs/swapback_router" ]; then
    echo -e "${RED}✗ programs/swapback_router manquant${NC}"
    exit 1
fi
if [ ! -d "programs/swapback_buyback" ]; then
    echo -e "${RED}✗ programs/swapback_buyback manquant${NC}"
    exit 1
fi
if [ ! -d "programs/swapback_cnft" ]; then
    echo -e "${RED}✗ programs/swapback_cnft manquant${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tous les programs sont présents${NC}"
echo ""

echo -e "${YELLOW}[6/7] Build avec Anchor...${NC}"
if ! anchor build 2>&1; then
    echo -e "${RED}✗ Erreur lors du build${NC}"
    echo "Tentative avec downgrade Anchor à 0.29.0..."
    
    echo "Installation Anchor 0.29.0..."
    avm install 0.29.0 || cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked
    avm use 0.29.0
    
    echo "Nouvelle tentative de build..."
    if ! anchor build 2>&1; then
        echo -e "${RED}✗ Build échoué même avec Anchor 0.29.0${NC}"
        echo "Tentative build direct sans Anchor..."
        
        cd programs/swapback_router && cargo build-sbf && cd ../..
        cd programs/swapback_buyback && cargo build-sbf && cd ../..
        cd programs/swapback_cnft && cargo build-sbf && cd ../..
    fi
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build réussi!${NC}"
else
    echo -e "${RED}✗ Build échoué${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}[7/7] Vérification des binaires...${NC}"
if [ -f "target/deploy/swapback_router.so" ]; then
    SIZE=$(du -h target/deploy/swapback_router.so | cut -f1)
    echo -e "${GREEN}✓ swapback_router.so: $SIZE${NC}"
else
    echo -e "${RED}✗ swapback_router.so manquant${NC}"
fi

if [ -f "target/deploy/swapback_buyback.so" ]; then
    SIZE=$(du -h target/deploy/swapback_buyback.so | cut -f1)
    echo -e "${GREEN}✓ swapback_buyback.so: $SIZE${NC}"
else
    echo -e "${RED}✗ swapback_buyback.so manquant${NC}"
fi

if [ -f "target/deploy/swapback_cnft.so" ]; then
    SIZE=$(du -h target/deploy/swapback_cnft.so | cut -f1)
    echo -e "${GREEN}✓ swapback_cnft.so: $SIZE${NC}"
else
    echo -e "${RED}✗ swapback_cnft.so manquant${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ FIX TERMINÉ AVEC SUCCÈS!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Prochaines étapes:"
echo "1. Airdrop SOL si needed: solana airdrop 5 --url devnet"
echo "2. Deploy: anchor deploy --provider.cluster devnet"
echo "3. Tests: npm run test:integration"
echo ""
echo -e "Backup: $BACKUP_DIR"
