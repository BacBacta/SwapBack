#!/bin/bash
# Script pour créer le token $BACK sur devnet et mainnet
# Date: 31 octobre 2025

set -e

CLUSTER=${1:-devnet}

echo "🪙 Creating $BACK Token on $CLUSTER..."
echo ""

if [ "$CLUSTER" = "mainnet-beta" ] || [ "$CLUSTER" = "mainnet" ]; then
    echo "⚠️  WARNING: You are about to create the token on MAINNET!"
    echo "This will require real SOL for transaction fees."
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Aborted."
        exit 1
    fi
    CLUSTER="mainnet-beta"
fi

# Configuration
DECIMALS=9
TOTAL_SUPPLY=1000000000  # 1 billion tokens
TOKEN_NAME="SwapBack"
TOKEN_SYMBOL="BACK"

echo "📋 Token Configuration:"
echo "   Name: $TOKEN_NAME"
echo "   Symbol: $TOKEN_SYMBOL"
echo "   Decimals: $DECIMALS"
echo "   Total Supply: $TOTAL_SUPPLY"
echo "   Cluster: $CLUSTER"
echo ""

# Create mint keypair directory if not exists
mkdir -p keypairs

# Generate mint keypair if not exists
if [ ! -f "keypairs/back-mint-$CLUSTER.json" ]; then
    echo "🔑 Generating mint keypair..."
    solana-keygen new --no-bip39-passphrase -o "keypairs/back-mint-$CLUSTER.json"
else
    echo "🔑 Using existing mint keypair: keypairs/back-mint-$CLUSTER.json"
fi

# Set cluster
solana config set --url $([ "$CLUSTER" = "devnet" ] && echo "https://api.devnet.solana.com" || echo "https://api.mainnet-beta.solana.com")

# Get current wallet
WALLET=$(solana address)
echo "👛 Current wallet: $WALLET"

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo "💰 Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
    echo "❌ Insufficient balance. Need at least 0.5 SOL."
    if [ "$CLUSTER" = "devnet" ]; then
        echo "📥 Requesting airdrop..."
        solana airdrop 2
    else
        exit 1
    fi
fi

echo ""
echo "🏗️  Creating token mint..."

# Create token (using Token Program, not Token-2022 for compatibility)
MINT_ADDRESS=$(spl-token create-token \
    --decimals $DECIMALS \
    --enable-metadata \
    keypairs/back-mint-$CLUSTER.json \
    2>&1 | grep "Creating token" | awk '{print $3}')

if [ -z "$MINT_ADDRESS" ]; then
    echo "❌ Failed to create token mint"
    exit 1
fi

echo "✅ Token created: $MINT_ADDRESS"
echo ""

# Initialize metadata (Metaplex)
echo "📝 Initializing token metadata..."
spl-token initialize-metadata \
    $MINT_ADDRESS \
    "$TOKEN_NAME" \
    "$TOKEN_SYMBOL" \
    "https://swapback.io/metadata.json"

echo "✅ Metadata initialized"
echo ""

# Create associated token account for wallet
echo "🏦 Creating token account..."
TOKEN_ACCOUNT=$(spl-token create-account $MINT_ADDRESS 2>&1 | grep "Creating account" | awk '{print $3}')
echo "✅ Token account created: $TOKEN_ACCOUNT"
echo ""

# Mint initial supply
echo "🪙 Minting initial supply ($TOTAL_SUPPLY tokens)..."
spl-token mint $MINT_ADDRESS $TOTAL_SUPPLY
echo "✅ Initial supply minted"
echo ""

# Display info
echo "📊 Token Info:"
spl-token display $MINT_ADDRESS
echo ""

# Save addresses to file
CONFIG_FILE="token-config-$CLUSTER.env"
cat > $CONFIG_FILE << EOF
# $BACK Token Configuration - $CLUSTER
# Generated on $(date)

BACK_MINT_ADDRESS=$MINT_ADDRESS
BACK_TOKEN_ACCOUNT=$TOKEN_ACCOUNT
BACK_DECIMALS=$DECIMALS
BACK_TOTAL_SUPPLY=$TOTAL_SUPPLY
BACK_CLUSTER=$CLUSTER
BACK_MINT_AUTHORITY=$WALLET

# Tokenomics Distribution (recommended)
# 30% - Liquidity Pools (300M)
# 20% - Team (vested 2 years) (200M)
# 20% - Community Rewards (200M)
# 15% - Marketing & Partnerships (150M)
# 15% - Protocol Reserve (150M)
EOF

echo "✅ Configuration saved to $CONFIG_FILE"
echo ""

echo "🎉 $BACK Token Created Successfully!"
echo ""
echo "📋 Next Steps:"
echo "   1. Update sdk/src/constants.ts with BACK_MINT_ADDRESS"
echo "   2. Distribute tokens according to tokenomics"
echo "   3. Create liquidity pools"
echo "   4. Update .env files with token address"
echo ""
echo "🔐 IMPORTANT: Backup keypairs/back-mint-$CLUSTER.json securely!"
echo ""

if [ "$CLUSTER" = "mainnet-beta" ]; then
    echo "⚠️  MAINNET CHECKLIST:"
    echo "   [ ] Verify metadata.json is hosted at https://swapback.io/metadata.json"
    echo "   [ ] Upload token logo to metadata.json"
    echo "   [ ] Setup multisig for mint authority (recommended)"
    echo "   [ ] Consider revoking mint authority after distribution"
    echo "   [ ] List token on Solana token list"
    echo ""
fi
