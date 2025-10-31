#!/bin/bash

echo "🚀 Déploiement rapide Programme Buyback Token-2022"
echo "=================================================="

# Installation Solana CLI
if ! command -v solana &> /dev/null; then
    echo "📦 Installation Solana CLI..."
    curl -L http://release.anza.xyz/v1.18.22/install | sh
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Configuration
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# Vérifier wallet
if [ ! -f ~/.config/solana/id.json ]; then
    echo "👛 Création wallet..."
    solana-keygen new --no-passphrase
fi

echo "💰 Solde: $(solana balance)"
echo "📍 Adresse: $(solana address)"

# Déployer
echo "🚀 Déploiement..."
solana program deploy --program-id program-keypair.json program.so

echo "✅ Déploiement terminé!"
echo "Programme ID: 92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir"
