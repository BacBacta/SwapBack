import { beforeEach, describe, expect, it, vi } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import { PhoenixService } from "../PhoenixService";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const mockClient = {
  addMarket: vi.fn(),
  refreshMarket: vi.fn(),
  getUiLadder: vi.fn(),
};

vi.mock("@ellipsis-labs/phoenix-sdk", () => ({
  Client: {
    create: vi.fn(async () => mockClient),
  },
}));

vi.mock("../config/phoenix-markets", () => ({
  getPhoenixMarketConfig: (inputMint: string, outputMint: string) => {
    if (inputMint === SOL_MINT && outputMint === USDC_MINT) {
      return {
        config: {
          symbol: "SOL/USDC",
          marketAddress: new PublicKey("4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg"),
          baseMint: new PublicKey(SOL_MINT),
          quoteMint: new PublicKey(USDC_MINT),
          baseDecimals: 9,
          quoteDecimals: 6,
          makerFeeBps: -1,
          takerFeeBps: 5,
          lotSize: 0.01,
          tickSize: 0.0001,
        },
        inverted: false,
      };
    }
    return null;
  },
  isPhoenixEnabled: () => true,
}));

const connection = new Connection("http://localhost:8899", "confirmed");

describe("PhoenixService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.getUiLadder.mockReturnValue({
      bids: [
        { price: 24.5, quantity: 10 },
        { price: 24.4, quantity: 12 },
      ],
      asks: [
        { price: 24.6, quantity: 8 },
        { price: 24.7, quantity: 6 },
      ],
    });
  });

  it("returns liquidity snapshot with fill metadata", async () => {
    const service = new PhoenixService(connection, { cacheTtlMs: 0 });

    const result = await service.fetchLiquidity(SOL_MINT, USDC_MINT, 5);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.venue).toBe("phoenix");
    expect(result.orderbook?.bestBid).toBeCloseTo(24.5, 5);
    expect(result.metadata?.inverted).toBe(false);
    expect(result.metadata?.fill).toBeDefined();
    expect(result.metadata?.fill?.outputAmount).toBeGreaterThan(0);
    expect(result.metadata?.direction).toBe("sellBase");
  });
});
