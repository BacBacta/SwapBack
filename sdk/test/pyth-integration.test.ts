import { describe, it } from 'vitest';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { OraclePriceService } from '../src/services/OraclePriceService';

describe.skip('Pyth Oracle Integration', () => {
  it('should test Pyth integration', async () => {
    console.log('🧪 Testing Pyth Oracle Integration...\n');

    // Connect to Solana Mainnet
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'),
      'confirmed'
    );

    // Initialize Oracle Service
    const oracleService = new OraclePriceService(connection, 5000);

  // Test tokens (using mint addresses)
  const testCases = [
    {
      name: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
    },
    {
      name: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    {
      name: 'USDT',
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },
  ];

  console.log('📊 Fetching Pyth price feeds...\n');

  for (const testCase of testCases) {
    try {
      console.log(`Testing ${testCase.name}...`);
      
      // Fetch price via private method (reflection hack for testing)
      const priceData = await (oracleService as any).getTokenPrice(testCase.mint);
      
      if (priceData) {
        console.log(`✅ ${testCase.name}:`);
        console.log(`   Provider: ${priceData.provider}`);
        console.log(`   Price: $${priceData.price.toFixed(4)}`);
        console.log(`   Confidence: ±$${priceData.confidence.toFixed(4)}`);
        console.log(`   Confidence %: ${((priceData.confidence / priceData.price) * 100).toFixed(2)}%`);
        console.log(`   Timestamp: ${new Date(priceData.timestamp).toISOString()}`);
        console.log(`   Age: ${Math.floor((Date.now() - priceData.timestamp) / 1000)}s`);
      } else {
        console.log(`⚠️  ${testCase.name}: No price data available`);
      }
      
      console.log('');
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error);
      console.log('');
    }
  }

  console.log('\n🧪 Testing route price verification...\n');

  // Test route verification with mock route
  const mockRoute = {
    venues: ['Orca'],
    splits: [{ venue: 'Orca', percentage: 100, amount: 1000 }],
    expectedOutput: 10050, // Expecting 10,050 USDC for 100 SOL
    totalCost: 50,
    riskScore: 20,
    mevRisk: 'low' as const,
    slippagePercent: 0.5,
    instructions: [],
  };

  try {
    const verification = await oracleService.verifyRoutePrice(
      mockRoute,
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      100, // 100 SOL input
      0.02 // 2% max deviation
    );

    console.log('Route Verification Result:');
    console.log(`   Oracle Price: $${verification.oraclePrice.toFixed(2)}`);
    console.log(`   Route Price: $${verification.routePrice.toFixed(2)}`);
    console.log(`   Deviation: ${(verification.deviation * 100).toFixed(2)}%`);
    console.log(`   Acceptable: ${verification.isAcceptable ? '✅ YES' : '❌ NO'}`);
    if (verification.warning) {
      console.log(`   Warning: ${verification.warning}`);
    }
  } catch (error) {
    console.error('❌ Route verification failed:', error);
  }

  console.log('\n✅ Pyth Integration Test Complete!');
  });
});
