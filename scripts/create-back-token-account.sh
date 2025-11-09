#!/bin/bash

echo ""
echo "🚀 CRÉATION DU COMPTE TOKEN \$BACK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
BACK_MINT="3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn"
TOKEN_PROGRAM="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"

echo "📋 INFORMATION:"
echo "   Token Mint: $BACK_MINT"
echo "   Program: Token-2022 ($TOKEN_PROGRAM)"
echo "   Network: Devnet"
echo ""

echo "⚠️  PRÉREQUIS:"
echo "   1. Avoir Solana CLI installé (solana --version)"
echo "   2. Être connecté au devnet (solana config set --url devnet)"
echo "   3. Avoir du SOL sur devnet (solana airdrop 2)"
echo ""

read -p "🔸 Continuer? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé"
    exit 1
fi

echo ""
echo "🔍 ÉTAPE 1/4: Vérification de la configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier que Solana CLI est installé
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI n'est pas installé"
    echo "   Installation: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

echo "✅ Solana CLI: $(solana --version)"

# Vérifier la configuration
CURRENT_URL=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "   RPC URL: $CURRENT_URL"

if [[ ! $CURRENT_URL == *"devnet"* ]]; then
    echo "⚠️  Vous n'êtes pas sur devnet!"
    read -p "   Basculer vers devnet maintenant? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        solana config set --url devnet
        echo "✅ Basculé vers devnet"
    else
        echo "❌ Veuillez d'abord basculer vers devnet: solana config set --url devnet"
        exit 1
    fi
fi

# Obtenir l'adresse du wallet
WALLET=$(solana address)
echo "   Wallet: $WALLET"

echo ""
echo "💰 ÉTAPE 2/4: Vérification du solde SOL..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BALANCE=$(solana balance | awk '{print $1}')
echo "   Solde actuel: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.01" | bc -l) )); then
    echo "⚠️  Solde insuffisant!"
    echo "   Demande d'airdrop de 2 SOL..."
    solana airdrop 2
    sleep 2
    BALANCE=$(solana balance | awk '{print $1}')
    echo "   Nouveau solde: $BALANCE SOL"
fi

echo ""
echo "🔧 ÉTAPE 3/4: Création du compte token..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Créer le compte token associé pour Token-2022
echo "   Commande: spl-token create-account $BACK_MINT --program-id $TOKEN_PROGRAM"
spl-token create-account $BACK_MINT --program-id $TOKEN_PROGRAM

if [ $? -eq 0 ]; then
    echo "✅ Compte token créé avec succès!"
else
    echo "❌ Erreur lors de la création du compte"
    echo "   Le compte existe peut-être déjà?"
    echo ""
    echo "   Vérification du compte existant..."
    spl-token accounts --program-id $TOKEN_PROGRAM
fi

echo ""
echo "📊 ÉTAPE 4/4: Vérification du compte..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Afficher les comptes tokens
spl-token accounts --program-id $TOKEN_PROGRAM | grep -A 2 "$BACK_MINT" || echo "   Compte non trouvé dans la liste"

echo ""
echo "🎯 RÉCAPITULATIF:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Wallet: $WALLET"
echo "✅ Mint: $BACK_MINT"
echo "✅ Program: Token-2022"
echo "✅ Network: Devnet"
echo ""
echo "📋 PROCHAINES ÉTAPES:"
echo "   1. Vérifier le solde avec:"
echo "      node scripts/check-back-balance.js $WALLET"
echo ""
echo "   2. Recevoir des tokens \$BACK:"
echo "      - Contactez l'équipe pour le faucet"
echo "      - Ou utilisez: spl-token mint $BACK_MINT 1000 (si vous êtes l'autorité)"
echo ""
echo "   3. Tester dans l'interface web:"
echo "      - Allez sur /lock"
echo "      - Vérifiez que le solde s'affiche"
echo "      - Testez le lock de tokens"
echo ""
