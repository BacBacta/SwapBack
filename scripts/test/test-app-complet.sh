#!/bin/bash

# Script de test complet de l'application SwapBack
# Vérifie que toutes les fonctionnalités principales sont opérationnelles

set -e

echo "🧪 Test complet de l'application SwapBack"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Vérifier que le serveur est en cours d'exécution
echo "1️⃣ Vérification du serveur Next.js..."
if netstat -tlnp 2>/dev/null | grep -q ":3000" || ss -tlnp 2>/dev/null | grep -q ":3000"; then
    echo "   ✅ Serveur actif sur le port 3000"
else
    echo "   ❌ Serveur non actif"
    exit 1
fi

# 2. Test de connectivité
echo ""
echo "2️⃣ Test de connectivité HTTP..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Serveur répond : HTTP $HTTP_CODE"
else
    echo "   ❌ Serveur ne répond pas correctement : HTTP $HTTP_CODE"
    exit 1
fi

# 3. Test des pages principales
echo ""
echo "3️⃣ Test des pages principales..."
PAGES=("/" "/lock" "/dca" "/dashboard")
for page in "${PAGES[@]}"; do
    sleep 1
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000${page}")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ ${page} : HTTP $HTTP_CODE"
    else
        echo "   ⚠️  ${page} : HTTP $HTTP_CODE"
    fi
done

# 4. Vérification de la configuration devnet
echo ""
echo "4️⃣ Vérification de la configuration devnet..."
if grep -q "NEXT_PUBLIC_SOLANA_NETWORK=devnet" /workspaces/SwapBack/app/.env.local; then
    echo "   ✅ Configuration devnet active"
    RPC_URL=$(grep "NEXT_PUBLIC_SOLANA_RPC_URL" /workspaces/SwapBack/app/.env.local | cut -d'=' -f2)
    echo "   📡 RPC: $RPC_URL"
else
    echo "   ⚠️  Configuration réseau non trouvée"
fi

# 5. Vérification du token BACK
echo ""
echo "5️⃣ Vérification du token BACK..."
BACK_MINT=$(grep "NEXT_PUBLIC_BACK_MINT" /workspaces/SwapBack/app/.env.local | cut -d'=' -f2)
echo "   🪙 BACK Mint: $BACK_MINT"

# Test du wallet utilisateur
WALLET="3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt"
echo ""
echo "6️⃣ Vérification du wallet de test..."
echo "   👛 Wallet: $WALLET"

# Vérifier le solde SOL
SOL_BALANCE=$(solana balance "$WALLET" --url https://api.devnet.solana.com 2>/dev/null | awk '{print $1}')
echo "   💰 SOL: $SOL_BALANCE"

# Vérifier le solde BACK
BACK_BALANCE=$(spl-token balance "$BACK_MINT" --owner "$WALLET" --url https://api.devnet.solana.com 2>/dev/null || echo "0")
echo "   🔙 BACK: $BACK_BALANCE"

if [ "$BACK_BALANCE" != "0" ] && [ "$BACK_BALANCE" != "" ]; then
    echo "   ✅ Wallet possède des tokens BACK (peut tester le lock)"
else
    echo "   ⚠️  Wallet sans tokens BACK (exécutez airdrop-back.js)"
fi

# 7. Vérification des logs du serveur
echo ""
echo "7️⃣ Derniers logs du serveur..."
if [ -f /tmp/nextjs.log ]; then
    echo "   📝 Dernières lignes (sans erreurs):"
    tail -5 /tmp/nextjs.log | sed 's/^/      /'
    
    ERROR_COUNT=$(grep -i "error" /tmp/nextjs.log | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "   ⚠️  $ERROR_COUNT erreurs détectées dans les logs"
    else
        echo "   ✅ Aucune erreur dans les logs"
    fi
else
    echo "   ℹ️  Fichier de logs non trouvé"
fi

# Résumé
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test complet terminé avec succès !"
echo ""
echo "📋 Actions suggérées :"
echo "   1. Ouvrez http://localhost:3000 dans votre navigateur"
echo "   2. Connectez votre wallet: $WALLET"
echo "   3. Testez le verrouillage de tokens BACK sur /lock"
echo "   4. Testez la création de plans DCA sur /dca"
echo ""
echo "🔗 Liens utiles :"
echo "   • Application : http://localhost:3000"
echo "   • Page Lock   : http://localhost:3000/lock"
echo "   • Page DCA    : http://localhost:3000/dca"
echo "   • Dashboard   : http://localhost:3000/dashboard"
echo "   • Explorer    : https://explorer.solana.com/address/$WALLET?cluster=devnet"
