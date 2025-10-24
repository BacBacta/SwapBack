# 🚀 READY-TO-USE DEPLOYMENT COMMANDS

Copy & paste these commands to deploy SwapBack to Devnet

---

## Step 1: Verify Artifacts (Optional)

```bash
bash /workspaces/SwapBack/scripts/final-deploy-check.sh
```

**Expected Output:** All artifacts verified ✅

---

## Step 2: Fund Your Wallet (REQUIRED)

Make sure you have 1-2 SOL on your devnet wallet:

```bash
# If using Solana CLI:
solana balance -u devnet

# Should show something like: 2.50000000 SOL
```

If balance is 0, request SOL from faucet:
```bash
solana airdrop 2 -u devnet
```

---

## Step 3: Deploy to Devnet

### Option A: Using Anchor CLI (Recommended)

```bash
cd /workspaces/SwapBack
anchor deploy --provider.cluster devnet
```

This will:
1. Compile IDL
2. Deploy all 4 programs
3. Generate IDL on-chain
4. Return program IDs and transaction hashes

**Expected Duration:** 5-10 minutes

**Expected Output:**
```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: [your-wallet]
Deploying program "swapback_router"...
Program Id: 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap
Tx signature: [transaction-hash]
...
```

---

### Option B: Using Solana CLI (Manual)

If you have Solana CLI installed:

```bash
cd /workspaces/SwapBack

# Deploy swapback_router
solana program deploy target/deploy/swapback_router.so \
  --program-id target/deploy/swapback_router-keypair.json \
  -u devnet

# Deploy swapback_buyback
solana program deploy target/deploy/swapback_buyback.so \
  --program-id target/deploy/swapback_buyback-keypair.json \
  -u devnet

# Deploy swapback_cnft
solana program deploy target/deploy/swapback_cnft.so \
  --program-id target/deploy/swapback_cnft-keypair.json \
  -u devnet

# Deploy common_swap
solana program deploy target/deploy/common_swap.so \
  --program-id target/deploy/common_swap-keypair.json \
  -u devnet
```

**Expected Duration:** 10-15 minutes (4 separate deployments)

---

## Step 4: Verify Deployment

### Check Program 1: swapback_router

```bash
solana program show 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap -u devnet
```

### Check Program 2: swapback_buyback

```bash
solana program show 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU -u devnet
```

### Check Program 3: swapback_cnft

```bash
solana program show ENbA46Rq9yFdp63WwmVm4tykcjmaukWs6T2ScGr9x7zB -u devnet
```

### Check Program 4: common_swap

```bash
solana program show D4Hz5ZBPWrLvnjNheQa7FYLVpzuGmPGRqFGWNqg5jRg6 -u devnet
```

**Expected Output Example:**
```
Program Id: 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap
Owner: BPFLoader2111111111111111111111111111111111
ProgramData Account: [account-address]
Authority: [your-wallet]
Last Deployed Slot: [slot-number]
Data Length: 783840 bytes
```

---

## Step 5: Optional - Verify IDL

If using Anchor:

```bash
anchor idl fetch 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap -u devnet
```

This will show the IDL stored on-chain.

---

## Troubleshooting

### Error: "Account has insufficient funds"

**Solution:** Fund your wallet with more SOL

```bash
solana airdrop 2 -u devnet
```

### Error: "Keypair file not found"

**Solution:** Regenerate keypairs

```bash
cd /workspaces/SwapBack
node -e "
const fs = require('fs');
const crypto = require('crypto');
const programs = ['swapback_router', 'swapback_buyback', 'swapback_cnft', 'common_swap'];
programs.forEach(prog => {
  const seed = crypto.randomBytes(32);
  const keypair = Array.from(seed);
  const path = \`target/deploy/\${prog}-keypair.json\`;
  fs.writeFileSync(path, JSON.stringify(keypair));
  console.log(\`✅ \${prog}\`);
});
"
```

### Error: "Network connection failed"

**Solution:** Verify Devnet is reachable

```bash
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Should return: {"jsonrpc":"2.0","result":"ok","id":1}
```

### Error: "BPF loader not found"

**Solution:** Ensure using correct Rust target

```bash
rustup target add bpf-solana
cargo build --release --target bpf-solana
```

---

## Quick Reference

### Program IDs (for easy copy-paste)
```
3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap   (router)
46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU  (buyback)
ENbA46Rq9yFdp63WwmVm4tykcjmaukWs6T2ScGr9x7zB  (cnft)
D4Hz5ZBPWrLvnjNheQa7FYLVpzuGmPGRqFGWNqg5jRg6  (common)
```

### File Locations
```
Build artifacts:  /workspaces/SwapBack/target/deploy/
Keypairs:         /workspaces/SwapBack/target/deploy/*-keypair.json
Configuration:    /workspaces/SwapBack/Anchor.toml
```

### Key Distances
```
Deployment time:  5-10 minutes (anchor deploy)
                  10-15 minutes (manual solana CLI)
Wallet requirement: 1-2 SOL on devnet
```

---

## After Deployment

1. **Document Transaction Hashes**
   - Save the tx signatures from deployment
   - Verify on devnet explorer: https://explorer.solana.com

2. **Update Configuration**
   - Verify Program IDs in your client code
   - Update SDK with new addresses

3. **Run Tests**
   - Once npm dependencies are resolved:
   ```bash
   npm run test
   ```

4. **Monitor Program**
   - Watch for program upgrades
   - Monitor transaction success rates

---

## Support

For detailed deployment guide, see:
- `DEPLOYMENT_READY_24OCT.md` - Full deployment documentation
- `scripts/final-deploy-check.sh` - Automated verification
- `scripts/prepare-devnet-deploy.sh` - Pre-deployment setup

---

**Status:** 🟢 Ready to Deploy  
**All artifacts:** ✅ Ready  
**All configs:** ✅ Ready  
**Just deploy!** 🚀
