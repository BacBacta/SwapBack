const { Connection, PublicKey } = require("@solana/web3.js");

async function main() {
  const conn = new Connection("https://api.mainnet-beta.solana.com");
  const routerState = new PublicKey("7nGEn5zY78G1X97VynadEbHRPkNtHmR69TGwWqymqeSs");

  console.log("=== RouterState Raw Data Analysis ===\n");
  
  const info = await conn.getAccountInfo(routerState);
  
  if (!info) {
    console.log("❌ RouterState NOT FOUND");
    return;
  }
  
  const data = info.data;
  console.log("Total size:", data.length, "bytes\n");
  
  // Print hex dump of first 200 bytes
  console.log("Hex dump (first 200 bytes):");
  for (let i = 0; i < Math.min(200, data.length); i += 32) {
    const chunk = data.slice(i, Math.min(i + 32, data.length));
    const hex = Buffer.from(chunk).toString('hex');
    const pubkey = chunk.length === 32 ? new PublicKey(chunk).toBase58() : '';
    console.log(`${i.toString().padStart(3)}: ${hex}`);
    if (pubkey) {
      console.log(`     -> ${pubkey}`);
    }
  }
  
  console.log("\n=== Known structure check ===");
  
  // Discriminator
  console.log("\n[0-7] Discriminator:", Buffer.from(data.slice(0, 8)).toString('hex'));
  
  // Authority at offset 8
  console.log("[8-39] Authority:", new PublicKey(data.slice(8, 40)).toBase58());
  
  // Check Option<Pubkey> encoding - try without the 32 byte skip
  // In Anchor, Option<Pubkey> can be:
  // - 1 byte tag (0=None, 1=Some) + 32 bytes value OR
  // - Just None = 1 byte (0) without value bytes in some encodings
  
  // Let's try: pending_authority starts at 40
  // If None: offset 40 = 0 (tag), then is_paused at 41
  const pendingAuthTag = data[40];
  console.log("\n[40] Pending Auth Tag:", pendingAuthTag);
  
  if (pendingAuthTag === 0) {
    // Option is None - no pubkey follows in Anchor's InitSpace
    // But InitSpace DOES reserve space for the full Option
    // So we still skip 33 bytes total (1 tag + 32 pubkey)
    console.log("  -> None");
    
    // Actually let's check both possibilities
    console.log("\n=== Trying offset without 32-byte skip ===");
    let offset = 41; // After None tag, no pubkey bytes
    
    const isPaused = data[offset];
    console.log(`[${offset}] is_paused:`, isPaused);
    offset += 1;
    
    // This might be paused_at
    const pausedAt = data.readBigInt64LE(offset);
    console.log(`[${offset}] paused_at:`, pausedAt.toString());
    offset += 8;
    
    // These should be percentages
    console.log(`[${offset}] u16:`, data.readUInt16LE(offset), "(rebate_percentage?)");
    console.log(`[${offset+2}] u16:`, data.readUInt16LE(offset+2), "(treasury_percentage?)");
    console.log(`[${offset+4}] u16:`, data.readUInt16LE(offset+4), "(boost_vault_percentage?)");
  }
  
  // Now try with the full 33-byte skip (1 + 32)
  console.log("\n=== Trying offset with 33-byte skip (standard Anchor) ===");
  let offset2 = 40 + 33; // 73
  
  const isPaused2 = data[offset2];
  console.log(`[${offset2}] is_paused:`, isPaused2);
  offset2 += 1;
  
  const pausedAt2 = data.readBigInt64LE(offset2);
  console.log(`[${offset2}] paused_at:`, pausedAt2.toString());
  offset2 += 8;
  
  console.log(`[${offset2}] u16:`, data.readUInt16LE(offset2), "(rebate_percentage?)");
  console.log(`[${offset2+2}] u16:`, data.readUInt16LE(offset2+2), "(treasury_percentage?)");
  console.log(`[${offset2+4}] u16:`, data.readUInt16LE(offset2+4), "(boost_vault_percentage?)");
  
  // Try to find the admin pubkey pattern in wallets
  const adminPubkey = "FLKsRa7xboYJ5d56jjQi2LKqJXMG2ejmWpkDDMLhv4WS";
  console.log("\n=== Searching for admin wallet pattern ===");
  for (let i = 0; i < data.length - 32; i++) {
    try {
      const pk = new PublicKey(data.slice(i, i + 32));
      if (pk.toBase58() === adminPubkey && i !== 8) {
        console.log(`Found admin pubkey at offset ${i}`);
      }
    } catch {}
  }
  
  // Search for System Program pattern
  const systemProgram = "11111111111111111111111111111111";
  for (let i = 0; i < data.length - 32; i++) {
    try {
      const pk = new PublicKey(data.slice(i, i + 32));
      if (pk.toBase58() === systemProgram) {
        console.log(`Found System Program at offset ${i}`);
      }
    } catch {}
  }
}

main().catch(console.error);
