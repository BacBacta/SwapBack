#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║              🧪 LANCEMENT DES TESTS E2E - BUYBACK SYSTEM             ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier si on est sur devnet
echo -e "${BLUE}📡 Vérification de la configuration Solana...${NC}"
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "   Cluster actuel: $CURRENT_CLUSTER"

if [[ ! "$CURRENT_CLUSTER" =~ "devnet" ]]; then
    echo -e "${YELLOW}⚠️  Attention: Vous n'êtes pas sur devnet${NC}"
    echo -e "${YELLOW}   Les tests E2E sont conçus pour devnet${NC}"
    read -p "   Voulez-vous continuer quand même? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Tests annulés${NC}"
        exit 1
    fi
fi

# Vérifier le wallet
echo ""
echo -e "${BLUE}💰 Vérification du wallet...${NC}"
WALLET_PUBKEY=$(solana address)
BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo "   Wallet: $WALLET_PUBKEY"
echo "   Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
    echo -e "${RED}❌ Balance insuffisante (minimum 0.5 SOL requis)${NC}"
    echo -e "${YELLOW}💡 Obtenir des SOL devnet:${NC}"
    echo "   solana airdrop 2 --url devnet"
    exit 1
fi

# Vérifier le programme
echo ""
echo -e "${BLUE}🔍 Vérification du programme buyback...${NC}"
PROGRAM_ID="92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir"
PROGRAM_INFO=$(solana program show $PROGRAM_ID --url devnet 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✓ Programme trouvé: $PROGRAM_ID${NC}"
else
    echo -e "${RED}   ❌ Programme non trouvé sur devnet${NC}"
    echo -e "${YELLOW}   💡 Déployez d'abord le programme:${NC}"
    echo "      anchor deploy --provider.cluster devnet"
    exit 1
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${BLUE}📦 Installation des dépendances...${NC}"
    npm install
fi

# Compiler TypeScript si nécessaire
echo ""
echo -e "${BLUE}🔨 Compilation TypeScript...${NC}"
npx tsc --noEmit tests/e2e/buyback-flow.test.ts 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}   ⚠️ Erreurs de compilation détectées (non bloquant)${NC}"
fi

# Lancer les tests E2E
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🚀 LANCEMENT DES TESTS E2E${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Exécuter les tests avec vitest
npx vitest run tests/e2e/buyback-flow.test.ts --reporter=verbose

TEST_EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ TOUS LES TESTS E2E SONT PASSÉS AVEC SUCCÈS!${NC}"
else
    echo -e "${RED}❌ CERTAINS TESTS ONT ÉCHOUÉ${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Afficher les prochaines étapes
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${BLUE}📋 Prochaines étapes recommandées:${NC}"
    echo ""
    echo "   1️⃣  Vérifier les logs de transactions sur Solana Explorer"
    echo "   2️⃣  Tester l'interface UI en local"
    echo "       $ cd app && npm run dev"
    echo ""
    echo "   3️⃣  Intégrer avec le swap (dépôt automatique 25% fees)"
    echo "   4️⃣  Déployer sur mainnet après audit sécurité"
    echo ""
fi

exit $TEST_EXIT_CODE
