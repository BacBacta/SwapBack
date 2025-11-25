/**
 * Integration tests for RouteOptimizationEngine
 * Tests the real API with mocked dependencies
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { RouteOptimizationEngine } from '../src/services/RouteOptimizationEngine';
import { LiquidityDataCollector } from '../src/services/LiquidityDataCollector';
import { OraclePriceService } from '../src/services/OraclePriceService';
import { VenueName, VenueType, LiquiditySource } from '../src/types/smart-router';

describe('RouteOptimizationEngine Integration', () => {
  let engine: RouteOptimizationEngine;
  let liquidityCollector: LiquidityDataCollector;
  let oracleService: OraclePriceService;
  let connection: Connection;

  const MOCK_SOL_MINT = 'So11111111111111111111111111111111111111112';
  const MOCK_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  beforeEach(() => {
    connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    liquidityCollector = new LiquidityDataCollector(connection, 60000);
    oracleService = new OraclePriceService(connection, 5000);
    engine = new RouteOptimizationEngine(liquidityCollector, oracleService);
  });

  describe('findOptimalRoutes()', () => {
    it('should initialize with correct dependencies', () => {
      expect(engine).toBeDefined();
      // Note: private properties not directly testable, verified via behavior
    });

    it('should accept valid input parameters', async () => {
      // Mock liquidity data
      const mockLiquidity = {
        tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
        totalDepth: 100000,
        sources: [
          {
            venue: VenueName.JUPITER,
            venueType: VenueType.RFQ,
            tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
            depth: 100000,
            effectivePrice: 100,
            feeAmount: 0.003,
            slippagePercent: 0.001,
            route: [MOCK_SOL_MINT, MOCK_USDC_MINT],
            timestamp: Date.now(),
          } as LiquiditySource,
        ],
        bestSingleVenue: VenueName.JUPITER,
        bestCombinedRoute: null,
        fetchedAt: Date.now(),
        staleness: 0,
      };

      jest.spyOn(liquidityCollector, 'fetchAggregatedLiquidity').mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        MOCK_SOL_MINT,
        MOCK_USDC_MINT,
        1_000_000_000, // 1 SOL
        { maxRoutes: 3 }
      );

      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
    });

    it('should handle empty liquidity sources', async () => {
      const emptyLiquidity = {
        tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
        totalDepth: 0,
        sources: [],
        bestSingleVenue: VenueName.JUPITER,
        bestCombinedRoute: null,
        fetchedAt: Date.now(),
        staleness: 0,
      };

      jest.spyOn(liquidityCollector, 'fetchAggregatedLiquidity').mockResolvedValue(emptyLiquidity);

      const routes = await engine.findOptimalRoutes(
        MOCK_SOL_MINT,
        MOCK_USDC_MINT,
        1_000_000_000
      );

      expect(routes).toBeDefined();
      expect(routes.length).toBe(0);
    });

    it('should respect maxRoutes configuration', async () => {
      const mockLiquidity = {
        tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
        totalDepth: 300000,
        sources: [
          {
            venue: VenueName.JUPITER,
            venueType: VenueType.RFQ,
            tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
            depth: 100000,
            effectivePrice: 100,
            feeAmount: 0.003,
            slippagePercent: 0.001,
            route: [MOCK_SOL_MINT, MOCK_USDC_MINT],
            timestamp: Date.now(),
          } as LiquiditySource,
          {
            venue: VenueName.ORCA,
            venueType: VenueType.AMM,
            tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
            depth: 100000,
            effectivePrice: 100.1,
            feeAmount: 0.002,
            slippagePercent: 0.002,
            route: [MOCK_SOL_MINT, MOCK_USDC_MINT],
            timestamp: Date.now(),
          } as LiquiditySource,
          {
            venue: VenueName.RAYDIUM,
            venueType: VenueType.AMM,
            tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
            depth: 100000,
            effectivePrice: 100.2,
            feeAmount: 0.0025,
            slippagePercent: 0.003,
            route: [MOCK_SOL_MINT, MOCK_USDC_MINT],
            timestamp: Date.now(),
          } as LiquiditySource,
        ],
        bestSingleVenue: VenueName.JUPITER,
        bestCombinedRoute: null,
        fetchedAt: Date.now(),
        staleness: 0,
      };

      jest.spyOn(liquidityCollector, 'fetchAggregatedLiquidity').mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        MOCK_SOL_MINT,
        MOCK_USDC_MINT,
        1_000_000_000,
        { maxRoutes: 2 }
      );

      expect(routes.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when not provided', async () => {
      const mockLiquidity = {
        tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
        totalDepth: 100000,
        sources: [
          {
            venue: VenueName.JUPITER,
            venueType: VenueType.RFQ,
            tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
            depth: 100000,
            effectivePrice: 100,
            feeAmount: 0.003,
            slippagePercent: 0.001,
            route: [MOCK_SOL_MINT, MOCK_USDC_MINT],
            timestamp: Date.now(),
          } as LiquiditySource,
        ],
        bestSingleVenue: VenueName.JUPITER,
        bestCombinedRoute: null,
        fetchedAt: Date.now(),
        staleness: 0,
      };

      jest.spyOn(liquidityCollector, 'fetchAggregatedLiquidity').mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        MOCK_SOL_MINT,
        MOCK_USDC_MINT,
        1_000_000_000
      );

      expect(routes).toBeDefined();
      // Default config: maxRoutes = 3
      expect(routes.length).toBeLessThanOrEqual(3);
    });

    it('should merge user config with defaults', async () => {
      const mockLiquidity = {
        tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
        totalDepth: 100000,
        sources: [
          {
            venue: VenueName.JUPITER,
            venueType: VenueType.RFQ,
            tokenPair: [MOCK_SOL_MINT, MOCK_USDC_MINT] as [string, string],
            depth: 100000,
            effectivePrice: 100,
            feeAmount: 0.003,
            slippagePercent: 0.001,
            route: [MOCK_SOL_MINT, MOCK_USDC_MINT],
            timestamp: Date.now(),
          } as LiquiditySource,
        ],
        bestSingleVenue: VenueName.JUPITER,
        bestCombinedRoute: null,
        fetchedAt: Date.now(),
        staleness: 0,
      };

      jest.spyOn(liquidityCollector, 'fetchAggregatedLiquidity').mockResolvedValue(mockLiquidity);

      const customConfig = {
        maxRoutes: 5,
        slippageTolerance: 0.02,
      };

      const routes = await engine.findOptimalRoutes(
        MOCK_SOL_MINT,
        MOCK_USDC_MINT,
        1_000_000_000,
        customConfig
      );

      expect(routes).toBeDefined();
      expect(routes.length).toBeLessThanOrEqual(5);
    });
  });
});
