#!/bin/bash

# Script de déploiement manuel du programme buyback
# À exécuter sur une machine avec Solana CLI installé

set -e

echo "🚀 Déploiement manuel programme buyback Token-2022"
echo "================================================"
echo

# Vérifier que Solana CLI est installé
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI n'est pas installé"
    echo "   Installez-le depuis: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Configuration
PROGRAM_KEYPAIR="target/deploy/swapback_buyback-keypair.json"
PROGRAM_BINARY="target/deploy/swapback_buyback.so"
PROGRAM_ID="EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf"

echo "📋 Configuration:"
echo "   Programme ID: $PROGRAM_ID"
echo "   Keypair: $PROGRAM_KEYPAIR"
echo "   Binaire: $PROGRAM_BINARY"
echo

# Vérifier que les fichiers existent
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Keypair du programme introuvable: $PROGRAM_KEYPAIR"
    exit 1
fi

if [ ! -f "$PROGRAM_BINARY" ]; then
    echo "❌ Binaire du programme introuvable: $PROGRAM_BINARY"
    exit 1
fi

echo "✅ Fichiers de déploiement trouvés"
echo

# Configurer Solana pour devnet
echo "🌐 Configuration Solana pour devnet..."
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# Afficher la configuration actuelle
echo "📊 Configuration actuelle:"
solana config get
echo

# Vérifier le solde du wallet
WALLET=$(solana address)
echo "👛 Wallet: $WALLET"

BALANCE=$(solana balance | awk '{print $1}')
echo "💰 Solde: $BALANCE SOL"

# Vérifier si le solde est suffisant (minimum 5 SOL)
BALANCE_NUM=$(echo "$BALANCE" | sed 's/SOL//')
if (( $(echo "$BALANCE_NUM < 5" | bc -l) )); then
    echo "⚠️  Solde insuffisant ($BALANCE_NUM SOL). Il faut au moins 5 SOL."
    echo
    echo "💡 Obtenez un airdrop:"
    echo "   solana airdrop 5"
    echo
    echo "   Ou visitez: https://faucet.solana.com"
    exit 1
fi

echo "✅ Solde suffisant"
echo

# Vérifier si le programme existe déjà
echo "🔍 Vérification du programme existant..."
if solana program show "$PROGRAM_ID" &> /dev/null; then
    echo "✅ Programme trouvé - mise à jour requise"
    DEPLOY_TYPE="upgrade"
else
    echo "📦 Programme non trouvé - déploiement initial"
    DEPLOY_TYPE="deploy"
fi

echo

# Demander confirmation
echo "⚠️  ATTENTION: Cette opération va $DEPLOY_TYPE le programme buyback"
echo "   avec support Token-2022."
echo
read -p "Continuer ? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 1
fi

echo
echo "🚀 Déploiement en cours..."

# Déployer ou mettre à jour le programme
if [ "$DEPLOY_TYPE" = "upgrade" ]; then
    # Mise à jour du programme existant
    echo "⬆️  Mise à jour du programme..."
    solana program deploy \
        --program-id "$PROGRAM_KEYPAIR" \
        "$PROGRAM_BINARY" \
        --upgrade-authority ~/.config/solana/id.json
else
    # Déploiement initial
    echo "📦 Déploiement initial..."
    solana program deploy \
        --program-id "$PROGRAM_KEYPAIR" \
        "$PROGRAM_BINARY"
fi

if [ $? -eq 0 ]; then
    echo
    echo "✅ DÉPLOIEMENT RÉUSSI !"
    echo "=========================="
    echo "Programme ID: $PROGRAM_ID"
    echo "Support Token-2022: ✅ Activé"
    echo
    echo "🎯 Prochaines étapes:"
    echo "1. Tester la compatibilité: node test-buyback-compatibility.js"
    echo "2. Initialiser les états: node scripts/init-buyback-states.js"
    echo "3. Tester le flow complet: lock → buyback → claim"
    echo
    echo "📊 Vérifier le programme:"
    echo "   solana program show $PROGRAM_ID"
else
    echo
    echo "❌ ÉCHEC DU DÉPLOIEMENT"
    echo "========================"
    echo "Vérifiez les logs ci-dessus pour les détails"
    echo
    echo "💡 Solutions possibles:"
    echo "- Vérifiez votre solde: solana balance"
    echo "- Obtenez un airdrop: solana airdrop 5"
    echo "- Vérifiez la configuration: solana config get"
    exit 1
fi