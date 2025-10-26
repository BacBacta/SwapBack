#!/bin/bash

# 🚀 Script de Déploiement Devnet - Système de Boost SwapBack
# Date: 26 Octobre 2025
# Version: 1.0.0

set -e

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║         🚀 DÉPLOIEMENT DEVNET - SYSTÈME DE BOOST                 ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que nous sommes sur le bon réseau
echo -e "${BLUE}📡 Vérification de la configuration Solana...${NC}"
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ "$CURRENT_CLUSTER" != *"devnet"* ]]; then
    echo -e "${YELLOW}⚠️  Configuration sur mainnet/localnet détectée${NC}"
    echo -e "${YELLOW}Passage en mode devnet...${NC}"
    solana config set --url https://api.devnet.solana.com
fi
echo -e "${GREEN}✅ Connecté à devnet${NC}"
echo ""

# Vérifier le solde du wallet
echo -e "${BLUE}💰 Vérification du solde du wallet...${NC}"
BALANCE=$(solana balance | awk '{print $1}')
MIN_BALANCE=2.0

if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Solde insuffisant: ${BALANCE} SOL${NC}"
    echo -e "${YELLOW}Demande d'airdrop...${NC}"
    solana airdrop 5
    sleep 3
    BALANCE=$(solana balance | awk '{print $1}')
fi
echo -e "${GREEN}✅ Solde: ${BALANCE} SOL${NC}"
echo ""

# Build des programmes
echo -e "${BLUE}🔨 Build des programmes Anchor...${NC}"
echo ""

echo -e "${YELLOW}Building swapback_cnft...${NC}"
anchor build -p swapback_cnft
echo -e "${GREEN}✅ swapback_cnft compilé${NC}"

echo -e "${YELLOW}Building swapback_router...${NC}"
anchor build -p swapback_router
echo -e "${GREEN}✅ swapback_router compilé${NC}"

echo -e "${YELLOW}Building swapback_buyback...${NC}"
anchor build -p swapback_buyback
echo -e "${GREEN}✅ swapback_buyback compilé${NC}"
echo ""

# Déploiement des programmes
echo -e "${BLUE}🚀 Déploiement sur devnet...${NC}"
echo ""

echo -e "${YELLOW}Déploiement de swapback_cnft...${NC}"
CNFT_DEPLOY=$(anchor deploy -p swapback_cnft --provider.cluster devnet 2>&1)
CNFT_PROGRAM_ID=$(echo "$CNFT_DEPLOY" | grep "Program Id:" | awk '{print $3}')
echo -e "${GREEN}✅ swapback_cnft déployé: ${CNFT_PROGRAM_ID}${NC}"

echo -e "${YELLOW}Déploiement de swapback_router...${NC}"
ROUTER_DEPLOY=$(anchor deploy -p swapback_router --provider.cluster devnet 2>&1)
ROUTER_PROGRAM_ID=$(echo "$ROUTER_DEPLOY" | grep "Program Id:" | awk '{print $3}')
echo -e "${GREEN}✅ swapback_router déployé: ${ROUTER_PROGRAM_ID}${NC}"

echo -e "${YELLOW}Déploiement de swapback_buyback...${NC}"
BUYBACK_DEPLOY=$(anchor deploy -p swapback_buyback --provider.cluster devnet 2>&1)
BUYBACK_PROGRAM_ID=$(echo "$BUYBACK_DEPLOY" | grep "Program Id:" | awk '{print $3}')
echo -e "${GREEN}✅ swapback_buyback déployé: ${BUYBACK_PROGRAM_ID}${NC}"
echo ""

# Sauvegarder les Program IDs
echo -e "${BLUE}💾 Sauvegarde des Program IDs...${NC}"
cat > deployed-program-ids.json << EOF
{
  "network": "devnet",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "programs": {
    "swapback_cnft": "${CNFT_PROGRAM_ID}",
    "swapback_router": "${ROUTER_PROGRAM_ID}",
    "swapback_buyback": "${BUYBACK_PROGRAM_ID}"
  }
}
EOF
echo -e "${GREEN}✅ Program IDs sauvegardés dans deployed-program-ids.json${NC}"
echo ""

# Vérification des déploiements
echo -e "${BLUE}🔍 Vérification des déploiements...${NC}"
echo ""

solana program show ${CNFT_PROGRAM_ID} --url devnet | grep "Program Id\|Owner\|Data Length"
echo ""
solana program show ${ROUTER_PROGRAM_ID} --url devnet | grep "Program Id\|Owner\|Data Length"
echo ""
solana program show ${BUYBACK_PROGRAM_ID} --url devnet | grep "Program Id\|Owner\|Data Length"
echo ""

# Initialisation des states (optionnel - nécessite un script TS)
echo -e "${YELLOW}⚠️  IMPORTANT: Initialisation des states requise${NC}"
echo ""
echo -e "${YELLOW}Pour initialiser les states, exécutez:${NC}"
echo -e "${YELLOW}  node scripts/initialize-states.js${NC}"
echo ""
echo -e "Les comptes à initialiser:"
echo -e "  • GlobalState (swapback_cnft)"
echo -e "  • RouterState (swapback_router)"
echo -e "  • BuybackState (swapback_buyback)"
echo ""

# Résumé final
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DÉPLOIEMENT RÉUSSI !                        ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📊 Résumé du déploiement:${NC}"
echo ""
echo "Network: devnet"
echo "Cluster: https://api.devnet.solana.com"
echo ""
echo "Program IDs:"
echo "  swapback_cnft:    ${CNFT_PROGRAM_ID}"
echo "  swapback_router:  ${ROUTER_PROGRAM_ID}"
echo "  swapback_buyback: ${BUYBACK_PROGRAM_ID}"
echo ""
echo -e "${BLUE}🔗 Explorer Links:${NC}"
echo "  https://explorer.solana.com/address/${CNFT_PROGRAM_ID}?cluster=devnet"
echo "  https://explorer.solana.com/address/${ROUTER_PROGRAM_ID}?cluster=devnet"
echo "  https://explorer.solana.com/address/${BUYBACK_PROGRAM_ID}?cluster=devnet"
echo ""
echo -e "${YELLOW}📝 Prochaines étapes:${NC}"
echo "  1. Initialiser les states avec: node scripts/initialize-states.js"
echo "  2. Tester avec: npm run test:boost-full"
echo "  3. Mettre à jour app/config/programIds.ts avec les nouveaux IDs"
echo ""
echo "🎉 Système de boost prêt pour les tests devnet !"
echo ""
