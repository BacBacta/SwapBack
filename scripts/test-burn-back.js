#!/usr/bin/env node
/**
 * Test script for burn_back() instruction
 * 
 * Tests:
 * 1. Check current vault balance and total_back_burned stat
 * 2. Call burn_back() to burn specific amount
 * 3. Verify vault balance decreased
 * 4. Verify total_back_burned stat increased
 * 5. Verify tokens actually burned (supply reduced) via mint info
 * 
 * Usage:
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com node scripts/test-burn-back.js [amount]
 * 
 * Example:
 *   node scripts/test-burn-back.js 1000000  # Burn 1 BACK token (6 decimals)
 */

const anchor = require("@coral-xyz/anchor");
const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const { getMint, getAccount } = require("@solana/spl-token");
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
const BACK_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");

async function main() {
  console.log("🔥 Testing burn_back() Instruction\n");
  console.log("=" .repeat(60));

  // Parse command line argument for burn amount
  const burnAmount = process.argv[2] 
    ? BigInt(process.argv[2])
    : 1000000n; // Default: 1 BACK token (assuming 6 decimals)

  console.log(`🎯 Burn Amount: ${burnAmount.toString()} (${Number(burnAmount) / 1e6} BACK)\n`);

  // Setup Anchor provider
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  const walletPath = process.env.ANCHOR_WALLET || (process.env.HOME + "/.config/solana/id.json");
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

  console.log("🔑 Derived PDAs:");
  console.log(`  buyback_state:  ${buybackState.toBase58()}`);
  console.log(`  back_vault:     ${backVault.toBase58()}`);
  console.log();

  // Step 2: Fetch state and balances BEFORE
  console.log("📡 Fetching state before burn...");
  
  let buybackStateData, vaultBalanceBefore, mintSupplyBefore;
  
  try {
    // Fetch buyback_state
    buybackStateData = await program.account.buybackState.fetch(buybackState);
    const totalBurnedBefore = buybackStateData.totalBackBurned;
    
    console.log(`  ✅ buyback_state found`);
    console.log(`     Authority:          ${buybackStateData.authority.toBase58()}`);
    console.log(`     Total BACK Burned:  ${totalBurnedBefore.toString()}`);

    // Verify authority matches wallet
    if (!buybackStateData.authority.equals(wallet.publicKey)) {
      console.error(`❌ Unauthorized: wallet ${wallet.publicKey.toBase58()} is not authority`);
      console.log(`   Expected: ${buybackStateData.authority.toBase58()}`);
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Failed to fetch buyback_state:", error.message);
    process.exit(1);
  }

  try {
    // Fetch vault balance
    const vaultAccount = await getAccount(connection, backVault);
    vaultBalanceBefore = vaultAccount.amount;
    
    console.log(`  ✅ back_vault balance:  ${vaultBalanceBefore.toString()}`);

    if (vaultBalanceBefore < burnAmount) {
      console.error(`❌ Insufficient vault balance to burn ${burnAmount.toString()}`);
      console.log(`   Current balance: ${vaultBalanceBefore.toString()}`);
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Failed to fetch back_vault:", error.message);
    process.exit(1);
  }

  try {
    // Fetch mint supply
    const mintInfo = await getMint(connection, BACK_MINT);
    mintSupplyBefore = mintInfo.supply;
    
    console.log(`  ✅ BACK mint supply:    ${mintSupplyBefore.toString()}`);
    console.log();

  } catch (error) {
    console.error("❌ Failed to fetch mint info:", error.message);
    process.exit(1);
  }

  // Step 3: Execute burn_back
  console.log("🔥 Executing burn_back()...");
  
  try {
    const tx = await program.methods
      .burnBack(new anchor.BN(burnAmount.toString()))
      .accounts({
        buybackState,
        backVault,
        backMint: BACK_MINT,
        authority: wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
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

  // Step 4: Verify results AFTER burn
  console.log("✅ Verifying burn results...");
  
  try {
    // Fetch updated state
    const buybackStateDataAfter = await program.account.buybackState.fetch(buybackState);
    const totalBurnedAfter = buybackStateDataAfter.totalBackBurned;
    
    // Fetch updated vault
    const vaultAccountAfter = await getAccount(connection, backVault);
    const vaultBalanceAfter = vaultAccountAfter.amount;
    
    // Fetch updated mint supply
    const mintInfoAfter = await getMint(connection, BACK_MINT);
    const mintSupplyAfter = mintInfoAfter.supply;

    console.log("\n📊 Results:");
    console.log("  ┌─────────────────────────────────────────────────────────┐");
    console.log(`  │ Vault Balance                                           │`);
    console.log(`  │   Before:  ${vaultBalanceBefore.toString().padEnd(44)} │`);
    console.log(`  │   After:   ${vaultBalanceAfter.toString().padEnd(44)} │`);
    console.log(`  │   Change:  -${(vaultBalanceBefore - vaultBalanceAfter).toString().padEnd(43)} │`);
    console.log("  ├─────────────────────────────────────────────────────────┤");
    console.log(`  │ Total BACK Burned (on-chain stat)                      │`);
    console.log(`  │   Before:  ${buybackStateData.totalBackBurned.toString().padEnd(44)} │`);
    console.log(`  │   After:   ${totalBurnedAfter.toString().padEnd(44)} │`);
    console.log(`  │   Change:  +${(totalBurnedAfter.sub(buybackStateData.totalBackBurned)).toString().padEnd(43)} │`);
    console.log("  ├─────────────────────────────────────────────────────────┤");
    console.log(`  │ Mint Supply (actual burned)                             │`);
    console.log(`  │   Before:  ${mintSupplyBefore.toString().padEnd(44)} │`);
    console.log(`  │   After:   ${mintSupplyAfter.toString().padEnd(44)} │`);
    console.log(`  │   Change:  -${(mintSupplyBefore - mintSupplyAfter).toString().padEnd(43)} │`);
    console.log("  └─────────────────────────────────────────────────────────┘");
    console.log();

    // Verify changes match expected
    const vaultDecrease = vaultBalanceBefore - vaultBalanceAfter;
    const statIncrease = totalBurnedAfter.sub(buybackStateData.totalBackBurned);
    const supplyDecrease = mintSupplyBefore - mintSupplyAfter;

    let allChecksPass = true;

    // Check 1: Vault decreased by burn amount
    if (vaultDecrease === burnAmount) {
      console.log("  ✅ Vault balance decreased by exact burn amount");
    } else {
      console.warn("  ⚠️  Vault decrease doesn't match burn amount!");
      console.log(`     Expected: ${burnAmount.toString()}`);
      console.log(`     Actual:   ${vaultDecrease.toString()}`);
      allChecksPass = false;
    }

    // Check 2: total_back_burned stat increased correctly
    if (statIncrease.eq(new anchor.BN(burnAmount.toString()))) {
      console.log("  ✅ total_back_burned stat updated correctly");
    } else {
      console.warn("  ⚠️  total_back_burned stat increase doesn't match!");
      console.log(`     Expected: ${burnAmount.toString()}`);
      console.log(`     Actual:   ${statIncrease.toString()}`);
      allChecksPass = false;
    }

    // Check 3: Mint supply actually decreased (tokens burned)
    if (supplyDecrease === burnAmount) {
      console.log("  ✅ Mint supply decreased (tokens actually burned)");
    } else {
      console.warn("  ⚠️  Mint supply decrease doesn't match!");
      console.log(`     Expected: ${burnAmount.toString()}`);
      console.log(`     Actual:   ${supplyDecrease.toString()}`);
      allChecksPass = false;
    }

    console.log();

    if (allChecksPass) {
      console.log("🎉 All verification checks passed!");
    } else {
      console.warn("⚠️  Some verification checks failed - review results above");
    }

  } catch (error) {
    console.error("❌ Failed to verify burn results:", error.message);
  }

  console.log();
  console.log("=" .repeat(60));
  console.log("🔥 burn_back() test complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
