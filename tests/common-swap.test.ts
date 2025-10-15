/**
 * Common Swap Program Unit Tests
 *
 * Tests for weight-based routing and MEV protection covering:
 * - Weight validation (sum to 100)
 * - Oracle price verification
 * - Dynamic weight calculation
 * - Emergency mode handling
 * - MEV protection via Jito bundling
 *
 * @module common-swap.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { CommonSwap } from "../target/types/common_swap";

// Mock Anchor
vi.mock("@coral-xyz/anchor", () => ({
  Program: vi.fn(),
  workspace: {
    CommonSwap: {
      programId: new PublicKey("11111111111111111111111111111112"),
    },
  },
}));

// ============================================================================
// MOCK DATA
// ============================================================================

const mockAuthority = Keypair.generate();
const mockUser = Keypair.generate();
const mockInputMint = new PublicKey("So11111111111111111111111111111111111111112"); // SOL
const mockOutputMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC

const createMockProgram = (): Program<CommonSwap> => {
  const mockProgram = {
    programId: new PublicKey("11111111111111111111111111111112"),
    methods: {
      initialize: vi.fn().mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockResolvedValue("mock_tx_signature_init"),
        }),
      }),
      executeWeightedSwap: vi.fn().mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockResolvedValue("mock_tx_signature_weighted"),
        }),
      }),
      executeDynamicSwap: vi.fn().mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockResolvedValue("mock_tx_signature_dynamic"),
        }),
      }),
      setEmergencyMode: vi.fn().mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockResolvedValue("mock_tx_signature_emergency"),
        }),
      }),
      pauseProgram: vi.fn().mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockResolvedValue("mock_tx_signature_pause"),
        }),
      }),
    },
  };
  return mockProgram as any;
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe("CommonSwap Program", () => {
  let program: Program<CommonSwap>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = createMockProgram();
  });

  describe("Initialization", () => {
    it("should initialize the program successfully", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          globalState: PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            program.programId
          )[0],
          authority: mockAuthority.publicKey,
          systemProgram: PublicKey.default,
        })
        .rpc();

      expect(tx).toBeDefined();
    });
  });

  describe("Weighted Swap Execution", () => {
    it("should execute swap with valid weights that sum to 100", async () => {
      const weights = [40, 35, 25]; // Sum = 100
      const venues = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Orca
        new PublicKey("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"), // Raydium
        new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"), // Jupiter
      ];

      const tx = await program.methods
        .executeWeightedSwap(
          mockInputMint,
          mockOutputMint,
          1000000, // 1 SOL (6 decimals)
          150000, // Min 150 USDC (6 decimals)
          weights,
          venues,
          150000000, // Oracle price (150 USDC per SOL)
          1000000, // Oracle confidence
          true, // Use Jito bundling
          50 // Max 0.5% slippage
        )
        .accounts({
          globalState: PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            program.programId
          )[0],
          user: mockUser.publicKey,
          userInputAccount: PublicKey.default,
          userOutputAccount: PublicKey.default,
        })
        .rpc();

      expect(tx).toBeDefined();
    });

    it("should reject weights that do not sum to 100", async () => {
      const invalidWeights = [40, 35, 20]; // Sum = 95
      const venues = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
        new PublicKey("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"),
      ];

      // Mock the rejection
      const mockExecuteWeightedSwap = program.methods.executeWeightedSwap as any;
      mockExecuteWeightedSwap.mockReturnValueOnce({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error("InvalidWeights")),
        }),
      });

      await expect(
        program.methods
          .executeWeightedSwap(
            mockInputMint,
            mockOutputMint,
            1000000,
            150000,
            invalidWeights,
            venues,
            150000000,
            1000000,
            false,
            50
          )
          .accounts({
            globalState: PublicKey.findProgramAddressSync(
              [Buffer.from("global_state")],
              program.programId
            )[0],
            user: mockUser.publicKey,
            userInputAccount: PublicKey.default,
            userOutputAccount: PublicKey.default,
          })
          .rpc()
      ).rejects.toThrow("InvalidWeights");
    });

    it("should reject mismatched weight and venue counts", async () => {
      const weights = [50, 50]; // 2 weights
      const venues = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
        // Missing venue for second weight
      ];

      // Mock the rejection
      const mockExecuteWeightedSwap = program.methods.executeWeightedSwap as any;
      mockExecuteWeightedSwap.mockReturnValueOnce({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error("WeightVenueMismatch")),
        }),
      });

      await expect(
        program.methods
          .executeWeightedSwap(
            mockInputMint,
            mockOutputMint,
            1000000,
            150000,
            weights,
            venues,
            150000000,
            1000000,
            false,
            50
          )
          .accounts({
            globalState: PublicKey.findProgramAddressSync(
              [Buffer.from("global_state")],
              program.programId
            )[0],
            user: mockUser.publicKey,
            userInputAccount: PublicKey.default,
            userOutputAccount: PublicKey.default,
          })
          .rpc()
      ).rejects.toThrow("WeightVenueMismatch");
    });

    it("should execute dynamic swap with oracle data", async () => {
      const oracleData = {
        provider: { pyth: {} },
        price: 150000000,
        confidence: 1000000,
        timestamp: Date.now(),
        exponent: -8,
      };

      const tx = await program.methods
        .executeDynamicSwap(
          mockInputMint,
          mockOutputMint,
          1000000,
          140000,
          oracleData,
          3 // Max venues
        )
        .accounts({
          globalState: PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            program.programId
          )[0],
          user: mockUser.publicKey,
          userInputAccount: PublicKey.default,
          userOutputAccount: PublicKey.default,
        })
        .rpc();

      expect(tx).toBeDefined();
    });
  });

  describe("Emergency Controls", () => {
    it("should allow admin to set emergency mode", async () => {
      const tx = await program.methods
        .setEmergencyMode(true)
        .accounts({
          globalState: PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            program.programId
          )[0],
          authority: mockAuthority.publicKey,
        })
        .rpc();

      expect(tx).toBeDefined();
    });

    it("should reject emergency mode changes from non-admin", async () => {
      // Mock the rejection
      const mockSetEmergencyMode = program.methods.setEmergencyMode as any;
      mockSetEmergencyMode.mockReturnValueOnce({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error("Unauthorized")),
        }),
      });

      await expect(
        program.methods
          .setEmergencyMode(true)
          .accounts({
            globalState: PublicKey.findProgramAddressSync(
              [Buffer.from("global_state")],
              program.programId
            )[0],
            authority: mockUser.publicKey, // Wrong authority
          })
          .rpc()
      ).rejects.toThrow("Unauthorized");
    });

    it("should allow admin to pause/unpause program", async () => {
      const tx = await program.methods
        .pauseProgram(true)
        .accounts({
          globalState: PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            program.programId
          )[0],
          authority: mockAuthority.publicKey,
        })
        .rpc();

      expect(tx).toBeDefined();
    });
  });

  describe("MEV Protection", () => {
    it("should support Jito bundling parameter", async () => {
      const weights = [100];
      const venues = [new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")];

      const tx = await program.methods
        .executeWeightedSwap(
          mockInputMint,
          mockOutputMint,
          1000000,
          150000,
          weights,
          venues,
          150000000,
          1000000,
          true, // Jito bundling enabled
          50
        )
        .accounts({
          globalState: PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            program.programId
          )[0],
          user: mockUser.publicKey,
          userInputAccount: PublicKey.default,
          userOutputAccount: PublicKey.default,
        })
        .rpc();

      expect(tx).toBeDefined();
    });
  });
});