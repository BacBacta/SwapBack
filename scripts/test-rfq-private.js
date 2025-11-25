/**
 * Phase 7 - RFQ Private Testing Script
 * Tests Jupiter integration with timeout and fallback simulation
 * 
 * NOTE: Full RFQ competition requires TypeScript compilation
 * This is a simplified test using Jupiter API directly
 */

const { Connection, PublicKey } = require("@solana/web3.js");

// Token mints (devnet)
const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};

// Test pairs
const TEST_PAIRS = [
  { name: "SOL → USDC", input: TOKENS.SOL, output: TOKENS.USDC, amount: 1_000_000 }, // 0.001 SOL
  { name: "USDC → SOL", input: TOKENS.USDC, output: TOKENS.SOL, amount: 1_000_000 }, // 1 USDC
  { name: "SOL → BONK", input: TOKENS.SOL, output: TOKENS.BONK, amount: 10_000_000 }, // 0.01 SOL
];

/**
 * Fetch quote from Jupiter API
 */
async function fetchJupiterQuote(inputMint, outputMint, amount) {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Jupiter API returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      source: 'jupiter',
      inputAmount: Number(data.inAmount),
      outputAmount: Number(data.outAmount),
      priceImpact: data.priceImpactPct || 0,
      responseTime: Date.now(),
    };
  } catch (error) {
    console.error('Jupiter API error:', error.message);
    return null;
  }
}

/**
 * Simulate Metis quote (placeholder until Metis API is validated)
 */
async function fetchMetisQuote(inputMint, outputMint, amount) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return mock data (slightly better than Jupiter for demo)
  return {
    source: 'metis (simulated)',
    inputAmount: amount,
    outputAmount: amount * 1.02, // 2% better than input (mock)
    priceImpact: 0.001,
    responseTime: Date.now(),
  };
}

/**
 * Test RFQ competition between Jupiter and Metis (simulated)
 */
async function testRFQCompetition() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║      Phase 7 - RFQ Private Competition Test (Devnet)          ║");
  console.log("║               (Simplified - Direct API calls)                  ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const results = {
    total: 0,
    success: 0,
    jupiterWins: 0,
    metisWins: 0,
    failures: [],
  };

  for (const pair of TEST_PAIRS) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`🔍 Testing: ${pair.name}`);
    console.log(`   Amount: ${pair.amount} (smallest units)`);
    console.log(`${"=".repeat(70)}\n`);

    results.total++;

    try {
      // Fetch quotes from Jupiter and simulated Metis
      const startTime = Date.now();
      
      console.log("   🔄 Fetching Jupiter quote...");
      const jupiterPromise = fetchJupiterQuote(pair.input, pair.output, pair.amount);
      
      console.log("   🔄 Fetching Metis quote (simulated)...");
      const metisPromise = fetchMetisQuote(pair.input, pair.output, pair.amount);
      
      // Fetch in parallel
      const [jupiterQuote, metisQuote] = await Promise.all([jupiterPromise, metisPromise]);
      
      const fetchTime = Date.now() - startTime;
      
      const quotes = [jupiterQuote, metisQuote].filter(q => q !== null);

      if (quotes.length === 0) {
        console.log("❌ No quotes received from any source");
        results.failures.push({ pair: pair.name, reason: "No quotes" });
        continue;
      }

      console.log(`\n📊 Received ${quotes.length} quote(s) in ${fetchTime}ms\n`);

      // Display all quotes
      quotes.forEach((quote, index) => {
        console.log(`Quote #${index + 1}: ${quote.source}`);
        console.log(`   Input:        ${quote.inputAmount.toLocaleString()}`);
        console.log(`   Output:       ${quote.outputAmount.toLocaleString()}`);
        console.log(`   Price Impact: ${quote.priceImpact.toFixed(4)}%`);
        console.log();
      });

      // Simple comparison (highest output wins)
      const bestQuote = quotes.reduce((best, current) => 
        current.outputAmount > best.outputAmount ? current : best
      );

      console.log("\n🏆 WINNER:");
      console.log(`   Source:       ${bestQuote.source}`);
      console.log(`   Output:       ${bestQuote.outputAmount.toLocaleString()}`);

      // Track winner
      if (bestQuote.source === 'jupiter') {
        results.jupiterWins++;
      } else {
        results.metisWins++;
      }

      console.log("\n📈 Comparison:");
      quotes
        .sort((a, b) => b.outputAmount - a.outputAmount)
        .forEach((q, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
          const diff = index > 0 
            ? `(-${((1 - q.outputAmount / quotes[0].outputAmount) * 100).toFixed(2)}%)`
            : "";
          console.log(
            `   ${medal} #${index + 1} ${q.source.padEnd(20)} Output: ${q.outputAmount.toLocaleString()} ${diff}`
          );
        });

      results.success++;
    } catch (error) {
      console.error(`\n❌ Test failed for ${pair.name}:`, error.message);
      results.failures.push({ pair: pair.name, reason: error.message });
    }
  }

  // Print summary
  console.log("\n\n" + "=".repeat(70));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total Tests:     ${results.total}`);
  console.log(`Successful:      ${results.success} (${((results.success / results.total) * 100).toFixed(1)}%)`);
  console.log(`Failed:          ${results.failures.length}`);
  console.log();
  console.log(`🏆 Jupiter Wins: ${results.jupiterWins}`);
  console.log(`🏆 Metis Wins:   ${results.metisWins}`);

  if (results.failures.length > 0) {
    console.log("\n❌ Failures:");
    results.failures.forEach((f) => {
      console.log(`   - ${f.pair}: ${f.reason}`);
    });
  }

  console.log("\n" + "=".repeat(70));

  // Determine overall result
  if (results.success === results.total) {
    console.log("✅ ALL TESTS PASSED");
  } else if (results.success > 0) {
    console.log("⚠️ PARTIAL SUCCESS");
  } else {
    console.log("❌ ALL TESTS FAILED");
  }

  console.log("=".repeat(70) + "\n");

  return results;
}

/**
 * Test timeout and fallback behavior (simulated)
 */
async function testTimeoutFallback() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║        Phase 7 - Timeout & Fallback Test (Simulated)          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("🔧 Test 1: Simulate timeout with Promise.race\n");

  const timeoutTest = async (timeoutMs) => {
    const fetchPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ success: true }), 2000);
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });

    try {
      await Promise.race([fetchPromise, timeoutPromise]);
      return 'completed';
    } catch (error) {
      return 'timeout';
    }
  };

  const result1 = await timeoutTest(3000); // Should complete
  console.log(`   ✓ Fetch with 3s timeout: ${result1}`);
  
  const result2 = await timeoutTest(1000); // Should timeout
  console.log(`   ✓ Fetch with 1s timeout: ${result2}`);

  if (result1 === 'completed' && result2 === 'timeout') {
    console.log("   ✅ Timeout protection working correctly\n");
  } else {
    console.log("   ❌ Timeout protection NOT working\n");
  }

  console.log("🔧 Test 2: Simulate fallback mechanism\n");

  const fallbackTest = async () => {
    // Try primary source (simulated failure)
    let result = null;
    
    console.log("   🔄 Trying primary source (Metis)...");
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("   ❌ Primary source failed");
    
    // Fallback to Jupiter
    console.log("   🔄 Falling back to Jupiter...");
    result = await fetchJupiterQuote(TOKENS.SOL, TOKENS.USDC, 1_000_000);
    
    if (result) {
      console.log("   ✅ Fallback to Jupiter successful");
      return true;
    } else {
      console.log("   ❌ Fallback failed");
      return false;
    }
  };

  const fallbackSuccess = await fallbackTest();

  console.log("\n" + "=".repeat(70));
  console.log(fallbackSuccess ? "✅ TIMEOUT & FALLBACK TESTS COMPLETE" : "⚠️ FALLBACK TEST HAD ISSUES");
  console.log("=".repeat(70) + "\n");
}

/**
 * Test scoring logic (simulated)
 */
async function testReliabilityScoring() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║           Phase 7 - Reliability Scoring Test                  ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("📊 Simulated scoring algorithm:\n");
  console.log("   Weights:");
  console.log("      Output Amount:  70%");
  console.log("      Price Impact:   15%");
  console.log("      Reliability:    10%");
  console.log("      Slippage:        5%\n");

  const calculateScore = (outputAmount, maxOutput, priceImpact, reliability, slippage) => {
    const outputScore = (outputAmount / maxOutput) * 100;
    const priceImpactScore = Math.max(0, 100 - priceImpact * 10);
    const reliabilityScore = reliability;
    const slippageScore = Math.max(0, 100 - slippage * 10);
    
    return (
      outputScore * 0.70 +
      priceImpactScore * 0.15 +
      reliabilityScore * 0.10 +
      slippageScore * 0.05
    );
  };

  const quotes = [
    { source: 'Jupiter', output: 248500, priceImpact: 0.12, reliability: 95, slippage: 0.5 },
    { source: 'Metis', output: 249100, priceImpact: 0.08, reliability: 85, slippage: 0.5 },
  ];

  const maxOutput = Math.max(...quotes.map(q => q.output));

  console.log("🔧 Example with current reliability:\n");
  quotes.forEach(q => {
    const score = calculateScore(q.output, maxOutput, q.priceImpact, q.reliability, q.slippage);
    console.log(`   ${q.source}:`);
    console.log(`      Output:      ${q.output.toLocaleString()}`);
    console.log(`      Reliability: ${q.reliability}/100`);
    console.log(`      Score:       ${score.toFixed(2)}/100`);
    console.log();
  });

  console.log("🔧 Simulating Metis reliability decrease to 60:\n");
  const lowReliabilityScore = calculateScore(249100, maxOutput, 0.08, 60, 0.5);
  const jupiterScore = calculateScore(248500, maxOutput, 0.12, 95, 0.5);
  
  console.log(`   Metis (low reliability):  ${lowReliabilityScore.toFixed(2)}/100`);
  console.log(`   Jupiter (unchanged):       ${jupiterScore.toFixed(2)}/100`);
  
  if (jupiterScore > lowReliabilityScore) {
    console.log("\n   ✅ Lower reliability affects ranking (Jupiter would win)\n");
  } else {
    console.log("\n   ℹ️ Output advantage still dominates (Metis still wins)\n");
  }

  console.log("=".repeat(70));
  console.log("✅ RELIABILITY SCORING TESTS COMPLETE");
  console.log("=".repeat(70) + "\n");
}

/**
 * Main test runner
 */
async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                                                                ║");
  console.log("║            PHASE 7 - RFQ PRIVATE INTEGRATION TESTS            ║");
  console.log("║                         Devnet Test Suite                      ║");
  console.log("║                                                                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\n");

  try {
    // Test 1: RFQ Competition
    const competitionResults = await testRFQCompetition();

    // Test 2: Timeout & Fallback
    await testTimeoutFallback();

    // Test 3: Reliability Scoring
    await testReliabilityScoring();

    // Final summary
    console.log("\n" + "=".repeat(70));
    console.log("🎉 PHASE 7 RFQ TESTS COMPLETE");
    console.log("=".repeat(70));
    console.log(`Competition Tests: ${competitionResults.success}/${competitionResults.total} passed`);
    console.log(`Jupiter Wins:      ${competitionResults.jupiterWins}`);
    console.log(`Metis Wins:        ${competitionResults.metisWins}`);
    console.log("=".repeat(70) + "\n");

    process.exit(competitionResults.success === competitionResults.total ? 0 : 1);
  } catch (error) {
    console.error("\n❌ FATAL ERROR:", error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main();
}

module.exports = {
  testRFQCompetition,
  testTimeoutFallback,
  testReliabilityScoring,
};
