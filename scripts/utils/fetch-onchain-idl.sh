#!/bin/bash
# Fetch the on-chain IDL from the deployed program

PROGRAM_ID="FsD6D5yakUipRtFXXbgBf5YaE1ABVEocFDTLB3z2MxnB"

echo "🔍 Fetching on-chain IDL for program: $PROGRAM_ID"

# Try to fetch the IDL from devnet
solana config set --url https://api.devnet.solana.com

# Use anchor idl fetch if available
if command -v anchor &> /dev/null; then
    echo "📥 Fetching IDL using Anchor..."
    anchor idl fetch $PROGRAM_ID -o /tmp/swapback_cnft_onchain.json --provider.cluster devnet
    
    if [ -f "/tmp/swapback_cnft_onchain.json" ]; then
        echo "✅ IDL fetched successfully!"
        cat /tmp/swapback_cnft_onchain.json | jq '.instructions[].name'
    else
        echo "❌ IDL not found on-chain"
    fi
else
    echo "❌ Anchor CLI not available"
fi
