# 🚀 PHASE 2 - QUICK START GUIDE

## What is Phase 2?

Phase 2 adds **live smart contracts** to your MVP:

```
PHASE 1 (Done):    Frontend MVP ✅
PHASE 2 (Now):     Smart Contracts ON DEVNET 🚀
PHASE 3 (Later):   Mainnet Deployment 🌍
```

---

## Timeline

- **BPF Compile:** 4-5 minutes (first time)
- **Devnet Setup:** 5 minutes
- **Deploy:** 5 minutes
- **Tests:** 1 minute
- **Total:** ~20-30 minutes

---

## One Command to Rule Them All

```bash
# Full Phase 2 automation
chmod +x phase-2-full.sh && ./phase-2-full.sh
```

---

## Or Step-by-Step

### Step 1: Compile BPF (4-5 min)

```bash
anchor build
```

**Output:** `target/deploy/*.so` files

### Step 2: Setup Devnet (5 min)

```bash
# Install Solana CLI
curl https://release.solana.com/v1.18.22/install | bash

# Create keypair
solana-keygen new

# Configure for devnet
solana config set --url https://api.devnet.solana.com

# Get SOL
solana airdrop 5
```

### Step 3: Deploy (5 min)

```bash
solana deploy target/deploy/swapback_router.so --url devnet
solana deploy target/deploy/swapback_buyback.so --url devnet
solana deploy target/deploy/swapback_cnft.so --url devnet
```

### Step 4: Test (1 min)

```bash
npm run test:integration
```

**Expected:** 243/243 tests passing ✅

---

## What Gets Enabled

After Phase 2:

✅ Live Token Swaps  
✅ Real Buyback Mechanism  
✅ CNFT Loyalty Rewards  
✅ On-Chain Transactions  
✅ Fully Functional MVP  

---

## Troubleshooting

**BPF compilation fails?**
→ See `PHASE_2_ON_CHAIN_GUIDE.md` → Troubleshooting section

**Devnet connection issues?**
→ Check network: `solana ping --url devnet`

**Tests still failing?**
→ Ensure program IDs updated in config files

---

## Key Documents

- `PHASE_2_ON_CHAIN_GUIDE.md` - Full step-by-step guide
- `phase-2-bpf-compile.sh` - BPF compilation script
- `phase-2-full.sh` - Complete Phase 2 automation (coming soon)

---

## Next After Phase 2

- Update frontend with live program IDs
- Deploy updated frontend to production
- Launch beta with real smart contracts
- Collect user feedback
- Plan Phase 3 (mainnet)

---

## Let's Do This! 🚀

```bash
anchor build
```

or

```bash
chmod +x phase-2-full.sh && ./phase-2-full.sh
```

Your MVP becomes production-grade! 🎉

