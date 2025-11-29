const { Connection, PublicKey } = require("@solana/web3.js");

async function testSolBalance() {
  // Devnet RPC
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Ton wallet
  const walletAddress = "DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP";
  const publicKey = new PublicKey(walletAddress);
  
  console.log("Testing SOL balance for:", walletAddress);
  
  try {
    const lamports = await connection.getBalance(publicKey);
    const solBalance = lamports / 1e9;
    console.log("✅ SOL balance:", solBalance.toFixed(6), "SOL");
    console.log("Raw lamports:", lamports);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testSolBalance();
