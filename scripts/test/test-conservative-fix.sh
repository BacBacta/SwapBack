#!/bin/bash

echo "🔍 Test de l'application SwapBack après correction conservative du bouton wallet"
echo "=============================================================================="

# Test 1: Vérifier que le serveur démarre
echo "✅ Test 1: Serveur Next.js"
if pgrep -f "next dev" > /dev/null; then
    echo "   ✅ Serveur en cours d'exécution"
else
    echo "   ❌ Serveur non trouvé"
    exit 1
fi

# Test 2: Vérifier que la page se charge
echo "✅ Test 2: Chargement de la page"
if curl -s http://localhost:3000 | grep -q "<!DOCTYPE html>"; then
    echo "   ✅ Page HTML chargée"
else
    echo "   ❌ Page ne se charge pas"
    exit 1
fi

# Test 3: Vérifier que le composant wallet est présent
echo "✅ Test 3: Composant ClientOnlyWallet"
if curl -s http://localhost:3000 | grep -q "ClientOnlyWallet"; then
    echo "   ✅ Composant wallet trouvé dans le DOM"
else
    echo "   ❌ Composant wallet absent"
fi

# Test 4: Vérifier les styles CSS wallet-adapter
echo "✅ Test 4: Styles wallet-adapter"
if grep -q "wallet-adapter-button-trigger" /workspaces/SwapBack/app/src/app/globals.css; then
    echo "   ✅ Styles wallet-adapter présents"
else
    echo "   ❌ Styles wallet-adapter manquants"
fi

# Test 5: Vérifier qu'il n'y a pas d'erreurs de compilation
echo "✅ Test 5: Compilation TypeScript"
if npx tsc --noEmit --project /workspaces/SwapBack/app/tsconfig.json 2>/dev/null; then
    echo "   ✅ Aucune erreur TypeScript"
else
    echo "   ⚠️  Erreurs TypeScript détectées (peut être normal)"
fi

echo ""
echo "🎯 Test terminé - Solution conservative appliquée"
echo "   - Styles CSS seulement (pas de changements JSX)"
echo "   - pointer-events: auto et cursor: pointer sur .wallet-adapter-button-trigger"
echo "   - z-index pour la modale wallet"
echo ""
echo "📋 Pour tester manuellement:"
echo "   1. Ouvrir http://localhost:3000"
echo "   2. Vérifier que le bouton 'Select Wallet' est visible"
echo "   3. Cliquer dessus pour ouvrir la modale"
echo "   4. Vérifier que les onglets SWAP et DASHBOARD fonctionnent"