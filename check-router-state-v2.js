const { Connection, PublicKey } = require("@solana/web3.js");

async function main() {
  const conn = new Connection("https://api.mainnet-beta.solana.com");
  const routerState = new PublicKey("7nGEn5zY78G1X97VynadEbHRPkNtHmR69TGwWqymqeSs");

  console.log("=== RouterState Analysis ===\n");
  
  const info = await conn.getAccountInfo(routerState);
  
  if (!info) {
    console.log("❌ RouterState NOT FOUND");
    return;
  }
  
  console.log("✅ RouterState EXISTS");
  console.log("Size:", info.data.length, "bytes");
  console.log("Owner:", info.owner.toBase58());
  console.log("");
  
  const data = info.data;
  let offset = 0;
  
  // Discriminator (8 bytes)
  const discriminator = data.slice(0, 8);
  console.log("Discriminator:", Buffer.from(discriminator).toString('hex'));
  offset = 8;
  
  // Authority (32 bytes)
  const authority = new PublicKey(data.slice(offset, offset + 32));
  console.log("\n📋 Authority:", authority.toBase58());
  offset += 32;
  
  // Pending authority Option (1 byte flag + 32 bytes if Some)
  const hasPendingAuth = data[offset] === 1;
  offset += 1;
  if (hasPendingAuth) {
    const pendingAuth = new PublicKey(data.slice(offset, offset + 32));
    console.log("Pending Authority:", pendingAuth.toBase58());
    offset += 32;
  } else {
    console.log("Pending Authority: None");
    offset += 32; // Still skip 32 bytes for Option<Pubkey>
  }
  
  // is_paused (1 byte)
  const isPaused = data[offset] === 1;
  console.log("Is Paused:", isPaused);
  offset += 1;
  
  // paused_at (8 bytes i64)
  const pausedAt = Number(data.readBigInt64LE(offset));
  console.log("Paused At:", pausedAt === 0 ? "Never" : pausedAt);
  offset += 8;
  
  // Percentages (5 x u16 = 10 bytes)
  const rebatePercentage = data.readUInt16LE(offset);
  offset += 2;
  const treasuryPercentage = data.readUInt16LE(offset);
  offset += 2;
  const boostVaultPercentage = data.readUInt16LE(offset);
  offset += 2;
  const treasuryFromFeesBps = data.readUInt16LE(offset);
  offset += 2;
  const buyburnFromFeesBps = data.readUInt16LE(offset);
  offset += 2;
  
  console.log("\n📈 Percentages (basis points, 100 = 1%):");
  console.log("  Rebate:", rebatePercentage, "bps (", rebatePercentage / 100, "%)");
  console.log("  Treasury:", treasuryPercentage, "bps (", treasuryPercentage / 100, "%)");
  console.log("  Boost Vault:", boostVaultPercentage, "bps (", boostVaultPercentage / 100, "%)");
  console.log("  Treasury from Fees:", treasuryFromFeesBps, "bps (", treasuryFromFeesBps / 100, "%)");
  console.log("  Buy/Burn from Fees:", buyburnFromFeesBps, "bps (", buyburnFromFeesBps / 100, "%)");
  
  // Wallets (4 x 32 bytes)
  const treasuryWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const boostVaultWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const buybackWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const npiVaultWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  console.log("\n💼 Wallets:");
  console.log("  Treasury:", treasuryWallet.toBase58());
  console.log("  Boost Vault:", boostVaultWallet.toBase58());
  console.log("  Buyback:", buybackWallet.toBase58());
  console.log("  NPI Vault:", npiVaultWallet.toBase58());
  
  // Metrics (7 x u64 = 56 bytes)
  const totalVolume = data.readBigUInt64LE(offset);
  offset += 8;
  const totalNpi = data.readBigUInt64LE(offset);
  offset += 8;
  const totalRebatesPaid = data.readBigUInt64LE(offset);
  offset += 8;
  const totalTreasuryFromNpi = data.readBigUInt64LE(offset);
  offset += 8;
  const totalBoostVault = data.readBigUInt64LE(offset);
  offset += 8;
  
  // dynamic_slippage_enabled (1 byte)
  const dynamicSlippageEnabled = data[offset] === 1;
  offset += 1;
  
  const totalTreasuryFromFees = data.readBigUInt64LE(offset);
  offset += 8;
  const totalBuyburn = data.readBigUInt64LE(offset);
  offset += 8;
  
  // bump (1 byte)
  const bump = data[offset];
  
  console.log("\n📊 Metrics:");
  console.log("  Total Volume:", totalVolume.toString());
  console.log("  Total NPI:", totalNpi.toString());
  console.log("  Total Rebates Paid:", totalRebatesPaid.toString());
  console.log("  Total Treasury (NPI):", totalTreasuryFromNpi.toString());
  console.log("  Total Boost Vault:", totalBoostVault.toString());
  console.log("  Total Treasury (Fees):", totalTreasuryFromFees.toString());
  console.log("  Total Buy/Burn:", totalBuyburn.toString());
  
  console.log("\n⚙️ Settings:");
  console.log("  Dynamic Slippage:", dynamicSlippageEnabled);
  console.log("  Bump:", bump);
  
  // Validation
  console.log("\n=== VALIDATION ===");
  const SYSTEM_PROGRAM = "11111111111111111111111111111111";
  
  let issues = 0;
  
  if (treasuryWallet.toBase58() === SYSTEM_PROGRAM) {
    console.log("❌ Treasury Wallet NOT SET (System Program)");
    issues++;
  } else {
    console.log("✅ Treasury Wallet configured");
  }
  
  if (buybackWallet.toBase58() === SYSTEM_PROGRAM) {
    console.log("❌ Buyback Wallet NOT SET (System Program)");
    issues++;
  } else {
    console.log("✅ Buyback Wallet configured");
  }
  
  if (rebatePercentage + treasuryPercentage + boostVaultPercentage > 10000) {
    console.log("❌ NPI percentages exceed 100%");
    issues++;
  } else {
    console.log("✅ NPI percentages valid (total:", (rebatePercentage + treasuryPercentage + boostVaultPercentage) / 100, "%)");
  }
  
  if (treasuryFromFeesBps + buyburnFromFeesBps > 10000) {
    console.log("❌ Fee percentages exceed 100%");
    issues++;
  } else {
    console.log("✅ Fee percentages valid (total:", (treasuryFromFeesBps + buyburnFromFeesBps) / 100, "%)");
  }
  
  if (issues === 0) {
    console.log("\n🎉 RouterState is correctly configured!");
  } else {
    console.log("\n⚠️  RouterState needs configuration via /admin/config");
  }
}

main().catch(console.error);
