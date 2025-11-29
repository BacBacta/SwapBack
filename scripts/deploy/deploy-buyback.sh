#!/bin/bash
# Script de déploiement du programme buyback
set -e

echo "🚀 Déploiement programme buyback avec support Token-2022..."

# Configuration devnet
solana config set --url https://api.devnet.solana.com

# Vérifier solde
BALANCE=$(solana balance | awk '{print $1}')
echo "Solde actuel: $BALANCE SOL"

if (( $(echo "$BALANCE < 2.0" | bc -l) )); then
  echo "Demande d'airdrop..."
  solana airdrop 5
fi

# Déploiement
echo "Déploiement du programme..."
solana program deploy --program-id target/deploy/swapback_buyback-keypair.json target/deploy/swapback_buyback.so

echo "✅ Déploiement terminé!"
echo "Programme ID: EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf"
