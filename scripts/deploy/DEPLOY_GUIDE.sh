#!/bin/bash
# GUIDE COMPLET POUR DÉPLOYER SUR DEVNET
# À exécuter sur VOTRE MACHINE LOCALE (pas dans le codespace)

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║    GUIDE DE DÉPLOIEMENT SWAPBACK CNFT SUR DEVNET            ║"
echo "║    À exécuter sur votre MACHINE LOCALE                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📋 PRÉREQUIS${NC}"
echo "=============="
echo "Avant de commencer, vérifiez que vous avez sur VOTRE MACHINE:"
echo ""
echo "1. Solana CLI (v1.18.26)"
echo "   Vérifier: solana --version"
echo "   Installer: sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.26/install)\""
echo ""
echo "2. Anchor CLI (v0.30.1)"
echo "   Vérifier: anchor --version"
echo "   Installer: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
echo "   Puis: avm install 0.30.1 && avm use 0.30.1"
echo ""
echo "3. Rust toolchain"
echo "   Vérifier: rustc --version"
echo "   Installer: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
echo ""
echo "4. Node.js (v18+)"
echo "   Vérifier: node --version && npm --version"
echo ""

read -p "Appuyez sur Entrée quand tout est installé..."
echo ""

# Étape 1: Vérifier l'installation
echo -e "${BLUE}🔍 Étape 1/6: Vérification des installations${NC}"
echo "=================================================="
echo ""

if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI non trouvé${NC}"
    echo "   Installer: sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.26/install)\""
    exit 1
fi
echo -e "${GREEN}✅${NC} Solana CLI: $(solana --version)"

if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI non trouvé${NC}"
    echo "   Installer: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    exit 1
fi
echo -e "${GREEN}✅${NC} Anchor CLI: $(anchor --version)"

if ! command -v rustc &> /dev/null; then
    echo -e "${RED}❌ Rust toolchain non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC} Rust: $(rustc --version)"

echo ""

# Étape 2: Configurer Solana pour devnet
echo -e "${BLUE}⚙️ Étape 2/6: Configuration Solana devnet${NC}"
echo "=============================================="
echo ""

echo "Définition du cluster devnet..."
solana config set --url https://api.devnet.solana.com

echo "Configuration actuelle:"
solana config get
echo ""

# Étape 3: Vérifier le wallet et le solde
echo -e "${BLUE}💰 Étape 3/6: Vérification du wallet${NC}"
echo "=========================================="
echo ""

WALLET=$(solana config get | grep "Keypair Path" | awk '{print $3}')
echo "Wallet: $WALLET"

BALANCE=$(solana balance)
echo "Solde: $BALANCE"
echo ""

BALANCE_LAMPORTS=$(solana balance --lamports)
if [ "$BALANCE_LAMPORTS" -lt 1000000000 ]; then
    echo -e "${YELLOW}⚠️  Solde faible (< 1 SOL)${NC}"
    echo "Vous avez besoin d'au moins 1 SOL pour déployer."
    echo ""
    echo "Pour obtenir des SOL devnet:"
    echo "   solana airdrop 2 --url devnet"
    echo ""
    read -p "Appuyez sur Entrée après avoir obtenu des SOL..."
fi
echo ""

# Étape 4: Cloner et préparer le repository
echo -e "${BLUE}📥 Étape 4/6: Préparation du projet${NC}"
echo "========================================"
echo ""

# Demander le chemin du projet
read -p "Chemin du projet SwapBack (ex: ~/projects/SwapBack): " PROJECT_PATH

if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${RED}❌ Dossier non trouvé: $PROJECT_PATH${NC}"
    exit 1
fi

cd "$PROJECT_PATH"
echo "📂 Projet: $(pwd)"
echo ""

# Vérifier les fichiers importants
if [ ! -f "rebuild-lock-unlock.sh" ]; then
    echo -e "${RED}❌ rebuild-lock-unlock.sh non trouvé${NC}"
    echo "Assurez-vous que vous êtes dans le répertoire SwapBack"
    exit 1
fi
echo -e "${GREEN}✅${NC} Scripts trouvés"

if [ ! -f "programs/swapback_cnft/src/lib.rs" ]; then
    echo -e "${RED}❌ Code Rust non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC} Code Rust trouvé"
echo ""

# Étape 5: Exécuter le script de déploiement
echo -e "${BLUE}🚀 Étape 5/6: Déploiement du programme${NC}"
echo "========================================="
echo ""
echo "Exécution de rebuild-lock-unlock.sh..."
echo "(Cela peut prendre 3-5 minutes)"
echo ""

chmod +x rebuild-lock-unlock.sh
./rebuild-lock-unlock.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors du déploiement${NC}"
    exit 1
fi

echo ""

# Étape 6: Mettre à jour le frontend
echo -e "${BLUE}🔄 Étape 6/6: Mise à jour du frontend${NC}"
echo "========================================"
echo ""

# Extraire le Program ID de Anchor.toml
PROGRAM_ID=$(grep -A 2 "\[programs.devnet\]" Anchor.toml | grep "swapback_cnft" | awk -F'"' '{print $2}')

if [ -z "$PROGRAM_ID" ]; then
    echo -e "${RED}❌ Impossible d'extraire le Program ID${NC}"
    exit 1
fi

echo -e "${YELLOW}Program ID: $PROGRAM_ID${NC}"
echo ""

read -p "Appuyez sur Entrée pour mettre à jour le frontend avec ce Program ID..."

chmod +x update-frontend-program-id.sh
./update-frontend-program-id.sh "$PROGRAM_ID"

echo ""

# Affichage du résumé
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT RÉUSSI ! ✅                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📌 Nouveau Program ID:${NC} $PROGRAM_ID"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1️⃣  Initialiser les comptes:"
echo "   ts-node scripts/init-cnft.ts"
echo ""
echo "2️⃣  Tester le système:"
echo "   ts-node scripts/test-lock-unlock.ts"
echo ""
echo "3️⃣  Lancer le frontend:"
echo "   cd app && npm run dev"
echo ""
echo "4️⃣  Vérifier sur l'explorer:"
echo "   https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo ""
echo "5️⃣  Monitorer les logs:"
echo "   solana logs --url devnet $PROGRAM_ID"
echo ""
echo -e "${GREEN}🎉 Votre programme cNFT est maintenant déployé sur devnet!${NC}"
echo ""
