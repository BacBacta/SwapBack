import { describe, expect, it, vi, beforeEach } from "vitest";
import { Connection } from "@solana/web3.js";
import { getAmountOut } from "@lifinity/sdk";
import { LifinityService } from "../LifinityService";
import { VenueName } from "../../types/smart-router";

vi.mock("@lifinity/sdk", () => {
  const pool = {
    amm: "GoafYfp3fxg5vtn6wSi8uDniJ6vAbX89vHksDHSTj841",
    poolCoinMint: "So11111111111111111111111111111111111111112",
    poolPcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    poolCoinTokenAccount: "wRPLCWzpJmiNpRxCuFNKw4rmHEJVZPu4PLRW7Leu65T",
    poolPcTokenAccount: "B3kkoxgcYgZCgKd3EaKdE6fFM6k6qZw7oYh2nK3VrVu",
    poolCoinDecimal: 9,
    poolPcDecimal: 6,
  };

  return {
    getPoolList: vi.fn(() => ({ LIF: pool })),
    getAmountOut: vi.fn(),
  };
});

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_POOL_ACCOUNT = "wRPLCWzpJmiNpRxCuFNKw4rmHEJVZPu4PLRW7Leu65T";
const USDC_POOL_ACCOUNT = "B3kkoxgcYgZCgKd3EaKdE6fFM6k6qZw7oYh2nK3VrVu";

describe("LifinityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns liquidity source from on-chain quote", async () => {
    const balanceByAccount: Record<string, { amount: number; decimals: number }> = {
      [SOL_POOL_ACCOUNT]: { amount: 10_000, decimals: 9 },
      [USDC_POOL_ACCOUNT]: { amount: 250_000, decimals: 6 },
    };

    const mockConnection = {
      getMultipleAccountsInfo: vi.fn(),
    } as unknown as Connection;

    vi.mocked(getAmountOut).mockResolvedValue({
      amountIn: 1,
      amountOut: 25,
      amountOutWithSlippage: 24.5,
      fee: 0.001,
      feePercent: 0.1,
      priceImpact: 0.5,
    });

    const service = new LifinityService(mockConnection, {
      slippagePercent: 0.5,
      balanceResolver: async (address) => {
        const entry = balanceByAccount[address];
        if (!entry) {
          throw new Error("missing balance");
        }
        return entry.amount;
      },
    });

    const source = await service.fetchLiquidity(SOL_MINT, USDC_MINT, 1);

    expect(getAmountOut).toHaveBeenCalled();
    expect(source?.reserves?.input).toBeCloseTo(10_000, 5);
    expect(source?.venue).toBe(VenueName.LIFINITY);
    expect(source?.effectivePrice).toBeCloseTo(0.04, 5);
    expect(source?.feeAmount).toBeCloseTo(0.001, 5);
    expect(source?.slippagePercent).toBeCloseTo(0.005, 5);
    expect(source?.reserves?.input).toBeCloseTo(10_000, 5);
  });
});
