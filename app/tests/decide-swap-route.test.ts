/**
 * Tests pour decideSwapRoute
 * 
 * Valide la fonction de décision de routing swap.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  decideSwapRoute,
  isNativeSwapFeatureEnabled,
  getUIMessageForReason,
  type SwapRouteParams,
} from "../src/lib/swap-routing/decideSwapRoute";

// ============================================================================
// CONSTANTS
// ============================================================================

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const UNKNOWN_MINT = "unknownMint123456789012345678901234567890ab";

// ============================================================================
// TEST SUITE: isNativeSwapFeatureEnabled
// ============================================================================

describe("isNativeSwapFeatureEnabled", () => {
  it("should return true when override is true", () => {
    expect(isNativeSwapFeatureEnabled(true)).toBe(true);
  });

  it("should return false when override is false", () => {
    expect(isNativeSwapFeatureEnabled(false)).toBe(false);
  });

  it("should return true by default (no env var)", () => {
    // Sans override, la fonction retourne true par défaut
    expect(isNativeSwapFeatureEnabled()).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: decideSwapRoute - Flag Disabled
// ============================================================================

describe("decideSwapRoute - FLAG_DISABLED", () => {
  it("should return jupiter with FLAG_DISABLED when feature flag is off", () => {
    const params: SwapRouteParams = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      hasJupiterCpi: true,
      featureFlagOverride: false, // Explicitly disabled
    };

    const result = decideSwapRoute(params);

    expect(result.route).toBe("jupiter");
    expect(result.reason).toBe("FLAG_DISABLED");
    expect(result.message).toContain("désactivé");
  });
});

// ============================================================================
// TEST SUITE: decideSwapRoute - Pair Unsupported
// ============================================================================

describe("decideSwapRoute - PAIR_UNSUPPORTED", () => {
  it("should return jupiter with PAIR_UNSUPPORTED for unknown pair", () => {
    const params: SwapRouteParams = {
      inputMint: UNKNOWN_MINT,
      outputMint: USDC_MINT,
      hasJupiterCpi: true,
      featureFlagOverride: true,
    };

    const result = decideSwapRoute(params);

    expect(result.route).toBe("jupiter");
    expect(result.reason).toBe("PAIR_UNSUPPORTED");
    expect(result.message).toContain("non supportée");
  });

  it("should return jupiter for both mints unknown", () => {
    const params: SwapRouteParams = {
      inputMint: UNKNOWN_MINT,
      outputMint: "anotherUnknown12345678901234567890123456",
      hasJupiterCpi: true,
      featureFlagOverride: true,
    };

    const result = decideSwapRoute(params);

    expect(result.route).toBe("jupiter");
    expect(result.reason).toBe("PAIR_UNSUPPORTED");
  });
});

// ============================================================================
// TEST SUITE: decideSwapRoute - Jupiter CPI Unavailable
// ============================================================================

describe("decideSwapRoute - JUPITER_CPI_UNAVAILABLE", () => {
  it("should still return native even when hasJupiterCpi is false (legacy param)", () => {
    const params: SwapRouteParams = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      hasJupiterCpi: false, // Not available
      featureFlagOverride: true,
    };

    const result = decideSwapRoute(params);

    expect(result.route).toBe("native");
    expect(result.reason).toBe("NATIVE_ELIGIBLE");
    expect(result.message).toContain("Swap natif");
  });
});

// ============================================================================
// TEST SUITE: decideSwapRoute - Native Eligible
// ============================================================================

describe("decideSwapRoute - NATIVE_ELIGIBLE", () => {
  it("should return native for supported pair with all conditions met", () => {
    const params: SwapRouteParams = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      hasJupiterCpi: true,
      featureFlagOverride: true,
    };

    const result = decideSwapRoute(params);

    expect(result.route).toBe("native");
    expect(result.reason).toBe("NATIVE_ELIGIBLE");
    expect(result.message).toContain("disponible");
  });

  it("should return native for reverse pair (USDC/SOL)", () => {
    const params: SwapRouteParams = {
      inputMint: USDC_MINT,
      outputMint: SOL_MINT,
      hasJupiterCpi: true,
      featureFlagOverride: true,
    };

    const result = decideSwapRoute(params);

    expect(result.route).toBe("native");
    expect(result.reason).toBe("NATIVE_ELIGIBLE");
  });
});

// ============================================================================
// TEST SUITE: getUIMessageForReason
// ============================================================================

describe("getUIMessageForReason", () => {
  it("should return appropriate message for FLAG_DISABLED", () => {
    const message = getUIMessageForReason("FLAG_DISABLED");
    expect(message).toContain("désactivé");
  });

  it("should return appropriate message for PAIR_UNSUPPORTED", () => {
    const message = getUIMessageForReason("PAIR_UNSUPPORTED");
    expect(message).toContain("supportée");
  });

  it("should return appropriate message for NATIVE_ELIGIBLE", () => {
    const message = getUIMessageForReason("NATIVE_ELIGIBLE");
    expect(message).toContain("SwapBack");
    expect(message).toContain("rebates");
  });

  it("should return fallback message for unknown reason", () => {
    const message = getUIMessageForReason("FALLBACK_JUPITER");
    expect(message).toContain("Swap natif");
  });
});

// ============================================================================
// TEST SUITE: Decision Consistency
// ============================================================================

describe("decideSwapRoute - Decision Consistency", () => {
  it("should be deterministic (same input = same output)", () => {
    const params: SwapRouteParams = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      hasJupiterCpi: true,
      featureFlagOverride: true,
    };

    const result1 = decideSwapRoute(params);
    const result2 = decideSwapRoute(params);
    const result3 = decideSwapRoute(params);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  it("should prioritize FLAG_DISABLED over other checks", () => {
    const params: SwapRouteParams = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      hasJupiterCpi: true,
      featureFlagOverride: false, // Disabled
    };

    const result = decideSwapRoute(params);

    // Even though pair is supported and jupiterCpi is available,
    // FLAG_DISABLED should take precedence
    expect(result.reason).toBe("FLAG_DISABLED");
  });

  it("should prioritize PAIR_UNSUPPORTED over JUPITER_CPI_UNAVAILABLE", () => {
    const params: SwapRouteParams = {
      inputMint: UNKNOWN_MINT,
      outputMint: USDC_MINT,
      hasJupiterCpi: false,
      featureFlagOverride: true,
    };

    const result = decideSwapRoute(params);

    // PAIR_UNSUPPORTED should be checked before JUPITER_CPI_UNAVAILABLE
    expect(result.reason).toBe("PAIR_UNSUPPORTED");
  });
});
