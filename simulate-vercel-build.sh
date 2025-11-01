#!/bin/bash

set -e

echo "🔬 SIMULATION ENVIRONNEMENT VERCEL"
echo "====================================="
echo ""

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Créer un répertoire temporaire pour simuler Vercel
TEMP_DIR="/tmp/vercel-simulation-$(date +%s)"
echo -e "${BLUE}📁 Création du répertoire de simulation: ${TEMP_DIR}${NC}"
mkdir -p "${TEMP_DIR}"

# Fonction de nettoyage
cleanup() {
  echo ""
  echo "🧹 Nettoyage du répertoire de simulation..."
  rm -rf "${TEMP_DIR}"
  echo "✅ Nettoyage terminé"
}
trap cleanup EXIT

echo ""
echo -e "${BLUE}📋 Étape 1: Copie du projet app (rootDirectory)${NC}"
echo "-------------------------------------------------------"
# Copier uniquement le dossier app (comme Vercel avec rootDirectory)
cp -r /workspaces/SwapBack/app "${TEMP_DIR}/"
echo "✅ Dossier app copié"
echo ""

echo -e "${BLUE}📋 Étape 2: Navigation vers le dossier app${NC}"
echo "-------------------------------------------------------"
cd "${TEMP_DIR}/app"
echo "📂 Current directory: $(pwd)"
echo "📄 Contenu:"
ls -la
echo ""

echo -e "${BLUE}📋 Étape 3: Vérification du vercel.json${NC}"
echo "-------------------------------------------------------"
if [ -f "vercel.json" ]; then
  echo "✅ vercel.json trouvé"
  echo "� Commandes de build:"
  cat vercel.json | grep -A1 "Command" || true
else
  echo -e "${RED}❌ vercel.json manquant${NC}"
  exit 1
fi
echo ""

echo -e "${BLUE}📋 Étape 4: Installation des dépendances${NC}"
echo "-------------------------------------------------------"
# Simuler la commande installCommand de vercel.json
echo "🔧 Exécution: npm install --legacy-peer-deps"
if npm install --legacy-peer-deps 2>&1 | tee /tmp/install-log.txt | grep -v "^npm warn" | head -50; then
  echo -e "${GREEN}✅ Installation réussie${NC}"
else
  echo -e "${RED}❌ Installation échouée${NC}"
  echo "📄 Dernières lignes du log:"
  tail -20 /tmp/install-log.txt
  exit 1
fi
echo ""

echo -e "${BLUE}📋 Étape 5: Vérification des dépendances critiques${NC}"
echo "-------------------------------------------------------"
MISSING_DEPS=0

check_dependency() {
  local dep=$1
  if [ -d "node_modules/${dep}" ]; then
    echo -e "${GREEN}✅ ${dep} trouvé${NC}"
  else
    echo -e "${RED}❌ ${dep} manquant${NC}"
    MISSING_DEPS=$((MISSING_DEPS + 1))
  fi
}

check_dependency "next"
check_dependency "react"
check_dependency "react-dom"
check_dependency "tailwindcss"
check_dependency "postcss"
check_dependency "autoprefixer"

if [ $MISSING_DEPS -gt 0 ]; then
  echo -e "${RED}⚠️  ${MISSING_DEPS} dépendances manquantes!${NC}"
  exit 1
fi
echo ""

echo -e "${BLUE}📋 Étape 6: Vérification des résolutions de modules TypeScript${NC}"
echo "-------------------------------------------------------"
echo "🔍 Vérification de @/hooks/useBuybackHistory:"
if [ -f "src/hooks/useBuybackHistory.ts" ]; then
  echo -e "${GREEN}✅ src/hooks/useBuybackHistory.ts existe${NC}"
else
  echo -e "${RED}❌ src/hooks/useBuybackHistory.ts manquant${NC}"
fi

echo "🔍 Vérification de @/utils/formatters:"
if [ -f "src/utils/formatters.ts" ]; then
  echo -e "${GREEN}✅ src/utils/formatters.ts existe${NC}"
else
  echo -e "${RED}❌ src/utils/formatters.ts manquant${NC}"
fi

echo "🔍 Vérification de @/hooks/useExecuteBuyback:"
if [ -f "src/hooks/useExecuteBuyback.ts" ]; then
  echo -e "${GREEN}✅ src/hooks/useExecuteBuyback.ts existe${NC}"
else
  echo -e "${RED}❌ src/hooks/useExecuteBuyback.ts manquant${NC}"
fi
echo ""

echo -e "${BLUE}📋 Étape 7: Build du projet${NC}"
echo "-------------------------------------------------------"
# Simuler la commande buildCommand de vercel.json
echo "🔧 Exécution: npm run build"
if npm run build 2>&1 | tee /tmp/build-log.txt; then
  echo -e "${GREEN}✅ Build réussi${NC}"
else
  echo -e "${RED}❌ Build échoué${NC}"
  echo "📄 Erreurs du build:"
  grep -A5 "Error:" /tmp/build-log.txt | tail -30
  exit 1
fi
echo ""

echo -e "${BLUE}📋 Étape 8: Vérification du résultat${NC}"
echo "-------------------------------------------------------"
if [ -d ".next" ]; then
  echo -e "${GREEN}✅ Dossier .next créé${NC}"
  echo "📊 Contenu de .next:"
  ls -la .next | head -20
  
  if [ -f ".next/BUILD_ID" ]; then
    echo -e "${GREEN}✅ BUILD_ID présent${NC}"
    echo "🆔 Build ID: $(cat .next/BUILD_ID)"
  fi
  
  if [ -d ".next/server" ]; then
    echo -e "${GREEN}✅ Dossier server présent${NC}"
  fi
  
  if [ -d ".next/static" ]; then
    echo -e "${GREEN}✅ Dossier static présent${NC}"
  fi
else
  echo -e "${RED}❌ Dossier .next manquant${NC}"
  exit 1
fi
echo ""

echo "================================================"
echo -e "${GREEN}✅✅✅ SIMULATION RÉUSSIE ! ✅✅✅${NC}"
echo "================================================"
echo ""
echo "Le build Vercel devrait fonctionner correctement."
echo ""
echo "Configuration détectée:"
echo "  - Framework: Next.js"
echo "  - Output: .next"
echo "  - Install: npm install --legacy-peer-deps"
echo "  - Build: npm run build"
echo ""
