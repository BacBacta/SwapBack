#!/bin/bash

# Script de déploiement du programme buyback directement dans le conteneur dev
# Utilise Solana CLI maintenant installé

set -e

echo "🚀 Déploiement programme buyback Token-2022 (Conteneur Dev)"
echo "=========================================================="

# Configuration Solana
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# Chemins des fichiers (relatifs au workspace)
PROGRAM_KEYPAIR="/workspaces/SwapBack/target/deploy/swapback_buyback-keypair.json"
PROGRAM_BINARY="/workspaces/SwapBack/target/deploy/swapback_buyback.so"
PROGRAM_ID="9KTkQyjDYHF4vemLZjYQM1XE74peviEi1tSXaYMSyZHT"

echo "📋 Configuration:"
echo "   Programme ID: $PROGRAM_ID"
echo "   Keypair: $PROGRAM_KEYPAIR"
echo "   Binaire: $PROGRAM_BINARY"
echo

# Vérifier que les fichiers existent
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Keypair introuvable: $PROGRAM_KEYPAIR"
    exit 1
fi

if [ ! -f "$PROGRAM_BINARY" ]; then
    echo "❌ Binaire introuvable: $PROGRAM_BINARY"
    exit 1
fi

echo "✅ Fichiers de déploiement trouvés"
echo

# Vérifier Solana CLI
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI non trouvé. Exécutez d'abord setup-solana-dev.sh"
    exit 1
fi

echo "✅ Solana CLI: $(solana --version)"
echo

# Configuration wallet
echo "👛 Configuration wallet..."
if [ ! -f ~/.config/solana/id.json ]; then
    echo "Création d'un nouveau wallet..."
    solana-keygen new --no-passphrase
fi

WALLET=$(solana address)
echo "Adresse wallet: $WALLET"

# Vérifier le solde
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}' | sed 's/SOL//' || echo "0")
echo "Solde actuel: ${BALANCE} SOL"

# Obtenir un airdrop si nécessaire
if (( $(echo "$BALANCE < 5" | bc -l 2>/dev/null || echo "1") )); then
    echo "💰 Obtention d'airdrop (5 SOL)..."
    # solana airdrop 5
    sleep 2
    NEW_BALANCE=$(solana balance | awk '{print $1}')
    echo "Nouveau solde: $NEW_BALANCE"
fi

echo

# Vérifier si le programme existe déjà
echo "🔍 Vérification programme existant..."
if solana program show "$PROGRAM_ID" &>/dev/null; then
    echo "✅ Programme trouvé - mise à jour requise"
    DEPLOY_TYPE="upgrade"
else
    echo "📦 Programme non trouvé - déploiement initial"
    DEPLOY_TYPE="deploy"
fi

echo

# Demander confirmation
echo "⚠️  ATTENTION: Cette opération va $DEPLOY_TYPE le programme buyback"
echo "   avec support Token-2022 sur devnet."
echo
read -p "Continuer ? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 1
fi

echo "🚀 Déploiement en cours..."

# Déployer le programme
if [ "$DEPLOY_TYPE" = "upgrade" ]; then
    solana program deploy \
        --program-id "$PROGRAM_KEYPAIR" \
        "$PROGRAM_BINARY" \
        --upgrade-authority ~/.config/solana/id.json
else
    solana program deploy \
        --program-id "$PROGRAM_KEYPAIR" \
        "$PROGRAM_BINARY"
fi

if [ $? -eq 0 ]; then
    echo
    echo "✅ DÉPLOIEMENT RÉUSSI!"
    echo "========================"
    echo "Programme ID: $PROGRAM_ID"
    echo "Support Token-2022: ✅ Activé"
    echo "Réseau: Devnet"
    echo
    echo "🎯 Prochaines étapes:"
    echo "1. Vérifier: solana program show $PROGRAM_ID"
    echo "2. Tester: cd /workspaces/SwapBack && node test-buyback-compatibility.js"
    echo "3. Initialiser: node scripts/init-buyback-states.js"
    echo
    echo "📊 Informations:"
    echo "   Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
else
    echo
    echo "❌ ÉCHEC DU DÉPLOIEMENT"
    echo "Vérifiez les logs ci-dessus"
    echo
    echo "💡 Solutions possibles:"
    echo "- Vérifiez votre solde: solana balance"
    echo "- Obtenez plus de SOL: # solana airdrop 5"
    echo "- Vérifiez la config: solana config get"
    exit 1
fi