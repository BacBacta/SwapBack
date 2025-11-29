#!/bin/bash
set -e

# SwapBack Devnet Deployment via Solana CLI
# Script à exécuter depuis une machine avec Solana CLI v1.18.26+

echo "🚀 SwapBack Devnet Deployment"
echo "=============================="
echo ""

# Configuration
PROGRAM_ID="GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E"
BINARY="swapback_cnft.so"
WALLET_KEYPAIR="devnet-keypair.json"
PROGRAM_KEYPAIR="target/deploy/swapback_cnft-keypair.json"
RPC_URL="https://api.devnet.solana.com"

# Vérifier que solana CLI est installé
if ! command -v solana &> /dev/null; then
    echo "❌ Erreur: Solana CLI n'est pas installé"
    echo ""
    echo "Installation:"
    echo "  sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.26/install)\""
    echo "  export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
    exit 1
fi

SOLANA_VERSION=$(solana --version | cut -d' ' -f2)
echo "✅ Solana CLI v$SOLANA_VERSION détecté"
echo ""

# Vérifier les fichiers
if [ ! -f "$BINARY" ]; then
    echo "❌ Erreur: $BINARY non trouvé"
    echo "   Veuillez copier le fichier depuis le codespace:"
    echo "   scp codespace:/workspaces/SwapBack/$BINARY ./"
    exit 1
fi

if [ ! -f "$WALLET_KEYPAIR" ]; then
    echo "❌ Erreur: $WALLET_KEYPAIR non trouvé"
    echo "   Veuillez copier le fichier depuis le codespace:"
    echo "   scp codespace:/workspaces/SwapBack/$WALLET_KEYPAIR ./"
    exit 1
fi

if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Erreur: $PROGRAM_KEYPAIR non trouvé"
    echo "   Veuillez copier le fichier depuis le codespace:"
    echo "   scp codespace:/workspaces/SwapBack/$PROGRAM_KEYPAIR ./"
    exit 1
fi

echo "✅ Fichiers vérifiés:"
echo "   - Binary: $(stat -f%z "$BINARY" 2>/dev/null || stat --printf=%s "$BINARY") bytes"
echo "   - Wallet keypair: OK"
echo "   - Program keypair: OK"
echo ""

# Configurer Solana CLI
echo "📋 Configuration Solana CLI..."
solana config set --url "$RPC_URL"
echo "   ✅ RPC URL configuré: $RPC_URL"
echo ""

# Vérifier le solde
WALLET_PUBKEY=$(solana-keygen pubkey "$WALLET_KEYPAIR")
echo "💼 Wallet public key: $WALLET_PUBKEY"
BALANCE=$(solana balance -k "$WALLET_KEYPAIR" --url "$RPC_URL")
echo "💰 Solde: $BALANCE"
echo ""

# Vérifier si le programme existe déjà
echo "🔍 Vérification du programme sur devnet..."
if solana program show "$PROGRAM_ID" --url "$RPC_URL" &>/dev/null; then
    echo "   ✅ Programme EXISTS - Procéder à UPGRADE"
    OPERATION="upgrade"
else
    echo "   ⚠️  Programme NOT FOUND - Procéder à NEW DEPLOYMENT"
    OPERATION="deploy"
fi
echo ""

# Déploiement
echo "📤 Déploiement du programme..."
echo "   Commande: solana program deploy $BINARY --program-id $PROGRAM_KEYPAIR -k $WALLET_KEYPAIR"
echo ""

if [ "$OPERATION" = "upgrade" ]; then
    echo "   Type: UPGRADE"
    echo "   Program ID: $PROGRAM_ID"
else
    echo "   Type: NEW DEPLOYMENT"
    echo "   Program ID: $PROGRAM_ID"
fi

echo ""
echo "⚠️  Confirmation requise!"
echo "   Coût estimé: ~1-2 SOL"
echo ""
read -p "   Continuer? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 1
fi

# Exécuter le déploiement
echo ""
echo "🚀 Envoi du programme..."
solana program deploy "$BINARY" \
    --program-id "$PROGRAM_KEYPAIR" \
    -k "$WALLET_KEYPAIR" \
    --url "$RPC_URL"

echo ""
echo "⏳ Vérification..."
sleep 5

# Vérifier le résultat
if solana program show "$PROGRAM_ID" --url "$RPC_URL" &>/dev/null; then
    echo "✅ SUCCÈS! Programme déployé sur devnet"
    echo ""
    echo "📝 Informations:"
    solana program show "$PROGRAM_ID" --url "$RPC_URL"
    echo ""
    echo "🎉 Prochaines étapes:"
    echo "   1. Mettre à jour .env.devnet avec:"
    echo "      VITE_PROGRAM_ID=$PROGRAM_ID"
    echo "   2. Configurer le frontend avec le Program ID"
    echo "   3. Tester les transactions de lock/unlock"
else
    echo "❌ ERREUR: Le programme n'a pas pu être déployé"
    exit 1
fi
