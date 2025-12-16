import { Connection } from "@solana/web3.js";
import { OraclePriceService } from "../src/services/OraclePriceService";

// Mock Solana connection
const mockGetAccountInfo = jest.fn();

jest.mock("@solana/web3.js", () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getAccountInfo: mockGetAccountInfo,
  })),
  clusterApiUrl: jest.fn(),
  PublicKey: jest.fn().mockImplementation((value) => ({
    toString: () => value,
    toBase58: () => value,
    toBytes: () => new Uint8Array(),
    toBuffer: () => Buffer.from([]),
  })),
}));

jest.mock("@pythnetwork/client", () => ({
  parsePriceData: jest.fn(),
}));

// Mock Hermes client
const mockGetLatestPriceUpdates = jest.fn();
jest.mock("@pythnetwork/hermes-client", () => ({
  HermesClient: jest.fn().mockImplementation(() => ({
    getLatestPriceUpdates: mockGetLatestPriceUpdates,
  })),
}));

describe("OraclePriceService Hermes Fallback", () => {
  let oracleService: OraclePriceService;
  let mockConnection: Connection;

  const SOL_MINT = "So11111111111111111111111111111111111111112";

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = new Connection("mock-url");
    oracleService = new OraclePriceService(mockConnection, 5000, {
      enableHermesFallback: true,
      hermesEndpoint: "https://hermes.pyth.network",
    });
  });

  it("should return pyth-hermes source when on-chain Pyth data is stale", async () => {
    // On-chain Pyth returns null (simulating stale)
    mockGetAccountInfo.mockResolvedValue(null);

    // Hermes returns fresh price
    mockGetLatestPriceUpdates.mockResolvedValue({
      parsed: [
        {
          price: {
            price: "22000000000", // $220 with -8 exponent
            expo: -8,
            conf: "50000000",
            publish_time: Math.floor(Date.now() / 1000),
          },
        },
      ],
    });

    const priceData = await oracleService.getTokenPrice(SOL_MINT);

    expect(priceData).toBeDefined();
    expect(priceData.provider).toBe("pyth");
    expect(priceData.source).toBe("pyth-hermes");
    expect(priceData.price).toBeCloseTo(220, 0);
  });

  it("should mark fallbackUsed when Hermes is used", async () => {
    mockGetAccountInfo.mockResolvedValue(null);
    mockGetLatestPriceUpdates.mockResolvedValue({
      parsed: [
        {
          price: {
            price: "22000000000",
            expo: -8,
            conf: "50000000",
            publish_time: Math.floor(Date.now() / 1000),
          },
        },
      ],
    });

    await oracleService.getTokenPrice(SOL_MINT);
    const detail = oracleService.getVerificationDetail(SOL_MINT);

    expect(detail).toBeDefined();
    expect(detail?.fallbackUsed).toBe(true);
    expect(detail?.providerUsed).toBe("pyth");
  });

  it("should reject stale Hermes data beyond MAX_PRICE_AGE_SECONDS", async () => {
    mockGetAccountInfo.mockResolvedValue(null);
    mockGetLatestPriceUpdates.mockResolvedValue({
      parsed: [
        {
          price: {
            price: "22000000000",
            expo: -8,
            conf: "50000000",
            publish_time: Math.floor(Date.now() / 1000) - 120, // 2 min old
          },
        },
      ],
    });

    await expect(oracleService.getTokenPrice(SOL_MINT)).rejects.toThrow();
  });
});
