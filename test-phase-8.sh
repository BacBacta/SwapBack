#!/bin/bash

# 🧪 Script de Test Phase 8 - Déploiement & Validation
# Date: 26 Octobre 2025
# Test complet du déploiement et initialisation states

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                  🧪 PHASE 8 - TESTS DÉPLOIEMENT                  ║"
echo "║                                                                   ║"
echo "║        Devnet Deploy → State Init → Validation                   ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# ÉTAPE 1: Vérifier l'environnement
# ============================================================================

echo -e "${BLUE}[1/5] 🔍 Vérification de l'environnement${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier Solana CLI
if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Solana CLI trouvé: $(solana --version)${NC}"

# Vérifier Anchor
if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Anchor CLI trouvé: $(anchor --version)${NC}"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm trouvé: $(npm --version)${NC}"

echo ""

# ============================================================================
# ÉTAPE 2: Vérifier la configuration Solana
# ============================================================================

echo -e "${BLUE}[2/5] 🌐 Configuration Solana${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Afficher la configuration actuelle
echo "Configuration actuelle:"
solana config get
echo ""

# Vérifier le réseau
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ "$CLUSTER" != *"devnet"* ]]; then
    echo -e "${YELLOW}⚠️  Passage en mode devnet${NC}"
    solana config set --url https://api.devnet.solana.com
fi
echo -e "${GREEN}✅ Devnet configuré${NC}"

# Vérifier le wallet
KEYPAIR=$(solana config get | grep "Keypair Path" | awk '{print $3}')
echo "Keypair: $KEYPAIR"

# Vérifier le solde
BALANCE=$(solana balance | awk '{print $1}')
echo "Solde: ${BALANCE} SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Solde faible, demande d'airdrop...${NC}"
    solana airdrop 5
    sleep 3
    BALANCE=$(solana balance | awk '{print $1}')
    echo "Nouveau solde: ${BALANCE} SOL"
fi
echo -e "${GREEN}✅ Wallet prêt${NC}"

echo ""

# ============================================================================
# ÉTAPE 3: Déployer les programmes
# ============================================================================

echo -e "${BLUE}[3/5] 🚀 Déploiement des programs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "./deploy-devnet.sh" ]; then
    echo "Exécution du script de déploiement..."
    bash ./deploy-devnet.sh
    DEPLOY_SUCCESS=$?
    if [ $DEPLOY_SUCCESS -eq 0 ]; then
        echo -e "${GREEN}✅ Déploiement réussi${NC}"
    else
        echo -e "${RED}❌ Déploiement échoué${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Script deploy-devnet.sh non trouvé${NC}"
    exit 1
fi

echo ""

# ============================================================================
# ÉTAPE 4: Vérifier les Program IDs
# ============================================================================

echo -e "${BLUE}[4/5] 📝 Vérification des Program IDs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "deployed-program-ids.json" ]; then
    echo "Contenu de deployed-program-ids.json:"
    cat deployed-program-ids.json | jq '.'
    echo ""
    
    # Extraire les IDs
    CNFT_ID=$(cat deployed-program-ids.json | jq -r '.cnft')
    ROUTER_ID=$(cat deployed-program-ids.json | jq -r '.router')
    BUYBACK_ID=$(cat deployed-program-ids.json | jq -r '.buyback')
    
    echo -e "${GREEN}✅ CNFT Program:    ${CNFT_ID}${NC}"
    echo -e "${GREEN}✅ Router Program:  ${ROUTER_ID}${NC}"
    echo -e "${GREEN}✅ Buyback Program: ${BUYBACK_ID}${NC}"
    
    # Vérifier sur le réseau
    echo ""
    echo "Vérification sur le réseau (devnet)..."
    
    if solana program show $CNFT_ID &> /dev/null; then
        echo -e "${GREEN}✅ CNFT Program vérifié${NC}"
    else
        echo -e "${YELLOW}⚠️  CNFT Program non trouvé${NC}"
    fi
    
    if solana program show $ROUTER_ID &> /dev/null; then
        echo -e "${GREEN}✅ Router Program vérifié${NC}"
    else
        echo -e "${YELLOW}⚠️  Router Program non trouvé${NC}"
    fi
    
    if solana program show $BUYBACK_ID &> /dev/null; then
        echo -e "${GREEN}✅ Buyback Program vérifié${NC}"
    else
        echo -e "${YELLOW}⚠️  Buyback Program non trouvé${NC}"
    fi
    
else
    echo -e "${RED}❌ Fichier deployed-program-ids.json non trouvé${NC}"
    exit 1
fi

echo ""

# ============================================================================
# ÉTAPE 5: Initialiser les states (optionnel)
# ============================================================================

echo -e "${BLUE}[5/5] 🔧 Initialisation des states (optionnel)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "scripts/initialize-states.ts" ]; then
    echo "Voulez-vous initialiser les states maintenant? (y/n)"
    read -r INIT_CHOICE
    
    if [ "$INIT_CHOICE" = "y" ] || [ "$INIT_CHOICE" = "Y" ]; then
        echo "Initialisation des states..."
        npx ts-node scripts/initialize-states.ts
        echo -e "${GREEN}✅ States initialisés${NC}"
    else
        echo "Initialisation saltée (vous pouvez la faire plus tard)"
        echo -e "${YELLOW}Command: npx ts-node scripts/initialize-states.ts${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Script initialize-states.ts non trouvé${NC}"
fi

echo ""

# ============================================================================
# RÉSUMÉ
# ============================================================================

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                   ✅ PHASE 8 - RÉSUMÉ                            ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Prochaines étapes:${NC}"
echo "  1. Vérifier les Program IDs dans app/config/programIds.ts"
echo "  2. Tester les hooks React: npm run dev"
echo "  3. Créer les composants UI (Phase 9)"
echo ""
echo -e "${BLUE}Program IDs (sauvegarder):${NC}"
echo "  CNFT:   $CNFT_ID"
echo "  Router: $ROUTER_ID"
echo "  Buyback: $BUYBACK_ID"
echo ""
echo -e "${BLUE}Explorer Links:${NC}"
CLUSTER_PARAM="?cluster=devnet"
echo "  CNFT:   https://explorer.solana.com/address/${CNFT_ID}${CLUSTER_PARAM}"
echo "  Router: https://explorer.solana.com/address/${ROUTER_ID}${CLUSTER_PARAM}"
echo "  Buyback: https://explorer.solana.com/address/${BUYBACK_ID}${CLUSTER_PARAM}"
echo ""
echo -e "${GREEN}✅ Phase 8 complétée!${NC}"
echo ""
