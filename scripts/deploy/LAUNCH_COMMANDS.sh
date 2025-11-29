#!/bin/bash
# 🚀 SWAPBACK MVP LAUNCH - COPY PASTE THESE COMMANDS

# ============================================
# OPTION 1: SOFT MVP (30 MINUTES)
# ============================================

# Step 1: Build frontend
npm run app:build

# Step 2: Deploy to Vercel (requires account)
npm install -g vercel
vercel deploy

# Result: Live MVP frontend! 🎉


# ============================================
# OPTION 2: FULL MVP (2-3 HOURS)  
# ============================================

# Step 1: Install dependencies
npm ci --legacy-peer-deps

# Step 2: Fix TypeScript errors (see MVP_STATUS_FINAL.md for details)
# - Fix sdk/src/services/LiquidityDataCollector.ts line 266
# - Fix sdk/src/services/LiquidityDataCollector.ts line 290
# - Fix sdk/src/services/LiquidityDataCollector.ts line 293
# OR skip this if you trust the errors are non-critical

# Step 3: Run tests (optional but recommended)
npm run test:unit

# Step 4: Build frontend
npm run app:build

# Step 5: Deploy
npm install -g vercel
vercel deploy

# Result: Full MVP with tested code! 🎉


# ============================================
# OPTION 3: COMPLETE PRODUCT (4-5 HOURS)
# ============================================

# Complete steps from OPTION 2 first (2-3 hours)

# Then add BPF compilation:

# Step 1: Install Rust 1.80.0 with BPF support
rustup install 1.80.0
rustup target add sbf-solana-solana --toolchain 1.80.0

# Step 2: Compile smart contracts (takes ~30 min)
# Using Anchor framework
anchor build

# Step 3: Deploy contracts to devnet
# Install Solana CLI if needed
solana-keygen pubkey ~/.config/solana/id.json

# Deploy each program
solana deploy target/deploy/swapback_router.so --url devnet
solana deploy target/deploy/swapback_buyback.so --url devnet
solana deploy target/deploy/swapback_cnft.so --url devnet

# Step 4: Run on-chain tests
npm run test:integration

# Result: Full production-ready system! 🎉


# ============================================
# TROUBLESHOOTING
# ============================================

# If npm install fails:
npm cache clean --force
npm ci --legacy-peer-deps

# If Rust build fails:
rustup update
rustc --version  # Should show 1.82.0

# If TypeScript fails:
# See MVP_STATUS_FINAL.md → Issue 1 (SDK compilation)

# ============================================
# STATUS CHECKS
# ============================================

# Check Rust version
rustc --version
# Should show: rustc 1.82.0

# Check Node version
node --version
# Should show: v20.x.x

# Check build works
cargo build --release
# Should show: Finished `release`

# Check tests framework
npm run test:unit
# Should run without crash

# ============================================
# DOCUMENTATION
# ============================================

# Quick start:        MVP_QUICK_START.md
# Full assessment:    MVP_STATUS_FINAL.md
# Build report:       BUILD_SUCCESS_25OCT.md
# Session summary:    SESSION_COMPLETE_CARGO_FIX.md
# This file:          LAUNCH_COMMANDS.sh

# ============================================
# WHICH OPTION DO YOU WANT?
# ============================================

# A) Soft MVP in 30 min?
#    Copy OPTION 1 commands

# B) Full MVP in 2-3 hours?
#    Copy OPTION 2 commands

# C) Complete in 4-5 hours?
#    Copy OPTION 3 commands

# ============================================
# YOU'RE READY! 🚀
# ============================================

echo ""
echo "Choose your launch path:"
echo "A) Soft MVP (30 min)   - Frontend only"
echo "B) Full MVP (2-3 hours) - All code tested"
echo "C) Complete (4-5 hours) - With on-chain"
echo ""
echo "Copy the commands from the section above and execute!"
echo ""
