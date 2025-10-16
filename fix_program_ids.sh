#!/bin/bash

# Script pour générer les IDs de programme et mettre à jour les déclarations

cd /workspaces/SwapBack

# Générer les keypairs de programme s'ils n'existent pas
mkdir -p target/deploy

# Générer les keypairs pour chaque programme
for program in swapback_buyback swapback_cnft swapback_router common_swap; do
    KEY_FILE="target/deploy/${program}-keypair.json"
    if [ ! -f "$KEY_FILE" ]; then
        echo "Generating keypair for $program..."
        solana-keygen grind-validator-keys --derivation-path "m/44'/501'/$RANDOM'/0'" --output "$KEY_FILE" 2>/dev/null || solana-keygen new --no-passphrase -o "$KEY_FILE" 2>/dev/null
    fi
    
    # Extraire l'ID public et l'afficher
    ID=$(solana-keygen pubkey "$KEY_FILE")
    echo "$program: $ID"
done
