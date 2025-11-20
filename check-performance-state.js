const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SwapbackRouter;

  console.log("Checking Performance Modules State...");

  // 1. Check Router State
  const [routerStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    program.programId
  );
  try {
    const state = await program.account.routerState.fetch(routerStatePda);
    console.log("\n✅ Router State:");
    console.log("- Authority:", state.authority.toString());
    console.log("- Dynamic Slippage Enabled:", state.dynamicSlippageEnabled);
    console.log("- Total Volume:", state.totalVolume.toString());
  } catch (e) {
    console.error("❌ Error fetching Router State:", e.message);
  }

  // 2. Check Venue Score
  const [venueScorePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("venue_score"), routerStatePda.toBuffer()],
    program.programId
  );
  try {
    const score = await program.account.venueScore.fetch(venueScorePda);
    console.log("\n✅ Venue Score:");
    console.log("- Venue:", score.venue.toString());
    console.log("- Avg Latency:", score.avgLatencyMs);
    console.log("- Avg Slippage:", score.avgSlippageBps);
    console.log("- Quality Score:", score.qualityScore);
  } catch (e) {
    console.error("❌ Error fetching Venue Score:", e.message);
  }

  // 3. Check Oracle Cache
  const SOL_USD_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
  const [oracleCachePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_cache"), SOL_USD_FEED.toBuffer()],
    program.programId
  );
  try {
    const cache = await program.account.oracleCache.fetch(oracleCachePda);
    console.log("\n✅ Oracle Cache:");
    console.log("- Token Pair:", cache.tokenPair.map(k => k.toString()));
    console.log("- Cached Price:", cache.cachedPrice.toString());
    console.log("- Cached At:", new Date(cache.cachedAt.toNumber() * 1000).toISOString());
    console.log("- Cache Duration:", cache.cacheDuration.toString());
  } catch (e) {
    console.error("❌ Error fetching Oracle Cache:", e.message);
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
