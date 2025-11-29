#!/bin/bash

# Configuration permanente de Solana CLI dans le conteneur dev
# À ajouter à votre ~/.bashrc ou ~/.zshrc

echo "🔧 Configuration Solana CLI pour conteneur dev..."

# Ajouter Solana au PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Configuration pour devnet
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# Vérifier l'installation
echo "📦 Solana CLI version: $(solana --version)"
echo "🌐 Configuration: $(solana config get)"

# Créer un wallet si nécessaire
if [ ! -f ~/.config/solana/id.json ]; then
    echo "👛 Création d'un wallet Solana..."
    solana-keygen new --no-passphrase
    echo "Adresse: $(solana address)"
fi

echo "✅ Solana CLI configuré avec succès!"
echo "💡 Utilisez 'solana' pour les commandes CLI"