#!/bin/bash

# Test DCA Execution - Phase 1 Verification
# Vérifie que le fix ATA fonctionne correctement

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🔍 TEST DCA EXECUTION - PHASE 1                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📋 Pre-requisites check...${NC}"
echo ""

# Check if wallet is configured
if [ ! -f ~/.config/solana/id.json ]; then
  echo -e "${RED}❌ Solana wallet not found${NC}"
  echo "Run: solana-keygen new"
  exit 1
fi

WALLET=$(solana address)
echo -e "${GREEN}✓${NC} Wallet: $WALLET"

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo -e "${GREEN}✓${NC} Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.1" | bc -l) )); then
  echo -e "${YELLOW}⚠️  Low balance. Request airdrop:${NC}"
  echo "   solana airdrop 2"
fi

echo ""
echo -e "${YELLOW}📦 Checking deployed programs...${NC}"
echo ""

# Check Router program
ROUTER_PROGRAM="9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"
if solana account $ROUTER_PROGRAM &>/dev/null; then
  echo -e "${GREEN}✓${NC} Router program deployed: $ROUTER_PROGRAM"
else
  echo -e "${RED}❌ Router program not found${NC}"
  exit 1
fi

# Check CNFT program
CNFT_PROGRAM="EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
if solana account $CNFT_PROGRAM &>/dev/null; then
  echo -e "${GREEN}✓${NC} CNFT program deployed: $CNFT_PROGRAM"
else
  echo -e "${RED}❌ CNFT program not found${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}🧪 Test Instructions:${NC}"
echo ""
echo "1. Open browser: https://swap-back-mauve.vercel.app/dca"
echo ""
echo "2. Connect your wallet: $WALLET"
echo ""
echo "3. Create a test DCA plan:"
echo "   - Token In: SOL"
echo "   - Token Out: USDC (devnet)"
echo "   - Amount per swap: 0.01 SOL"
echo "   - Frequency: Hourly"
echo "   - Total swaps: 5"
echo ""
echo "4. Check browser console for logs:"
echo "   - Should see: '🔍 Checking token accounts'"
echo "   - Should see: '✅ user_token_in exists' OR '⚠️ creating...'"
echo "   - Should see: '✅ user_token_out exists' OR '⚠️ creating...'"
echo ""
echo "5. If creation succeeds, try executing the plan:"
echo "   - Click 'Execute Now' button"
echo "   - Check console for ATA creation logs"
echo "   - Transaction should succeed without AccountNotInitialized error"
echo ""
echo -e "${GREEN}✅ If execution works = Phase 1 SUCCESS${NC}"
echo -e "${RED}❌ If AccountNotInitialized = Need more debugging${NC}"
echo ""
echo "Press ENTER to continue to automated test..."
read

echo ""
echo -e "${YELLOW}🤖 Running automated DCA test via Node.js...${NC}"
echo ""

node << 'EOF'
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function testDCAExecution() {
  console.log('🔗 Connecting to Devnet...');
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet
  const keypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log('👤 Wallet:', wallet.publicKey.toBase58());
  
  const ROUTER_PROGRAM = new PublicKey('9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh');
  
  // Check for existing DCA plans
  console.log('\n🔍 Fetching DCA plans...');
  
  try {
    const accounts = await connection.getProgramAccounts(ROUTER_PROGRAM, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: 'fhgZ3PxKmRu', // DcaPlan discriminator in base58
          },
        },
        {
          memcmp: {
            offset: 40,
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ],
    });
    
    console.log(`📦 Found ${accounts.length} DCA plan(s) for your wallet`);
    
    if (accounts.length === 0) {
      console.log('\n⚠️  No DCA plans found.');
      console.log('   Please create one via the web interface first.');
      process.exit(0);
    }
    
    accounts.forEach((acc, idx) => {
      console.log(`\n   Plan ${idx + 1}:`);
      console.log(`   - PDA: ${acc.pubkey.toBase58()}`);
      console.log(`   - Size: ${acc.account.data.length} bytes`);
      
      // Parse basic info
      const data = acc.account.data;
      const executedSwaps = data.readUInt32LE(136); // offset for executed_swaps
      const totalSwaps = data.readUInt32LE(132); // offset for total_swaps
      const isActive = data.readUInt8(172) !== 0; // offset for is_active
      
      console.log(`   - Progress: ${executedSwaps}/${totalSwaps} swaps`);
      console.log(`   - Status: ${isActive ? 'ACTIVE' : 'PAUSED'}`);
    });
    
    console.log('\n✅ DCA plans fetch successful!');
    console.log('\n💡 Next step: Execute a plan via the web UI to test ATA creation');
    
  } catch (error) {
    console.error('\n❌ Error fetching DCA plans:', error.message);
    process.exit(1);
  }
}

testDCAExecution();
EOF

echo ""
echo -e "${GREEN}✅ Phase 1 verification complete!${NC}"
echo ""
