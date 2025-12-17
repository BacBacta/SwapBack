/**
 * 🧪 Native Router Tests
 * 
 * Tests unitaires et d'intégration pour le RouterSwap:
 * - Tests de slippage estimator
 * - Tests de cache
 * - Tests de simulation
 * - Tests de DEX account resolvers
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PublicKey, Connection } from '@solana/web3.js';

// Mocks
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js');
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getAccountInfo: vi.fn().mockResolvedValue(null),
      getBalance: vi.fn().mockResolvedValue(1_000_000_000),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'mock-blockhash',
        lastValidBlockHeight: 1000,
      }),
      simulateTransaction: vi.fn().mockResolvedValue({
        value: { err: null, logs: [], unitsConsumed: 100000 },
      }),
    })),
  };
});

// ============================================================================
// SLIPPAGE ESTIMATOR TESTS
// ============================================================================

describe('RealTimeSlippageEstimator', () => {
  let estimator: any;
  
  beforeEach(async () => {
    const { RealTimeSlippageEstimator } = await import('../slippage/RealTimeSlippageEstimator');
    estimator = new RealTimeSlippageEstimator();
  });
  
  afterEach(() => {
    estimator?.reset();
  });
  
  describe('recordObservation', () => {
    it('should store observations', () => {
      estimator.recordObservation({
        timestamp: Date.now(),
        expectedOutput: 1000,
        actualOutput: 990,
        slippageBps: 100,
        tradeSize: 100,
        poolTvl: 1000000,
        venue: 'RAYDIUM_AMM',
      });
      
      const ema = estimator.getEMA('RAYDIUM_AMM');
      expect(ema).toBeGreaterThan(0);
    });
    
    it('should calculate EMA correctly', () => {
      // Premier observation: 100 bps
      estimator.recordObservation({
        timestamp: Date.now(),
        expectedOutput: 1000,
        actualOutput: 990,
        slippageBps: 100,
        tradeSize: 100,
        poolTvl: 1000000,
        venue: 'ORCA_WHIRLPOOL',
      });
      
      const ema1 = estimator.getEMA('ORCA_WHIRLPOOL');
      
      // Deuxième observation: 200 bps
      estimator.recordObservation({
        timestamp: Date.now(),
        expectedOutput: 1000,
        actualOutput: 980,
        slippageBps: 200,
        tradeSize: 100,
        poolTvl: 1000000,
        venue: 'ORCA_WHIRLPOOL',
      });
      
      const ema2 = estimator.getEMA('ORCA_WHIRLPOOL');
      
      // EMA should have moved towards 200
      expect(ema2).toBeGreaterThan(ema1);
    });
  });
  
  describe('estimateSlippage', () => {
    it('should return reasonable slippage for small trades', async () => {
      // Mock fetch for volatility
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });
      
      const estimate = await estimator.estimateSlippage(
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        1_000_000_000, // 1 SOL
        'RAYDIUM_AMM'
      );
      
      expect(estimate.recommendedSlippageBps).toBeGreaterThanOrEqual(10);
      expect(estimate.recommendedSlippageBps).toBeLessThanOrEqual(500);
      expect(estimate.confidence).toBeGreaterThan(0);
    });
    
    it('should include warnings for large trades', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tvl: 10000, bidDepth: 5000, askDepth: 5000, utilization: 50 }),
      });
      
      const estimate = await estimator.estimateSlippage(
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        100_000_000_000, // 100 SOL - large trade
        'RAYDIUM_AMM'
      );
      
      // Should have higher slippage for large trades relative to pool
      expect(estimate.breakdown.tradeSize).toBeGreaterThan(0);
    });
  });
  
  describe('validateExecution', () => {
    it('should validate successful execution', () => {
      const result = estimator.validateExecution(1000, 995, 100);
      
      expect(result.success).toBe(true);
      expect(result.withinTolerance).toBe(true);
      expect(result.actualSlippageBps).toBe(50);
    });
    
    it('should detect slippage exceeded', () => {
      const result = estimator.validateExecution(1000, 900, 50);
      
      expect(result.withinTolerance).toBe(false);
      expect(result.actualSlippageBps).toBe(1000);
    });
    
    it('should detect positive slippage', () => {
      const result = estimator.validateExecution(1000, 1010, 50);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Positive slippage');
    });
  });
});

// ============================================================================
// HIERARCHICAL CACHE TESTS
// ============================================================================

describe('HierarchicalQuoteCache', () => {
  let cache: any;
  
  beforeEach(async () => {
    const { HierarchicalQuoteCache } = await import('../cache/HierarchicalQuoteCache');
    cache = new HierarchicalQuoteCache();
  });
  
  afterEach(() => {
    cache?.clear();
  });
  
  describe('set and get', () => {
    const mockQuotes = [
      {
        venue: 'RAYDIUM_AMM',
        venueProgramId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
        inputAmount: 1000000,
        outputAmount: 100000,
        priceImpactBps: 10,
        accounts: [],
        estimatedNpiBps: 10,
        latencyMs: 50,
      },
    ];
    
    it('should cache quotes', () => {
      cache.set('SOL', 'USDC', 1000000, mockQuotes);
      
      const result = cache.get('SOL', 'USDC', 1000000);
      
      expect(result).not.toBeNull();
      expect(result?.fromCache).toBe(true);
      expect(result?.quotes).toEqual(mockQuotes);
    });
    
    it('should return from L1 for repeated access', () => {
      cache.set('SOL', 'USDC', 1000000, mockQuotes);
      
      // First access
      cache.get('SOL', 'USDC', 1000000);
      
      // Second access should be L1
      const result = cache.get('SOL', 'USDC', 1000000);
      
      expect(result?.cacheLevel).toBe('L1');
    });
    
    it('should bucket amounts', () => {
      cache.set('SOL', 'USDC', 1000000, mockQuotes);
      
      // Slightly different amount should use same bucket
      const result = cache.get('SOL', 'USDC', 1000100);
      
      expect(result).not.toBeNull();
    });
  });
  
  describe('invalidate', () => {
    it('should invalidate specific entry', () => {
      const mockQuotes = [{ venue: 'RAYDIUM_AMM' }] as any[];
      
      cache.set('SOL', 'USDC', 1000000, mockQuotes);
      cache.invalidate('SOL', 'USDC', 1000000);
      
      const result = cache.get('SOL', 'USDC', 1000000);
      
      expect(result).toBeNull();
    });
  });
  
  describe('getStats', () => {
    it('should track hits and misses', () => {
      const mockQuotes = [{ venue: 'RAYDIUM_AMM' }] as any[];
      
      cache.get('SOL', 'USDC', 1000000); // Miss
      cache.set('SOL', 'USDC', 1000000, mockQuotes);
      cache.get('SOL', 'USDC', 1000000); // Hit
      
      const stats = cache.getStats();
      
      expect(stats.totalRequests).toBe(2);
      expect(stats.l1Misses).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// TRANSACTION SIMULATOR TESTS
// ============================================================================

describe('TransactionSimulator', () => {
  let simulator: any;
  let mockConnection: any;
  
  beforeEach(async () => {
    mockConnection = {
      getAccountInfo: vi.fn().mockResolvedValue(null),
      getBalance: vi.fn().mockResolvedValue(1_000_000_000),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'mock-blockhash',
        lastValidBlockHeight: 1000,
      }),
      simulateTransaction: vi.fn().mockResolvedValue({
        value: { err: null, logs: ['Program log: Success'], unitsConsumed: 100000 },
      }),
      getSlot: vi.fn().mockResolvedValue(12345),
    };
    
    const { TransactionSimulator } = await import('../simulation/TransactionSimulator');
    simulator = new TransactionSimulator(mockConnection);
  });
  
  describe('simulate', () => {
    it('should return success for valid transaction', async () => {
      const { VersionedTransaction, TransactionMessage, SystemProgram } = await import('@solana/web3.js');
      
      // Create minimal transaction
      const instructions = [
        SystemProgram.transfer({
          fromPubkey: new PublicKey('11111111111111111111111111111111'),
          toPubkey: new PublicKey('11111111111111111111111111111112'),
          lamports: 1000,
        }),
      ];
      
      const message = new TransactionMessage({
        payerKey: new PublicKey('11111111111111111111111111111111'),
        recentBlockhash: 'mock-blockhash',
        instructions,
      }).compileToV0Message();
      
      const tx = new VersionedTransaction(message);
      
      const result = await simulator.simulate(tx);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });
    
    it('should parse known error codes', async () => {
      mockConnection.simulateTransaction.mockResolvedValueOnce({
        value: {
          err: { InstructionError: [5, { Custom: 6002 }] },
          logs: ['Program log: Error: StaleOracleData'],
          unitsConsumed: 50000,
        },
      });
      
      const { VersionedTransaction, TransactionMessage, SystemProgram } = await import('@solana/web3.js');
      
      const message = new TransactionMessage({
        payerKey: new PublicKey('11111111111111111111111111111111'),
        recentBlockhash: 'mock-blockhash',
        instructions: [],
      }).compileToV0Message();
      
      const tx = new VersionedTransaction(message);
      const result = await simulator.simulate(tx);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('0x1772');
      expect(result.error?.knownError?.errorType).toBe('ORACLE');
    });
  });
  
  describe('checkSwapPrerequisites', () => {
    it('should detect insufficient SOL', async () => {
      mockConnection.getBalance.mockResolvedValueOnce(1000); // Very low SOL
      
      const result = await simulator.checkSwapPrerequisites(
        new PublicKey('11111111111111111111111111111111'),
        new PublicKey('So11111111111111111111111111111111111111112'),
        new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        1_000_000_000
      );
      
      expect(result.canSwap).toBe(false);
      expect(result.issues.join(' ')).toContain('Solde SOL insuffisant');
    });
  });
});

// ============================================================================
// DEX ACCOUNT RESOLVERS TESTS
// ============================================================================

describe('DEX Account Resolvers', () => {
  let mockConnection: any;
  
  beforeEach(() => {
    mockConnection = {
      getAccountInfo: vi.fn().mockResolvedValue(null),
      getMultipleAccountsInfo: vi.fn().mockResolvedValue([null, null]),
    };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    });
  });
  
  describe('getAllDEXAccounts', () => {
    it('should return empty map when no pools found', async () => {
      const { getAllDEXAccounts } = await import('../dex/DEXAccountResolvers');
      
      const result = await getAllDEXAccounts(
        mockConnection,
        new PublicKey('So11111111111111111111111111111111111111112'),
        new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        new PublicKey('11111111111111111111111111111111')
      );
      
      expect(result.size).toBe(0);
    });
  });
});

// ============================================================================
// STRUCTURED LOGGER TESTS
// ============================================================================

describe('StructuredLogger', () => {
  let logger: any;
  let consoleInfoSpy: any;
  
  beforeEach(async () => {
    const { createLogger, setLogLevel } = await import('../logging/StructuredLogger');
    setLogLevel('debug');
    logger = createLogger('TestComponent');
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleInfoSpy?.mockRestore();
  });
  
  describe('logging methods', () => {
    it('should log info messages', () => {
      logger.info('Test message', { key: 'value' });
      
      expect(consoleInfoSpy).toHaveBeenCalled();
    });
    
    it('should include context in logs', () => {
      logger.info('Test message', { key: 'value' }, { action: 'test_action' });
      
      expect(consoleInfoSpy).toHaveBeenCalled();
      const call = consoleInfoSpy.mock.calls[0];
      expect(call[0]).toContain('TestComponent');
    });
  });
  
  describe('measure', () => {
    it('should measure async operation duration', async () => {
      const result = await logger.measure('test_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      });
      
      expect(result).toBe('result');
    });
  });
});
