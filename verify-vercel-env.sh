#!/bin/bash

# Script de vérification des variables d'environnement Vercel
# Pour SwapBack - 9 Novembre 2025

echo "🔍 VÉRIFICATION ENVIRONNEMENT VERCEL"
echo "======================================"
echo ""

VERCEL_URL="https://swap-back-app-4ewf-3apwh0e3i-bactas-projects.vercel.app"

echo "📍 URL testée: $VERCEL_URL"
echo ""

# Test 1: Vérifier que l'application répond
echo "✅ Test 1: Vérifier que l'application répond..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✓ Application accessible (HTTP $HTTP_CODE)"
else
    echo "   ✗ Problème d'accès (HTTP $HTTP_CODE)"
fi
echo ""

# Test 2: Télécharger la page HTML
echo "✅ Test 2: Analyser le contenu HTML..."
HTML_CONTENT=$(curl -s "$VERCEL_URL")

# Vérifier si "Application error" est présent
if echo "$HTML_CONTENT" | grep -q "Application error"; then
    echo "   ✗ ERREUR DÉTECTÉE: 'Application error' trouvé dans la page"
    echo ""
    echo "📋 Extrait de l'erreur:"
    echo "$HTML_CONTENT" | grep -A 5 -B 5 "Application error" | head -20
else
    echo "   ✓ Pas d'erreur 'Application error' détectée"
fi
echo ""

# Test 3: Vérifier la présence de composants React
if echo "$HTML_CONTENT" | grep -q "SWAPBACK"; then
    echo "   ✓ Composant SwapBack trouvé"
else
    echo "   ✗ Composant SwapBack NON trouvé"
fi
echo ""

# Test 4: Vérifier les variables env dans le HTML (elles ne doivent PAS apparaître)
echo "✅ Test 3: Vérifier l'absence de fuites de variables sensibles..."
SENSITIVE_FOUND=false

if echo "$HTML_CONTENT" | grep -q "NEXT_PUBLIC_ROUTER_PROGRAM_ID"; then
    echo "   ⚠️  ROUTER_PROGRAM_ID trouvé dans le HTML (peut être normal dans les scripts)"
    SENSITIVE_FOUND=true
fi

if echo "$HTML_CONTENT" | grep -q "BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz"; then
    echo "   ✓ Router Program ID présent (BKExqm5c...)"
fi

if ! $SENSITIVE_FOUND; then
    echo "   ✓ Aucune fuite évidente de variables sensibles"
fi
echo ""

# Test 5: Créer un test API pour vérifier les env vars côté serveur
echo "✅ Test 4: Tester une API route (si disponible)..."
API_RESPONSE=$(curl -s "$VERCEL_URL/api/swap/quote" -X POST \
  -H "Content-Type: application/json" \
  -d '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":1000000}' 2>&1)

if echo "$API_RESPONSE" | grep -q "error"; then
    echo "   ⚠️  API répond avec une erreur (peut être normal si pas de route configurée)"
    echo "   Response: $(echo "$API_RESPONSE" | head -c 200)..."
else
    echo "   ✓ API répond (status à vérifier manuellement)"
fi
echo ""

# Test 6: Extraire les variables Next.js du HTML
echo "✅ Test 5: Extraire les variables Next.js publiques..."
if echo "$HTML_CONTENT" | grep -q "NEXT_PUBLIC"; then
    echo "   Variables trouvées dans le build:"
    echo "$HTML_CONTENT" | grep -o 'NEXT_PUBLIC_[A-Z_]*' | sort | uniq | head -10
else
    echo "   ⚠️  Aucune variable NEXT_PUBLIC trouvée (peut indiquer un problème de build)"
fi
echo ""

# Résumé
echo "======================================"
echo "📊 RÉSUMÉ"
echo "======================================"
echo ""
if [ "$HTTP_CODE" = "200" ]; then
    if echo "$HTML_CONTENT" | grep -q "Application error"; then
        echo "🔴 STATUS: ERREUR - Application error détectée"
        echo ""
        echo "🔧 ACTIONS RECOMMANDÉES:"
        echo "   1. Vérifier les variables d'environnement dans Vercel Dashboard"
        echo "   2. Variables requises:"
        echo "      - NEXT_PUBLIC_SOLANA_NETWORK=devnet"
        echo "      - NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com"
        echo "      - NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
        echo "      - NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz"
        echo "      - NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
        echo "      - NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom"
        echo "   3. Redéployer après avoir configuré les variables"
        echo ""
    elif echo "$HTML_CONTENT" | grep -q "SWAPBACK"; then
        echo "🟢 STATUS: OK - Application semble fonctionner"
        echo ""
        echo "⚠️  Note: L'avertissement sur la police (woff2) est normal et n'affecte pas le fonctionnement."
    else
        echo "🟡 STATUS: INCERTAIN - Application répond mais contenu à vérifier"
    fi
else
    echo "🔴 STATUS: ERREUR - Application inaccessible (HTTP $HTTP_CODE)"
fi
echo ""
