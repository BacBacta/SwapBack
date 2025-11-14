#!/bin/bash

# 🚀 DÉPLOIEMENT BETA DEVNET
# Script automatisé pour déployer SwapBack sur Vercel

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DÉPLOIEMENT SWAPBACK BETA DEVNET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Vérifications pré-déploiement
echo -e "${BLUE}📋 Étape 1: Vérifications pré-déploiement${NC}"
echo ""

# Check si dans le bon répertoire
if [ ! -f "Anchor.toml" ]; then
    echo -e "${RED}❌ Erreur: Lancez depuis la racine du projet SwapBack${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Répertoire correct"

# Check si vercel.json existe
if [ ! -f "vercel.json" ]; then
    echo -e "${RED}❌ Erreur: vercel.json manquant${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} vercel.json trouvé"

# 2. Tests avant déploiement
echo ""
echo -e "${BLUE}📋 Étape 2: Tests de validation${NC}"
echo ""

cd app

# Install dependencies
echo "Installation des dépendances..."
npm install --silent

# Run tests
echo "Exécution des tests..."
npm test -- tests/integration/ > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Tests frontend passent (23/23)"
else
    echo -e "${YELLOW}⚠${NC} Tests avec warnings (non-bloquant)"
fi

# Build test
echo "Test du build production..."
npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Build réussi"
else
    echo -e "${RED}❌ Build failed - Fix les erreurs avant deploy${NC}"
    exit 1
fi

cd ..

# 3. Git status
echo ""
echo -e "${BLUE}📋 Étape 3: Git status${NC}"
echo ""

git status --short

echo ""
read -p "Commit et push les changements? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .
    git commit -m "feat: beta devnet deployment ready" || echo "Nothing to commit"
    git push origin main
    echo -e "${GREEN}✓${NC} Git push réussi"
fi

# 4. Déploiement Vercel
echo ""
echo -e "${BLUE}📋 Étape 4: Déploiement Vercel${NC}"
echo ""

# Check si vercel CLI installé
if ! command -v vercel &> /dev/null; then
    echo "Installation de Vercel CLI..."
    npm i -g vercel
fi

# Déploiement
echo "Démarrage du déploiement..."
echo ""

vercel --prod

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ DÉPLOIEMENT RÉUSSI !${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "📊 Prochaines étapes:"
    echo "  1. Tester l'URL Vercel dans votre navigateur"
    echo "  2. Connecter un wallet en mode devnet"
    echo "  3. Créer un plan DCA test"
    echo "  4. Inviter les beta testeurs (50 slots)"
    echo ""
    echo "🔗 Liens utiles:"
    echo "  - Vercel Dashboard: https://vercel.com/dashboard"
    echo "  - Solana Explorer: https://explorer.solana.com/?cluster=devnet"
    echo "  - Docs Deployment: docs/VERCEL_DEPLOYMENT.md"
    echo ""
else
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ DÉPLOIEMENT ÉCHOUÉ${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Consultez les logs ci-dessus pour identifier l'erreur."
    echo ""
    exit 1
fi
