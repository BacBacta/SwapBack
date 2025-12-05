#!/bin/bash
# Initialize Buyback State with New Program ID

set -e

echo "🚀 Initializing Buyback State"
echo "=============================="
echo ""

NEW_PROGRAM_ID="4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK"
BACK_MINT="862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
USDC_MINT="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" # Devnet

WALLET=$(solana address)

echo "📊 Configuration:"
echo "   Program ID: $NEW_PROGRAM_ID"
echo "   BACK Mint: $BACK_MINT"
echo "   USDC Mint: $USDC_MINT"
echo "   Authority: $WALLET"
echo ""

# Derive PDAs
echo "🔍 Deriving PDAs..."

node -e "
const { PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey('$NEW_PROGRAM_ID');

const [buybackState, buybackBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('buyback_state')],
  PROGRAM_ID
);

const [usdcVault, vaultBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('usdc_vault')],
  PROGRAM_ID
);

console.log('   Buyback State PDA:', buybackState.toString());
console.log('   Buyback State Bump:', buybackBump);
console.log('   USDC Vault PDA:', usdcVault.toString());
console.log('   USDC Vault Bump:', vaultBump);
console.log('');

// Save for use in scripts
require('fs').writeFileSync('/tmp/buyback-pdas.json', JSON.stringify({
  buybackState: buybackState.toString(),
  buybackBump,
  usdcVault: usdcVault.toString(),
  vaultBump,
}, null, 2));
"

BUYBACK_STATE=$(node -e "console.log(require('/tmp/buyback-pdas.json').buybackState)")
USDC_VAULT=$(node -e "console.log(require('/tmp/buyback-pdas.json').usdcVault)")

echo "✅ PDAs calculated"
echo ""

# Check if already initialized
echo "🔍 Checking if already initialized..."
if solana account $BUYBACK_STATE --url devnet >/dev/null 2>&1; then
  echo "⚠️  Buyback state already exists"
  echo "   State: $BUYBACK_STATE"
  
  solana account $BUYBACK_STATE --url devnet | head -10
  
  echo ""
  echo "✅ Already initialized - skipping"
  exit 0
fi

echo "❌ Not initialized yet"
echo ""

# Create USDC vault ATA
echo "🏦 Creating USDC Vault..."
echo "   Note: This requires a transaction to initialize the token account"
echo ""

# TODO: Use Anchor client to call initialize() instruction
echo "⚠️  Manual initialization required:"
echo ""
echo "   Use Anchor client or write a script to call:"
echo "   await program.methods"
echo "     .initialize(new BN(100_000_000)) // 100 USDC min threshold"
echo "     .accounts({"
echo "       buybackState: '$BUYBACK_STATE',"
echo "       backMint: '$BACK_MINT',"
echo "       usdcVault: '$USDC_VAULT',"
echo "       usdcMint: '$USDC_MINT',"
echo "       authority: wallet.publicKey,"
echo "       tokenProgram: TOKEN_PROGRAM_ID,"
echo "       systemProgram: SystemProgram.programId,"
echo "       rent: SYSVAR_RENT_PUBKEY,"
echo "     })"
echo "     .rpc();"
echo ""

echo "📝 Next: Create init script with Anchor client"
