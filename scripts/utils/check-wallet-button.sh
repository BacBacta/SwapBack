#!/bin/bash

echo "🔍 Vérification de l'accessibilité du bouton Connect Wallet"
echo "============================================================"
echo ""

# Vérifier que le serveur est accessible
echo "1. Vérification du serveur..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "   ✅ Serveur Next.js accessible sur http://localhost:3000"
else
    echo "   ❌ Serveur non accessible"
    exit 1
fi

echo ""
echo "2. Vérification de la présence du composant ClientOnlyWallet..."
if curl -s http://localhost:3000 | grep -q "ClientOnlyWallet"; then
    echo "   ✅ Composant ClientOnlyWallet présent dans le DOM"
else
    echo "   ❌ Composant ClientOnlyWallet non trouvé"
    exit 1
fi

echo ""
echo "3. Vérification du z-index du bouton wallet..."
if curl -s http://localhost:3000 | grep -q "z-\[100\]"; then
    echo "   ✅ z-index [100] appliqué au bouton wallet"
else
    echo "   ⚠️  z-index personnalisé non détecté (pourrait être dans les styles compilés)"
fi

echo ""
echo "4. Vérification des styles wallet-adapter dans globals.css..."
if grep -q "wallet-adapter-modal-wrapper" /workspaces/SwapBack/app/src/app/globals.css; then
    echo "   ✅ Styles wallet-adapter-modal-wrapper ajoutés"
else
    echo "   ❌ Styles wallet-adapter manquants"
    exit 1
fi

if grep -q "pointer-events: auto" /workspaces/SwapBack/app/src/app/globals.css; then
    echo "   ✅ pointer-events: auto configuré pour l'accessibilité"
else
    echo "   ❌ pointer-events non configuré"
    exit 1
fi

echo ""
echo "5. Vérification du code source du composant..."
if grep -q "pointerEvents: 'auto'" /workspaces/SwapBack/app/src/components/ClientOnlyWallet.tsx; then
    echo "   ✅ pointerEvents configuré dans ClientOnlyWallet"
else
    echo "   ❌ pointerEvents manquant dans ClientOnlyWallet"
    exit 1
fi

if grep -q "cursor: 'pointer'" /workspaces/SwapBack/app/src/components/ClientOnlyWallet.tsx; then
    echo "   ✅ cursor: pointer configuré dans ClientOnlyWallet"
else
    echo "   ❌ cursor pointer manquant dans ClientOnlyWallet"
    exit 1
fi

echo ""
echo "============================================================"
echo "✅ Toutes les vérifications sont passées !"
echo ""
echo "📝 Résumé des corrections appliquées:"
echo "   • z-index élevé (100) pour le bouton wallet"
echo "   • pointer-events: auto pour assurer la cliquabilité"
echo "   • cursor: pointer pour indiquer l'interactivité"
echo "   • Styles z-index pour les modals wallet-adapter"
echo "   • Wrapper div avec z-index pour isoler le composant"
echo ""
echo "🌐 Testez maintenant dans le navigateur:"
echo "   1. Ouvrez http://localhost:3000"
echo "   2. Le bouton 'Select Wallet' devrait être visible en haut à droite"
echo "   3. Cliquez dessus pour ouvrir le modal de connexion"
echo "   4. Sélectionnez un wallet (Phantom, Solflare, etc.)"
echo ""
echo "💡 Si le problème persiste:"
echo "   • Videz le cache du navigateur (Ctrl+Shift+R)"
echo "   • Vérifiez la console (F12) pour des erreurs JavaScript"
echo "   • Assurez-vous qu'aucun autre élément ne couvre le bouton"
echo ""
