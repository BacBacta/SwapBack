#!/bin/bash

# Script de redéploiement d'urgence pour swapback_cnft
# Résout l'erreur DeclaredProgramIdMismatch

set -e

echo "🚀 Redéploiement de swapback_cnft sur devnet"
echo "=============================================="
echo ""

PROGRAM_ID="26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru"
BINARY="target/deploy/swapback_cnft.so"
KEYPAIR="target/deploy/swapback_cnft-keypair.json"

# Vérifier que le binaire existe
if [ ! -f "$BINARY" ]; then
    echo "❌ Erreur: Le binaire $BINARY n'existe pas"
    echo "   Veuillez d'abord compiler le programme avec: anchor build"
    exit 1
fi

# Vérifier que la keypair existe
if [ ! -f "$KEYPAIR" ]; then
    echo "❌ Erreur: La keypair $KEYPAIR n'existe pas"
    exit 1
fi

# Afficher les infos
echo "📋 Configuration:"
echo "   Program ID: $PROGRAM_ID"
echo "   Binary: $BINARY ($(du -h "$BINARY" | cut -f1))"
echo "   Keypair: $KEYPAIR"
echo ""

# Vérifier l'upgrade authority
echo "🔍 Vérification de l'upgrade authority..."
CURRENT_AUTHORITY=$(solana program show $PROGRAM_ID --url devnet 2>&1 | grep "Authority:" | awk '{print $2}')
MY_ADDRESS=$(solana address)

echo "   Current authority: $CURRENT_AUTHORITY"
echo "   My address: $MY_ADDRESS"
echo ""

if [ "$CURRENT_AUTHORITY" != "$MY_ADDRESS" ]; then
    echo "❌ ERREUR: Vous n'êtes pas l'upgrade authority de ce programme"
    echo "   Impossible de mettre à jour le programme"
    exit 1
fi

# Vérifier le solde
BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo "💰 Solde actuel: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
    echo "⚠️  ATTENTION: Solde faible, le déploiement peut échouer"
    echo "   Obtenez des SOL devnet avec: solana airdrop 2 --url devnet"
fi
echo ""

# Confirmer le redéploiement
echo "⚠️  ATTENTION: Cette opération va REMPLACER le programme on-chain existant"
echo ""
read -p "Continuer avec le redéploiement ? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo "❌ Déploiement annulé"
    exit 0
fi

# Redéployer (upgrade)
echo "🔄 Redéploiement en cours..."
solana program deploy \
    --url devnet \
    --program-id "$KEYPAIR" \
    --upgrade-authority ~/.config/solana/id.json \
    "$BINARY"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Redéploiement réussi !"
    echo ""
    
    # Vérifier le programme
    echo "🔍 Vérification du programme redéployé..."
    solana program show $PROGRAM_ID --url devnet
    
    echo ""
    echo "📝 Prochaines étapes:"
    echo "   1. Tester une transaction lock depuis l'interface Vercel"
    echo "   2. Vérifier que l'erreur DeclaredProgramIdMismatch a disparu"
    echo "   3. Réinitialiser les états si nécessaire (collection_config, global_state)"
else
    echo ""
    echo "❌ Erreur lors du redéploiement"
    exit 1
fi
