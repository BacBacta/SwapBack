#!/bin/bash
# Script de vérification du statut de déploiement

set -e

PROGRAM_ID="EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
DEVNET_URL="https://api.devnet.solana.com"

echo "🔍 VÉRIFICATION DU STATUT DE DÉPLOIEMENT"
echo "=========================================="
echo ""

# 1. Vérifier les workflows GitHub
echo "📊 1. Workflows GitHub Actions récents:"
echo "----------------------------------------"
gh run list --limit 5 --json databaseId,status,conclusion,name,createdAt,displayTitle 2>/dev/null | jq -r '.[] | "[\(.status)] \(.name) - \(.conclusion // "running") - \(.createdAt)"' || echo "⚠️  Utilisez 'gh auth login' pour voir les workflows"
echo ""

# 2. Vérifier le programme sur Solana
echo "🔗 2. Programme sur Solana Devnet:"
echo "----------------------------------------"
if command -v solana &> /dev/null; then
    solana program show $PROGRAM_ID --url devnet 2>/dev/null || echo "⏸️  Programme pas encore déployé"
else
    echo "⚠️  Solana CLI non installé"
    echo "   Vérifiez manuellement: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
fi
echo ""

# 3. Vérifier les commits récents
echo "📝 3. Commits récents (pour vérifier l'IDL update):"
echo "----------------------------------------"
git log --oneline -5 | head -5
echo ""

# 4. Vérifier le fichier IDL
echo "📄 4. IDL dans le projet:"
echo "----------------------------------------"
if [ -f "app/src/idl/swapback_cnft.json" ]; then
    PROGRAM_ID_IN_IDL=$(cat app/src/idl/swapback_cnft.json | jq -r '.address // .metadata.address // "not found"')
    if [ "$PROGRAM_ID_IN_IDL" = "$PROGRAM_ID" ]; then
        echo "✅ IDL contient le bon Program ID: $PROGRAM_ID"
    else
        echo "⚠️  IDL Program ID: $PROGRAM_ID_IN_IDL (devrait être $PROGRAM_ID)"
    fi
else
    echo "⏸️  Fichier IDL non trouvé"
fi
echo ""

# 5. Vérifier la configuration frontend
echo "⚙️  5. Configuration Frontend:"
echo "----------------------------------------"
if [ -f "app/.env.local" ]; then
    FRONTEND_PROGRAM_ID=$(grep "NEXT_PUBLIC_CNFT_PROGRAM_ID" app/.env.local | cut -d'=' -f2)
    if [ "$FRONTEND_PROGRAM_ID" = "$PROGRAM_ID" ]; then
        echo "✅ Frontend configuré avec: $FRONTEND_PROGRAM_ID"
    else
        echo "⚠️  Frontend Program ID: $FRONTEND_PROGRAM_ID (devrait être $PROGRAM_ID)"
    fi
else
    echo "⏸️  Fichier .env.local non trouvé"
fi
echo ""

# 6. Résumé
echo "📊 RÉSUMÉ:"
echo "=========================================="
echo "Program ID attendu: $PROGRAM_ID"
echo ""
echo "🔗 Liens utiles:"
echo "  - Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "  - Workflows: https://github.com/BacBacta/SwapBack/actions"
echo "  - Dashboard: https://swap-back-556okzq8h-bactas-projects.vercel.app/dashboard"
echo ""
echo "✅ Si le workflow GitHub est terminé avec succès et que"
echo "   le programme est visible sur l'Explorer, vous pouvez"
echo "   tester l'unlock sur le dashboard (après hard refresh)."
