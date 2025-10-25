# 🚀 PHASE 2: ON-CHAIN DEPLOYMENT GUIDE

## Overview

Phase 2 adds live smart contract capability to your MVP:

1. **BPF Compilation** - Compile Rust to Solana BPF format
2. **Devnet Setup** - Configure local Solana validator
3. **Deploy Programs** - Deploy contracts to devnet
4. **Run On-Chain Tests** - Validate smart contracts
5. **Enable Live Trading** - MVP fully functional

**Timeline:** 4-5 hours  
**Difficulty:** Medium  
**Requirements:** Rust, Anchor, Solana CLI

---

## Prerequisites

Before starting, ensure you have:

```bash
# Check versions
rustc --version      # Should show 1.82.0 (from Phase 1)
cargo --version
anchor --version     # Should show version
node --version       # Should show v20+
```

If Anchor is missing:
```bash
npm install -g @coral-xyz/anchor-cli
```

---

## Phase 2a: Setup Rust for BPF (Optional)

**Status:** ⏳ In Progress

BPF target is experimental and may not compile with all Rust versions. This is **optional** - you can use Anchor's built-in BPF compilation instead.

### Option A: Use Anchor (Recommended)

Anchor handles BPF compilation internally. No special Rust setup needed.

### Option B: Manual BPF Setup

```bash
# Install Rust 1.75.0 (Anchor's minimum supported)
rustup install 1.75.0

# Try adding BPF target (may not work)
rustup target add sbf-solana-solana --toolchain 1.75.0

# Switch to 1.75.0 for BPF work
rustup override set 1.75.0
```

**Note:** If manual setup fails, stick with Option A (Anchor).

---

## Phase 2b: Compile BPF Programs

### Quick Start

```bash
chmod +x phase-2-bpf-compile.sh
./phase-2-bpf-compile.sh
```

### Manual Compilation

```bash
# Using Anchor (recommended)
anchor build

# Or individual programs
anchor build --program-name swapback_router
anchor build --program-name swapback_buyback
anchor build --program-name swapback_cnft
```

**Expected Output:**
```
Compiling swapback_router v0.1.0
Finished release [optimized] target(s) in 4m 43s
```

**Output Location:** `target/deploy/*.so`

### Troubleshooting BPF Compilation

**Error: "BPF target not supported"**
- Solution: Use Anchor CLI instead (automatic BPF handling)

**Error: "Version conflict in dependencies"**
- Solution: Clean build cache: `rm -rf target/`

**Error: Long compilation time (>10 minutes)**
- Normal for first build. Subsequent builds are faster (~1 minute)

---

## Phase 2c: Setup Devnet

### Install Solana CLI

```bash
# Official installation
curl https://release.solana.com/v1.18.22/install | bash

# Add to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify
solana --version
```

### Create/Import Solana Keypair

```bash
# Generate new keypair
solana-keygen new -o ~/.config/solana/id.json

# Or use existing (copy your keypair.json to ~/.config/solana/id.json)

# Verify
solana address
```

### Configure Devnet

```bash
# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Verify configuration
solana config get
```

### Airdrop SOL (for testing)

```bash
# Request 5 SOL from faucet
solana airdrop 5 --url devnet

# Check balance
solana balance
```

---

## Phase 2d: Deploy Programs to Devnet

### Deploy All Programs

```bash
# Deploy router contract
solana deploy target/deploy/swapback_router.so --url devnet

# Deploy buyback contract
solana deploy target/deploy/swapback_buyback.so --url devnet

# Deploy CNFT contract
solana deploy target/deploy/swapback_cnft.so --url devnet
```

**Expected Output:**
```
Program deployed to: 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap
Signature: [long hash]
```

### Update Program IDs

After deployment, update program IDs in:
- `Anchor.toml` - Update `[programs.devnet]` section
- `sdk/src/config.ts` - Update constant exports
- `app/.env.devnet` - Update environment variables

---

## Phase 2e: Run On-Chain Tests

### Execute Integration Tests

```bash
# Run all on-chain tests
npm run test:integration

# Or specific test
npm run test:unit -- router-onchain
```

**Expected Results:**
- ✅ 6 on-chain tests now pass (previously skipped)
- ✅ 237 unit tests still pass
- ✅ Total: 243/243 tests passing

---

## Validation Checklist

After Phase 2, verify:

- [ ] BPF compilation completed without errors
- [ ] `target/deploy/*.so` files exist
- [ ] Programs deployed to devnet
- [ ] Program IDs updated in config
- [ ] On-chain tests passing (6 tests)
- [ ] Can see programs on Solana Explorer
- [ ] Devnet transactions visible in logs

---

## Next Steps After Phase 2

### Beta Launch
- Update frontend with devnet program IDs
- Deploy frontend to production
- Invite beta testers
- Collect feedback

### Phase 3: Mainnet Preparation
- Security audit
- Performance testing
- Final validation
- Mainnet deployment

---

## Troubleshooting Guide

### "Program already exists"
**Error:** `Deployment failed: ProgramAccountAlreadyExists`
**Solution:** Use `solana deploy --program-id <existing-id>` to upgrade

### "Insufficient lamports"
**Error:** Not enough SOL for deployment
**Solution:** Airdrop more: `solana airdrop 5 --url devnet`

### "Connection refused"
**Error:** Cannot connect to devnet
**Solution:** Check network: `solana ping --url devnet`

### "Compilation still failing"
**Error:** BPF target issues persist
**Solution:** See PHASE_2_BPF_ALTERNATIVES.md for workarounds

---

## Performance Expectations

| Task | Time | Status |
|------|------|--------|
| BPF compile (first) | 4-5 min | ⏳ Long, one-time |
| BPF compile (rebuild) | 1-2 min | ⚡ Fast |
| Devnet deploy | 1-2 min | ⚡ Fast |
| On-chain tests | 30 sec | ⚡ Very fast |
| **Total Phase 2** | **30-40 min** | ✅ Reasonable |

---

## Success Criteria

✅ Phase 2 Complete when:
1. All programs compile to .so
2. Programs deploy to devnet
3. On-chain tests pass (6/6)
4. MVP fully functional
5. Ready for beta launch

---

## Quick Command Reference

```bash
# Full Phase 2 automation (when ready)
chmod +x phase-2-complete.sh && ./phase-2-complete.sh

# Or manual step-by-step
./phase-2-bpf-compile.sh          # Compile
solana airdrop 5 --url devnet     # Fund wallet
solana deploy target/deploy/*.so --url devnet  # Deploy
npm run test:integration           # Test
```

---

## Support

If you get stuck:

1. Check `PHASE_2_BPF_TROUBLESHOOTING.md`
2. See `PHASE_2_ALTERNATIVES.md` for workarounds
3. Review `SESSION_COMPLETE_CARGO_FIX.md` for context
4. Check Anchor docs: https://docs.anchor-lang.com/

---

## Summary

**Phase 2 Enables:**
- ✅ Live smart contracts
- ✅ Real token swaps
- ✅ On-chain buyback mechanism
- ✅ CNFT loyalty rewards
- ✅ Fully functional MVP

**After Phase 2:** Your MVP is **production-grade** 🎉

---

**Ready? Start with:**
```bash
./phase-2-bpf-compile.sh
```

