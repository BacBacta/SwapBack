#!/usr/bin/env bash
set -e

# Ce script met à jour tous les fichiers frontend avec le nouveau Program ID
# Usage: ./update-frontend-program-id.sh <NEW_PROGRAM_ID>

if [ -z "$1" ]; then
    echo "❌ Erreur: Program ID manquant"
    echo "Usage: $0 <NEW_PROGRAM_ID>"
    echo "Exemple: $0 ABC123...XYZ"
    exit 1
fi

NEW_PROGRAM_ID=$1
OLD_PROGRAM_ID="26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru"

echo "🔄 Mise à jour du Program ID dans le frontend"
echo "=============================================="
echo "Ancien ID: $OLD_PROGRAM_ID"
echo "Nouveau ID: $NEW_PROGRAM_ID"
echo ""

# Fichiers à mettre à jour
FILES=(
    "app/src/config/testnet.ts"
    "app/src/config/constants.ts"
    "app/src/config/tokens.ts"
    "app/src/lib/validateEnv.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "📝 Mise à jour: $file"
        # Sauvegarder l'original
        cp "$file" "${file}.backup-$(date +%Y%m%d-%H%M%S)"
        # Remplacer l'ancien ID par le nouveau
        sed -i "s/${OLD_PROGRAM_ID}/${NEW_PROGRAM_ID}/g" "$file"
        echo "   ✅ Mis à jour"
    else
        echo "   ⚠️  Fichier non trouvé: $file"
    fi
done

echo ""
echo "✅ Mise à jour terminée!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Vérifier les changements: git diff"
echo "2. Rebuilder le frontend: cd app && npm run build"
echo "3. Tester l'application: npm run dev"
echo "4. Commiter les changements: git add . && git commit -m 'Update cNFT program ID'"
