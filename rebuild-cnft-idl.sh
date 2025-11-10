#!/bin/bash
set -e

echo "🔧 Rebuilding swapback_cnft program to generate correct IDL..."

cd /workspaces/SwapBack

# Build only the CNFT program
echo "📦 Building CNFT program..."
anchor build -p swapback_cnft

# Check if IDL was generated
if [ -f "target/idl/swapback_cnft.json" ]; then
    echo "✅ IDL generated successfully"
    
    # Show the instructions in the generated IDL
    echo ""
    echo "📋 Instructions in generated IDL:"
    cat target/idl/swapback_cnft.json | jq -r '.instructions[].name' | nl
    
    # Copy to frontend
    echo ""
    echo "📁 Copying IDL to frontend..."
    cp target/idl/swapback_cnft.json app/src/idl/swapback_cnft.json
    
    echo "✅ IDL updated in app/src/idl/swapback_cnft.json"
    
    # Verify lock_tokens is present
    if grep -q '"name": "lock_tokens"' app/src/idl/swapback_cnft.json; then
        echo "✅ lock_tokens instruction found in IDL"
    else
        echo "❌ WARNING: lock_tokens instruction NOT found in IDL"
        exit 1
    fi
    
    if grep -q '"name": "unlock_tokens"' app/src/idl/swapback_cnft.json; then
        echo "✅ unlock_tokens instruction found in IDL"
    else
        echo "❌ WARNING: unlock_tokens instruction NOT found in IDL"
        exit 1
    fi
    
    echo ""
    echo "🎉 IDL rebuild complete!"
else
    echo "❌ ERROR: IDL file not generated at target/idl/swapback_cnft.json"
    exit 1
fi
