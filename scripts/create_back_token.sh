#!/bin/bash

# Script de création du token $BACK avec Transfer Hook
# Utilise Token-2022 avec extensions pour burn automatique

set -e

echo "🪙 Création du token \$BACK avec Transfer Hook"
echo "============================================="

# Configuration
TOKEN_NAME="SwapBack"
TOKEN_SYMBOL="BACK"
TOKEN_DECIMALS=9
TOTAL_SUPPLY=1000000000  # 1B tokens
METADATA_URI="https://arweave.net/abc123"  # À remplacer par vraie URI

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Vérifier les prérequis
echo -e "${BLUE}Vérification des prérequis...${NC}"

if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI non installé${NC}"
    exit 1
fi

if ! command -v spl-token &> /dev/null; then
    echo -e "${RED}❌ spl-token CLI non installé${NC}"
    exit 1
fi

# Vérifier la configuration Solana
NETWORK=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ $NETWORK != *"devnet"* ]]; then
    echo -e "${YELLOW}⚠️  Configuration recommandée: devnet${NC}"
    read -p "Continuer quand même? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Prérequis OK${NC}"

# 1. Créer le mint avec Token-2022
echo -e "${BLUE}1. Création du mint \$BACK...${NC}"

MINT_ADDRESS=$(spl-token create-token \
    --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
    --decimals $TOKEN_DECIMALS \
    --enable-metadata \
    --enable-transfer-hook \
    --output json | jq -r '.commandOutput.address')

if [ -z "$MINT_ADDRESS" ]; then
    echo -e "${RED}❌ Échec création mint${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Mint créé: $MINT_ADDRESS${NC}"

# 2. Créer les métadonnées
echo -e "${BLUE}2. Configuration des métadonnées...${NC}"

spl-token initialize-metadata \
    "$MINT_ADDRESS" \
    "$TOKEN_NAME" \
    "$TOKEN_SYMBOL" \
    "$METADATA_URI"

echo -e "${GREEN}✅ Métadonnées configurées${NC}"

# 3. Créer le compte Transfer Hook
echo -e "${BLUE}3. Configuration du Transfer Hook...${NC}"

# Calculer l'adresse du programme Transfer Hook
TRANSFER_HOOK_PROGRAM_ID="BACKTransferHook1111111111111111111111111111111"

# Initialiser l'extension Transfer Hook
spl-token enable-transfer-hook \
    "$MINT_ADDRESS" \
    "$TRANSFER_HOOK_PROGRAM_ID"

echo -e "${GREEN}✅ Transfer Hook configuré${NC}"

# 4. Mint initial supply
echo -e "${BLUE}4. Mint du supply initial...${NC}"

INITIAL_MINT_AMOUNT=$((TOTAL_SUPPLY * 10 ** TOKEN_DECIMALS))

spl-token mint \
    "$MINT_ADDRESS" \
    "$INITIAL_MINT_AMOUNT"

echo -e "${GREEN}✅ Supply initial minté: $TOTAL_SUPPLY $TOKEN_SYMBOL${NC}"

# 5. Créer le compte de trésorerie
echo -e "${BLUE}5. Création du compte trésorerie...${NC}"

TREASURY_ADDRESS=$(spl-token create-account "$MINT_ADDRESS" --output json | jq -r '.commandOutput.address')

echo -e "${GREEN}✅ Trésorerie créée: $TREASURY_ADDRESS${NC}"

# 6. Générer le rapport
echo ""
echo -e "${GREEN}🎉 Token \$BACK créé avec succès!${NC}"
echo "====================================="
echo "Nom: $TOKEN_NAME"
echo "Symbole: $TOKEN_SYMBOL"
echo "Décimales: $TOKEN_DECIMALS"
echo "Supply total: $TOTAL_SUPPLY"
echo "Adresse mint: $MINT_ADDRESS"
echo "Adresse trésorerie: $TREASURY_ADDRESS"
echo "Transfer Hook: Activé (0.1% burn automatique)"
echo ""

# Sauvegarder les informations
cat > token_back_config.json << EOF
{
  "name": "$TOKEN_NAME",
  "symbol": "$TOKEN_SYMBOL",
  "decimals": $TOKEN_DECIMALS,
  "totalSupply": $TOTAL_SUPPLY,
  "mintAddress": "$MINT_ADDRESS",
  "treasuryAddress": "$TREASURY_ADDRESS",
  "transferHookProgramId": "$TRANSFER_HOOK_PROGRAM_ID",
  "burnPercentage": 0.1,
  "network": "$(solana config get | grep 'RPC URL' | awk '{print $3}')"
}
EOF

echo -e "${GREEN}📄 Configuration sauvegardée dans token_back_config.json${NC}"

echo ""
echo -e "${BLUE}Prochaines étapes:${NC}"
echo "1. Déployer le programme Transfer Hook"
echo "2. Initialiser le Transfer Hook"
echo "3. Tester les transfers avec burn automatique"
echo "4. Intégrer dans les programmes SwapBack"