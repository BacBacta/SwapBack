#!/bin/bash

# Script de déploiement automatique sur Testnet
# Usage: ./deploy-testnet.sh

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║          🚀 DÉPLOIEMENT SWAPBACK SUR TESTNET                            ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
NETWORK="testnet"
RPC_URL="https://api.testnet.solana.com"
WALLET=$(solana address)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOYMENT_LOG="testnet_deployment_${TIMESTAMP}.log"

echo "📋 Configuration:"
echo "   • Network: $NETWORK"
echo "   • RPC: $RPC_URL"
echo "   • Wallet: $WALLET"
echo "   • Log file: $DEPLOYMENT_LOG"
echo ""

# Fonction de logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$DEPLOYMENT_LOG"
}

# Vérifier le solde
log "Vérification du solde testnet..."
BALANCE=$(solana balance --url $NETWORK | grep -o '[0-9.]*')
log "Solde actuel: $BALANCE SOL"

if (( $(echo "$BALANCE < 20" | bc -l) )); then
    log "⚠️  ATTENTION: Solde insuffisant ($BALANCE SOL < 20 SOL requis)"
    log "💡 Obtenir des SOL testnet:"
    log "   1. Faucet officiel: https://faucet.solana.com"
    log "   2. Discord Solana: #testnet-faucet"
    log "   3. QuickNode Faucet: https://faucet.quicknode.com/solana/testnet"
    echo ""
    read -p "Continuer quand même? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "❌ Déploiement annulé par l'utilisateur"
        exit 1
    fi
fi

# Étape 1: Build des programmes
log "═══════════════════════════════════════════════════════════════"
log "ÉTAPE 1/7: Build des programmes Solana"
log "═══════════════════════════════════════════════════════════════"

cd /workspaces/SwapBack
anchor build 2>&1 | tee -a "$DEPLOYMENT_LOG"

if [ $? -eq 0 ]; then
    log "✅ Build réussi"
else
    log "❌ Erreur lors du build"
    exit 1
fi

# Étape 2: Déployer les programmes
log ""
log "═══════════════════════════════════════════════════════════════"
log "ÉTAPE 2/7: Déploiement des programmes"
log "═══════════════════════════════════════════════════════════════"

# Déployer CNFT
log "Déploiement swapback_cnft..."
CNFT_PROGRAM_ID=$(anchor deploy --provider.cluster $NETWORK --program-name swapback_cnft 2>&1 | tee -a "$DEPLOYMENT_LOG" | grep "Program Id:" | awk '{print $NF}')
log "✅ swapback_cnft déployé: $CNFT_PROGRAM_ID"
sleep 2

# Déployer Router
log "Déploiement swapback_router..."
ROUTER_PROGRAM_ID=$(anchor deploy --provider.cluster $NETWORK --program-name swapback_router 2>&1 | tee -a "$DEPLOYMENT_LOG" | grep "Program Id:" | awk '{print $NF}')
log "✅ swapback_router déployé: $ROUTER_PROGRAM_ID"
sleep 2

# Déployer Buyback
log "Déploiement swapback_buyback..."
BUYBACK_PROGRAM_ID=$(anchor deploy --provider.cluster $NETWORK --program-name swapback_buyback 2>&1 | tee -a "$DEPLOYMENT_LOG" | grep "Program Id:" | awk '{print $NF}')
log "✅ swapback_buyback déployé: $BUYBACK_PROGRAM_ID"

# Étape 3: Créer les tokens
log ""
log "═══════════════════════════════════════════════════════════════"
log "ÉTAPE 3/7: Création des tokens"
log "═══════════════════════════════════════════════════════════════"

# Créer BACK token
log "Création du token BACK..."
BACK_MINT=$(spl-token create-token --decimals 9 --url $NETWORK 2>&1 | grep "Creating token" | awk '{print $NF}')
log "✅ BACK mint créé: $BACK_MINT"

# Créer token account
log "Création du token account BACK..."
BACK_ACCOUNT=$(spl-token create-account $BACK_MINT --url $NETWORK 2>&1 | grep "Creating account" | awk '{print $NF}')
log "✅ BACK account créé: $BACK_ACCOUNT"

# Mint initial supply
log "Mint de 1 milliard BACK..."
spl-token mint $BACK_MINT 1000000000 --url $NETWORK 2>&1 | tee -a "$DEPLOYMENT_LOG"
log "✅ 1,000,000,000 BACK mintés"

# Note: Pour USDC, utiliser le mock testnet existant ou en créer un
USDC_MOCK="BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR"  # Devnet USDC, créer un vrai pour testnet si besoin
log "ℹ️  USDC mock: $USDC_MOCK (à remplacer par vrai testnet USDC si nécessaire)"

# Étape 4: Initialiser les états
log ""
log "═══════════════════════════════════════════════════════════════"
log "ÉTAPE 4/7: Initialisation des états on-chain"
log "═══════════════════════════════════════════════════════════════"

# Router State
log "Initialisation Router State..."
cd /workspaces/SwapBack
ROUTER_STATE_OUTPUT=$(node scripts/init-router-state.js 2>&1 | tee -a "$DEPLOYMENT_LOG")
ROUTER_STATE=$(echo "$ROUTER_STATE_OUTPUT" | grep -oP 'RouterState.*: \K[A-Za-z0-9]+' | head -1)
log "✅ RouterState initialisé: $ROUTER_STATE"

# Buyback State  
log "Initialisation Buyback State..."
BUYBACK_STATE_OUTPUT=$(node scripts/init-buyback-state.js 2>&1 | tee -a "$DEPLOYMENT_LOG")
BUYBACK_STATE=$(echo "$BUYBACK_STATE_OUTPUT" | grep -oP 'BuybackState.*: \K[A-Za-z0-9]+' | head -1)
log "✅ BuybackState initialisé: $BUYBACK_STATE"

# Global State
log "Initialisation Global State..."
GLOBAL_STATE_OUTPUT=$(node scripts/init-global-state.js 2>&1 | tee -a "$DEPLOYMENT_LOG")
GLOBAL_STATE=$(echo "$GLOBAL_STATE_OUTPUT" | grep -oP 'GlobalState.*: \K[A-Za-z0-9]+' | head -1)
log "✅ GlobalState initialisé: $GLOBAL_STATE"

# Étape 5: Collection Config
log ""
log "═══════════════════════════════════════════════════════════════"
log "ÉTAPE 5/7: Configuration de la collection cNFT"
log "═══════════════════════════════════════════════════════════════"

log "Initialisation Collection Config..."
COLLECTION_OUTPUT=$(node scripts/init-collection-config.js 2>&1 | tee -a "$DEPLOYMENT_LOG")
COLLECTION_CONFIG=$(echo "$COLLECTION_OUTPUT" | grep -oP 'CollectionConfig.*: \K[A-Za-z0-9]+' | head -1)
log "✅ CollectionConfig initialisé: $COLLECTION_CONFIG"

# Étape 6: Créer Merkle Tree
log ""
log "═══════════════════════════════════════════════════════════════"
log "ÉTAPE 6/7: Création de l'arbre Merkle (16,384 cNFTs)"
log "═══════════════════════════════════════════════════════════════"

log "Création Merkle Tree (maxDepth=14, maxBufferSize=64)..."
TREE_OUTPUT=$(node scripts/create-merkle-tree.js 2>&1 | tee -a "$DEPLOYMENT_LOG")
MERKLE_TREE=$(echo "$TREE_OUTPUT" | grep -oP 'Merkle Tree.*: \K[A-Za-z0-9]+' | head -1)
log "✅ Merkle Tree créé: $MERKLE_TREE"

# Étape 7: Sauvegarder la configuration
log ""
log "═══════════════════════════════════════════════════════════════"
log "ÉTAPE 7/7: Sauvegarde de la configuration"
log "═══════════════════════════════════════════════════════════════"

CONFIG_FILE="testnet_deployment_${TIMESTAMP}.json"

cat > "$CONFIG_FILE" << EOF
{
  "network": "$NETWORK",
  "rpc_url": "$RPC_URL",
  "deployed_at": "$(date -Iseconds)",
  "deployer": "$WALLET",
  "programs": {
    "swapback_cnft": "$CNFT_PROGRAM_ID",
    "swapback_router": "$ROUTER_PROGRAM_ID",
    "swapback_buyback": "$BUYBACK_PROGRAM_ID"
  },
  "tokens": {
    "back_mint": "$BACK_MINT",
    "back_account": "$BACK_ACCOUNT",
    "usdc_mock": "$USDC_MOCK"
  },
  "states": {
    "router_state": "$ROUTER_STATE",
    "buyback_state": "$BUYBACK_STATE",
    "global_state": "$GLOBAL_STATE",
    "collection_config": "$COLLECTION_CONFIG"
  },
  "merkle_tree": "$MERKLE_TREE",
  "fees": {
    "platform_fee_bps": 20,
    "platform_fee_percent": "0.20%",
    "buyback_allocation_bps": 4000,
    "buyback_allocation_percent": "40%"
  }
}
EOF

log "✅ Configuration sauvegardée: $CONFIG_FILE"

# Créer fichier .env pour frontend
ENV_FILE="app/.env.testnet"
cat > "$ENV_FILE" << EOF
# Testnet Configuration - Generated $(date)
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=$RPC_URL

# Program IDs
NEXT_PUBLIC_ROUTER_PROGRAM_ID=$ROUTER_PROGRAM_ID
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=$BUYBACK_PROGRAM_ID
NEXT_PUBLIC_CNFT_PROGRAM_ID=$CNFT_PROGRAM_ID

# Tokens
NEXT_PUBLIC_BACK_MINT=$BACK_MINT
NEXT_PUBLIC_USDC_MINT=$USDC_MOCK

# Infrastructure
NEXT_PUBLIC_MERKLE_TREE=$MERKLE_TREE
NEXT_PUBLIC_COLLECTION_CONFIG=$COLLECTION_CONFIG

# Fees
NEXT_PUBLIC_PLATFORM_FEE_BPS=20
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=0.20
EOF

log "✅ Fichier .env créé: $ENV_FILE"

# Afficher le résumé
log ""
log "╔══════════════════════════════════════════════════════════════════════════╗"
log "║                   ✅ DÉPLOIEMENT TESTNET TERMINÉ                         ║"
log "╚══════════════════════════════════════════════════════════════════════════╝"
log ""
log "📦 Programs déployés:"
log "   • CNFT:    $CNFT_PROGRAM_ID"
log "   • Router:  $ROUTER_PROGRAM_ID"  
log "   • Buyback: $BUYBACK_PROGRAM_ID"
log ""
log "🪙 Tokens créés:"
log "   • BACK: $BACK_MINT"
log "   • Supply: 1,000,000,000 BACK"
log ""
log "🌲 Infrastructure:"
log "   • Merkle Tree: $MERKLE_TREE (16,384 cNFTs)"
log "   • Collection:  $COLLECTION_CONFIG"
log ""
log "💰 Fees configurés:"
log "   • Platform Fee: 0.20% (20 basis points)"
log "   • 33% moins cher qu'Orca (0.30%)"
log "   • 20% moins cher que Raydium (0.25%)"
log ""
log "📄 Fichiers générés:"
log "   • Config JSON: $CONFIG_FILE"
log "   • Frontend .env: $ENV_FILE"
log "   • Logs: $DEPLOYMENT_LOG"
log ""
log "🚀 Prochaines étapes:"
log "   1. Copier $ENV_FILE vers app/.env.local"
log "   2. Redémarrer le serveur frontend"
log "   3. Tester les flows (lock, mint, swap, buyback)"
log "   4. Lancer UAT avec beta testers"
log ""

echo "Déploiement terminé avec succès! 🎉"
