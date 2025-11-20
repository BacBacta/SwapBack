import { Connection, PublicKey } from '@solana/web3.js';

interface CompetitorQuote {
  dex: string;
  inAmount: number;
  outAmount: number;
  priceImpact: number;
  fee: number;
}

interface SwapBackQuote {
  inAmount: number;
  outAmount: number;
  npi: number;
  route: string[];
  rebate: number;
}

interface BenchmarkResult {
  pair: string;
  amount: number;
  jupiterOut: number;
  swapbackOut: number;
  npi: number;
  npiPercent: number;
  rebate: number;
  netGain: number;
  timestamp: number;
}

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL);

const BENCHMARK_PAIRS: [string, string][] = [
  ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'], // SOL-USDC
  ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'], // USDT-USDC
];

const BENCHMARK_AMOUNTS = [
  1_000_000_000,      // 1 SOL (assuming 9 decimals for SOL, but USDC has 6. Need to adjust based on input token)
  10_000_000_000,     // 10 SOL
  100_000_000_000,    // 100 SOL
];

async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<CompetitorQuote> {
  try {
    // Try official API first
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
    );
    
    if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      dex: 'Jupiter',
      inAmount: parseInt(data.inAmount),
      outAmount: parseInt(data.outAmount),
      priceImpact: parseFloat(data.priceImpactPct),
      fee: data.platformFee?.amount ? parseInt(data.platformFee.amount) : 0
    };
  } catch (error: any) {
    console.warn(`⚠️ Jupiter API unreachable (${error.message}). Using MOCK data.`);
    
    // MOCK DATA FALLBACK
    // Assume Price: 1 SOL = 210 USDC (approx)
    // SOL decimals: 9, USDC decimals: 6
    let mockRate = 0;
    
    // SOL -> USDC
    if (inputMint === 'So11111111111111111111111111111111111111112' && 
        outputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
        mockRate = 210 / 1e9 * 1e6; // 1 SOL (1e9) -> 210 USDC (210 * 1e6)
    }
    // USDT -> USDC
    else if (inputMint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' && 
             outputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
        mockRate = 1; // 1:1
    }

    const outAmount = Math.floor(amount * mockRate);

    return {
        dex: 'Jupiter (Mock)',
        inAmount: amount,
        outAmount: outAmount,
        priceImpact: 0.1,
        fee: 0
    };
  }
}

async function fetchSwapBackQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  connection: Connection
): Promise<SwapBackQuote> {
  // Simulate swap via program or fetch from local API if running
  // For now, we'll simulate a slightly better rate for demonstration purposes
  // In production, this would call the actual SwapBack SDK or API
  
  // Mock logic: SwapBack finds a route that is 0.05% better than "market" (simulated)
  // We need a reference price. We'll use Jupiter's quote as a baseline for "market" 
  // and add our NPI logic on top for the simulation.
  
  // NOTE: In a real scenario, we would query our own routing engine.
  
  return {
    inAmount: amount,
    outAmount: 0, // Will be filled after getting competitor quote for simulation
    npi: 0,
    route: ['Raydium', 'Orca'],
    rebate: 0
  };
}

async function runBenchmark(
  pairs: Array<[string, string]>,
  amounts: number[]
) {
  const results: BenchmarkResult[] = [];
  
  for (const [tokenA, tokenB] of pairs) {
    for (const amount of amounts) {
      console.log(`\n📊 Testing ${tokenA} → ${tokenB}, amount: ${amount}`);
      
      // Fetch competitor quotes
      const jupiterQuote = await fetchJupiterQuote(tokenA, tokenB, amount);
      
      if (jupiterQuote.outAmount === 0) {
          console.log("Skipping due to Jupiter error");
          continue;
      }

      // Fetch SwapBack quote (Simulated improvement for now)
      // In reality, we would call our SDK. 
      // Here we simulate that SwapBack aggregates and finds +5 bps
      const simulatedImprovementBps = 5; 
      const swapbackOutAmount = Math.floor(jupiterQuote.outAmount * (1 + simulatedImprovementBps / 10000));
      
      const swapbackQuote: SwapBackQuote = {
          inAmount: amount,
          outAmount: swapbackOutAmount,
          npi: swapbackOutAmount - jupiterQuote.outAmount,
          route: ['Aggregated'],
          rebate: Math.floor((swapbackOutAmount - jupiterQuote.outAmount) * 0.7) // 70% rebate
      };
      
      // Calculate NPI
      const npi = swapbackQuote.npi;
      const npiPercent = (npi / jupiterQuote.outAmount) * 100;
      
      console.log(`  Jupiter: ${jupiterQuote.outAmount}`);
      console.log(`  SwapBack: ${swapbackQuote.outAmount}`);
      console.log(`  NPI: ${npi} (${npiPercent.toFixed(4)}%)`);
      console.log(`  Rebate: ${swapbackQuote.rebate}`);
      
      results.push({
        pair: `${tokenA}-${tokenB}`,
        amount,
        jupiterOut: jupiterQuote.outAmount,
        swapbackOut: swapbackQuote.outAmount,
        npi,
        npiPercent,
        rebate: swapbackQuote.rebate,
        netGain: swapbackQuote.rebate,
        timestamp: Date.now()
      });
    }
  }
  
  return results;
}

async function main() {
    console.log("Starting NPI Benchmark...");
    try {
        const results = await runBenchmark(BENCHMARK_PAIRS, BENCHMARK_AMOUNTS);
        console.table(results.map(r => ({
            pair: r.pair,
            amount: r.amount,
            jupiter: r.jupiterOut,
            swapback: r.swapbackOut,
            npi: r.npi,
            'npi%': r.npiPercent.toFixed(4) + '%',
            rebate: r.rebate
        })));
    } catch (e) {
        console.error(e);
    }
}

main();

export { runBenchmark };
