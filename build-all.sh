#!/bin/bash

# Script de build complet pour SwapBack
# Contourne le problème de build complet en compilant programme par programme

set -e

echo "🔧 SwapBack - Build Complet des Programmes"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Nettoyer le target (optionnel)
if [ "$1" == "--clean" ]; then
    echo -e "${BLUE}🧹 Nettoyage du cache...${NC}"
    rm -rf target/
    cargo clean
    echo ""
fi

# Liste des programmes à compiler
PROGRAMS=("swapback_router" "swapback_buyback" "swapback_cnft")

# Build de chaque programme
for PROGRAM in "${PROGRAMS[@]}"; do
    echo -e "${BLUE}📦 Building ${PROGRAM}...${NC}"
    anchor build --program-name "$PROGRAM"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${PROGRAM} compilé avec succès${NC}"
        
        # Vérifier la taille du binaire
        BINARY="target/deploy/${PROGRAM}.so"
        if [ -f "$BINARY" ]; then
            SIZE=$(du -h "$BINARY" | cut -f1)
            echo -e "${GREEN}   Taille: ${SIZE}${NC}"
        fi
    else
        echo -e "${RED}❌ Erreur lors de la compilation de ${PROGRAM}${NC}"
        exit 1
    fi
    echo ""
done

echo ""
echo -e "${GREEN}🎉 Tous les programmes ont été compilés avec succès !${NC}"
echo ""
echo "📁 Binaires générés dans target/deploy/ :"
ls -lh target/deploy/*.so 2>/dev/null | awk '{print "   - " $9 " (" $5 ")"}'

echo ""
echo -e "${BLUE}📝 Prochaines étapes :${NC}"
echo "   1. Générer les IDL : anchor idl parse -f programs/swapback_router/src/lib.rs"
echo "   2. Déployer sur devnet : anchor deploy --provider.cluster devnet"
echo "   3. Tester : anchor test"
