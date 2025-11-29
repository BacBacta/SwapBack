#!/bin/bash
# Script pour mettre à jour le frontend après déploiement via GitHub Actions
# Usage: ./update-frontend-after-deploy.sh <PROGRAM_ID>

set -e

PROGRAM_ID=$1

if [ -z "$PROGRAM_ID" ]; then
  echo "❌ Usage: $0 <PROGRAM_ID>"
  echo "Example: $0 AaN2BwpGWbvDo7NHfpyC6zGYxsbg2xtcikToW9xYy4Xq"
  exit 1
fi

echo "🔄 Mise à jour frontend avec Program ID: $PROGRAM_ID"

# 1. Update TypeScript files
echo "📝 Mise à jour des fichiers TypeScript..."
find app/src -name "*.ts" -type f -exec sed -i "s/2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G/$PROGRAM_ID/g" {} +

# 2. Update IDL address (sera aussi fait par GitHub Actions)
echo "📝 Mise à jour de l'IDL..."
jq --arg pid "$PROGRAM_ID" '.address = $pid' app/src/idl/swapback_cnft.json > /tmp/idl.json
mv /tmp/idl.json app/src/idl/swapback_cnft.json

# 3. Verify changes
echo "✅ Vérification..."
echo "IDL Program ID: $(jq -r '.address' app/src/idl/swapback_cnft.json)"

# 4. Commit
git add app/src/
git commit -m "feat(frontend): update to new CNFT Program ID $PROGRAM_ID"
git push

echo ""
echo "✅ Frontend mis à jour !"
echo ""
echo "⚠️  ACTIONS MANUELLES REQUISES:"
echo "1. Va sur Vercel Dashboard"
echo "2. Met à jour: NEXT_PUBLIC_CNFT_PROGRAM_ID=$PROGRAM_ID"
echo "3. Redéploie ou attends l'auto-deploy (2-5 min)"
echo "4. Teste lock/unlock sur: swap-back-app.vercel.app"
