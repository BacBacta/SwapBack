#!/bin/bash

##############################################################################
# 🚀 Script de Vérification du Correctif de Déploiement
# 
# Vérifie que l'erreur ClaimBuyback est résolue après le déploiement
##############################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  🔍 VÉRIFICATION DU CORRECTIF - ClaimBuyback Import               ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Vérifier le fichier corrigé
echo "📝 1. Vérification du fichier buyback/page.tsx..."
if grep -q "import ClaimBuyback from '@/components/ClaimBuyback'" app/src/app/buyback/page.tsx; then
    echo "   ✅ Import ClaimBuyback trouvé"
else
    echo "   ❌ Import ClaimBuyback MANQUANT"
    exit 1
fi

# 2. Vérifier que le composant existe
echo ""
echo "📦 2. Vérification du composant ClaimBuyback.tsx..."
if [ -f "app/src/components/ClaimBuyback.tsx" ]; then
    echo "   ✅ Composant existe ($(wc -l < app/src/components/ClaimBuyback.tsx) lignes)"
else
    echo "   ❌ Composant MANQUANT"
    exit 1
fi

# 3. Vérifier l'export par défaut
echo ""
echo "🔍 3. Vérification de l'export..."
if grep -q "export default function ClaimBuyback" app/src/components/ClaimBuyback.tsx; then
    echo "   ✅ Export par défaut trouvé"
else
    echo "   ❌ Export MANQUANT"
    exit 1
fi

# 4. Test de build local
echo ""
echo "🏗️  4. Test du build Next.js..."
cd app
if npm run build > /tmp/next-build.log 2>&1; then
    echo "   ✅ Build réussi"
    
    # Vérifier le bundle généré
    if grep -q "ClaimBuyback" /tmp/next-build.log || [ -d ".next" ]; then
        echo "   ✅ Bundle Next.js généré"
    fi
else
    echo "   ❌ Build ÉCHOUÉ"
    echo ""
    echo "   📄 Dernières lignes du log:"
    tail -20 /tmp/next-build.log
    exit 1
fi
cd ..

# 5. Vérifier le dernier commit
echo ""
echo "📌 5. Vérification du commit Git..."
LAST_COMMIT=$(git log -1 --pretty=format:"%h - %s")
echo "   Dernier commit: $LAST_COMMIT"

if git log -1 --pretty=format:"%s" | grep -q "ClaimBuyback"; then
    echo "   ✅ Commit mentionne ClaimBuyback"
else
    echo "   ⚠️  Commit ne mentionne pas ClaimBuyback"
fi

# 6. Statut Git
echo ""
echo "🔄 6. Statut Git..."
if [ -z "$(git status --porcelain)" ]; then
    echo "   ✅ Aucun changement non commité"
else
    echo "   ⚠️  Changements non commités:"
    git status --short | head -5
fi

# 7. Vérifier tous les imports dans le projet
echo ""
echo "🔎 7. Recherche d'autres références à ClaimBuyback..."
REFS=$(grep -r "ClaimBuyback" app/src --include="*.tsx" --include="*.ts" | grep -v ".next" | wc -l)
echo "   Trouvé $REFS références à ClaimBuyback dans app/src"

# 8. Vérifier la configuration TypeScript
echo ""
echo "⚙️  8. Vérification TypeScript..."
if [ -f "app/tsconfig.json" ]; then
    echo "   ✅ tsconfig.json existe"
    if grep -q "@/components" app/tsconfig.json; then
        echo "   ✅ Path alias @/components configuré"
    else
        echo "   ⚠️  Path alias peut-être manquant"
    fi
else
    echo "   ❌ tsconfig.json MANQUANT"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ TOUTES LES VÉRIFICATIONS RÉUSSIES                              ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Prochaines étapes:"
echo "   1. Vercel va auto-déployer le correctif depuis GitHub"
echo "   2. Attendre 2-3 minutes pour le build"
echo "   3. Vérifier https://swap-back-7gkl2gek5-bactas-projects.vercel.app/buyback"
echo "   4. L'erreur 'ClaimBuyback is not defined' devrait disparaître"
echo ""
echo "📊 Pour vérifier le déploiement:"
echo "   - Dashboard Vercel: https://vercel.com/bactas-projects"
echo "   - Logs de build: vercel logs [deployment-url]"
echo ""
