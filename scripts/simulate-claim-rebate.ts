/**
 * Simulate claim_rewards on mainnet (simulateTransaction only - no real funds)
 */
import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import * as fs from "fs";

const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// claim_rewards discriminator from IDL
const CLAIM_REWARDS_DISCRIMINATOR = Buffer.from([4, 144, 132, 71, 116, 23, 151, 80]);

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  // Load or generate keypair
  let keypair: Keypair;
  const kpPath = process.env.SOLANA_KEYPAIR;
  if (kpPath && fs.existsSync(kpPath)) {
    const raw = JSON.parse(fs.readFileSync(kpPath, "utf-8"));
    keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else if (process.env.SWAPBACK_AUTO_CREATE_KEYPAIR) {
    keypair = Keypair.generate();
    console.log("⚠️  Using ephemeral keypair:", keypair.publicKey.toBase58());
  } else {
    console.error("No keypair found. Set SOLANA_KEYPAIR or SWAPBACK_AUTO_CREATE_KEYPAIR=1");
    process.exit(1);
  }

  const user = keypair.publicKey;
  console.log("👤 User:", user.toBase58());

  // Derive PDAs
  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("router_state")], ROUTER_PROGRAM_ID);
  const [userRebatePda] = PublicKey.findProgramAddressSync([Buffer.from("user_rebate"), user.toBuffer()], ROUTER_PROGRAM_ID);
  const [rebateVaultPda] = PublicKey.findProgramAddressSync([Buffer.from("rebate_vault"), statePda.toBuffer()], ROUTER_PROGRAM_ID);
  const userUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, user);

  console.log("📍 PDAs:");
  console.log("   state:", statePda.toBase58());
  console.log("   userRebate:", userRebatePda.toBase58());
  console.log("   rebateVault:", rebateVaultPda.toBase58());
  console.log("   userUsdcAta:", userUsdcAta.toBase58());

  // Check if user_rebate account exists
  const userRebateInfo = await connection.getAccountInfo(userRebatePda);
  if (!userRebateInfo) {
    console.log("\n❌ user_rebate account does not exist for this user.");
    console.log("   This user has never swapped via SwapBack router.");
    process.exit(0);
  }

  // Parse user_rebate data
  const data = userRebateInfo.data;
  let offset = 8; // discriminator
  offset += 32; // user pubkey
  const unclaimedLamports = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const totalClaimedLamports = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const totalSwaps = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const lastSwapTs = data.length >= offset + 8 ? Number(data.readBigInt64LE(offset)) : 0;
  offset += 8;
  const lastClaimTs = data.length >= offset + 8 ? Number(data.readBigInt64LE(offset)) : 0;

  const unclaimedUsdc = unclaimedLamports / 1e6;
  const totalClaimedUsdc = totalClaimedLamports / 1e6;

  console.log("\n📊 UserRebate account data:");
  console.log("   unclaimed:", unclaimedUsdc.toFixed(6), "USDC");
  console.log("   totalClaimed:", totalClaimedUsdc.toFixed(6), "USDC");
  console.log("   totalSwaps:", totalSwaps);
  console.log("   lastSwapTimestamp:", lastSwapTs, lastSwapTs ? `(${new Date(lastSwapTs * 1000).toISOString()})` : "");
  console.log("   lastClaimTimestamp:", lastClaimTs, lastClaimTs ? `(${new Date(lastClaimTs * 1000).toISOString()})` : "");

  const nowSecs = Math.floor(Date.now() / 1000);
  const claimableAfter = lastSwapTs + 48 * 60 * 60;
  const remainingSecs = Math.max(0, claimableAfter - nowSecs);

  if (lastSwapTs > 0 && nowSecs < claimableAfter) {
    const hrs = Math.floor(remainingSecs / 3600);
    const mins = Math.floor((remainingSecs % 3600) / 60);
    console.log(`\n⏳ Claim locked: available in ${hrs}h ${mins}m (48h rule)`);
  } else if (unclaimedLamports > 0) {
    console.log("\n✅ Claim unlocked (48h passed or no swap timestamp)");
  }

  if (unclaimedLamports === 0) {
    console.log("\n⚠️  No unclaimed rebates to claim.");
    process.exit(0);
  }

  // Build claim_rewards transaction
  const tx = new Transaction();

  // Ensure ATA exists (idempotent)
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      user,
      userUsdcAta,
      user,
      USDC_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // claim_rewards instruction
  const claimIx = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: userRebatePda, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: rebateVaultPda, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: CLAIM_REWARDS_DISCRIMINATOR,
  });
  tx.add(claimIx);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = user;

  console.log("\n🔄 Simulating claim_rewards transaction...");

  const simResult = await connection.simulateTransaction(tx, [keypair]);

  if (simResult.value.err) {
    console.log("\n❌ Simulation FAILED");
    console.log("   Error:", JSON.stringify(simResult.value.err));

    // Parse logs for specific error
    const logs = simResult.value.logs || [];
    const errorLog = logs.find((l) => l.includes("Error") || l.includes("failed"));
    if (errorLog) console.log("   Log:", errorLog);

    // Check for RebateClaimTooEarly
    const isTooEarly = logs.some(
      (l) => l.includes("RebateClaimTooEarly") || l.includes("6017") || l.includes("0x1781")
    );
    if (isTooEarly) {
      const hrs = Math.floor(remainingSecs / 3600);
      const mins = Math.floor((remainingSecs % 3600) / 60);
      console.log(`\n⏳ RebateClaimTooEarly: claim available in ${hrs}h ${mins}m`);
    }
  } else {
    console.log("\n✅ Simulation SUCCESS");
    console.log("   Units consumed:", simResult.value.unitsConsumed);
    console.log("   Logs:");
    (simResult.value.logs || []).forEach((l) => console.log("     ", l));
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
