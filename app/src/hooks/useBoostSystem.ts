/**
 * 🎯 Hook React pour le Système de Boost SwapBack
 *
 * Ce hook fournit toutes les fonctionnalités du système de boost:
 * - Lecture du boost utilisateur (on-chain)
 * - Lock de tokens
 * - Swap avec rebate boosté
 * - Distribution NPI (le buyback est 100% burn)
 *
 * PHASE 1 IMPLEMENTATION - Connexion on-chain réelle
 * 
 * @author SwapBack Team
 * @date November 29, 2025 - Phase 1 Implementation
 */

"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useState, useEffect, useCallback } from "react";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export type LockLevel = "rookie" | "holder" | "believer" | "diamond";

export interface UserLockData {
  user: PublicKey;
  level: LockLevel;
  amountLocked: number;  // En lamports
  lockDuration: number;  // En secondes
  boost: number;         // Basis points (0-10000)
  lockTime: number;      // Unix timestamp
  isActive: boolean;
  bump: number;
}

export interface GlobalStateData {
  authority: PublicKey;
  totalCommunityBoost: number;
  activeLocksCount: number;
  totalValueLocked: number;
}

export interface LockParams {
  amount: number;        // En tokens (sera converti en lamports)
  durationDays: number;  // Durée en jours
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Program IDs depuis les variables d'environnement
const CNFT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
);

// Seeds pour les PDAs
const GLOBAL_STATE_SEED = "global_state";
const USER_LOCK_SEED = "user_lock";
const LOCK_VAULT_SEED = "lock_vault";

// Instruction discriminators (SHA256 hash des noms d'instruction)
// Ces valeurs doivent correspondre au programme Rust
const LOCK_TOKENS_DISCRIMINATOR = Buffer.from([21, 19, 208, 43, 237, 62, 255, 87]);
const UNLOCK_TOKENS_DISCRIMINATOR = Buffer.from([118, 103, 168, 247, 178, 4, 219, 87]);

// Token mint (configurable)
const LOCK_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_LOCK_TOKEN_MINT || "So11111111111111111111111111111111111111112" // SOL par défaut
);

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useBoostSystem() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();

  const [userLock, setUserLock] = useState<UserLockData | null>(null);
  const [globalState, setGlobalState] = useState<GlobalStateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // PDA DERIVATION
  // ==========================================================================

  const derivePDAs = useCallback((userPubkey?: PublicKey) => {
    const [globalStatePda, globalStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      CNFT_PROGRAM_ID
    );

    let userLockPda: PublicKey | null = null;
    let userLockBump: number = 0;

    if (userPubkey) {
      const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from(USER_LOCK_SEED), userPubkey.toBuffer()],
        CNFT_PROGRAM_ID
      );
      userLockPda = pda;
      userLockBump = bump;
    }

    const [lockVaultPda, lockVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(LOCK_VAULT_SEED)],
      CNFT_PROGRAM_ID
    );

    return {
      globalState: globalStatePda,
      globalStateBump,
      userLock: userLockPda,
      userLockBump,
      lockVault: lockVaultPda,
      lockVaultBump,
    };
  }, []);

  // ==========================================================================
  // DATA PARSING
  // ==========================================================================

  /**
   * Parse la structure UserLock depuis les données on-chain
   * Structure Rust:
   * - discriminator: 8 bytes
   * - user: 32 bytes (Pubkey)
   * - level: 1 byte (enum)
   * - amount_locked: 8 bytes (u64)
   * - lock_duration: 8 bytes (i64)
   * - boost: 2 bytes (u16)
   * - lock_time: 8 bytes (i64)
   * - is_active: 1 byte (bool)
   * - bump: 1 byte (u8)
   */
  const parseUserLock = useCallback((data: Buffer): UserLockData => {
    const DISCRIMINATOR_SIZE = 8;
    let offset = DISCRIMINATOR_SIZE;

    const user = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const levelByte = data.readUInt8(offset);
    offset += 1;
    
    const levelMap: Record<number, LockLevel> = {
      0: "rookie",
      1: "holder",
      2: "believer",
      3: "diamond"
    };
    const level = levelMap[levelByte] || "rookie";

    const amountLocked = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const lockDuration = Number(data.readBigInt64LE(offset));
    offset += 8;

    const boost = data.readUInt16LE(offset);
    offset += 2;

    const lockTime = Number(data.readBigInt64LE(offset));
    offset += 8;

    const isActive = data.readUInt8(offset) === 1;
    offset += 1;

    const bump = data.readUInt8(offset);

    return {
      user,
      level,
      amountLocked,
      lockDuration,
      boost,
      lockTime,
      isActive,
      bump
    };
  }, []);

  /**
   * Parse la structure GlobalState depuis les données on-chain
   * Structure Rust (approximative):
   * - discriminator: 8 bytes
   * - authority: 32 bytes
   * - wallets: 5 x 32 = 160 bytes (Wallets struct with 5 pubkeys)
   * - total_community_boost: 8 bytes (u64)
   * - active_locks_count: 8 bytes (u64)
   * - total_value_locked: 8 bytes (u64)
   */
  const parseGlobalState = useCallback((data: Buffer): GlobalStateData => {
    const DISCRIMINATOR_SIZE = 8;
    let offset = DISCRIMINATOR_SIZE;

    const authority = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    // Skip wallets (5 pubkeys)
    offset += 160;

    const totalCommunityBoost = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const activeLocksCount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const totalValueLocked = Number(data.readBigUInt64LE(offset));

    return {
      authority,
      totalCommunityBoost,
      activeLocksCount,
      totalValueLocked
    };
  }, []);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  /**
   * Récupère les données UserLock de l'utilisateur connecté
   */
  const fetchUserLock = useCallback(async () => {
    if (!publicKey) {
      setUserLock(null);
      return;
    }

    try {
      const { userLock: userLockPda } = derivePDAs(publicKey);
      if (!userLockPda) return;

      const accountInfo = await connection.getAccountInfo(userLockPda);
      
      if (!accountInfo) {
        logger.info("useBoostSystem", "No user lock found for wallet", { 
          wallet: publicKey.toString() 
        });
        setUserLock(null);
        return;
      }

      const parsedData = parseUserLock(accountInfo.data);
      logger.info("useBoostSystem", "User lock fetched successfully", {
        boost: parsedData.boost,
        isActive: parsedData.isActive,
        level: parsedData.level
      });
      
      setUserLock(parsedData);
    } catch (err) {
      logger.error("useBoostSystem", "Error fetching user lock", err);
      setUserLock(null);
    }
  }, [publicKey, connection, derivePDAs, parseUserLock]);

  /**
   * Récupère les données GlobalState du programme
   */
  const fetchGlobalState = useCallback(async () => {
    try {
      const { globalState: globalStatePda } = derivePDAs();
      
      const accountInfo = await connection.getAccountInfo(globalStatePda);
      
      if (!accountInfo) {
        logger.warn("useBoostSystem", "Global state not found - program may not be initialized");
        setGlobalState(null);
        return;
      }

      const parsedData = parseGlobalState(accountInfo.data);
      logger.info("useBoostSystem", "Global state fetched successfully", {
        totalCommunityBoost: parsedData.totalCommunityBoost,
        activeLocksCount: parsedData.activeLocksCount
      });
      
      setGlobalState(parsedData);
    } catch (err) {
      logger.error("useBoostSystem", "Error fetching global state", err);
      setGlobalState(null);
    }
  }, [connection, derivePDAs, parseGlobalState]);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  /**
   * Lock des tokens pour obtenir du boost
   */
  const lockTokens = useCallback(
    async ({ amount, durationDays }: LockParams): Promise<string> => {
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet non connecté");
      }

      setLoading(true);
      setError(null);

      try {
        const { globalState: globalStatePda, userLock: userLockPda, lockVault } = derivePDAs(publicKey);
        
        if (!userLockPda) {
          throw new Error("Cannot derive user lock PDA");
        }

        // Convertir amount en lamports (9 decimals)
        const amountLamports = new BN(amount * 1e9);
        // Convertir durée en secondes
        const durationSeconds = new BN(durationDays * 86400);

        // Get user's token account
        const userTokenAccount = await getAssociatedTokenAddress(
          LOCK_TOKEN_MINT,
          publicKey
        );

        // Build instruction data
        // Format: discriminator (8) + amount (8) + duration (8)
        const instructionData = Buffer.alloc(24);
        LOCK_TOKENS_DISCRIMINATOR.copy(instructionData, 0);
        instructionData.writeBigUInt64LE(BigInt(amountLamports.toString()), 8);
        instructionData.writeBigInt64LE(BigInt(durationSeconds.toString()), 16);

        // Build instruction
        const lockInstruction = new TransactionInstruction({
          programId: CNFT_PROGRAM_ID,
          keys: [
            { pubkey: globalStatePda, isSigner: false, isWritable: true },
            { pubkey: userLockPda, isSigner: false, isWritable: true },
            { pubkey: userTokenAccount, isSigner: false, isWritable: true },
            { pubkey: lockVault, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: instructionData
        });

        const transaction = new Transaction().add(lockInstruction);
        
        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Sign and send
        const signedTx = await signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTx.serialize());

        // Confirm
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        });

        logger.info("useBoostSystem", "Lock successful", { signature, amount, durationDays });

        // Refresh data
        await Promise.all([fetchUserLock(), fetchGlobalState()]);

        return signature;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Erreur lors du lock";
        setError(errorMsg);
        logger.error("useBoostSystem", "Lock failed", err);
        throw new Error(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, connection, derivePDAs, fetchUserLock, fetchGlobalState]
  );

  /**
   * Unlock des tokens (après la période de lock)
   */
  const unlockTokens = useCallback(async (): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error("Wallet non connecté");
    }

    if (!userLock || !userLock.isActive) {
      throw new Error("Aucun lock actif trouvé");
    }

    // Check if lock period has ended
    const now = Math.floor(Date.now() / 1000);
    const unlockTime = userLock.lockTime + userLock.lockDuration;
    if (now < unlockTime) {
      const remainingDays = Math.ceil((unlockTime - now) / 86400);
      throw new Error(`Lock expire dans ${remainingDays} jours`);
    }

    setLoading(true);
    setError(null);

    try {
      const { globalState: globalStatePda, userLock: userLockPda, lockVault } = derivePDAs(publicKey);
      
      if (!userLockPda) {
        throw new Error("Cannot derive user lock PDA");
      }

      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(
        LOCK_TOKEN_MINT,
        publicKey
      );

      // Build instruction
      const unlockInstruction = new TransactionInstruction({
        programId: CNFT_PROGRAM_ID,
        keys: [
          { pubkey: globalStatePda, isSigner: false, isWritable: true },
          { pubkey: userLockPda, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: lockVault, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: UNLOCK_TOKENS_DISCRIMINATOR
      });

      const transaction = new Transaction().add(unlockInstruction);
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      logger.info("useBoostSystem", "Unlock successful", { signature });

      // Refresh data
      await Promise.all([fetchUserLock(), fetchGlobalState()]);

      return signature;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erreur lors du unlock";
      setError(errorMsg);
      logger.error("useBoostSystem", "Unlock failed", err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, connection, userLock, derivePDAs, fetchUserLock, fetchGlobalState]);

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  /**
   * Calculer le rebate boosté
   */
  const calculateBoostedRebate = useCallback(
    (baseRebate: number): number => {
      if (!userLock || !userLock.isActive) {
        return baseRebate;
      }

      // boost est en basis points (ex: 500 = 5%)
      const boostMultiplier = (10_000 + userLock.boost) / 10_000;
      return baseRebate * boostMultiplier;
    },
    [userLock]
  );

  /**
   * Calculer la part de NPI estimée
   * Note: Le buyback est maintenant 100% burn, 
   * les NPI sont distribués séparément
   */
  const calculateNpiShare = useCallback(
    (totalNpiPool: number): number => {
      if (!userLock || !globalState || !userLock.isActive) {
        return 0;
      }

      if (globalState.totalCommunityBoost === 0) {
        return 0;
      }

      // Part proportionnelle au boost
      return (totalNpiPool * userLock.boost) / globalState.totalCommunityBoost;
    },
    [userLock, globalState]
  );

  /**
   * Obtenir le temps restant avant unlock
   */
  const getRemainingLockTime = useCallback((): number => {
    if (!userLock || !userLock.isActive) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const unlockTime = userLock.lockTime + userLock.lockDuration;
    return Math.max(0, unlockTime - now);
  }, [userLock]);

  /**
   * Vérifier si le lock est déverrouillable
   */
  const canUnlock = useCallback((): boolean => {
    return getRemainingLockTime() === 0 && userLock?.isActive === true;
  }, [getRemainingLockTime, userLock]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Charger les données au montage et quand le wallet change
  useEffect(() => {
    if (publicKey) {
      setLoading(true);
      Promise.all([fetchUserLock(), fetchGlobalState()])
        .finally(() => setLoading(false));
    } else {
      setUserLock(null);
    }
  }, [publicKey, fetchUserLock, fetchGlobalState]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Data
    userLock,
    globalState,
    loading,
    error,

    // Derived state
    hasActiveLock: userLock?.isActive ?? false,
    userBoost: userLock?.boost ?? 0,
    totalCommunityBoost: globalState?.totalCommunityBoost ?? 0,
    remainingLockTime: getRemainingLockTime(),
    canUnlock: canUnlock(),

    // Actions
    lockTokens,
    unlockTokens,

    // Utilities
    calculateBoostedRebate,
    calculateNpiShare,
    getRemainingLockTime,

    // Refresh
    refreshData: useCallback(() => {
      return Promise.all([fetchUserLock(), fetchGlobalState()]);
    }, [fetchUserLock, fetchGlobalState]),
  };
}

// Helper pour formater la durée restante
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return "Déverrouillable";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}j ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Helper pour formater le niveau
export function formatLockLevel(level: LockLevel): string {
  const levelNames: Record<LockLevel, string> = {
    rookie: "🥉 Rookie",
    holder: "🥈 Holder",
    believer: "🥇 Believer",
    diamond: "💎 Diamond"
  };
  return levelNames[level] || level;
}

// Helper pour calculer le boost attendu
export function calculateExpectedBoost(amountUsd: number, durationDays: number): number {
  // Formule: boost = (amount_weight * duration_weight) / 100
  // amount_weight: basé sur le niveau
  // duration_weight: basé sur la durée (30/90/180/365 jours)
  
  let amountWeight = 100; // Rookie
  if (amountUsd >= 10000) amountWeight = 400; // Diamond
  else if (amountUsd >= 1000) amountWeight = 300; // Believer
  else if (amountUsd >= 100) amountWeight = 200; // Holder
  
  let durationWeight = 100; // 30 days
  if (durationDays >= 365) durationWeight = 400;
  else if (durationDays >= 180) durationWeight = 300;
  else if (durationDays >= 90) durationWeight = 200;
  
  return Math.floor((amountWeight * durationWeight) / 100);
}
