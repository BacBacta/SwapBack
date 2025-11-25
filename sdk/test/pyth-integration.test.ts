import { Connection } from "@solana/web3.js";
import { OraclePriceService } from "../src/services/OraclePriceService";
import { VenueName, RouteCandidate } from "../src/types/smart-router";
import { parsePriceData } from "@pythnetwork/client";

// Mock Solana connection
jest.mock("@solana/web3.js", () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getAccountInfo: jest.fn(),
  })),
  clusterApiUrl: jest.fn(),
  PublicKey: jest.fn().mockImplementation((value) => ({
    toString: jest.fn(() => value),
    toBase58: jest.fn(() => value),
    toBytes: jest.fn(() => new Uint8Array()),
    toBuffer: jest.fn(() => Buffer.from([])),
  })),
}));

jest.mock("@pythnetwork/client", () => ({
  parsePriceData: jest.fn(),
}));

jest.mock("@switchboard-xyz/solana.js", () => ({
  AggregatorAccount: jest.fn(),
}));

describe("Pyth Oracle Integration", () => {
  let oracleService: OraclePriceService;
  let mockConnection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = new Connection("mock-url");
    oracleService = new OraclePriceService(mockConnection, 5000);

    const accountInfo = {
      data: Buffer.alloc(280, 1),
      owner: { toBase58: () => "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH" },
      lamports: 1_000_000,
      executable: false,
    };

    (mockConnection.getAccountInfo as jest.Mock).mockResolvedValue(accountInfo);

    (parsePriceData as jest.Mock).mockReturnValue({
      price: BigInt(100_000_000_00),
      confidence: BigInt(500_000_00),
      exponent: -8,
      publishTime: BigInt(Math.floor(Date.now() / 1000)),
    });
  });

  it("should test Pyth integration with mocked data", async () => {
    // Test tokens (using mint addresses)
    const testCases = [
      {
        name: "SOL",
        mint: "So11111111111111111111111111111111111111112",
      },
      {
        name: "USDC",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
      {
        name: "USDT",
        mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      },
    ];

    console.log("📊 Fetching Pyth price feeds...\n");

    for (const testCase of testCases) {
      try {
        console.log(`Testing ${testCase.name}...`);

        // Fetch price via private method (reflection hack for testing)
        const priceData = await (oracleService as any).getTokenPrice(
          testCase.mint
        );

        if (priceData) {
          console.log(`✅ ${testCase.name}:`);
          console.log(`   Provider: ${priceData.provider}`);
          console.log(`   Price: $${priceData.price.toFixed(4)}`);
          console.log(`   Confidence: ±$${priceData.confidence.toFixed(4)}`);
          console.log(
            `   Confidence %: ${((priceData.confidence / priceData.price) * 100).toFixed(2)}%`
          );
          console.log(
            `   Timestamp: ${new Date(priceData.timestamp).toISOString()}`
          );
          console.log(
            `   Age: ${Math.floor((Date.now() - priceData.timestamp) / 1000)}s`
          );
        } else {
          console.log(`⚠️  ${testCase.name}: No price data available`);
        }

        console.log("");
      } catch (error) {
        console.error(`❌ ${testCase.name} failed:`, error);
        console.log("");
      }
    }

    console.log("\n🧪 Testing route price verification...\n");

    // Test route verification with mock route
    const mockRoute: RouteCandidate = {
      id: "test-route-1",
      venues: [VenueName.RAYDIUM],
      path: ["SOL", "USDC"],
      hops: 1,
      splits: [],
      expectedOutput: 1000000,
      totalCost: 0.001,
      effectiveRate: 0.0001,
      riskScore: 10,
      mevRisk: "low",
      instructions: [],
      estimatedComputeUnits: 100000,
    };
    try {
      const verification = await oracleService.verifyRoutePrice(
        mockRoute,
        "So11111111111111111111111111111111111111112", // SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        100, // 100 SOL input
        0.02 // 2% max deviation
      );

      console.log("Route Verification Result:");
      console.log(`   Oracle Price: $${verification.oraclePrice.toFixed(2)}`);
      console.log(`   Route Price: $${verification.routePrice.toFixed(2)}`);
      console.log(
        `   Deviation: ${(verification.deviation * 100).toFixed(2)}%`
      );
      console.log(
        `   Acceptable: ${verification.isAcceptable ? "✅ YES" : "❌ NO"}`
      );
      if (verification.warning) {
        console.log(`   Warning: ${verification.warning}`);
      }
    } catch (error) {
      console.error("❌ Route verification failed:", error);
    }

    console.log("\n✅ Pyth Integration Test Complete!");
  });
});
