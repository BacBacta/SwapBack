import { beforeEach, describe, expect, it, vi } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import { OpenBookService } from "../OpenBookService";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const mockMarket = {
  loadBids: vi.fn(),
  loadAsks: vi.fn(),
};

const createOrderbook = (levels: Array<[number, number]>) => ({
  getL2: () => levels,
});

vi.mock("@project-serum/serum", () => ({
  Market: {
    load: vi.fn(async () => mockMarket),
  },
  Orderbook: class {},
}));

vi.mock("../config/openbook-markets", () => ({
  getOpenBookMarketConfig: (inputMint: string, outputMint: string) => {
    if (inputMint === USDC_MINT && outputMint === SOL_MINT) {
      return {
        config: {
          symbol: "SOL/USDC",
          marketAddress: new PublicKey("9wFFBENy5n1z2WMSr8d4223WXGmywHLvyDMvDaTLwSqB"),
          baseMint: new PublicKey(SOL_MINT),
          quoteMint: new PublicKey(USDC_MINT),
          baseDecimals: 9,
          quoteDecimals: 6,
          makerFeeBps: -2,
          takerFeeBps: 5,
        },
        inverted: true,
      };
    }
    return null;
  },
  isOpenBookEnabled: () => true,
  getOpenBookProgramId: () => new PublicKey("9xQeWvG816bUx9EPfDdQzWo1UzVXwQ2Yq89c4iG1QLLf"),
}));

const connection = new Connection("http://localhost:8899", "confirmed");

describe("OpenBookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarket.loadBids.mockResolvedValue(createOrderbook([[24.3, 12]]));
    mockMarket.loadAsks.mockResolvedValue(createOrderbook([[24.5, 9]]));
  });

  it("handles inverted pairs and exposes fill metrics", async () => {
    const service = new OpenBookService(connection, { cacheTtlMs: 0 });

    const result = await service.fetchLiquidity(USDC_MINT, SOL_MINT, 100);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.metadata?.inverted).toBe(true);
    expect(result.metadata?.direction).toBe("sellQuote");
    expect(result.topOfBook?.askPrice).toBeCloseTo(24.5, 5);
    expect(result.metadata?.fill?.outputAmount).toBeGreaterThan(0);
  });
});
