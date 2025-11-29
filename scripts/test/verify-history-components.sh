#!/bin/bash

echo "🔍 Vérification des composants d'historique..."
echo ""

# Vérifier les fichiers
echo "✓ Fichiers présents:"
ls -lh app/src/components/OnChainHistory.tsx 2>/dev/null && echo "  ✅ OnChainHistory.tsx"
ls -lh app/src/components/OnChainHistoryWidget.tsx 2>/dev/null && echo "  ✅ OnChainHistoryWidget.tsx"
ls -lh app/src/components/TransactionVolumeChart.tsx 2>/dev/null && echo "  ✅ TransactionVolumeChart.tsx"
ls -lh app/src/hooks/useOnChainHistory.ts 2>/dev/null && echo "  ✅ useOnChainHistory.ts"
ls -lh app/src/app/history/page.tsx 2>/dev/null && echo "  ✅ history/page.tsx"

echo ""
echo "✓ Directives 'use client':"
grep -l "^'use client'" app/src/components/OnChainHistory.tsx && echo "  ✅ OnChainHistory.tsx"
grep -l "^'use client'" app/src/components/OnChainHistoryWidget.tsx && echo "  ✅ OnChainHistoryWidget.tsx"
grep -l "^'use client'" app/src/components/TransactionVolumeChart.tsx && echo "  ✅ TransactionVolumeChart.tsx"

echo ""
echo "✓ Imports dans Dashboard:"
grep "OnChainHistoryWidget" app/src/components/Dashboard.tsx && echo "  ✅ Import présent"

echo ""
echo "✓ Utilisation dans Dashboard:"
grep -A 1 "OnChainHistoryWidget limit" app/src/components/Dashboard.tsx && echo "  ✅ Widget utilisé"

echo ""
echo "✓ Lien dans Navigation:"
grep "history.*History" app/src/components/Navigation.tsx && echo "  ✅ Lien présent"

echo ""
echo "✓ Build Next.js:"
cd app && npm run build 2>&1 | grep "/history" && echo "  ✅ Route /history buildée"

echo ""
echo "✓ Dernier commit:"
git log -1 --oneline

echo ""
echo "🎉 Vérification terminée!"
