import path from "path";
import fs from "fs";
import bs58 from "bs58";
import { vi } from "vitest";
import BN from "bn.js";

const walletCacheDir = path.resolve(__dirname, ".cache");
const walletPath = path.join(walletCacheDir, "devnet-wallet.json");

if (!fs.existsSync(walletCacheDir)) {
  fs.mkdirSync(walletCacheDir, { recursive: true });
}

if (!fs.existsSync(walletPath)) {
  const base58Secret = process.env.SWAPBACK_DEVNET_SECRET_BASE58;

  if (!base58Secret) {
    throw new Error(
      "Missing SWAPBACK_DEVNET_SECRET_BASE58. Provide the devnet wallet secret in base58 format."
    );
  }

  const secretBytes = bs58.decode(base58Secret);

  if (secretBytes.length !== 64) {
    throw new Error("Invalid devnet secret: expected 64-byte keypair.");
  }

  fs.writeFileSync(walletPath, JSON.stringify(Array.from(secretBytes)));
}

if (process.env.ANCHOR_WALLET === undefined) {
  process.env.ANCHOR_WALLET = walletPath;
}

if (process.env.ANCHOR_PROVIDER_URL === undefined) {
  process.env.ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com";
}

const homeDirectory = process.env.HOME ?? "";
if (homeDirectory) {
  const solanaConfigDir = path.join(homeDirectory, ".config", "solana");
  const solanaIdPath = path.join(solanaConfigDir, "id.json");

  if (!fs.existsSync(solanaConfigDir)) {
    fs.mkdirSync(solanaConfigDir, { recursive: true });
  }

  if (!fs.existsSync(solanaIdPath)) {
    const secret = fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8");
    fs.writeFileSync(solanaIdPath, secret);
  }
}

// ---------------------------------------------------------------------------
// Lightweight SDK mocks (avoid native deps and external RPC calls in tests)
// ---------------------------------------------------------------------------

class MockDlmm {
  static async create() {
    return new MockDlmm();
  }

  tokenX = {
    mint: { decimals: 6 },
    amount: BigInt(1_000_000_000),
  };

  tokenY = {
    mint: { decimals: 6 },
    amount: BigInt(900_000_000),
  };

  lbPair = {
    binStep: 10,
  };

  async getBinArrayForSwap() {
    return [];
  }

  async swapQuote(amount: BN) {
    return {
      consumedInAmount: amount,
      outAmount: amount,
      fee: new BN(0),
      priceImpact: { toNumber: () => 0 },
    };
  }
}

vi.mock("@meteora-ag/dlmm", () => ({
  default: MockDlmm,
}));

class MockWhirlpool {
  async refreshData() {
    return;
  }

  getTokenAInfo() {
    return {
      mint: { equals: () => true },
      decimals: 6,
    };
  }

  getTokenBInfo() {
    return {
      mint: { equals: () => false },
      decimals: 6,
    };
  }

  getData() {
    return {
      sqrtPrice: new BN(1_000_000_000),
      tickSpacing: 1,
    };
  }

  getTokenVaultAInfo() {
    return { amount: new BN(1_000_000_000) };
  }

  getTokenVaultBInfo() {
    return { amount: new BN(900_000_000) };
  }
}

const mockWhirlpool = new MockWhirlpool();

vi.mock("@orca-so/whirlpools-sdk", () => ({
  PriceMath: {
    sqrtPriceX64ToPrice: () => ({ toNumber: () => 1 }),
  },
  UseFallbackTickArray: {
    Situational: 0,
  },
  WhirlpoolContext: {
    withProvider: () => ({
      fetcher: {},
      programId: {},
    }),
  },
  buildWhirlpoolClient: () => ({
    getPool: () => mockWhirlpool,
  }),
  swapQuoteByInputToken: vi.fn(async () => ({
    estimatedAmountIn: new BN(1_000_000),
    estimatedAmountOut: new BN(900_000),
    estimatedFeeAmount: new BN(1_000),
  })),
}));
