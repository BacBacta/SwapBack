import BN from "bn.js";
import { describe, expect, it, vi } from "vitest";
import { Connection } from "@solana/web3.js";
import { MeteoraService } from "../MeteoraService";
import { VenueName } from "../../types/smart-router";

vi.mock("@meteora-ag/dlmm", () => ({
  default: class MockDlmm {
    static async create() {
      throw new Error("not implemented for tests");
    }
  },
}));

describe("MeteoraService", () => {
  it("converts DLMM quote into liquidity source", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          address: "pool",
          mint_x: "SOL",
          mint_y: "USDC",
          liquidity: "12345",
          reserve_x_amount: 5000,
          reserve_y_amount: 100000,
        },
      ],
    });

    const swapQuoteMock = vi.fn().mockResolvedValue({
      consumedInAmount: new BN("1000000000"), // 1 SOL
      outAmount: new BN("25000000"), // 25 USDC
      fee: new BN("1000000"), // 0.001 SOL
      priceImpact: 0.5, // 0.5%
    });

    const dlmmMock = {
      tokenX: {
        mint: { decimals: 9 },
        amount: 10_000n * 10n ** 9n,
      },
      tokenY: {
        mint: { decimals: 6 },
        amount: 250_000n * 10n ** 6n,
      },
      lbPair: { binStep: 50 },
      getBinArrayForSwap: vi.fn().mockResolvedValue([]),
      swapQuote: swapQuoteMock,
    };

    const service = new MeteoraService({} as Connection, {
      fetcher: fetchMock as unknown as typeof fetch,
      dlmmFactory: vi.fn().mockResolvedValue(dlmmMock),
    });

    const source = await service.fetchLiquidity("SOL", "USDC", 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(swapQuoteMock).toHaveBeenCalled();
    expect(source?.venue).toBe(VenueName.METEORA);
    expect(source?.effectivePrice).toBeCloseTo(0.04, 5);
    expect(source?.feeAmount).toBeCloseTo(0.001, 5);
    expect(source?.slippagePercent).toBeCloseTo(0.5 / 100, 5);
    expect(source?.reserves?.input).toBeCloseTo(10_000, 5);
  });
});
