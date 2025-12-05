#!/usr/bin/env node
/**
 * Test script for distribute_buyback() instruction
 * 
 * Tests:
 * 1. Fetch global_state and verify total_community_boost > 0
 * 2. Fetch user_nft and verify boost value
 * 3. Calculate expected user_share based on formula
 * 4. Call distribute_buyback() and verify transfer
 * 5. Verify balance changes (vault and user account)
 * 
 * Usage:
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com node scripts/test-distribute-buyback.js
 */

const anchor = require("@coral-xyz/anchor");
const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const { getAssociatedTokenAddressSync, getAccount } = require("@solana/spl-token");
const fs = require("fs");

// Load IDL
const idlPath = __dirname + "/../target/idl/swapback_buyback.json";
if (!fs.existsSync(idlPath)) {
  console.error("❌ IDL not found at:", idlPath);
  console.log("Run: anchor build && anchor idl init first");
  process.exit(1);
}
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

// Configuration
const BUYBACK_PROGRAM_ID = new PublicKey("4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK");
const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const BACK_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

const DISTRIBUTION_RATIO_BPS = 5000; // 50%

async function main() {
  console.log("🧪 Testing distribute_buyback() Instruction\n");
  console.log("=" .repeat(60));

  // Setup Anchor provider
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  const walletPath = process.env.HOME + "/.config/solana/id.json";
  if (!fs.existsSync(walletPath)) {
    console.error("❌ Wallet not found at:", walletPath);
    console.log("Run: solana-keygen new first");
    process.exit(1);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new anchor.Program(idl, provider);

  console.log("📋 Configuration:");
  console.log(`  Buyback Program: ${BUYBACK_PROGRAM_ID.toBase58()}`);
  console.log(`  cNFT Program:    ${CNFT_PROGRAM_ID.toBase58()}`);
  console.log(`  Wallet:          ${wallet.publicKey.toBase58()}`);
  console.log(`  BACK Mint:       ${BACK_MINT.toBase58()}`);
  console.log();

  // Step 1: Derive PDAs
  const [buybackState] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    BUYBACK_PROGRAM_ID
  );

  const [backVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("back_vault"), buybackState.toBuffer()],
    BUYBACK_PROGRAM_ID
  );

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );

  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  console.log("🔑 Derived PDAs:");
  console.log(`  buyback_state:  ${buybackState.toBase58()}`);
  console.log(`  back_vault:     ${backVault.toBase58()}`);
  console.log(`  global_state:   ${globalState.toBase58()}`);
  console.log(`  user_nft:       ${userNft.toBase58()}`);
  console.log();

  // Step 2: Fetch on-chain accounts
  console.log("📡 Fetching on-chain data...");
  
  let globalStateData, userNftData, vaultBalanceBefore;
  
  try {
    // Fetch global_state (from cNFT program)
    const globalStateInfo = await connection.getAccountInfo(globalState);
    if (!globalStateInfo) {
      console.error("❌ global_state not found - cNFT program not initialized?");
      process.exit(1);
    }
    
    // Parse global_state (assuming basic structure: authority=32, total_boost=u64, etc)
    // You may need to adjust offsets based on actual struct
    const globalStateBuffer = globalStateInfo.data;
    // Skip discriminator (8 bytes) and authority (32 bytes), then read u64 total_community_boost
    const totalBoostOffset = 8 + 32;
    globalStateData = {
      totalCommunityBoost: new anchor.BN(
        globalStateBuffer.readBigUInt64LE(totalBoostOffset)
      )
    };

    console.log(`  ✅ global_state found`);
    console.log(`     Total Community Boost: ${globalStateData.totalCommunityBoost.toString()}`);

    if (globalStateData.totalCommunityBoost.isZero()) {
      console.warn("⚠️  Warning: total_community_boost = 0, distribution will fail!");
    }

  } catch (error) {
    console.error("❌ Failed to fetch global_state:", error.message);
    process.exit(1);
  }

  try {
    // Fetch user_nft
    const userNftInfo = await connection.getAccountInfo(userNft);
    if (!userNftInfo) {
      console.error("❌ user_nft not found - user has no cNFT position?");
      console.log("   Create a cNFT position first with the cNFT program");
      process.exit(1);
    }

    // Parse user_nft (assuming: discriminator 8, user pubkey 32, boost u64, is_active bool)
    const userNftBuffer = userNftInfo.data;
    const boostOffset = 8 + 32; // After discriminator and user pubkey
    const isActiveOffset = boostOffset + 8;
    
    userNftData = {
      boost: new anchor.BN(userNftBuffer.readBigUInt64LE(boostOffset)),
      isActive: userNftBuffer[isActiveOffset] === 1
    };

    console.log(`  ✅ user_nft found`);
    console.log(`     Boost: ${userNftData.boost.toString()}`);
    console.log(`     Active: ${userNftData.isActive}`);

    if (!userNftData.isActive) {
      console.error("❌ user_nft is inactive - cannot distribute");
      process.exit(1);
    }

    if (userNftData.boost.isZero()) {
      console.error("❌ user_nft boost = 0 - nothing to distribute");
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Failed to fetch user_nft:", error.message);
    process.exit(1);
  }

  // Step 3: Check vault balance
  try {
    const vaultAccount = await getAccount(connection, backVault);
    vaultBalanceBefore = vaultAccount.amount;
    console.log(`  ✅ back_vault balance: ${vaultBalanceBefore.toString()} tokens`);
    console.log();

    if (vaultBalanceBefore === 0n) {
      console.error("❌ Vault is empty - fund it first with finalize_buyback()");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Failed to fetch back_vault:", error.message);
    process.exit(1);
  }

  // Step 4: Calculate expected distribution
  console.log("🧮 Calculating expected distribution...");
  
  const maxTokens = vaultBalanceBefore; // Use full vault balance
  const distributableTokens = (BigInt(maxTokens) * BigInt(DISTRIBUTION_RATIO_BPS)) / 10000n;
  const expectedUserShare = 
    (distributableTokens * BigInt(userNftData.boost.toString())) / 
    BigInt(globalStateData.totalCommunityBoost.toString());

  console.log(`  Max Tokens (vault):       ${maxTokens.toString()}`);
  console.log(`  Distributable (50%):      ${distributableTokens.toString()}`);
  console.log(`  User Boost:               ${userNftData.boost.toString()}`);
  console.log(`  Total Community Boost:    ${globalStateData.totalCommunityBoost.toString()}`);
  console.log(`  Expected User Share:      ${expectedUserShare.toString()}`);
  console.log(`  User Share %:             ${(Number(expectedUserShare) / Number(distributableTokens) * 100).toFixed(4)}%`);
  console.log();

  // Step 5: Get or create user BACK ATA
  const userBackAccount = getAssociatedTokenAddressSync(BACK_MINT, wallet.publicKey);
  console.log(`👛 User BACK Account: ${userBackAccount.toBase58()}`);

  let userBalanceBefore = 0n;
  try {
    const userAccount = await getAccount(connection, userBackAccount);
    userBalanceBefore = userAccount.amount;
    console.log(`   Balance before: ${userBalanceBefore.toString()}`);
  } catch (error) {
    console.log("   ⚠️  Account doesn't exist yet - will be created during distribution");
  }
  console.log();

  // Step 6: Execute distribute_buyback
  console.log("🚀 Executing distribute_buyback()...");
  
  try {
    const tx = await program.methods
      .distributeBuyback(new anchor.BN(maxTokens.toString()))
      .accounts({
        buybackState,
        globalState,
        userNft,
        backVault,
        backMint: BACK_MINT,
        userBackAccount,
        user: wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`  ✅ Transaction successful!`);
    console.log(`  📝 Signature: ${tx}`);
    console.log();

    // Wait for confirmation
    await connection.confirmTransaction(tx, "confirmed");

  } catch (error) {
    console.error("❌ Transaction failed:", error);
    
    if (error.logs) {
      console.log("\n📋 Program Logs:");
      error.logs.forEach(log => console.log(`   ${log}`));
    }
    
    process.exit(1);
  }

  // Step 7: Verify balances after distribution
  console.log("✅ Verifying distribution results...");
  
  try {
    const vaultAccountAfter = await getAccount(connection, backVault);
    const vaultBalanceAfter = vaultAccountAfter.amount;
    
    const userAccountAfter = await getAccount(connection, userBackAccount);
    const userBalanceAfter = userAccountAfter.amount;

    const vaultDecrease = vaultBalanceBefore - vaultBalanceAfter;
    const userIncrease = userBalanceAfter - userBalanceBefore;

    console.log(`  Vault balance:  ${vaultBalanceBefore.toString()} → ${vaultBalanceAfter.toString()}`);
    console.log(`  Vault decrease: ${vaultDecrease.toString()}`);
    console.log();
    console.log(`  User balance:   ${userBalanceBefore.toString()} → ${userBalanceAfter.toString()}`);
    console.log(`  User increase:  ${userIncrease.toString()}`);
    console.log();

    // Verify amounts match
    if (vaultDecrease === userIncrease) {
      console.log("  ✅ Amounts match (vault decrease = user increase)");
    } else {
      console.warn("  ⚠️  Amounts don't match!");
    }

    if (userIncrease === expectedUserShare) {
      console.log("  ✅ User share matches expected calculation");
    } else {
      console.warn("  ⚠️  User share differs from expected!");
      console.log(`     Expected: ${expectedUserShare.toString()}`);
      console.log(`     Actual:   ${userIncrease.toString()}`);
    }

  } catch (error) {
    console.error("❌ Failed to verify balances:", error.message);
  }

  console.log();
  console.log("=" .repeat(60));
  console.log("🎉 distribute_buyback() test complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
