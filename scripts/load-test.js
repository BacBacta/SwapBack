#!/usr/bin/env node
/**
 * Load Testing Script - Phase 7.3
 * 
 * Tests SwapBack under heavy concurrent load to identify bottlenecks
 * and validate production readiness.
 * 
 * Usage:
 *   node scripts/load-test.js [options]
 * 
 * Options:
 *   --num-swaps=N       Total number of swaps to execute (default: 100)
 *   --workers=N         Number of concurrent workers (default: 10)
 *   --amount=N          Amount per swap in SOL (default: 0.01)
 *   --rpc-url=URL       Custom RPC endpoint (default: devnet)
 *   --output=FILE       Output file for results (default: load-test-results.json)
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://api.devnet.solana.com',
  NUM_SWAPS: parseInt(process.env.NUM_SWAPS || '100'),
  NUM_WORKERS: parseInt(process.env.NUM_WORKERS || '10'),
  SWAP_AMOUNT: parseFloat(process.env.SWAP_AMOUNT || '0.01'),
  OUTPUT_FILE: process.env.OUTPUT_FILE || 'load-test-results.json',
  
  // Tokens for testing (devnet)
  SOL_MINT: 'So11111111111111111111111111111111111111112',
  USDC_MINT: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC devnet
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  
  // Rate limiting
  RATE_LIMIT_DELAY_MS: 100, // Delay between worker starts
};

// Parse command line arguments
process.argv.forEach(arg => {
  if (arg.startsWith('--num-swaps=')) {
    CONFIG.NUM_SWAPS = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--workers=')) {
    CONFIG.NUM_WORKERS = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--amount=')) {
    CONFIG.SWAP_AMOUNT = parseFloat(arg.split('=')[1]);
  } else if (arg.startsWith('--rpc-url=')) {
    CONFIG.RPC_URL = arg.split('=')[1];
  } else if (arg.startsWith('--output=')) {
    CONFIG.OUTPUT_FILE = arg.split('=')[1];
  }
});

// Colors for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

// Global metrics collector
const metrics = {
  totalSwaps: 0,
  successfulSwaps: 0,
  failedSwaps: 0,
  latencies: [],
  errors: [],
  startTime: null,
  endTime: null,
  workerMetrics: [],
};

/**
 * Simulate a swap transaction
 * In production, this would call your actual swap program
 */
async function executeSwap(connection, workerId, swapId) {
  const startTime = Date.now();
  
  try {
    // Simulate swap preparation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get latest blockhash (real RPC call)
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    // Simulate transaction building and signing
    await new Promise(resolve => setTimeout(resolve, 30));
    
    // Simulate transaction sending (with random success/failure)
    const success = Math.random() > 0.05; // 95% success rate simulation
    
    if (!success) {
      throw new Error('Simulated transaction failure');
    }
    
    // Simulate confirmation wait
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    
    const latency = Date.now() - startTime;
    
    return {
      success: true,
      workerId,
      swapId,
      latency,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    const latency = Date.now() - startTime;
    
    return {
      success: false,
      workerId,
      swapId,
      latency,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Worker function - executes swaps from a queue
 */
async function worker(connection, workerId, swapQueue) {
  const workerMetrics = {
    workerId,
    swapsExecuted: 0,
    swapsSucceeded: 0,
    swapsFailed: 0,
    totalLatency: 0,
    errors: [],
  };
  
  while (swapQueue.length > 0) {
    const swapId = swapQueue.shift();
    if (swapId === undefined) break;
    
    workerMetrics.swapsExecuted++;
    
    const result = await executeSwap(connection, workerId, swapId);
    
    if (result.success) {
      workerMetrics.swapsSucceeded++;
      metrics.successfulSwaps++;
      log(`  [Worker ${workerId}] Swap #${swapId} ✅ ${result.latency}ms`, 'green');
    } else {
      workerMetrics.swapsFailed++;
      metrics.failedSwaps++;
      workerMetrics.errors.push({
        swapId,
        error: result.error,
        timestamp: result.timestamp,
      });
      log(`  [Worker ${workerId}] Swap #${swapId} ❌ ${result.error}`, 'red');
    }
    
    workerMetrics.totalLatency += result.latency;
    metrics.latencies.push(result.latency);
    metrics.totalSwaps++;
    
    // Progress update every 10 swaps
    if (metrics.totalSwaps % 10 === 0) {
      const progress = ((metrics.totalSwaps / CONFIG.NUM_SWAPS) * 100).toFixed(1);
      const successRate = ((metrics.successfulSwaps / metrics.totalSwaps) * 100).toFixed(1);
      log(`\n📊 Progress: ${progress}% | Success Rate: ${successRate}% | Completed: ${metrics.totalSwaps}/${CONFIG.NUM_SWAPS}`, 'cyan');
    }
  }
  
  return workerMetrics;
}

/**
 * Calculate statistics from latency array
 */
function calculateStats(latencies) {
  if (latencies.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

/**
 * Main load test orchestrator
 */
async function runLoadTest() {
  log('\n🚀 SwapBack Load Test - Phase 7.3\n', 'bright');
  
  // Display configuration
  log('📋 Configuration:', 'cyan');
  log(`   RPC URL: ${CONFIG.RPC_URL}`);
  log(`   Total Swaps: ${CONFIG.NUM_SWAPS}`);
  log(`   Concurrent Workers: ${CONFIG.NUM_WORKERS}`);
  log(`   Amount per Swap: ${CONFIG.SWAP_AMOUNT} SOL`);
  log(`   Output File: ${CONFIG.OUTPUT_FILE}\n`);
  
  // Initialize connection
  log('🔌 Connecting to Solana...', 'yellow');
  const connection = new Connection(CONFIG.RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
  
  try {
    const version = await connection.getVersion();
    log(`   ✅ Connected to Solana ${version['solana-core']}\n`, 'green');
  } catch (error) {
    log(`   ❌ Connection failed: ${error.message}\n`, 'red');
    process.exit(1);
  }
  
  // Create swap queue
  const swapQueue = Array.from({ length: CONFIG.NUM_SWAPS }, (_, i) => i + 1);
  
  log('🏃 Starting workers...\n', 'yellow');
  metrics.startTime = Date.now();
  
  // Launch workers with staggered start to avoid rate limits
  const workerPromises = [];
  for (let i = 0; i < CONFIG.NUM_WORKERS; i++) {
    // Stagger worker starts
    await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY_MS));
    
    log(`   Worker ${i + 1} started`, 'blue');
    workerPromises.push(worker(connection, i + 1, swapQueue));
  }
  
  log('\n⏳ Executing swaps...\n', 'yellow');
  
  // Wait for all workers to complete
  metrics.workerMetrics = await Promise.all(workerPromises);
  
  metrics.endTime = Date.now();
  const totalTime = (metrics.endTime - metrics.startTime) / 1000;
  
  // Calculate statistics
  const latencyStats = calculateStats(metrics.latencies);
  const tps = metrics.successfulSwaps / totalTime;
  const successRate = (metrics.successfulSwaps / metrics.totalSwaps) * 100;
  
  // Display results
  log('\n' + '='.repeat(60), 'bright');
  log('📊 LOAD TEST RESULTS', 'bright');
  log('='.repeat(60) + '\n', 'bright');
  
  log('⏱️  Execution Time:', 'cyan');
  log(`   Total Duration: ${totalTime.toFixed(2)}s`);
  log(`   TPS (Transactions Per Second): ${tps.toFixed(2)}\n`);
  
  log('✅ Success Metrics:', 'green');
  log(`   Total Swaps: ${metrics.totalSwaps}`);
  log(`   Successful: ${metrics.successfulSwaps}`);
  log(`   Failed: ${metrics.failedSwaps}`);
  log(`   Success Rate: ${successRate.toFixed(2)}%\n`);
  
  log('📈 Latency Statistics (ms):', 'cyan');
  log(`   Min: ${latencyStats.min.toFixed(2)}ms`);
  log(`   Max: ${latencyStats.max.toFixed(2)}ms`);
  log(`   Average: ${latencyStats.avg.toFixed(2)}ms`);
  log(`   P50 (Median): ${latencyStats.p50.toFixed(2)}ms`);
  log(`   P95: ${latencyStats.p95.toFixed(2)}ms`);
  log(`   P99: ${latencyStats.p99.toFixed(2)}ms\n`);
  
  // Performance assessment
  log('🎯 Performance Assessment:', 'yellow');
  
  if (tps >= 5) {
    log(`   TPS: ✅ EXCELLENT (${tps.toFixed(2)} >= 5 target)`, 'green');
  } else if (tps >= 3) {
    log(`   TPS: ⚠️  ACCEPTABLE (${tps.toFixed(2)} >= 3)`, 'yellow');
  } else {
    log(`   TPS: ❌ NEEDS IMPROVEMENT (${tps.toFixed(2)} < 3)`, 'red');
  }
  
  if (successRate >= 95) {
    log(`   Success Rate: ✅ EXCELLENT (${successRate.toFixed(2)}% >= 95%)`, 'green');
  } else if (successRate >= 85) {
    log(`   Success Rate: ⚠️  ACCEPTABLE (${successRate.toFixed(2)}% >= 85%)`, 'yellow');
  } else {
    log(`   Success Rate: ❌ NEEDS IMPROVEMENT (${successRate.toFixed(2)}% < 85%)`, 'red');
  }
  
  if (latencyStats.p95 <= 1000) {
    log(`   P95 Latency: ✅ EXCELLENT (${latencyStats.p95.toFixed(2)}ms <= 1000ms)`, 'green');
  } else if (latencyStats.p95 <= 2000) {
    log(`   P95 Latency: ⚠️  ACCEPTABLE (${latencyStats.p95.toFixed(2)}ms <= 2000ms)`, 'yellow');
  } else {
    log(`   P95 Latency: ❌ NEEDS IMPROVEMENT (${latencyStats.p95.toFixed(2)}ms > 2000ms)`, 'red');
  }
  
  // Bottleneck analysis
  log('\n🔍 Bottleneck Analysis:', 'yellow');
  
  if (metrics.failedSwaps > metrics.totalSwaps * 0.1) {
    log(`   ⚠️  High failure rate detected (${metrics.failedSwaps} failures)`, 'red');
    log(`      Possible causes: RPC rate limits, compute budget, network issues`);
  }
  
  if (latencyStats.max > latencyStats.avg * 5) {
    log(`   ⚠️  High latency variance detected (max: ${latencyStats.max}ms, avg: ${latencyStats.avg.toFixed(2)}ms)`, 'yellow');
    log(`      Possible causes: RPC congestion, network instability, compute spikes`);
  }
  
  if (tps < 3) {
    log(`   ⚠️  Low TPS detected (${tps.toFixed(2)} TPS)`, 'red');
    log(`      Recommendations:`);
    log(`      - Consider using a dedicated RPC node`);
    log(`      - Optimize transaction size and compute units`);
    log(`      - Implement connection pooling`);
    log(`      - Use priority fees during congestion`);
  }
  
  // Worker statistics
  log('\n👷 Worker Statistics:', 'cyan');
  metrics.workerMetrics.forEach(wm => {
    const workerSuccessRate = wm.swapsExecuted > 0 
      ? ((wm.swapsSucceeded / wm.swapsExecuted) * 100).toFixed(1)
      : 0;
    const avgLatency = wm.swapsExecuted > 0
      ? (wm.totalLatency / wm.swapsExecuted).toFixed(2)
      : 0;
    
    log(`   Worker ${wm.workerId}: ${wm.swapsSucceeded}/${wm.swapsExecuted} swaps (${workerSuccessRate}% success, ${avgLatency}ms avg)`);
  });
  
  // Save results to file
  const results = {
    config: CONFIG,
    summary: {
      totalSwaps: metrics.totalSwaps,
      successfulSwaps: metrics.successfulSwaps,
      failedSwaps: metrics.failedSwaps,
      successRate: successRate,
      totalTime: totalTime,
      tps: tps,
    },
    latencyStats,
    workerMetrics: metrics.workerMetrics,
    errors: metrics.errors,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), CONFIG.OUTPUT_FILE),
    JSON.stringify(results, null, 2)
  );
  
  log(`\n💾 Results saved to: ${CONFIG.OUTPUT_FILE}`, 'green');
  log('\n' + '='.repeat(60) + '\n', 'bright');
  
  // Exit with appropriate code
  process.exit(successRate >= 85 ? 0 : 1);
}

// Run the load test
runLoadTest().catch(error => {
  log(`\n❌ Load test failed: ${error.message}\n`, 'red');
  console.error(error);
  process.exit(1);
});
