#!/bin/bash

# Script d'initialisation du projet SwapBack
# À exécuter après le clone du repository

set -e

echo "🚀 Initialisation du projet SwapBack..."

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Fonction pour afficher les étapes
step() {
    echo -e "${BLUE}▶ $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# 1. Vérification des prérequis
step "Vérification des prérequis..."

check_command() {
    if command -v $1 &> /dev/null; then
        VERSION=$($1 --version 2>&1 | head -n 1)
        success "$1 installé: $VERSION"
        return 0
    else
        error "$1 n'est pas installé"
        return 1
    fi
}

PREREQS_OK=true

check_command node || PREREQS_OK=false
check_command rustc || PREREQS_OK=false
check_command solana || PREREQS_OK=false
check_command anchor || PREREQS_OK=false

if [ "$PREREQS_OK" = false ]; then
    error "Certains prérequis ne sont pas installés. Consultez docs/BUILD.md"
    exit 1
fi

# 2. Installation des dépendances
step "Installation des dépendances racine..."
npm install
success "Dépendances racine installées"

step "Installation des dépendances app..."
cd app && npm install && cd ..
success "Dépendances app installées"

step "Installation des dépendances sdk..."
cd sdk && npm install && cd ..
success "Dépendances sdk installées"

step "Installation des dépendances oracle..."
cd oracle && npm install && cd ..
success "Dépendances oracle installées"

# 3. Configuration Solana
step "Configuration Solana..."

if [ ! -f ~/.config/solana/id.json ]; then
    warning "Pas de wallet Solana détecté"
    read -p "Voulez-vous créer un nouveau wallet ? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        solana-keygen new
        success "Wallet créé"
    fi
fi

solana config set --url devnet
success "Configuration Solana définie sur devnet"

BALANCE=$(solana balance 2>&1)
echo "Balance actuelle: $BALANCE"

if [[ $BALANCE == "0 SOL" ]]; then
    warning "Balance insuffisante. Airdrop de 2 SOL..."
    solana airdrop 2
    success "Airdrop réussi"
fi

# 4. Configuration environnement
step "Configuration des variables d'environnement..."

if [ ! -f .env ]; then
    cp .env.example .env
    success "Fichier .env créé"
    warning "N'oubliez pas de configurer les variables dans .env"
else
    warning ".env existe déjà, pas de modification"
fi

# 5. Build initial
step "Build initial des programmes..."

if anchor build; then
    success "Build Anchor réussi"
    
    # Afficher les program IDs
    echo ""
    echo "Program IDs générés:"
    echo "-------------------"
    if [ -f target/deploy/swapback_router-keypair.json ]; then
        ROUTER_ID=$(solana address -k target/deploy/swapback_router-keypair.json)
        echo "Router:  $ROUTER_ID"
    fi
    if [ -f target/deploy/swapback_buyback-keypair.json ]; then
        BUYBACK_ID=$(solana address -k target/deploy/swapback_buyback-keypair.json)
        echo "Buyback: $BUYBACK_ID"
    fi
else
    warning "Build Anchor a échoué (normal si c'est la première fois)"
    warning "Consultez les erreurs ci-dessus"
fi

# 6. Résumé
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Initialisation terminée !${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Prochaines étapes:"
echo "1. Consultez QUICKSTART.md pour démarrer"
echo "2. Lancez les tests: anchor test"
echo "3. Consultez ROADMAP.md pour le plan complet"
echo ""
echo "Commandes utiles:"
echo "  anchor build      - Build les programmes"
echo "  anchor test       - Exécuter les tests"
echo "  anchor deploy     - Déployer sur devnet"
echo ""
echo "Lancer le projet:"
echo "  Terminal 1: cd oracle && npm run dev"
echo "  Terminal 2: cd app && npm run dev"
echo ""
echo -e "${BLUE}Bon développement ! 🚀${NC}"
