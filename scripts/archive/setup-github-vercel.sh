#!/bin/bash

# Script de configuration GitHub ↔️ Vercel
# Ce script aide à configurer les secrets GitHub nécessaires au déploiement automatique

set -e

echo "🔗 Configuration GitHub ↔️ Vercel - Déploiement Automatique"
echo "=============================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier si .vercel/project.json existe
if [ ! -f "app/.vercel/project.json" ]; then
    echo -e "${RED}❌ Erreur: .vercel/project.json introuvable${NC}"
    echo "Exécutez d'abord: cd app && vercel link"
    exit 1
fi

# Lire les IDs depuis .vercel/project.json
VERCEL_PROJECT_ID=$(jq -r '.projectId' app/.vercel/project.json)
VERCEL_ORG_ID=$(jq -r '.orgId' app/.vercel/project.json)

echo -e "${GREEN}✅ IDs Vercel détectés:${NC}"
echo "   - Project ID: $VERCEL_PROJECT_ID"
echo "   - Org ID: $VERCEL_ORG_ID"
echo ""

# Instructions pour obtenir le token
echo -e "${YELLOW}📋 Instructions:${NC}"
echo ""
echo "1️⃣  Créer un token Vercel:"
echo "   → Ouvrir: https://vercel.com/account/tokens"
echo "   → Cliquer sur 'Create Token'"
echo "   → Name: 'SwapBack GitHub Actions'"
echo "   → Scope: 'Full Account'"
echo "   → Copier le token (commence par 'vercel_')"
echo ""
echo "2️⃣  Configurer les secrets GitHub:"
echo "   → Ouvrir: https://github.com/BacBacta/SwapBack/settings/secrets/actions"
echo "   → Cliquer sur 'New repository secret'"
echo ""
echo -e "${BLUE}Secret 1: VERCEL_TOKEN${NC}"
echo "   Name:  VERCEL_TOKEN"
echo "   Value: <le token copié>"
echo ""
echo -e "${BLUE}Secret 2: VERCEL_ORG_ID${NC}"
echo "   Name:  VERCEL_ORG_ID"
echo "   Value: $VERCEL_ORG_ID"
echo ""
echo -e "${BLUE}Secret 3: VERCEL_PROJECT_ID${NC}"
echo "   Name:  VERCEL_PROJECT_ID"
echo "   Value: $VERCEL_PROJECT_ID"
echo ""
echo "=============================================================="
echo ""

# Demander si l'utilisateur a configuré les secrets
read -p "Avez-vous ajouté les 3 secrets sur GitHub ? (o/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo -e "${YELLOW}⏸️  Configuration en attente.${NC}"
    echo "Relancez ce script après avoir configuré les secrets."
    exit 0
fi

echo ""
echo -e "${GREEN}✅ Configuration terminée !${NC}"
echo ""
echo "🚀 Pour déclencher un déploiement:"
echo ""
echo "Option 1 - Push sur main (automatique):"
echo "   git add ."
echo "   git commit -m 'chore: configure GitHub Vercel integration'"
echo "   git push origin main"
echo ""
echo "Option 2 - Créer une release:"
echo "   git tag -a v1.0.0-beta -m 'Beta Release'"
echo "   git push origin v1.0.0-beta"
echo "   # Puis créer la release sur GitHub"
echo ""
echo "Option 3 - Déploiement manuel:"
echo "   https://github.com/BacBacta/SwapBack/actions/workflows/release-deploy.yml"
echo "   → Cliquer sur 'Run workflow'"
echo ""
echo "📊 Suivre le déploiement:"
echo "   https://github.com/BacBacta/SwapBack/actions"
echo ""
echo -e "${GREEN}✨ Le déploiement automatique est maintenant configuré !${NC}"
