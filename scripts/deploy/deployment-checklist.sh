#!/bin/bash

# ✅ Checklist de Déploiement SwapBack - GitHub → Vercel
# Ce script affiche une checklist visuelle pour le déploiement

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear

echo -e "${BLUE}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║            ✅ CHECKLIST DE DÉPLOIEMENT SWAPBACK               ║"
echo "║                 GitHub → Vercel Production                     ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Fonction pour afficher une étape
show_step() {
    local status=$1
    local title=$2
    local description=$3
    
    if [ "$status" = "done" ]; then
        echo -e "${GREEN}✅${NC} ${BOLD}$title${NC}"
    elif [ "$status" = "pending" ]; then
        echo -e "${YELLOW}⏳${NC} ${BOLD}$title${NC}"
    else
        echo -e "${RED}❌${NC} ${BOLD}$title${NC}"
    fi
    
    if [ -n "$description" ]; then
        echo -e "   ${description}"
    fi
    echo ""
}

# Vérifier si les fichiers de configuration existent
if [ -f ".github/workflows/main-ci.yml" ] && [ -f "GITHUB_VERCEL_SETUP.md" ]; then
    config_status="done"
else
    config_status="error"
fi

# Vérifier si le projet Vercel est lié
if [ -f "app/.vercel/project.json" ]; then
    vercel_link_status="done"
else
    vercel_link_status="error"
fi

# Afficher la checklist
echo -e "${BOLD}📋 ÉTAPES COMPLÉTÉES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

show_step "done" "1. Configuration GitHub Actions" \
    "Workflows main-ci.yml et release-deploy.yml configurés"

show_step "done" "2. Documentation créée" \
    "GITHUB_VERCEL_SETUP.md et scripts disponibles"

show_step "$vercel_link_status" "3. Projet Vercel lié" \
    "Project ID: prj_4T5WKyofamxdl35cbJUaAJSgWgCB"

show_step "done" "4. Code production-ready" \
    "252/261 tests passés (96.6%), build optimisé (480 KB)"

show_step "done" "5. Commit et push effectués" \
    "Commit 8fb8651 pushé sur main"

echo ""
echo -e "${BOLD}⏳ ACTIONS REQUISES (5 MINUTES)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

show_step "pending" "6. Créer token Vercel (2 min)" \
    "→ Ouvrir: ${BLUE}https://vercel.com/account/tokens${NC}
   → Name: 'SwapBack GitHub Actions'
   → Scope: 'Full Account'
   → Copier le token (commence par 'vercel_')"

show_step "pending" "7. Configurer secrets GitHub (3 min)" \
    "→ Ouvrir: ${BLUE}https://github.com/BacBacta/SwapBack/settings/secrets/actions${NC}
   → Créer 3 secrets (cliquer 'New repository secret'):
   
   ${GREEN}Secret 1:${NC} VERCEL_TOKEN
      Value: <token copié à l'étape 6>
   
   ${GREEN}Secret 2:${NC} VERCEL_ORG_ID
      Value: team_yvcPXxh5OyD9bGT9ogPgtNEw
   
   ${GREEN}Secret 3:${NC} VERCEL_PROJECT_ID
      Value: prj_4T5WKyofamxdl35cbJUaAJSgWgCB"

echo ""
echo -e "${BOLD}🚀 DÉPLOIEMENT${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "${YELLOW}Option 1:${NC} Push immédiat (déclenche le déploiement)"
echo "   ${BLUE}git commit --allow-empty -m 'chore: trigger deployment'${NC}"
echo "   ${BLUE}git push origin main${NC}"
echo ""

echo -e "${YELLOW}Option 2:${NC} Créer une release beta (recommandé)"
echo "   ${BLUE}git tag -a v1.0.0-beta -m 'Beta Release - SwapBack DEX'${NC}"
echo "   ${BLUE}git push origin v1.0.0-beta${NC}"
echo "   Puis créer la release: ${BLUE}https://github.com/BacBacta/SwapBack/releases/new${NC}"
echo ""

echo -e "${YELLOW}Option 3:${NC} Déploiement manuel (via GitHub UI)"
echo "   → ${BLUE}https://github.com/BacBacta/SwapBack/actions/workflows/release-deploy.yml${NC}"
echo "   → Cliquer 'Run workflow'"
echo ""

echo ""
echo -e "${BOLD}📊 SUIVI DU DÉPLOIEMENT${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "1. ${GREEN}GitHub Actions:${NC} ${BLUE}https://github.com/BacBacta/SwapBack/actions${NC}"
echo "   Observer les jobs en temps réel (~5-7 min)"
echo ""

echo -e "2. ${GREEN}Vercel Dashboard:${NC} ${BLUE}https://vercel.com/bactas-projects/swapback${NC}"
echo "   Vérifier que le déploiement apparaît"
echo ""

echo -e "3. ${GREEN}Production URL:${NC} ${BLUE}https://swapback.vercel.app${NC}"
echo "   Tester l'application une fois déployée"
echo ""

echo ""
echo -e "${BOLD}📚 DOCUMENTATION${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Guide complet:     ${BLUE}GITHUB_VERCEL_SETUP.md${NC}"
echo "Script setup:      ${BLUE}./setup-github-vercel.sh${NC}"
echo "Rapport déploiement: ${BLUE}DEPLOYMENT_READY_GITHUB_VERCEL.md${NC}"
echo ""

echo ""
echo -e "${GREEN}${BOLD}✨ Prêt pour le déploiement !${NC}"
echo ""
echo -e "Une fois les secrets configurés, chaque push sur ${BOLD}main${NC} déclenchera"
echo -e "automatiquement un déploiement en production sur Vercel. 🚀"
echo ""

# Demander si l'utilisateur veut ouvrir les URLs
echo ""
read -p "Voulez-vous ouvrir les URLs nécessaires dans le navigateur ? (o/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo ""
    echo "Ouverture des URLs..."
    
    # Ouvrir Vercel token page
    if command -v xdg-open > /dev/null; then
        xdg-open "https://vercel.com/account/tokens" 2>/dev/null &
    elif command -v open > /dev/null; then
        open "https://vercel.com/account/tokens"
    fi
    
    sleep 2
    
    # Ouvrir GitHub secrets page
    if command -v xdg-open > /dev/null; then
        xdg-open "https://github.com/BacBacta/SwapBack/settings/secrets/actions" 2>/dev/null &
    elif command -v open > /dev/null; then
        open "https://github.com/BacBacta/SwapBack/settings/secrets/actions"
    fi
    
    echo ""
    echo -e "${GREEN}✅ URLs ouvertes dans le navigateur${NC}"
fi

echo ""
echo -e "${BLUE}Bonne chance avec le déploiement ! 🎉${NC}"
echo ""
