/**
 * Configuration des tokens pour Testnet
 * Déploiement du 28 octobre 2025
 * 
 * IMPORTANT: All PublicKey creations use lazy-loading to avoid SSR/build errors
 */

import { PublicKey } from "@solana/web3.js";

// Default values (valid base58 strings)
const DEFAULT_BACK_MINT = "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
const DEFAULT_USDC_MINT = "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR";
const DEFAULT_CNFT_PROGRAM = "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP";
const DEFAULT_ROUTER_PROGRAM = "9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh";
const DEFAULT_BUYBACK_PROGRAM = "746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6";
const DEFAULT_MERKLE_TREE = "93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT";
const DEFAULT_COLLECTION_CONFIG = "5Lz4eHdqAgVsXu3Antp3TVqncuoCdUj2WEnc6PQuVzMT";

// Helper to safely create PublicKey (returns null on invalid input)
function safePublicKey(value: string | undefined, fallback: string): PublicKey {
  try {
    const keyString = value && value.trim() !== '' ? value : fallback;
    return new PublicKey(keyString);
  } catch {
    return new PublicKey(fallback);
  }
}

// Lazy-loaded tokens
let _testnetTokens: typeof TESTNET_TOKENS_SHAPE | null = null;

const TESTNET_TOKENS_SHAPE = {
  BACK: {
    mint: null as unknown as PublicKey,
    symbol: "BACK",
    name: "SwapBack Token",
    decimals: 9,
    logoURI: "/tokens/back.png",
  },
  USDC: {
    mint: null as unknown as PublicKey,
    symbol: "USDC",
    name: "USD Coin (Testnet)",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  SOL: {
    mint: new PublicKey("So11111111111111111111111111111111111111112"),
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
};

export function getTestnetTokens() {
  if (!_testnetTokens) {
    _testnetTokens = {
      BACK: {
        ...TESTNET_TOKENS_SHAPE.BACK,
        mint: safePublicKey(process.env.NEXT_PUBLIC_BACK_MINT, DEFAULT_BACK_MINT),
      },
      USDC: {
        ...TESTNET_TOKENS_SHAPE.USDC,
        mint: safePublicKey(process.env.NEXT_PUBLIC_USDC_MINT, DEFAULT_USDC_MINT),
      },
      SOL: TESTNET_TOKENS_SHAPE.SOL,
    };
  }
  return _testnetTokens;
}

// For backwards compatibility (lazy evaluation)
export const TESTNET_TOKENS = new Proxy({} as typeof TESTNET_TOKENS_SHAPE, {
  get(_, prop) {
    return getTestnetTokens()[prop as keyof typeof TESTNET_TOKENS_SHAPE];
  },
});

// Lazy-loaded program IDs
let _testnetProgramIds: { CNFT: PublicKey; ROUTER: PublicKey; BUYBACK: PublicKey } | null = null;

export function getTestnetProgramIds() {
  if (!_testnetProgramIds) {
    _testnetProgramIds = {
      CNFT: safePublicKey(process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID, DEFAULT_CNFT_PROGRAM),
      ROUTER: safePublicKey(process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID, DEFAULT_ROUTER_PROGRAM),
      BUYBACK: safePublicKey(process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID, DEFAULT_BUYBACK_PROGRAM),
    };
  }
  return _testnetProgramIds;
}

// For backwards compatibility (lazy evaluation)
export const TESTNET_PROGRAM_IDS = new Proxy({} as { CNFT: PublicKey; ROUTER: PublicKey; BUYBACK: PublicKey }, {
  get(_, prop) {
    return getTestnetProgramIds()[prop as keyof ReturnType<typeof getTestnetProgramIds>];
  },
});

// Lazy-loaded infrastructure
let _testnetInfrastructure: { MERKLE_TREE: PublicKey; COLLECTION_CONFIG: PublicKey } | null = null;

export function getTestnetInfrastructure() {
  if (!_testnetInfrastructure) {
    _testnetInfrastructure = {
      MERKLE_TREE: safePublicKey(process.env.NEXT_PUBLIC_MERKLE_TREE, DEFAULT_MERKLE_TREE),
      COLLECTION_CONFIG: safePublicKey(process.env.NEXT_PUBLIC_COLLECTION_CONFIG, DEFAULT_COLLECTION_CONFIG),
    };
  }
  return _testnetInfrastructure;
}

// For backwards compatibility (lazy evaluation)
export const TESTNET_INFRASTRUCTURE = new Proxy({} as { MERKLE_TREE: PublicKey; COLLECTION_CONFIG: PublicKey }, {
  get(_, prop) {
    return getTestnetInfrastructure()[prop as keyof ReturnType<typeof getTestnetInfrastructure>];
  },
});

/**
 * Récupère la configuration selon l'environnement
 */
export function getNetworkConfig() {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "testnet";
  
  if (network === "testnet") {
    return {
      tokens: getTestnetTokens(),
      programIds: getTestnetProgramIds(),
      infrastructure: getTestnetInfrastructure(),
    };
  }
  
  // Fallback vers devnet si autre réseau
  return null;
}
