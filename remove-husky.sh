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
