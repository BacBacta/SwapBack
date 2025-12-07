#!/usr/bin/env node
/**
 * Check recent transactions for a wallet
 * Usage: node check-recent-txs.js <WALLET_ADDRESS>
 */

const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_URL = "https://api.mainnet-beta.solana.com";

async function main() {
  const walletAddress = process.argv[2];
  
  if (!walletAddress) {
    console.log("Usage: node check-recent-txs.js <WALLET_ADDRESS>");
    console.log("Example: node check-recent-txs.js FLKsRa7xboYJ5d56jjQi2LKqJXMG2ejmWpkDDMLhv4WS");
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new PublicKey(walletAddress);

  console.log(`\n🔍 Checking recent transactions for: ${walletAddress}\n`);

  try {
    // Get recent signatures
    const signatures = await connection.getSignaturesForAddress(wallet, { limit: 10 });
    
    if (signatures.length === 0) {
      console.log("❌ No recent transactions found");
      return;
    }

    console.log(`Found ${signatures.length} recent transactions:\n`);
    console.log("=" .repeat(100));

    for (const sig of signatures) {
      const date = new Date(sig.blockTime * 1000).toLocaleString();
      const status = sig.err ? "❌ FAILED" : "✅ SUCCESS";
      
      console.log(`\n📝 Signature: ${sig.signature}`);
      console.log(`   Status: ${status}`);
      console.log(`   Time: ${date}`);
      console.log(`   Slot: ${sig.slot}`);
      
      if (sig.err) {
        console.log(`   Error: ${JSON.stringify(sig.err)}`);
      }

      // Get transaction details
      try {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx && tx.meta) {
          // Check for SOL balance changes
          const preBalances = tx.meta.preBalances;
          const postBalances = tx.meta.postBalances;
          const solChange = (postBalances[0] - preBalances[0]) / 1e9;
          
          console.log(`   SOL Change: ${solChange > 0 ? '+' : ''}${solChange.toFixed(6)} SOL`);
          console.log(`   Fee: ${tx.meta.fee / 1e9} SOL`);

          // Check for token balance changes
          if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
            const tokenChanges = [];
            
            // Create a map of pre-balances
            const preTokenMap = new Map();
            for (const bal of tx.meta.preTokenBalances) {
              const key = `${bal.owner}-${bal.mint}`;
              preTokenMap.set(key, parseFloat(bal.uiTokenAmount?.uiAmountString || '0'));
            }
            
            // Calculate changes
            for (const bal of tx.meta.postTokenBalances) {
              const key = `${bal.owner}-${bal.mint}`;
              const preBal = preTokenMap.get(key) || 0;
              const postBal = parseFloat(bal.uiTokenAmount?.uiAmountString || '0');
              const change = postBal - preBal;
              
              if (change !== 0 && bal.owner === walletAddress) {
                tokenChanges.push({
                  mint: bal.mint,
                  change: change,
                  decimals: bal.uiTokenAmount?.decimals || 0
                });
              }
            }

            if (tokenChanges.length > 0) {
              console.log(`   Token Changes:`);
              for (const tc of tokenChanges) {
                const mintLabel = tc.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? '(USDC)' :
                                  tc.mint === 'So11111111111111111111111111111111111111112' ? '(Wrapped SOL)' : '';
                console.log(`      ${tc.change > 0 ? '+' : ''}${tc.change} ${mintLabel} ${tc.mint.slice(0, 8)}...`);
              }
            }
          }

          // Check for errors in logs
          if (tx.meta.err) {
            console.log(`   ⚠️ Transaction Error: ${JSON.stringify(tx.meta.err)}`);
          }

          // Show relevant logs
          if (tx.meta.logMessages) {
            const importantLogs = tx.meta.logMessages.filter(log => 
              log.includes('failed') || 
              log.includes('error') || 
              log.includes('Error') ||
              log.includes('insufficient')
            );
            if (importantLogs.length > 0) {
              console.log(`   ⚠️ Important Logs:`);
              for (const log of importantLogs) {
                console.log(`      ${log}`);
              }
            }
          }
        }
      } catch (e) {
        console.log(`   (Could not fetch tx details: ${e.message})`);
      }
    }

    console.log("\n" + "=".repeat(100));
    console.log("\n💡 To view full details, visit: https://solscan.io/account/" + walletAddress);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
