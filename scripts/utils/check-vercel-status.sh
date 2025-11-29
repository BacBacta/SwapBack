#!/bin/bash

# Script pour vérifier le statut du déploiement Vercel
# Usage: ./check-vercel-status.sh

echo "═══════════════════════════════════════════════════════════"
echo "🔍 VÉRIFICATION STATUT DÉPLOIEMENT VERCEL"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Informations sur le dernier commit
echo "📝 Dernier commit:"
git log --oneline -1
echo ""

# Heure actuelle
echo "🕐 Heure: $(date '+%H:%M:%S')"
echo ""

# Instructions pour vérifier manuellement
echo "📋 ÉTAPES DE VÉRIFICATION MANUELLE:"
echo ""
echo "1. Ouvrir le dashboard Vercel:"
echo "   https://vercel.com/dashboard"
echo ""
echo "2. Chercher le projet 'SwapBack' (ou votre nom de projet)"
echo ""
echo "3. Vérifier le déploiement pour commit: cbb06de"
echo ""
echo "4. Cliquer sur les logs de build"
echo ""
echo "5. Chercher dans les logs:"
echo "   ✅ SUCCÈS si vous voyez:"
echo "      - 'Dependencies installed'"
echo "      - PAS de 'husky: command not found'"
echo "      - 'Build completed successfully'"
echo ""
echo "   ❌ ÉCHEC si vous voyez:"
echo "      - 'sh: line 1: husky: command not found'"
echo "      - 'npm error code 127'"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Proposer des alternatives
echo "🔧 SI LE BUILD ÉCHOUE ENCORE:"
echo ""
echo "Option A - Supprimer Husky (RECOMMANDÉ):"
echo "  ./remove-husky.sh"
echo ""
echo "Option B - Essayer Netlify:"
echo "  Voir VERCEL_DEPLOYMENT_GUIDE.md section 'Alternatives'"
echo ""
echo "Option C - Build manuel:"
echo "  cd app && npm run build && vercel deploy --prebuilt"
echo ""
echo "═══════════════════════════════════════════════════════════"

# Créer aussi le script de suppression de Husky
cat > remove-husky.sh << 'HUSKY_REMOVE'
#!/bin/bash

echo "⚠️  SUPPRESSION DE HUSKY"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Cette action va:"
echo "  - Désinstaller le package husky"
echo "  - Supprimer le dossier .husky/"
echo "  - Committer les changements"
echo "  - Pusher sur GitHub"
echo ""
read -p "Continuer? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Annulé"
    exit 1
fi

echo "🗑️  Suppression de Husky..."

# Désinstaller Husky
npm uninstall husky

# Supprimer le dossier
rm -rf .husky

# Git remove
git rm -rf .husky 2>/dev/null || true

# Commit
git add package.json package-lock.json
git commit -m "chore: Remove husky for Vercel compatibility"

# Push
git push origin main

echo "✅ Husky supprimé et changements pushés"
echo ""
echo "⏳ Vercel devrait détecter le push et redéployer dans 2-5 minutes"
echo ""
echo "📊 Surveiller le déploiement sur:"
echo "   https://vercel.com/dashboard"
HUSKY_REMOVE

chmod +x remove-husky.sh

echo ""
echo "✅ Scripts créés:"
echo "   - check-vercel-status.sh (ce script)"
echo "   - remove-husky.sh (solution de secours)"
echo ""
