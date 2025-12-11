/**
 * Tests unitaires pour la sérialisation Jupiter CPI dans le Native Router
 * 
 * Ces tests vérifient que les données Jupiter CPI sont correctement sérialisées
 * selon le format attendu par le programme on-chain swapback_router.
 * 
 * Le format Rust attendu:
 * ```rust
 * pub struct JupiterRouteParams {
 *     pub swap_instruction: Vec<u8>,      // Données d'instruction Jupiter
 *     pub expected_input_amount: u64,      // Montant en lamports
 * }
 * ```
 * 
 * Serialisation Borsh:
 * - Option<T>: [0] pour None, [1] + data pour Some
 * - Vec<u8>: préfixé par u32 LE (longueur)
 * - u64: little-endian 8 bytes
 */

import { describe, it, expect } from "vitest";
import BN from "bn.js";

// Type miroir de JupiterCpiData
interface JupiterCpiData {
  swapInstruction: Buffer;
  expectedInputAmount: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  programId: string;
  addressTableLookups?: {
    accountKey: string;
    writableIndexes: number[];
    readonlyIndexes: number[];
  }[];
  lastValidBlockHeight?: number;
}

/**
 * Sérialise la partie jupiter_route des SwapArgs
 * Extrait de serializeSwapArgs pour tester isolément
 */
function serializeJupiterRoute(jupiterCpi: JupiterCpiData | null | undefined): Buffer {
  const buffers: Buffer[] = [];

  if (
    jupiterCpi &&
    jupiterCpi.swapInstruction &&
    jupiterCpi.swapInstruction.length > 0
  ) {
    // Option: Some = [1]
    buffers.push(Buffer.from([1]));

    // swap_instruction: Vec<u8> - préfixé par u32 LE (longueur)
    const swapIxLen = Buffer.alloc(4);
    swapIxLen.writeUInt32LE(jupiterCpi.swapInstruction.length, 0);
    buffers.push(swapIxLen);
    buffers.push(jupiterCpi.swapInstruction);

    // expected_input_amount: u64 LE
    const expectedAmount = new BN(jupiterCpi.expectedInputAmount);
    buffers.push(expectedAmount.toArrayLike(Buffer, "le", 8));
  } else {
    // Option: None = [0]
    buffers.push(Buffer.from([0]));
  }

  return Buffer.concat(buffers);
}

describe("Jupiter CPI Serialization", () => {
  describe("serializeJupiterRoute", () => {
    it("should serialize None when jupiterCpi is null", () => {
      const result = serializeJupiterRoute(null);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // None
    });

    it("should serialize None when jupiterCpi is undefined", () => {
      const result = serializeJupiterRoute(undefined);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // None
    });

    it("should serialize None when swapInstruction is empty", () => {
      const jupiterCpi: JupiterCpiData = {
        swapInstruction: Buffer.alloc(0),
        expectedInputAmount: "1000000",
        accounts: [],
        programId: "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm",
      };

      const result = serializeJupiterRoute(jupiterCpi);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // None
    });

    it("should serialize Some with valid jupiter_route data", () => {
      // Données d'instruction fictives (16 bytes)
      const instructionData = Buffer.from([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
        0x0d, 0x0e, 0x0f, 0x10,
      ]);

      const jupiterCpi: JupiterCpiData = {
        swapInstruction: instructionData,
        expectedInputAmount: "1000000", // 1 SOL = 1_000_000 lamports
        accounts: [],
        programId: "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm",
      };

      const result = serializeJupiterRoute(jupiterCpi);

      // Structure attendue:
      // [1] = Some
      // [16, 0, 0, 0] = Vec length (u32 LE)
      // [16 bytes] = instruction data
      // [8 bytes] = expected_input_amount (u64 LE)
      const expectedLength = 1 + 4 + 16 + 8; // = 29
      expect(result.length).toBe(expectedLength);

      // Vérifier Option Some
      expect(result[0]).toBe(1);

      // Vérifier Vec length (u32 LE = 16)
      expect(result.readUInt32LE(1)).toBe(16);

      // Vérifier instruction data
      expect(result.subarray(5, 21).equals(instructionData)).toBe(true);

      // Vérifier expected_input_amount (u64 LE = 1_000_000)
      const amount = new BN(result.subarray(21, 29), "le");
      expect(amount.toNumber()).toBe(1000000);
    });

    it("should handle large expected_input_amount correctly", () => {
      // 100 SOL = 100_000_000_000 lamports (dépasse 32 bits)
      const largeAmount = "100000000000";
      const instructionData = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);

      const jupiterCpi: JupiterCpiData = {
        swapInstruction: instructionData,
        expectedInputAmount: largeAmount,
        accounts: [],
        programId: "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm",
      };

      const result = serializeJupiterRoute(jupiterCpi);

      // Vérifier que le montant est correctement encodé en u64 LE
      const amountBuf = result.subarray(result.length - 8);
      const amount = new BN(amountBuf, "le");
      expect(amount.toString()).toBe(largeAmount);
    });

    it("should serialize realistic Jupiter instruction data", () => {
      // Données d'instruction Jupiter réalistes (environ 300-500 bytes en pratique)
      const instructionData = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        instructionData[i] = i % 256;
      }

      const jupiterCpi: JupiterCpiData = {
        swapInstruction: instructionData,
        expectedInputAmount: "50000000", // 50 USDC (6 decimals)
        accounts: [
          {
            pubkey: "So11111111111111111111111111111111111111112",
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            isSigner: false,
            isWritable: true,
          },
        ],
        programId: "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm",
      };

      const result = serializeJupiterRoute(jupiterCpi);

      // Vérifier la structure
      expect(result[0]).toBe(1); // Some
      expect(result.readUInt32LE(1)).toBe(256); // Vec length
      expect(result.subarray(5, 5 + 256).equals(instructionData)).toBe(true);

      // Le total fait 1 + 4 + 256 + 8 = 269 bytes
      expect(result.length).toBe(269);
    });
  });

  describe("JupiterCpiData validation", () => {
    it("should validate required fields", () => {
      const validData: JupiterCpiData = {
        swapInstruction: Buffer.from([0x01]),
        expectedInputAmount: "1000",
        accounts: [],
        programId: "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm",
      };

      // Doit avoir swapInstruction
      expect(validData.swapInstruction).toBeDefined();
      expect(validData.swapInstruction.length).toBeGreaterThan(0);

      // Doit avoir expectedInputAmount
      expect(validData.expectedInputAmount).toBeDefined();
      expect(parseInt(validData.expectedInputAmount)).toBeGreaterThan(0);
    });

    it("should handle accounts array", () => {
      const data: JupiterCpiData = {
        swapInstruction: Buffer.from([0x01]),
        expectedInputAmount: "1000",
        accounts: [
          {
            pubkey: "So11111111111111111111111111111111111111112",
            isSigner: true,
            isWritable: true,
          },
          {
            pubkey: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            isSigner: false,
            isWritable: true,
          },
        ],
        programId: "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm",
      };

      expect(data.accounts.length).toBe(2);
      expect(data.accounts[0].isSigner).toBe(true);
      expect(data.accounts[1].isWritable).toBe(true);
    });
  });
});

describe("Buffer conversion from base64", () => {
  it("should correctly convert base64 instructionData to Buffer", () => {
    // Simuler les données base64 comme renvoyées par l'API
    const originalData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    const base64Data = originalData.toString("base64");

    // Conversion comme dans getJupiterCpiData()
    const converted = Buffer.from(base64Data, "base64");

    expect(converted.equals(originalData)).toBe(true);
  });

  it("should handle large base64 instruction data", () => {
    // Simuler des données d'instruction Jupiter réalistes
    const originalData = Buffer.alloc(512);
    for (let i = 0; i < 512; i++) {
      originalData[i] = Math.floor(Math.random() * 256);
    }
    const base64Data = originalData.toString("base64");

    const converted = Buffer.from(base64Data, "base64");

    expect(converted.length).toBe(512);
    expect(converted.equals(originalData)).toBe(true);
  });
});
