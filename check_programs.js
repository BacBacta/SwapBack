const anchor = require("@coral-xyz/anchor");
const { Connection, PublicKey } = require("@solana/web3.js");

async function checkPrograms() {
  try {
    const connection = new Connection("http://localhost:8899", "confirmed");

    // Test connection
    const version = await connection.getVersion();
    console.log("Connected to Solana:", version);

    // Check if programs exist
    const commonSwapId = new PublicKey(
      "FATq512CLwLAcxcJGRQosgxMTHnxRwvhPHKZGUBY1wxg"
    );
    const routerId = new PublicKey(
      "3d7RVuiAvEYCrQp8534nJ1TnyAYUoqrnBPEGXvaMhYwa"
    );
    const cnftId = new PublicKey(
      "2HAiig6cGhtB9RZow4hXDPEPamUBS3EdZfnjAyDpC7BU"
    );

    const commonSwapInfo = await connection.getAccountInfo(commonSwapId);
    const routerInfo = await connection.getAccountInfo(routerId);
    const cnftInfo = await connection.getAccountInfo(cnftId);

    console.log("Common Swap program deployed:", !!commonSwapInfo);
    console.log("Router program deployed:", !!routerInfo);
    console.log("CNFT program deployed:", !!cnftInfo);
  } catch (e) {
    console.log("Error:", e.message);
  }
}

checkPrograms();
