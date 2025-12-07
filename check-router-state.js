const { Connection, PublicKey } = require("@solana/web3.js");

async function main() {
  const conn = new Connection("https://api.mainnet-beta.solana.com");
  const routerState = new PublicKey("7nGEn5zY78G1X97VynadEbHRPkNtHmR69TGwWqymqeSs");

  console.log("Checking RouterState...");
  
  const info = await conn.getAccountInfo(routerState);
  
  if (!info) {
    console.log("RouterState NOT FOUND");
    return;
  }
  
  console.log("RouterState EXISTS");
  console.log("Size:", info.data.length, "bytes");
  console.log("Owner:", info.owner.toBase58());
  
  const data = info.data;
  // Skip discriminator (8 bytes)
  const admin = new PublicKey(data.slice(8, 40));
  const feeWallet = new PublicKey(data.slice(40, 72));
  const buybackWallet = new PublicKey(data.slice(72, 104));
  const rebateVault = new PublicKey(data.slice(104, 136));
  
  console.log("\nCurrent Config:");
  console.log("  Admin:", admin.toBase58());
  console.log("  Fee Wallet:", feeWallet.toBase58());
  console.log("  Buyback Wallet:", buybackWallet.toBase58());
  console.log("  Rebate Vault:", rebateVault.toBase58());
  
  // Percentages (u16 = 2 bytes each)
  const feePercent = data.readUInt16LE(136);
  const buybackPercent = data.readUInt16LE(138);
  const rebatePercent = data.readUInt16LE(140);
  
  console.log("\nPercentages:");
  console.log("  Fee:", feePercent / 100, "%");
  console.log("  Buyback:", buybackPercent / 100, "%");
  console.log("  Rebate:", rebatePercent / 100, "%");
  
  // Check if configured
  const SYSTEM_PROGRAM = "11111111111111111111111111111111";
  if (feeWallet.toBase58() === SYSTEM_PROGRAM) {
    console.log("\n⚠️  RouterState NOT CONFIGURED - wallets are System Program");
  } else {
    console.log("\n✅ RouterState is configured");
  }
}

main().catch(console.error);
