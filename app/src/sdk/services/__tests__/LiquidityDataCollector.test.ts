import { describe, expect, it, vi, beforeEach } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import { LiquidityDataCollector } from "../LiquidityDataCollector";
import {
  VenueName,
  VenueType,
  LiquiditySource,
} from "../../types/smart-router";

const meteoraFetchMock = vi.fn();
const orcaFetchMock = vi.fn();
const raydiumFetchMock = vi.fn();

vi.mock("../MeteoraService", () => {
  return {
    MeteoraService: vi.fn().mockImplementation(() => ({
      fetchLiquidity: meteoraFetchMock,
    })),
  };
});

vi.mock("../OrcaService", () => {
  return {
    OrcaService: vi.fn().mockImplementation(() => ({
      fetchLiquidity: orcaFetchMock,
    })),
  };
});

vi.mock("../RaydiumService", () => {
  return {
    RaydiumService: vi.fn().mockImplementation(() => ({
      fetchLiquidity: raydiumFetchMock,
    })),
  };
});

const connection = new Connection("http://localhost:8899", "confirmed");

beforeEach(() => {
  meteoraFetchMock.mockReset();
  orcaFetchMock.mockReset();
  raydiumFetchMock.mockReset();
});

describe("LiquidityDataCollector", () => {
  it("delegates Meteora venue to service", async () => {
    const collector = new LiquidityDataCollector(connection, 0);
    const meteoraQuote: LiquiditySource = {
      venue: VenueName.METEORA,
      venueType: VenueType.AMM,
      tokenPair: ["SOL", "USDC"],
      depth: 1_000_000,
      effectivePrice: 0.04,
      feeAmount: 0.001,
      slippagePercent: 0.01,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };

    meteoraFetchMock.mockResolvedValueOnce(meteoraQuote);

    const source = await (collector as any).fetchAMMLiquidity(
      VenueName.METEORA,
      "SOL",
      "USDC",
      1
    );

    expect(meteoraFetchMock).toHaveBeenCalled();
    expect(source).toEqual(meteoraQuote);
  });

  it("delegates Orca venue to service", async () => {
    const collector = new LiquidityDataCollector(connection, 0);
    const orcaQuote: LiquiditySource = {
      venue: VenueName.ORCA,
      venueType: VenueType.AMM,
      tokenPair: ["SOL", "USDC"],
      depth: 500000,
      effectivePrice: 25,
      feeAmount: 0.01,
      slippagePercent: 0.0002,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };

    orcaFetchMock.mockResolvedValueOnce(orcaQuote);

    const source = await (collector as any).fetchAMMLiquidity(
      VenueName.ORCA,
      "SOL",
      "USDC",
      2
    );

    expect(orcaFetchMock).toHaveBeenCalledWith("SOL", "USDC", 2);
    expect(source).toEqual(orcaQuote);
  });

  it("delegates Raydium venue to service", async () => {
    const collector = new LiquidityDataCollector(connection, 0);
    const raydiumQuote: LiquiditySource = {
      venue: VenueName.RAYDIUM,
      venueType: VenueType.AMM,
      tokenPair: ["SOL", "USDT"],
      depth: 300000,
      effectivePrice: 24.9,
      feeAmount: 0.02,
      slippagePercent: 0.0003,
      route: ["SOL", "USDT"],
      timestamp: Date.now(),
    };

    raydiumFetchMock.mockResolvedValueOnce(raydiumQuote);

    const source = await (collector as any).fetchAMMLiquidity(
      VenueName.RAYDIUM,
      "SOL",
      "USDT",
      3
    );

    expect(raydiumFetchMock).toHaveBeenCalledWith("SOL", "USDT", 3);
    expect(source).toEqual(raydiumQuote);
  });

  it("sorts CLOB venues ahead of AMMs by effective price", async () => {
    const collector = new LiquidityDataCollector(connection, 0);
    const phoenixSource: LiquiditySource = {
      venue: VenueName.PHOENIX,
      venueType: VenueType.CLOB,
      tokenPair: ["SOL", "USDC"],
      depth: 100000,
      effectivePrice: 24.5,
      feeAmount: 0.01,
      slippagePercent: 0.0001,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };
    const orcaSource: LiquiditySource = {
      venue: VenueName.ORCA,
      venueType: VenueType.AMM,
      tokenPair: ["SOL", "USDC"],
      depth: 90000,
      effectivePrice: 25,
      feeAmount: 0.05,
      slippagePercent: 0.002,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };

    (collector as any).fetchVenueLiquidity = vi.fn(async (venue: VenueName) => {
      if (venue === VenueName.PHOENIX) return phoenixSource;
      if (venue === VenueName.ORCA) return orcaSource;
      return null;
    });

    const result = await collector.fetchAggregatedLiquidity(
      new PublicKey(0).toBase58(),
      new PublicKey(1).toBase58(),
      10,
      [VenueName.PHOENIX, VenueName.ORCA]
    );

    expect(result.sources[0].venue).toBe(VenueName.PHOENIX);
    expect(result.sources[1].venue).toBe(VenueName.ORCA);
  });

  it("marks CLOB venue unhealthy after repeated failures", () => {
    const collector = new LiquidityDataCollector(connection, 0);
    const markOutcome = (collector as any).markClobOutcome.bind(collector);
    const isHealthy = (collector as any).isClobHealthy.bind(collector);

    expect(isHealthy(VenueName.PHOENIX)).toBe(true);
    for (let i = 0; i < 3; i++) {
      markOutcome(VenueName.PHOENIX, false, new Error("rpc"));
    }
    expect(isHealthy(VenueName.PHOENIX)).toBe(false);
  });

  it("normalizes CLOB metadata and resets health state after success", async () => {
    const collector = new LiquidityDataCollector(connection, 0);
    const orderbook = {
      bids: [{ price: 25, size: 5 }],
      asks: [{ price: 26, size: 5 }],
      bestBid: 25,
      bestAsk: 26,
      spreadBps: 400,
      depthUsd: 1000,
      lastUpdated: Date.now(),
      latencyMs: 12,
    };

    const rawSource: LiquiditySource = {
      venue: VenueName.PHOENIX,
      venueType: VenueType.CLOB,
      tokenPair: ["SOL", "USDC"],
      depth: 100000,
      effectivePrice: 25,
      feeAmount: 0.01,
      slippagePercent: 0.0001,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
      orderbook,
      metadata: { inverted: true },
    };

    vi.spyOn(collector as any, "fetchVenueLiquidity").mockResolvedValueOnce(
      rawSource
    );

    const result = await collector.fetchAggregatedLiquidity(
      new PublicKey(0).toBase58(),
      new PublicKey(1).toBase58(),
      10,
      [VenueName.PHOENIX]
    );

    const metadata = result.sources[0].metadata as Record<string, unknown>;
    expect(metadata.direction).toBe("sellQuote");
    expect(metadata.takerFeeBps).toBeGreaterThan(0);
    expect(metadata.latencyMs).toBe(12);

    const markOutcome = (collector as any).markClobOutcome.bind(collector);
    const isHealthy = (collector as any).isClobHealthy.bind(collector);
    for (let i = 0; i < 3; i++) {
      markOutcome(VenueName.OPENBOOK, false, new Error("rpc"));
    }
    expect(isHealthy(VenueName.OPENBOOK)).toBe(false);
    markOutcome(VenueName.OPENBOOK, true);
    expect(isHealthy(VenueName.OPENBOOK)).toBe(true);
  });
});
