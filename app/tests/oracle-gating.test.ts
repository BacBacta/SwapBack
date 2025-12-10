/**
 * Oracle Gating Tests
 * 
 * Tests de validation du gating des oracles pour RouterSwap.
 * Vérifie que les paires non supportées sont correctement bloquées.
 * 
 * Référence: docs/ai/solana-native-router-a2z.md
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  hasOracleForPair,
  getOracleFeedsForPair,
  isNativeSwapAvailable,
  listSupportedOraclePairs,
  PYTH_FEEDS,
  TOKEN_MINTS,
} from "../src/config/oracles";

// ============================================================================
// CONSTANTS
// ============================================================================

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const WIF_MINT = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";

// Tokens WITHOUT sponsored push feeds (should NOT be supported)
const RAY_MINT = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
const JTO_MINT = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL";
const UNKNOWN_MINT = "unknownMint123456789012345678901234567890";

// ============================================================================
// TEST SUITE: Native Swap Availability
// ============================================================================

describe("Native Swap Availability", () => {
  it("should return true when oracles are configured", () => {
    const isAvailable = isNativeSwapAvailable();
    expect(isAvailable).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Supported Pairs (should pass)
// ============================================================================

describe("Supported Pairs - hasOracleForPair", () => {
  it("should support SOL/USDC", () => {
    expect(hasOracleForPair(SOL_MINT, USDC_MINT)).toBe(true);
  });

  it("should support USDC/SOL (reverse)", () => {
    expect(hasOracleForPair(USDC_MINT, SOL_MINT)).toBe(true);
  });

  it("should support SOL/USDT", () => {
    expect(hasOracleForPair(SOL_MINT, USDT_MINT)).toBe(true);
  });

  it("should support SOL/JUP", () => {
    expect(hasOracleForPair(SOL_MINT, JUP_MINT)).toBe(true);
  });

  it("should support SOL/BONK", () => {
    expect(hasOracleForPair(SOL_MINT, BONK_MINT)).toBe(true);
  });

  it("should support SOL/WIF", () => {
    expect(hasOracleForPair(SOL_MINT, WIF_MINT)).toBe(true);
  });

  it("should support USDC/JUP", () => {
    expect(hasOracleForPair(USDC_MINT, JUP_MINT)).toBe(true);
  });

  it("should support USDC/BONK", () => {
    expect(hasOracleForPair(USDC_MINT, BONK_MINT)).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Unsupported Pairs (should be blocked)
// ============================================================================

describe("Unsupported Pairs - hasOracleForPair", () => {
  it("should NOT support SOL/RAY (no push feed)", () => {
    expect(hasOracleForPair(SOL_MINT, RAY_MINT)).toBe(false);
  });

  it("should NOT support SOL/JTO (no push feed)", () => {
    expect(hasOracleForPair(SOL_MINT, JTO_MINT)).toBe(false);
  });

  it("should NOT support unknown tokens", () => {
    expect(hasOracleForPair(SOL_MINT, UNKNOWN_MINT)).toBe(false);
  });

  it("should NOT support RAY/USDC", () => {
    expect(hasOracleForPair(RAY_MINT, USDC_MINT)).toBe(false);
  });
});

// ============================================================================
// TEST SUITE: getOracleFeedsForPair
// ============================================================================

describe("getOracleFeedsForPair", () => {
  it("should return oracle config for SOL/USDC", () => {
    const config = getOracleFeedsForPair(SOL_MINT, USDC_MINT);
    expect(config).toBeDefined();
    expect(config.primary).toBeDefined();
    expect(config.primary.toString()).toBe(PYTH_FEEDS.SOL_USD);
  });

  it("should throw for unsupported pair", () => {
    expect(() => getOracleFeedsForPair(SOL_MINT, RAY_MINT)).toThrow(
      /Aucun oracle configuré/
    );
  });

  it("should throw for unknown token", () => {
    expect(() => getOracleFeedsForPair(SOL_MINT, UNKNOWN_MINT)).toThrow(
      /Aucun oracle configuré/
    );
  });
});

// ============================================================================
// TEST SUITE: List Supported Pairs
// ============================================================================

describe("listSupportedOraclePairs", () => {
  it("should return an array of supported pairs", () => {
    const pairs = listSupportedOraclePairs();
    expect(Array.isArray(pairs)).toBe(true);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it("should include SOL/USDC pair", () => {
    const pairs = listSupportedOraclePairs();
    expect(pairs).toContain(`${SOL_MINT}/${USDC_MINT}`);
  });

  it("should include bidirectional pairs", () => {
    const pairs = listSupportedOraclePairs();
    // Both directions should be present
    expect(pairs).toContain(`${SOL_MINT}/${USDC_MINT}`);
    expect(pairs).toContain(`${USDC_MINT}/${SOL_MINT}`);
  });
});

// ============================================================================
// TEST SUITE: Pyth Feed Addresses
// ============================================================================

describe("Pyth Feed Addresses", () => {
  it("should have SOL_USD feed configured", () => {
    expect(PYTH_FEEDS.SOL_USD).toBeDefined();
    expect(PYTH_FEEDS.SOL_USD.length).toBeGreaterThan(30); // Valid base58 address
  });

  it("should have USDC_USD feed configured", () => {
    expect(PYTH_FEEDS.USDC_USD).toBeDefined();
  });

  it("should have JUP_USD feed configured", () => {
    expect(PYTH_FEEDS.JUP_USD).toBeDefined();
  });

  it("should have BONK_USD feed configured", () => {
    expect(PYTH_FEEDS.BONK_USD).toBeDefined();
  });

  it("should have WIF_USD feed configured", () => {
    expect(PYTH_FEEDS.WIF_USD).toBeDefined();
  });

  it("should have correct SOL_USD address from audit", () => {
    // Verified via oracle-audit.mainnet.ts on 2025-12-10
    expect(PYTH_FEEDS.SOL_USD).toBe("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
  });
});

// ============================================================================
// TEST SUITE: Token Mints
// ============================================================================

describe("Token Mints", () => {
  it("should have SOL mint configured", () => {
    expect(TOKEN_MINTS.SOL).toBe(SOL_MINT);
  });

  it("should have USDC mint configured", () => {
    expect(TOKEN_MINTS.USDC).toBe(USDC_MINT);
  });

  it("should NOT have RAY mint (no push feed)", () => {
    expect(TOKEN_MINTS.RAY).toBeUndefined();
  });

  it("should NOT have JTO mint (no push feed)", () => {
    expect(TOKEN_MINTS.JTO).toBeUndefined();
  });
});
