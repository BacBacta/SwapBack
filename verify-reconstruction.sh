#!/usr/bin/env bash

# Script de vérification pour s'assurer que tous les fichiers nécessaires sont présents

echo "🔍 VÉRIFICATION DE LA RECONSTRUCTION LOCK/UNLOCK"
echo "================================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

MISSING=0
PRESENT=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        ((PRESENT++))
    else
        echo -e "${RED}❌${NC} $1 (MANQUANT)"
        ((MISSING++))
    fi
}

check_executable() {
    if [ -x "$1" ]; then
        echo -e "${GREEN}✅${NC} $1 (exécutable)"
        ((PRESENT++))
    else
        echo -e "${YELLOW}⚠️${NC}  $1 (pas exécutable - chmod +x $1)"
        ((PRESENT++))
    fi
}

echo "📋 Scripts Shell:"
check_executable "rebuild-lock-unlock.sh"
check_executable "update-frontend-program-id.sh"
echo ""

echo "📜 Scripts TypeScript:"
check_file "scripts/init-cnft.ts"
check_file "scripts/test-lock-unlock.ts"
echo ""

echo "📖 Documentation:"
check_file "QUICK_START.md"
check_file "README_RECONSTRUCTION.md"
check_file "RECONSTRUCTION_LOCK_UNLOCK_GUIDE.md"
check_file "COMMANDES_RAPIDES.md"
check_file "INDEX_RECONSTRUCTION.md"
check_file "ORDRE_LECTURE.md"
check_file "RECAP_VISUEL.txt"
echo ""

echo "🔧 Code Rust:"
check_file "programs/swapback_cnft/src/lib.rs"
check_file "programs/swapback_cnft/src/lib_old.rs"
echo ""

echo "⚙️ Configuration:"
check_file ".env.example"
check_file "Anchor.toml"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✅ TOUS LES FICHIERS SONT PRÉSENTS!${NC}"
    echo ""
    echo "📊 Résumé:"
    echo "   Fichiers présents: $PRESENT"
    echo "   Fichiers manquants: $MISSING"
    echo ""
    echo "🚀 Vous êtes prêt à déployer!"
    echo ""
    echo "Prochaines étapes:"
    echo "1. Lire QUICK_START.md (si pas déjà fait)"
    echo "2. Exécuter ./rebuild-lock-unlock.sh (sur machine locale)"
    echo ""
else
    echo -e "${RED}❌ CERTAINS FICHIERS SONT MANQUANTS${NC}"
    echo ""
    echo "📊 Résumé:"
    echo "   Fichiers présents: $PRESENT"
    echo "   Fichiers manquants: $MISSING"
    echo ""
    echo "⚠️  Veuillez vérifier que tous les fichiers ont été créés correctement."
    echo ""
fi

# Vérifier les permissions
echo "🔐 Vérification des permissions des scripts shell:"
if [ -x "rebuild-lock-unlock.sh" ] && [ -x "update-frontend-program-id.sh" ]; then
    echo -e "${GREEN}✅${NC} Les scripts sont exécutables"
else
    echo -e "${YELLOW}⚠️${NC}  Certains scripts ne sont pas exécutables"
    echo "   Pour corriger: chmod +x rebuild-lock-unlock.sh update-frontend-program-id.sh"
fi
echo ""

# Vérifier la structure du projet
echo "📁 Vérification de la structure du projet:"
DIRS=("programs/swapback_cnft" "programs/swapback_cnft/src" "scripts" "app/src/config")
for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅${NC} $dir/"
    else
        echo -e "${RED}❌${NC} $dir/ (MANQUANT)"
    fi
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Vérification terminée!"
echo ""
