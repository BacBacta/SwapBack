#!/bin/bash
set -e

echo "🚀 SwapBack Devnet Deployment Script"
echo "======================================"

# Configuration
PROGRAM_ID="GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E"
WALLET_KEYPAIR="devnet-keypair.json"
PROGRAM_KEYPAIR="target/deploy/swapback_cnft-keypair.json"
BINARY="swapback_cnft.so"
RPC_URL="https://api.devnet.solana.com"

# Vérifier fichiers nécessaires
if [ ! -f "$WALLET_KEYPAIR" ]; then
    echo "❌ Erreur: $WALLET_KEYPAIR non trouvé"
    exit 1
fi

if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Erreur: $PROGRAM_KEYPAIR non trouvé"
    exit 1
fi

if [ ! -f "$BINARY" ]; then
    echo "❌ Erreur: $BINARY non trouvé"
    exit 1
fi

echo "✅ Fichiers vérifiés:"
echo "   - Wallet: $(wc -c < "$WALLET_KEYPAIR") bytes"
echo "   - Program Keypair: $(wc -c < "$PROGRAM_KEYPAIR") bytes"
echo "   - Binary: $(wc -c < "$BINARY") bytes"
echo ""

# Utiliser npm/web3.js pour vérifier wallet
echo "📋 Vérification du wallet..."
cat > /tmp/check-wallet.js << 'NODEJS'
const fs = require('fs');
const path = require('path');

try {
  const keypairPath = process.argv[1];
  const keypair = JSON.parse(fs.readFileSync(keypairPath));
  if (Array.isArray(keypair) && keypair.length === 64) {
    console.log('✅ Keypair valide (64 bytes)');
    process.exit(0);
  } else {
    console.log('❌ Format keypair invalide');
    process.exit(1);
  }
} catch(e) {
  console.log('❌ Erreur: ' + e.message);
  process.exit(1);
}
NODEJS

node /tmp/check-wallet.js "$WALLET_KEYPAIR" 2>/dev/null || echo "⚠️ Impossible de vérifier (node pas disponible)"
echo ""

# Crédits estimés
BINARY_SIZE=$(wc -c < "$BINARY")
ESTIMATED_COST=$(( (BINARY_SIZE / 10240) + 1 ))
echo "💰 Coût estimé de déploiement: ~$ESTIMATED_COST SOL"
echo "   (1 SOL par 10KB + frais réseau)"
echo ""

# Instructions de déploiement manuel
echo "📝 Instructions de déploiement manuel:"
echo ""
echo "Depuis votre machine locale avec Solana CLI installé:"
echo ""
echo "# 1. Copier le fichier depuis le codespace"
echo "   scp codespace:/workspaces/SwapBack/$BINARY ./"
echo "   scp codespace:/workspaces/SwapBack/$WALLET_KEYPAIR ./"
echo "   scp codespace:/workspaces/SwapBack/$PROGRAM_KEYPAIR ./"
echo ""
echo "# 2. Configurer le réseau devnet"
echo "   solana config set --url https://api.devnet.solana.com"
echo ""
echo "# 3. Déployer le programme"
echo "   solana program deploy $BINARY \\"
echo "     --program-id $PROGRAM_KEYPAIR \\"
echo "     -k $WALLET_KEYPAIR"
echo ""
echo "# 4. Vérifier le déploiement"
echo "   solana program show $PROGRAM_ID --url https://api.devnet.solana.com"
echo ""

# Alternativement: créer un endpoint de déploiement web
echo "🌐 Ou utiliser un service de déploiement en ligne:"
echo ""
echo "# Voici les données de déploiement JSON:"
cat > /tmp/deploy-config.json << JSONEOF
{
  "program_id": "$PROGRAM_ID",
  "program_keypair": "$PROGRAM_KEYPAIR",
  "binary_size": $BINARY_SIZE,
  "wallet": "$WALLET_KEYPAIR",
  "rpc_url": "$RPC_URL",
  "deployment_type": "upgrade"
}
JSONEOF

cat /tmp/deploy-config.json
echo ""

# Script d'automatisation avec Rust/web3.rs (pour codespace)
echo "🔧 Script de déploiement automatisé (Rust/anchor/web3):"
echo ""
cat > /tmp/deploy-rust-snippet.rs << 'RUSTEOF'
// Pseudo-code pour déploiement avec web3.rs
// À intégrer dans un binaire Rust

use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::transaction::Transaction;
use solana_sdk::system_instruction::create_account;
use solana_client::rpc_client::RpcClient;
use std::fs;

#[tokio::main]
async fn main() {
    let client = RpcClient::new("https://api.devnet.solana.com".to_string());
    
    // Charger les keypairs
    let wallet: Vec<u8> = serde_json::from_slice(
        &fs::read("devnet-keypair.json").unwrap()
    ).unwrap();
    let payer = Keypair::from_secret_key(&wallet);
    
    // Lire le binaire
    let program_data = fs::read("swapback_cnft.so").unwrap();
    
    // Envoyer transaction de déploiement
    // (Utiliser solana_sdk::bpf_loader::...)
    
    println!("✅ Programme déployé!");
}
RUSTEOF

cat /tmp/deploy-rust-snippet.rs
echo ""

echo "✅ Configuration d'avant-déploiement complétée!"
echo ""
echo "⚠️  NOTE: Le déploiement manuel sur devnet nécessite Solana CLI"
echo "         sur votre machine locale avec accès au RPC public."
echo ""
