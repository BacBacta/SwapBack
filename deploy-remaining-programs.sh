#!/bin/bash

# Script pour déployer les programmes restants sur devnet
# Prérequis: Avoir au moins 5 SOL sur le wallet

set -e

# Ajouter Solana CLI au PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   SwapBack - Déploiement Programmes Restants (Devnet)       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifications préalables
echo "🔍 Vérifications préalables..."
echo ""

# Vérifier Solana CLI
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI non trouvé"
    echo "   Exécutez d'abord: export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
    exit 1
fi

echo "✅ Solana CLI: $(solana --version)"

# Vérifier la configuration réseau
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "✅ Cluster: $CLUSTER"

if [[ "$CLUSTER" != *"devnet"* ]]; then
    echo "⚠️  Cluster n'est pas devnet. Configuration..."
    solana config set --url https://api.devnet.solana.com
fi

# Vérifier le wallet
WALLET=$(solana address)
echo "✅ Wallet: $WALLET"

# Vérifier le solde
BALANCE=$(solana balance | awk '{print $1}')
echo "💰 Solde: $BALANCE SOL"
echo ""

# Vérifier si suffisant (besoin de ~5 SOL)
BALANCE_LAMPORTS=$(echo "$BALANCE * 1000000000" | bc)
REQUIRED_LAMPORTS=$(echo "5.0 * 1000000000" | bc)

if (( $(echo "$BALANCE_LAMPORTS < $REQUIRED_LAMPORTS" | bc -l) )); then
    echo "❌ Solde insuffisant (besoin de ~5 SOL)"
    echo ""
    echo "Exécutez d'abord:"
    echo "   ./get-devnet-sol.sh"
    echo ""
    exit 1
fi

# Vérifier que les fichiers .so existent
echo "🔍 Vérification des fichiers compilés..."
echo ""

if [ ! -f "target/deploy/swapback_router.so" ]; then
    echo "❌ target/deploy/swapback_router.so non trouvé"
    echo "   Compilez d'abord avec: cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml"
    exit 1
fi

if [ ! -f "target/deploy/swapback_buyback.so" ]; then
    echo "❌ target/deploy/swapback_buyback.so non trouvé"
    echo "   Compilez d'abord avec: cargo build-sbf --manifest-path programs/swapback_buyback/Cargo.toml"
    exit 1
fi

echo "✅ swapback_router.so ($(du -h target/deploy/swapback_router.so | cut -f1))"
echo "✅ swapback_buyback.so ($(du -h target/deploy/swapback_buyback.so | cut -f1))"
echo ""

# Déploiement
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   🚀 DÉPLOIEMENT EN COURS                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Programme 1: Router
echo "📦 [1/2] Déploiement swapback_router..."
echo "─────────────────────────────────────────────────────────────"

ROUTER_OUTPUT=$(solana program deploy target/deploy/swapback_router.so 2>&1)

if echo "$ROUTER_OUTPUT" | grep -q "Program Id:"; then
    ROUTER_PROGRAM_ID=$(echo "$ROUTER_OUTPUT" | grep "Program Id:" | awk '{print $3}')
    ROUTER_SIGNATURE=$(echo "$ROUTER_OUTPUT" | grep "Signature:" | awk '{print $2}')
    
    echo "✅ swapback_router déployé avec succès!"
    echo "   Program ID: $ROUTER_PROGRAM_ID"
    echo "   Signature: $ROUTER_SIGNATURE"
    echo "   Explorer: https://explorer.solana.com/address/$ROUTER_PROGRAM_ID?cluster=devnet"
    echo ""
else
    echo "❌ Échec du déploiement swapback_router"
    echo "$ROUTER_OUTPUT"
    exit 1
fi

# Programme 2: Buyback
echo "📦 [2/2] Déploiement swapback_buyback..."
echo "─────────────────────────────────────────────────────────────"

BUYBACK_OUTPUT=$(solana program deploy target/deploy/swapback_buyback.so 2>&1)

if echo "$BUYBACK_OUTPUT" | grep -q "Program Id:"; then
    BUYBACK_PROGRAM_ID=$(echo "$BUYBACK_OUTPUT" | grep "Program Id:" | awk '{print $3}')
    BUYBACK_SIGNATURE=$(echo "$BUYBACK_OUTPUT" | grep "Signature:" | awk '{print $2}')
    
    echo "✅ swapback_buyback déployé avec succès!"
    echo "   Program ID: $BUYBACK_PROGRAM_ID"
    echo "   Signature: $BUYBACK_SIGNATURE"
    echo "   Explorer: https://explorer.solana.com/address/$BUYBACK_PROGRAM_ID?cluster=devnet"
    echo ""
else
    echo "❌ Échec du déploiement swapback_buyback"
    echo "$BUYBACK_OUTPUT"
    exit 1
fi

# Résumé
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   ✅ DÉPLOIEMENT COMPLET - TOUS LES PROGRAMMES ACTIFS        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 RÉCAPITULATIF DES PROGRAM IDs"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "swapback_cnft    : 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"
echo "swapback_router  : $ROUTER_PROGRAM_ID"
echo "swapback_buyback : $BUYBACK_PROGRAM_ID"
echo ""
echo "─────────────────────────────────────────────────────────────"
echo ""

# Sauvegarder les Program IDs
cat > DEPLOYED_PROGRAM_IDS.txt << EOF
# SwapBack - Program IDs Devnet
# Déployé le: $(date)
# Wallet: $WALLET

swapback_cnft=$CNFT_PROGRAM_ID
swapback_router=$ROUTER_PROGRAM_ID
swapback_buyback=$BUYBACK_PROGRAM_ID

# Explorer Links
cnft_explorer=https://explorer.solana.com/address/9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw?cluster=devnet
router_explorer=https://explorer.solana.com/address/$ROUTER_PROGRAM_ID?cluster=devnet
buyback_explorer=https://explorer.solana.com/address/$BUYBACK_PROGRAM_ID?cluster=devnet
EOF

echo "💾 Program IDs sauvegardés dans: DEPLOYED_PROGRAM_IDS.txt"
echo ""

# Prochaines étapes
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   📋 PROCHAINES ÉTAPES                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Mettre à jour Anchor.toml:"
echo "   [programs.devnet]"
echo "   swapback_cnft    = \"9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw\""
echo "   swapback_router  = \"$ROUTER_PROGRAM_ID\""
echo "   swapback_buyback = \"$BUYBACK_PROGRAM_ID\""
echo ""
echo "2. Mettre à jour app/config/programIds.ts:"
echo "   export const PROGRAM_IDS = {"
echo "     devnet: {"
echo "       cnft: new PublicKey(\"9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw\"),"
echo "       router: new PublicKey(\"$ROUTER_PROGRAM_ID\"),"
echo "       buyback: new PublicKey(\"$BUYBACK_PROGRAM_ID\"),"
echo "     }"
echo "   };"
echo ""
echo "3. Upload IDL files:"
echo "   anchor idl init --filepath target/idl/swapback_cnft.json 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"
echo "   anchor idl init --filepath target/idl/swapback_router.json $ROUTER_PROGRAM_ID"
echo "   anchor idl init --filepath target/idl/swapback_buyback.json $BUYBACK_PROGRAM_ID"
echo ""
echo "4. Initialiser les états:"
echo "   anchor run init-cnft"
echo "   anchor run init-router"
echo "   anchor run init-buyback"
echo ""
echo "5. Tests d'intégration:"
echo "   npm test -- --grep \"devnet\""
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎉 Déploiement terminé! Les programmes sont maintenant actifs sur devnet."
echo "═══════════════════════════════════════════════════════════════"
echo ""
