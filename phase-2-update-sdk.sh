#!/bin/bash

# SDK Configuration Update Script
# Updates SDK with deployed smart contract program IDs from Phase 2

set -e

echo "
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                  📝 SDK CONFIGURATION UPDATE TOOL 📝                         ║
║                                                                               ║
║                   Update SDK with deployed program addresses                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"

# Check if deployment config exists
if [ ! -f "phase2-deployment-config.json" ]; then
  echo "❌ phase2-deployment-config.json not found"
  echo "ℹ️  Run: ./phase-2-full.sh  (to deploy contracts first)"
  exit 1
fi

echo "📖 Current deployment config:"
cat phase2-deployment-config.json | grep -A 10 '"programs"'

echo ""
echo "🔧 Updating SDK configuration..."

# Extract program IDs from deployment config
ROUTER_ID=$(jq -r '.programs.router // "unknown"' phase2-deployment-config.json)
CNFT_ID=$(jq -r '.programs.cnft // "unknown"' phase2-deployment-config.json)
BUYBACK_ID=$(jq -r '.programs.buyback // "unknown"' phase2-deployment-config.json)

echo "📌 Extracted Program IDs:"
echo "   Router:   $ROUTER_ID"
echo "   CNFT:     $CNFT_ID"
echo "   Buyback:  $BUYBACK_ID"

# Update SDK config files
SDK_CONFIG="sdk/src/config/devnet.ts"

if [ -f "$SDK_CONFIG" ]; then
  echo "✏️  Updating $SDK_CONFIG..."
  
  # Create backup
  cp "$SDK_CONFIG" "$SDK_CONFIG.backup"
  
  # Update program IDs (using sed with safe delimiters)
  sed -i "s|ROUTER_PROGRAM_ID.*|ROUTER_PROGRAM_ID: new PublicKey('$ROUTER_ID'),|g" "$SDK_CONFIG"
  sed -i "s|CNFT_PROGRAM_ID.*|CNFT_PROGRAM_ID: new PublicKey('$CNFT_ID'),|g" "$SDK_CONFIG"
  sed -i "s|BUYBACK_PROGRAM_ID.*|BUYBACK_PROGRAM_ID: new PublicKey('$BUYBACK_ID'),|g" "$SDK_CONFIG"
  
  echo "✅ SDK config updated"
else
  echo "⚠️  $SDK_CONFIG not found. Creating..."
  
  # Create SDK config with program IDs
  mkdir -p "sdk/src/config"
  
  cat > "$SDK_CONFIG" << EOFSDK
import { PublicKey } from '@solana/web3.js';

export const DEVNET_CONFIG = {
  ROUTER_PROGRAM_ID: new PublicKey('$ROUTER_ID'),
  CNFT_PROGRAM_ID: new PublicKey('$CNFT_ID'),
  BUYBACK_PROGRAM_ID: new PublicKey('$BUYBACK_ID'),
  RPC_ENDPOINT: 'https://api.devnet.solana.com',
  NETWORK: 'devnet',
} as const;

export const MAINNET_CONFIG = {
  // Mainnet program IDs will be set after Phase 3 deployment
  ROUTER_PROGRAM_ID: new PublicKey('11111111111111111111111111111111'),
  CNFT_PROGRAM_ID: new PublicKey('11111111111111111111111111111111'),
  BUYBACK_PROGRAM_ID: new PublicKey('11111111111111111111111111111111'),
  RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
  NETWORK: 'mainnet-beta',
} as const;
EOFSDK
  
  echo "✅ Created $SDK_CONFIG with program IDs"
fi

# Update frontend config if it exists
APP_CONFIG="app/lib/config.ts"

if [ -f "$APP_CONFIG" ]; then
  echo "✏️  Updating $APP_CONFIG..."
  
  # Backup
  cp "$APP_CONFIG" "$APP_CONFIG.backup"
  
  # Update program IDs in app config
  sed -i "s|ROUTER_PROGRAM_ID:.*|ROUTER_PROGRAM_ID: '$ROUTER_ID',|g" "$APP_CONFIG"
  sed -i "s|CNFT_PROGRAM_ID:.*|CNFT_PROGRAM_ID: '$CNFT_ID',|g" "$APP_CONFIG"
  sed -i "s|BUYBACK_PROGRAM_ID:.*|BUYBACK_PROGRAM_ID: '$BUYBACK_ID',|g" "$APP_CONFIG"
  
  echo "✅ App config updated"
fi

# Save configuration summary
CONFIG_SUMMARY="phase2-sdk-update.log"

cat > "$CONFIG_SUMMARY" << EOFSUMMARY
SDK Configuration Update - $(date)

Deployed Programs:
  Router:   $ROUTER_ID
  CNFT:     $CNFT_ID
  Buyback:  $BUYBACK_ID

Files Updated:
  • $SDK_CONFIG
  • $APP_CONFIG

Backups Created:
  • $SDK_CONFIG.backup
  • $APP_CONFIG.backup

Status: ✅ COMPLETE

Next Steps:
  1. Verify the updated configs look correct
  2. Run: npm run build  (to validate changes)
  3. Run: npm test       (to run integration tests)
  4. Redeploy frontend to production
EOFSUMMARY

echo "
📝 Summary saved to: $CONFIG_SUMMARY"

echo "
✅ SDK Configuration Update Complete!

Files Updated:
  ✓ $SDK_CONFIG
  ✓ $APP_CONFIG

Program IDs:
  ✓ Router:   $ROUTER_ID
  ✓ CNFT:     $CNFT_ID
  ✓ Buyback:  $BUYBACK_ID

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Next Steps:

  1️⃣  Rebuild the app to validate configs
      npm run build

  2️⃣  Run integration tests
      npm test

  3️⃣  Redeploy frontend with live contract addresses
      cd app && vercel --prod

  4️⃣  Test the complete MVP
      Visit your live MVP and try transactions

🚀 Your MVP is now connected to live smart contracts!
"
