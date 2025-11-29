#!/bin/bash

# 🚀 DÉPLOIEMENT VERCEL AUTOMATISÉ - SwapBack
# Script interactif pour déployer facilement sur Vercel

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Se positionner dans le répertoire app
cd /workspaces/SwapBack/app

echo "════════════════════════════════════════════════════════════"
echo "🚀 DÉPLOIEMENT VERCEL AUTOMATISÉ"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📁 Répertoire actuel: ${NC}$(pwd)"
echo ""

# Vérifier Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de Vercel CLI...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✅ Installé${NC}"
    echo ""
fi

# Menu
echo "Options:"
echo ""
echo -e "${CYAN}1)${NC} 🧪 Preview (test)"
echo -e "${CYAN}2)${NC} 🚀 Production"
echo -e "${CYAN}3)${NC} 📊 Logs"
echo ""
read -p "Choix: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}🧪 Déploiement Preview...${NC}"
        echo -e "${YELLOW}💡 Quand demandé 'In which directory is your code located?'${NC}"
        echo -e "${YELLOW}   Tapez juste: ${GREEN}.${YELLOW} (un point) ou appuyez sur ENTER${NC}"
        echo ""
        vercel
        ;;
    2)
        echo ""
        echo -e "${BLUE}🚀 Déploiement Production...${NC}"
        echo -e "${YELLOW}💡 Quand demandé 'In which directory is your code located?'${NC}"
        echo -e "${YELLOW}   Tapez juste: ${GREEN}.${YELLOW} (un point) ou appuyez sur ENTER${NC}"
        echo ""
        vercel --prod
        ;;
    3)
        echo ""
        echo -e "${BLUE}📊 Affichage des logs...${NC}"
        vercel logs --follow
        ;;
    *)
        echo ""
        echo -e "${RED}❌ Choix invalide${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Terminé${NC}"
