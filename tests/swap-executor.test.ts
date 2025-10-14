/**
 * SwapExecutor Integration Tests
 * 
 * Tests for the main swap orchestrator covering:
 * - Successful swap execution
 * - Oracle verification failure
 * - Circuit breaker behavior
 * - Insufficient liquidity
 * - Transaction timeout scenarios
 * 
 * @module swap-executor.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { SwapExecutor } from '../sdk/src/services/SwapExecutor';
import type { SwapParams } from '../sdk/src/services/SwapExecutor';
import type { AggregatedLiquidity, RouteCandidate, OraclePriceData, LiquiditySource } from '../sdk/src/types/smart-router';
import { VenueName, VenueType } from '../sdk/src/types/smart-router';

// Mock Solana Transaction to avoid real signing
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js');
  return {
    ...actual,
    Transaction: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockReturnThis(),
      sign: vi.fn(),
      serialize: vi.fn().mockReturnValue(Buffer.from('mock-serialized-tx')),
      recentBlockhash: '',
      feePayer: null,
    })),
  };
});

// ============================================================================
// MOCK SERVICES
// ============================================================================

// Mock LiquidityDataCollector
const mockLiquidityCollector = {
  fetchAggregatedLiquidity: vi.fn(),
};

// Mock RouteOptimizationEngine
const mockOptimizer = {
  findOptimalRoutes: vi.fn(),
};

// Mock OraclePriceService
const mockOracleService = {
  getTokenPrice: vi.fn(),
};

// Mock JitoBundleService
const mockJitoService = {
  submitBundle: vi.fn(),
};

// Mock CircuitBreaker
const mockCircuitBreaker = {
  isTripped: vi.fn().mockReturnValue(false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  getNextRetryTime: vi.fn().mockReturnValue(null),
  reset: vi.fn(),
  getState: vi.fn().mockReturnValue('CLOSED'),
};

// Mock Connection
const mockConnection = {
  getSignatureStatus: vi.fn(),
  getLatestBlockhash: vi.fn().mockResolvedValue({
    blockhash: 'test-blockhash',
    lastValidBlockHeight: 12345,
  }),
};

// ============================================================================
// TEST SETUP
// ============================================================================

describe('SwapExecutor', () => {
  let executor: SwapExecutor;
  let testKeypair: Keypair;

  // Valid Solana token addresses
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  // Helper: Create mock liquidity source
  const createMockLiquiditySource = (effectivePrice: number): LiquiditySource => ({
    venue: VenueName.ORCA,
    venueType: VenueType.AMM,
    tokenPair: [SOL_MINT, USDC_MINT],
    depth: 500000,
    reserves: { input: 1000000, output: effectivePrice * 1000000 },
    effectivePrice,
    feeAmount: 0.05,
    slippagePercent: 0.001,
    route: [SOL_MINT, USDC_MINT],
    timestamp: Date.now(),
  });

  // Helper: Create mock aggregated liquidity
  const createMockAggregatedLiquidity = (sources: LiquiditySource[]): AggregatedLiquidity => ({
    tokenPair: [SOL_MINT, USDC_MINT],
    totalDepth: sources.reduce((sum, s) => sum + s.depth, 0),
    sources,
    bestSingleVenue: sources[0]?.venue || VenueName.ORCA,
    bestCombinedRoute: {
      id: 'route-best',
      venues: sources.map(s => s.venue),
      path: [SOL_MINT, USDC_MINT],
      hops: 1,
      splits: [],
      expectedOutput: sources[0]?.effectivePrice * 1.5 || 0,
      totalCost: 0.05,
      effectiveRate: sources[0]?.effectivePrice || 0,
      riskScore: 10,
      mevRisk: 'low',
      instructions: [],
      estimatedComputeUnits: 200000,
    },
    fetchedAt: Date.now(),
    staleness: 0,
  });

  beforeEach(() => {
    // Clear all mocks and reset state
    vi.clearAllMocks();
    
    // Reset circuit breaker to CLOSED state
    mockCircuitBreaker.isTripped.mockReturnValue(false);
    mockCircuitBreaker.getState.mockReturnValue('CLOSED');
    mockCircuitBreaker.getNextRetryTime.mockReturnValue(null);

    // Create test keypair
    testKeypair = Keypair.generate();

    // Create executor with mocked dependencies
    executor = new SwapExecutor(
      mockConnection as any,
      mockLiquidityCollector as any,
      mockOptimizer as any,
      mockOracleService as any,
      mockJitoService as any,
      mockCircuitBreaker as any
    );
  });

  // ============================================================================
  // TEST 1: SUCCESSFUL SWAP EXECUTION
  // ============================================================================

  describe('Successful Swap Execution', () => {
    it('should execute swap successfully with valid parameters', async () => {
      // Setup mocks
      const mockSource = createMockLiquiditySource(100.5);
      const mockLiquidity = createMockAggregatedLiquidity([mockSource]);

      const mockRoutes: RouteCandidate[] = [
        {
          id: 'route-1',
          venues: [VenueName.ORCA],
          path: [SOL_MINT, USDC_MINT],
          hops: 1,
          splits: [
            {
              venue: VenueName.ORCA,
              percentage: 100,
              inputAmount: 1.5,
              expectedOutput: 150.75,
              liquiditySource: mockSource,
            },
          ],
          expectedOutput: 150.75,
          totalCost: 0.05,
          effectiveRate: 100.5,
          riskScore: 10,
          mevRisk: 'low',
          instructions: [],
          estimatedComputeUnits: 200000,
        },
      ];

      // Mock oracle price data
      const mockOraclePriceSOL: OraclePriceData = {
        provider: 'pyth',
        price: 100.0,
        confidence: 0.5,
        timestamp: Date.now(),
        exponent: -8,
      };

      const mockOraclePriceUSDC: OraclePriceData = {
        provider: 'pyth',
        price: 1.0,
        confidence: 0.001,
        timestamp: Date.now(),
        exponent: -8,
      };

      // Setup service mocks
      mockLiquidityCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);
      mockOptimizer.findOptimalRoutes.mockResolvedValue(mockRoutes);
      mockOracleService.getTokenPrice
        .mockResolvedValueOnce(mockOraclePriceSOL)
        .mockResolvedValueOnce(mockOraclePriceUSDC);
      
      mockJitoService.submitBundle.mockResolvedValue({
        bundleId: 'test-bundle-123',
        status: 'pending',
        transactions: [],
      });

      mockConnection.getSignatureStatus.mockResolvedValue({
        context: { slot: 12345 },
        value: {
          slot: 12345,
          confirmations: 10,
          err: null,
          confirmationStatus: 'confirmed',
        },
      });

      // Create swap params
      const params: SwapParams = {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1.5,
        maxSlippageBps: 50,
        userPublicKey: testKeypair.publicKey,
        signer: testKeypair,
      };

      // Execute swap
      const result = await executor.executeSwap(params);

      // Assertions
      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
      expect(result.signature).toBe('test-bundle-123');
      expect(result.routes).toHaveLength(1);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.executionTimeMs).toBeGreaterThan(0);
      expect(result.metrics.outputAmount).toBeCloseTo(150.75, 2);
      expect(result.metrics.oracleVerified).toBe(true);
      expect(result.metrics.venueBreakdown[VenueName.ORCA]).toBe(1.5);

      // Verify mocks called
      expect(mockCircuitBreaker.isTripped).toHaveBeenCalled();
      expect(mockOptimizer.findOptimalRoutes).toHaveBeenCalledWith(
        params.inputMint,
        params.outputMint,
        params.inputAmount,
        expect.objectContaining({
          slippageTolerance: expect.any(Number),
        })
      );
      expect(mockOracleService.getTokenPrice).toHaveBeenCalledTimes(2);
      expect(mockJitoService.submitBundle).toHaveBeenCalled();
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST 2: ORACLE VERIFICATION FAILURE
  // ============================================================================

  describe('Oracle Verification Failure', () => {
    it('should reject swap when route price deviates > 5% from oracle', async () => {
      // Mock liquidity with manipulated price
      const mockSource: LiquiditySource = {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: [
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ],
        depth: 500000,
        reserves: { input: 1000000, output: 110000000 },
        effectivePrice: 110.0,
        feeAmount: 0.05,
        slippagePercent: 0.001,
        route: [
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ],
        timestamp: Date.now(),
      };

      const mockLiquidity: AggregatedLiquidity = {
        tokenPair: [
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ],
        totalDepth: 500000,
        sources: [mockSource],
        bestSingleVenue: VenueName.ORCA,
        bestCombinedRoute: {
          id: 'route-best',
          venues: [VenueName.ORCA],
          path: [
            'So11111111111111111111111111111111111111112',
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          ],
          hops: 1,
          splits: [],
          expectedOutput: 165.0,
          totalCost: 0.05,
          effectiveRate: 110.0,
          riskScore: 50,
          mevRisk: 'medium',
          instructions: [],
          estimatedComputeUnits: 200000,
        },
        fetchedAt: Date.now(),
        staleness: 0,
      };

      const mockRoutes: RouteCandidate[] = [
        {
          id: 'route-1',
          venues: [VenueName.ORCA],
          path: [
            'So11111111111111111111111111111111111111112',
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          ],
          hops: 1,
          splits: [
            {
              venue: VenueName.ORCA,
              percentage: 100,
              inputAmount: 1.5,
              expectedOutput: 165.0, // 10% higher than oracle
              liquiditySource: mockSource,
            },
          ],
          expectedOutput: 165.0,
          totalCost: 0.05,
          effectiveRate: 110.0,
          riskScore: 50,
          mevRisk: 'medium',
          instructions: [],
          estimatedComputeUnits: 200000,
        },
      ];

      // Oracle shows normal price
      const mockOraclePriceSOL: OraclePriceData = {
        provider: 'pyth',
        price: 100.0, // Expected rate: 100
        confidence: 0.5,
        timestamp: Date.now(),
        exponent: -8,
      };

      const mockOraclePriceUSDC: OraclePriceData = {
        provider: 'pyth',
        price: 1.0,
        confidence: 0.001,
        timestamp: Date.now(),
        exponent: -8,
      };

      // Setup mocks
      mockLiquidityCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);
      mockOptimizer.findOptimalRoutes.mockResolvedValue(mockRoutes);
      mockOracleService.getTokenPrice
        .mockResolvedValueOnce(mockOraclePriceSOL)
        .mockResolvedValueOnce(mockOraclePriceUSDC);

      // Create swap params
      const params: SwapParams = {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1.5,
        maxSlippageBps: 50,
        userPublicKey: testKeypair.publicKey,
        signer: testKeypair,
      };

      // Execute swap - should return failure (not throw)
      const result = await executor.executeSwap(params);

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toContain('deviates');
      expect(result.error).toContain('oracle');
      
      // Verify circuit breaker recorded failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST 3: CIRCUIT BREAKER BEHAVIOR
  // ============================================================================

  describe('Circuit Breaker Behavior', () => {
    it('should block swap when circuit breaker is tripped', async () => {
      // Trip the circuit breaker
      mockCircuitBreaker.isTripped.mockReturnValue(true);

      const params: SwapParams = {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1.5,
        maxSlippageBps: 50,
        userPublicKey: testKeypair.publicKey,
        signer: testKeypair,
      };

      // Execute swap - should return failure (not throw)
      const result = await executor.executeSwap(params);

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/circuit breaker.*active/i);

      // Verify no other services were called
      expect(mockLiquidityCollector.fetchAggregatedLiquidity).not.toHaveBeenCalled();
      expect(mockOptimizer.findOptimalRoutes).not.toHaveBeenCalled();
    });

    it('should record consecutive failures and trip breaker', async () => {
      // Mock to simulate 3 failures in a row
      mockLiquidityCollector.fetchAggregatedLiquidity.mockRejectedValue(
        new Error('RPC timeout')
      );

      const params: SwapParams = {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1.5,
        maxSlippageBps: 50,
        userPublicKey: testKeypair.publicKey,
        signer: testKeypair,
      };

      // First failure
      const result1 = await executor.executeSwap(params);
      expect(result1.success).toBe(false);
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledTimes(1);

      // Second failure
      const result2 = await executor.executeSwap(params);
      expect(result2.success).toBe(false);
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledTimes(2);

      // Third failure
      const result3 = await executor.executeSwap(params);
      expect(result3.success).toBe(false);
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================================
  // TEST 4: INSUFFICIENT LIQUIDITY
  // ============================================================================

  describe('Insufficient Liquidity', () => {
    it('should fail when no liquidity sources are available', async () => {
      // Mock empty liquidity
      const mockLiquidity: AggregatedLiquidity = {
        tokenPair: [
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ],
        totalDepth: 0,
        sources: [],
        bestSingleVenue: VenueName.ORCA, // Will have no actual routes
        bestCombinedRoute: {
          id: 'route-empty',
          venues: [],
          path: [],
          hops: 0,
          splits: [],
          expectedOutput: 0,
          totalCost: 0,
          effectiveRate: 0,
          riskScore: 100,
          mevRisk: 'high',
          instructions: [],
          estimatedComputeUnits: 0,
        },
        fetchedAt: Date.now(),
        staleness: 0,
      };

      mockLiquidityCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);
      // Also need to mock optimizer to return empty routes
      mockOptimizer.findOptimalRoutes.mockResolvedValue([]);

      const params: SwapParams = {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1.5,
        maxSlippageBps: 50,
        userPublicKey: testKeypair.publicKey,
        signer: testKeypair,
      };

      // Execute swap - should return failure (not throw)
      const result = await executor.executeSwap(params);

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no.*route|liquidity/i);

      // Verify circuit breaker recorded failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST 5: TRANSACTION TIMEOUT
  // ============================================================================

  describe('Transaction Timeout', () => {
    it('should timeout when transaction confirmation exceeds 30s', async () => {
      // Mock services for successful route
      const mockSource: LiquiditySource = {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: [
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ],
        depth: 500000,
        reserves: { input: 1000000, output: 100500000 },
        effectivePrice: 100.5,
        feeAmount: 0.05,
        slippagePercent: 0.001,
        route: [
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ],
        timestamp: Date.now(),
      };

      const mockLiquidity: AggregatedLiquidity = {
        tokenPair: [
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ],
        totalDepth: 500000,
        sources: [mockSource],
        bestSingleVenue: VenueName.ORCA,
        bestCombinedRoute: {
          id: 'route-best',
          venues: [VenueName.ORCA],
          path: [
            'So11111111111111111111111111111111111111112',
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          ],
          hops: 1,
          splits: [],
          expectedOutput: 150.75,
          totalCost: 0.05,
          effectiveRate: 100.5,
          riskScore: 10,
          mevRisk: 'low',
          instructions: [],
          estimatedComputeUnits: 200000,
        },
        fetchedAt: Date.now(),
        staleness: 0,
      };

      const mockRoutes: RouteCandidate[] = [
        {
          id: 'route-1',
          venues: [VenueName.ORCA],
          path: [
            'So11111111111111111111111111111111111111112',
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          ],
          hops: 1,
          splits: [
            {
              venue: VenueName.ORCA,
              percentage: 100,
              inputAmount: 1.5,
              expectedOutput: 150.75,
              liquiditySource: mockSource,
            },
          ],
          expectedOutput: 150.75,
          totalCost: 0.05,
          effectiveRate: 100.5,
          riskScore: 10,
          mevRisk: 'low',
          instructions: [],
          estimatedComputeUnits: 200000,
        },
      ];

      const mockOraclePriceSOL: OraclePriceData = {
        provider: 'pyth',
        price: 100.0,
        confidence: 0.5,
        timestamp: Date.now(),
        exponent: -8,
      };

      const mockOraclePriceUSDC: OraclePriceData = {
        provider: 'pyth',
        price: 1.0,
        confidence: 0.001,
        timestamp: Date.now(),
        exponent: -8,
      };

      mockLiquidityCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);
      mockOptimizer.findOptimalRoutes.mockResolvedValue(mockRoutes);
      mockOracleService.getTokenPrice
        .mockResolvedValueOnce(mockOraclePriceSOL)
        .mockResolvedValueOnce(mockOraclePriceUSDC);
      
      mockJitoService.submitBundle.mockResolvedValue({
        bundleId: 'test-bundle-timeout',
        status: 'pending',
        transactions: [],
      });

      // Mock confirmation to always return null (never confirms)
      mockConnection.getSignatureStatus.mockResolvedValue({
        context: { slot: 12345 },
        value: null,
      });

      const params: SwapParams = {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1.5,
        maxSlippageBps: 50,
        userPublicKey: testKeypair.publicKey,
        signer: testKeypair,
      };

      // Execute swap - should timeout after 30s and return failure
      const result = await executor.executeSwap(params);

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout/i);

      // Verify circuit breaker recorded failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    }, 35000); // 35s timeout for this test
  });
});
