/**
 * Bundle Optimizer
 * Optimizes transaction bundles for maximum efficiency and atomicity
 */

import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// ============================================================================
// TYPES
// ============================================================================

export interface InstructionWithMetadata {
  instruction: TransactionInstruction;
  type: InstructionType;
  estimatedCU: number;
  priority: number; // Lower = higher priority (setup=1, swap=2, cleanup=3)
  dependencies?: string[]; // Account keys that must exist before this instruction
}

export enum InstructionType {
  SETUP = "setup", // ATA creation, account initialization
  SWAP = "swap", // Main swap instructions
  CLEANUP = "cleanup", // Post-swap cleanup
  TIP = "tip", // Jito tip
  COMPUTE_BUDGET = "compute_budget", // Compute budget instructions
}

export interface InstructionGroup {
  instructions: InstructionWithMetadata[];
  totalComputeUnits: number;
  estimatedLamports: number;
}

export interface OptimizedBundle {
  transactions: Transaction[];
  totalComputeUnits: number;
  instructionGroups: InstructionGroup[];
  optimizations: string[];
  metrics: BundleOptimizationMetrics;
}

export interface BundleOptimizationMetrics {
  originalInstructionCount: number;
  optimizedInstructionCount: number;
  transactionCount: number;
  compressionRatio: number; // 0-1 (1 = no compression)
  estimatedTotalCU: number;
  estimatedTotalLamports: number;
}

export interface BundleOptimizationConfig {
  maxComputeUnitsPerTx: number; // 1.4M CU
  maxInstructionsPerTx: number; // 20 instructions
  compressATACreation: boolean; // Group ATA creation
  prioritizeSwapInstructions: boolean; // Put swaps first after setup
  validateDependencies: boolean; // Validate account dependencies
  enableComputeBudgetOptimization: boolean; // Optimize compute budget instructions
}

const DEFAULT_CONFIG: BundleOptimizationConfig = {
  maxComputeUnitsPerTx: 1_400_000, // 1.4M CU limit
  maxInstructionsPerTx: 20,
  compressATACreation: true,
  prioritizeSwapInstructions: true,
  validateDependencies: true,
  enableComputeBudgetOptimization: true,
};

// ============================================================================
// BUNDLE OPTIMIZER
// ============================================================================

export class BundleOptimizer {
  private readonly config: BundleOptimizationConfig;

  constructor(config?: Partial<BundleOptimizationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Optimize bundle construction
   * Compresses instructions, validates dependencies, splits by compute units
   */
  optimizeBundleConstruction(
    instructions: InstructionWithMetadata[],
    feePayer: PublicKey
  ): OptimizedBundle {
    const startTime = Date.now();
    const optimizations: string[] = [];
    const originalCount = instructions.length;

    let optimized = [...instructions];

    // 1. Compress ATA creation instructions
    if (this.config.compressATACreation) {
      const before = optimized.length;
      optimized = this.compressATAInstructions(optimized);
      const after = optimized.length;
      if (before !== after) {
        optimizations.push(
          `Compressed ${before - after} duplicate ATA creation instructions`
        );
      }
    }

    // 2. Prioritize instructions (setup → swap → cleanup)
    if (this.config.prioritizeSwapInstructions) {
      optimized = this.prioritizeInstructions(optimized);
      optimizations.push("Prioritized instructions (setup → swap → cleanup)");
    }

    // 3. Validate dependencies
    if (this.config.validateDependencies) {
      this.validateDependencies(optimized);
      optimizations.push("Validated instruction dependencies");
    }

    // 4. Split by compute units (smarter than fixed count)
    const groups = this.splitByComputeUnits(optimized);
    optimizations.push(
      `Split into ${groups.length} transaction(s) by compute units`
    );

    // 5. Create transactions
    const transactions = groups.map((group) =>
      this.createTransaction(group, feePayer)
    );

    // 6. Calculate metrics
    const totalComputeUnits = groups.reduce(
      (sum, g) => sum + g.totalComputeUnits,
      0
    );
    const compressionRatio = optimized.length / originalCount;

    const metrics: BundleOptimizationMetrics = {
      originalInstructionCount: originalCount,
      optimizedInstructionCount: optimized.length,
      transactionCount: transactions.length,
      compressionRatio,
      estimatedTotalCU: totalComputeUnits,
      estimatedTotalLamports: this.estimateTotalLamports(groups),
    };

    const elapsedMs = Date.now() - startTime;
    optimizations.push(`Optimization completed in ${elapsedMs}ms`);

    return {
      transactions,
      totalComputeUnits,
      instructionGroups: groups,
      optimizations,
      metrics,
    };
  }

  /**
   * Compress duplicate ATA creation instructions
   * Multiple swaps may try to create same ATA - keep only first occurrence
   */
  private compressATAInstructions(
    instructions: InstructionWithMetadata[]
  ): InstructionWithMetadata[] {
    const seenATAs = new Set<string>();
    const compressed: InstructionWithMetadata[] = [];

    for (const instr of instructions) {
      // Check if this is an ATA creation
      if (this.isATACreation(instr.instruction)) {
        const ataKey = this.getATACreationKey(instr.instruction);
        if (seenATAs.has(ataKey)) {
          // Skip duplicate
          continue;
        }
        seenATAs.add(ataKey);
      }

      compressed.push(instr);
    }

    return compressed;
  }

  /**
   * Prioritize instructions by type
   * Order: COMPUTE_BUDGET → SETUP → SWAP → CLEANUP → TIP
   */
  private prioritizeInstructions(
    instructions: InstructionWithMetadata[]
  ): InstructionWithMetadata[] {
    return [...instructions].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate that instruction dependencies are satisfied
   * Ensures accounts exist before being used
   */
  private validateDependencies(
    instructions: InstructionWithMetadata[]
  ): void {
    const createdAccounts = new Set<string>();

    for (const instr of instructions) {
      // Check dependencies
      if (instr.dependencies) {
        for (const dep of instr.dependencies) {
          if (!createdAccounts.has(dep)) {
            console.warn(
              `⚠️  Dependency warning: Account ${dep} used before creation`
            );
          }
        }
      }

      // Track created accounts (ATA creation)
      if (this.isATACreation(instr.instruction)) {
        const ataAddress = this.getATAAddress(instr.instruction);
        if (ataAddress) {
          createdAccounts.add(ataAddress);
        }
      }
    }
  }

  /**
   * Split instructions into groups by compute units
   * More intelligent than fixed instruction count
   */
  private splitByComputeUnits(
    instructions: InstructionWithMetadata[]
  ): InstructionGroup[] {
    const groups: InstructionGroup[] = [];
    let currentGroup: InstructionWithMetadata[] = [];
    let currentCU = 0;

    for (const instr of instructions) {
      const instrCU = instr.estimatedCU;

      // Check if adding this instruction would exceed limits
      const wouldExceedCU =
        currentCU + instrCU > this.config.maxComputeUnitsPerTx;
      const wouldExceedCount =
        currentGroup.length >= this.config.maxInstructionsPerTx;

      if ((wouldExceedCU || wouldExceedCount) && currentGroup.length > 0) {
        // Finalize current group
        groups.push(this.finalizeGroup(currentGroup, currentCU));

        // Start new group
        currentGroup = [instr];
        currentCU = instrCU;
      } else {
        // Add to current group
        currentGroup.push(instr);
        currentCU += instrCU;
      }
    }

    // Finalize last group
    if (currentGroup.length > 0) {
      groups.push(this.finalizeGroup(currentGroup, currentCU));
    }

    return groups;
  }

  /**
   * Finalize instruction group with metadata
   */
  private finalizeGroup(
    instructions: InstructionWithMetadata[],
    totalCU: number
  ): InstructionGroup {
    return {
      instructions,
      totalComputeUnits: totalCU,
      estimatedLamports: this.estimateGroupLamports(totalCU),
    };
  }

  /**
   * Create transaction from instruction group
   */
  private createTransaction(
    group: InstructionGroup,
    feePayer: PublicKey
  ): Transaction {
    const tx = new Transaction();
    tx.feePayer = feePayer;

    // Note: ComputeBudgetProgram not available in web3.js v1.x
    // Add compute budget instruction if needed (commented out for v1)
    // if (
    //   this.config.enableComputeBudgetOptimization &&
    //   group.totalComputeUnits > 200_000
    // ) {
    //   tx.add(
    //     ComputeBudgetProgram.setComputeUnitLimit({
    //       units: group.totalComputeUnits,
    //     })
    //   );
    // }

    // Add all instructions
    for (const instrMeta of group.instructions) {
      tx.add(instrMeta.instruction);
    }

    return tx;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check if instruction is ATA creation
   */
  private isATACreation(instruction: TransactionInstruction): boolean {
    return (
      instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) &&
      instruction.keys.length >= 6
    );
  }

  /**
   * Get unique key for ATA creation (mint + owner)
   */
  private getATACreationKey(instruction: TransactionInstruction): string {
    if (!this.isATACreation(instruction)) return "";

    // ATA instruction format: [ata, payer, wallet, mint, system, token]
    const mint = instruction.keys[3]?.pubkey.toBase58() || "";
    const owner = instruction.keys[2]?.pubkey.toBase58() || "";

    return `${mint}:${owner}`;
  }

  /**
   * Get ATA address from creation instruction
   */
  private getATAAddress(instruction: TransactionInstruction): string | null {
    if (!this.isATACreation(instruction)) return null;
    return instruction.keys[0]?.pubkey.toBase58() || null;
  }

  /**
   * Estimate compute units for instruction
   */
  estimateInstructionCU(instruction: TransactionInstruction): number {
    const programId = instruction.programId.toBase58();

    // Known program estimates
    if (programId === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()) {
      return 5_000; // ATA creation
    }

    if (programId === TOKEN_PROGRAM_ID.toBase58()) {
      return 3_000; // Token transfer
    }

    // Swap programs (rough estimates)
    if (
      programId.includes("orca") ||
      programId.includes("raydium") ||
      programId.includes("jupiter")
    ) {
      return 100_000; // Swap instruction
    }

    // Default estimate
    return 10_000;
  }

  /**
   * Estimate lamports for group
   */
  private estimateGroupLamports(computeUnits: number): number {
    // Base fee: 5000 lamports
    // Priority fee: 1 micro-lamport per CU (configurable)
    const baseFee = 5000;
    const priorityFee = computeUnits; // 1 micro-lamport/CU = 1 lamport/1M CU
    return baseFee + priorityFee / 1_000_000;
  }

  /**
   * Estimate total lamports for all groups
   */
  private estimateTotalLamports(groups: InstructionGroup[]): number {
    return groups.reduce((sum, g) => sum + g.estimatedLamports, 0);
  }

  /**
   * Wrap instructions with metadata
   */
  wrapInstructions(
    setupIxs: TransactionInstruction[],
    swapIxs: TransactionInstruction[],
    cleanupIxs: TransactionInstruction[]
  ): InstructionWithMetadata[] {
    const wrapped: InstructionWithMetadata[] = [];

    // Setup instructions (priority 1)
    for (const ix of setupIxs) {
      wrapped.push({
        instruction: ix,
        type: InstructionType.SETUP,
        estimatedCU: this.estimateInstructionCU(ix),
        priority: 1,
      });
    }

    // Swap instructions (priority 2)
    for (const ix of swapIxs) {
      wrapped.push({
        instruction: ix,
        type: InstructionType.SWAP,
        estimatedCU: this.estimateInstructionCU(ix),
        priority: 2,
      });
    }

    // Cleanup instructions (priority 3)
    for (const ix of cleanupIxs) {
      wrapped.push({
        instruction: ix,
        type: InstructionType.CLEANUP,
        estimatedCU: this.estimateInstructionCU(ix),
        priority: 3,
      });
    }

    return wrapped;
  }
}
