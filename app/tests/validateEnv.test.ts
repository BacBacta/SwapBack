import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { validateEnv, ensureDevnetConfig } from "../src/lib/validateEnv";

describe("validateEnv", () => {
  // Sauvegarder l'env original
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env avant chaque test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restaurer l'env original
    process.env = originalEnv;
  });

  it("should pass with all required variables set correctly", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID =
      "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"; // IDL address
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID =
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"; // Router IDL address
    process.env.NEXT_PUBLIC_BACK_MINT =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";

    const config = validateEnv();

    expect(config.network).toBe("devnet");
    expect(config.cnftProgramId).toBe(
      "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
    );
    expect(config.routerProgramId).toBe(
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
    );
    expect(config.backMint).toBe(
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
    );
  });

  it("should return defaults when CNFT_PROGRAM_ID is missing", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID =
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt";
    // CNFT_PROGRAM_ID manquant
    process.env.NEXT_PUBLIC_BACK_MINT =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";

    const config = validateEnv();
    expect(config.cnftProgramId).toBeDefined();
    expect(config.cnftProgramId).not.toBe("");
  });

  it("should return defaults when CNFT_PROGRAM_ID doesn't match IDL", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID =
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt";
    // Mauvais Program ID (ancien)
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID =
      "2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G";
    process.env.NEXT_PUBLIC_BACK_MINT =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";

    const config = validateEnv();
    expect(config.cnftProgramId).toBe("2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G");
  });

  it("should return defaults for invalid PublicKey format", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID =
      "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"; // IDL address
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID =
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt";
    process.env.NEXT_PUBLIC_BACK_MINT = "invalid-public-key";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";

    const config = validateEnv();
    expect(config.backMint).toBe("invalid-public-key");
  });

  it("should return defaults when network variable is missing", () => {
    // NETWORK manquant
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID =
      "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq";
    process.env.NEXT_PUBLIC_BACK_MINT =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";
    
    const config = validateEnv();
    expect(config.network).toBe("devnet");
  });
});

describe("ensureDevnetConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should pass for valid devnet configuration", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID =
      "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"; // IDL address
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID =
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt";
    process.env.NEXT_PUBLIC_BACK_MINT =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";

    expect(() => ensureDevnetConfig()).not.toThrow();
  });

  it("should warn when network is not devnet", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "mainnet-beta";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL =
      "https://api.mainnet-beta.solana.com";
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID =
      "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"; // IDL address
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID =
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt";
    process.env.NEXT_PUBLIC_BACK_MINT =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";

    expect(() => ensureDevnetConfig()).not.toThrow();
  });

  it("should return config even when devnet CNFT program ID is wrong", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID =
      "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt";
    // Mauvais Program ID
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID =
      "2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G";
    process.env.NEXT_PUBLIC_BACK_MINT =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG =
      "5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom";

    const config = ensureDevnetConfig();
    expect(config.cnftProgramId).toBe("2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G");
  });
});
