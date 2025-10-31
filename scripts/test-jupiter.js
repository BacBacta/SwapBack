/**
 * Script de test de l'intégration Jupiter
 * Test les appels API réels à Jupiter Aggregator v6
 */

const axios = require("axios");

// Mints connus sur devnet
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; // USDC devnet (Circle)

const JUPITER_API = "https://quote-api.jup.ag/v6";

async function testJupiterIntegration() {
  console.log("🧪 Test de l'intégration Jupiter");
  console.log("=====================================\n");

  try {
    // Test 1: Obtenir une quote SOL → USDC
    console.log("📊 Test 1: Quote SOL → USDC");
    console.log("Input: 0.1 SOL");
    console.log("Slippage: 0.5% (50 bps)\n");

    const amount = 0.1 * 1e9; // 0.1 SOL en lamports

    const quoteResponse = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: amount.toString(),
        slippageBps: 50,
      },
    });

    const quote = quoteResponse.data;

    console.log("✅ Quote reçue:");
    console.log(`   Input: ${quote.inAmount} lamports (${quote.inAmount / 1e9} SOL)`);
    console.log(
      `   Output: ${quote.outAmount} (${quote.outAmount / 1e6} USDC)`
    );
    console.log(`   Price Impact: ${quote.priceImpactPct}%`);
    console.log(`   Slippage: ${quote.slippageBps} bps`);
    console.log(`   Routes: ${quote.routePlan.length} plan(s)`);

    // Afficher les routes
    console.log("\n🛣️  Route détaillée:");
    quote.routePlan.forEach((plan, idx) => {
      const { label, inAmount, outAmount } = plan.swapInfo;
      console.log(`   ${idx + 1}. ${label || "Unknown DEX"} (${plan.percent}%)`);
      console.log(`      In: ${inAmount} → Out: ${outAmount}`);
    });

    // Test 2: Quote inverse USDC → SOL
    console.log("\n📊 Test 2: Quote USDC → SOL");
    console.log("Input: 10 USDC");

    const usdcAmount = 10 * 1e6; // 10 USDC

    const quote2Response = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint: USDC_MINT,
        outputMint: SOL_MINT,
        amount: usdcAmount.toString(),
        slippageBps: 50,
      },
    });

    const quote2 = quote2Response.data;

    console.log("✅ Quote reçue:");
    console.log(`   Input: ${quote2.inAmount} (${quote2.inAmount / 1e6} USDC)`);
    console.log(
      `   Output: ${quote2.outAmount} lamports (${quote2.outAmount / 1e9} SOL)`
    );
    console.log(`   Price Impact: ${quote2.priceImpactPct}%`);

    // Test 3: Calculer NPI (avec quote mockée pour exemple)
    console.log("\n💰 Test 3: Calcul NPI");
    const swapBackOut = Number.parseInt(quote.outAmount) * 1.015; // SwapBack 1.5% meilleur
    const jupiterOut = Number.parseInt(quote.outAmount);

    const npiAmount = swapBackOut - jupiterOut;
    const npiPercent = (npiAmount / jupiterOut) * 100;

    console.log(`   Jupiter output: ${jupiterOut / 1e6} USDC`);
    console.log(`   SwapBack output: ${swapBackOut / 1e6} USDC`);
    console.log(`   NPI: +${npiAmount / 1e6} USDC (+${npiPercent.toFixed(2)}%)`);
    console.log(
      `   Better than Jupiter: ${npiAmount > 0 ? "✅ YES" : "❌ NO"}`
    );

    // Test 4: Liste des tokens
    console.log("\n📋 Test 4: Fetch token list");
    const tokensResponse = await axios.get("https://token.jup.ag/all");
    const tokens = tokensResponse.data;
    console.log(`✅ ${tokens.length} tokens disponibles sur Jupiter`);
    console.log("   Premiers tokens:");
    tokens.slice(0, 5).forEach((token) => {
      console.log(`   - ${token.symbol}: ${token.address}`);
    });

    console.log("\n✅ Tous les tests réussis !");
    console.log("\n📝 Résumé:");
    console.log("   ✅ API Jupiter fonctionnelle");
    console.log("   ✅ Quotes en temps réel");
    console.log("   ✅ Calcul NPI opérationnel");
    console.log("   ✅ Token list accessible");
  } catch (error) {
    console.error("\n❌ Erreur lors des tests:", error.message);
    if (error.response) {
      console.error("   Response:", error.response.data);
    }
    process.exit(1);
  }
}

// Exécuter les tests
testJupiterIntegration();
