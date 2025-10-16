/**
 * Demonstration script for tranche-based weight calculation
 * Shows how the new algorithm allocates weights across DEXes
 */

function simulateAMMOutput(amountIn, source) {
  // Simulate AMM: x*y = k with fees
  const reserveIn = source.depth * 0.5;
  const reserveOut = source.depth * 0.5;
  const feeRate = source.feeAmount || 0.003;
  const effectiveInput = amountIn * (1 - feeRate);

  const numerator = reserveIn * reserveOut;
  const denominator = reserveIn + effectiveInput;
  return reserveOut - numerator / denominator;
}

function computeWeightsTrancheBased(amountIn, dexList) {
  if (dexList.length === 0) return { weights: [], venueOrder: [] };
  if (dexList.length === 1)
    return { weights: [100], venueOrder: [dexList[0].venue] };

  // Step 1: Simulate output and calculate unit costs
  const dexCosts = dexList.map((dex) => {
    const simulatedOutput = simulateAMMOutput(amountIn, dex);
    const unitCost = amountIn / Math.max(simulatedOutput, 0.000001);
    return { dex, unitCost, simulatedOutput };
  });

  // Step 2: Sort by ascending unit cost (lowest cost first)
  dexCosts.sort((a, b) => a.unitCost - b.unitCost);

  // Step 3: Allocate in tranches
  const allocations = [];
  let remainingAmount = amountIn;

  for (const dexCost of dexCosts) {
    if (remainingAmount <= 0) break;

    const trancheSize = Math.min(
      remainingAmount * 0.4,
      dexCost.dex.depth * 0.1
    );
    const allocatedInput = Math.min(trancheSize, remainingAmount);

    if (allocatedInput > 0) {
      allocations.push({ dex: dexCost.dex, allocatedInput });
      remainingAmount -= allocatedInput;
    }
  }

  // Step 4: Convert to weights summing to 100
  const weights = [];
  const venueOrder = [];

  for (const allocation of allocations) {
    const weight = Math.round((allocation.allocatedInput / amountIn) * 100);
    weights.push(weight);
    venueOrder.push(allocation.dex.venue);
  }

  // Ensure sum is exactly 100
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight !== 100 && weights.length > 0) {
    weights[weights.length - 1] += 100 - totalWeight;
  }

  return { weights, venueOrder };
}

// Demo with sample data
const dexes = [
  {
    venue: "Raydium",
    depth: 1000000,
    feeAmount: 30,
    effectivePrice: 0.00001,
    slippagePercent: 0.005,
  },
  {
    venue: "Orca",
    depth: 500000,
    feeAmount: 15,
    effectivePrice: 0.0000105,
    slippagePercent: 0.003,
  },
  {
    venue: "Jupiter",
    depth: 2000000,
    feeAmount: 20,
    effectivePrice: 0.0000098,
    slippagePercent: 0.002,
  },
];

const inputAmount = 100000;
const result = computeWeightsTrancheBased(inputAmount, dexes);

console.log("Tranche-based Weight Allocation Demo");
console.log("====================================");
console.log(`Input Amount: $${inputAmount}`);
console.log(
  "DEXes:",
  dexes.map((d) => `${d.venue} ($${d.depth} liquidity)`)
);
console.log("\nResults:");
console.log("Weights:", result.weights);
console.log("Venue Order:", result.venueOrder);
console.log(
  "Total Weight:",
  result.weights.reduce((sum, w) => sum + w, 0)
);

// Show individual allocations
console.log("\nDetailed Allocation:");
for (let i = 0; i < result.weights.length; i++) {
  const weight = result.weights[i];
  const venue = result.venueOrder[i];
  const amount = (weight / 100) * inputAmount;
  console.log(`${venue}: ${weight}% ($${amount.toFixed(0)})`);
}
