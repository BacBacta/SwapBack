/**
 * 💰 Composant ClaimBuyback - Interface de Réclamation NPI
 *
 * Permet aux utilisateurs de réclamer leurs NPI (Negative Price Impact) rewards
 * Le système buyback est maintenant 100% burn - cette interface gère le claim NPI
 *
 * @author SwapBack Team
 * @date November 29, 2025 - Phase 1 Implementation
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram 
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { logger } from "@/lib/logger";

interface ClaimableRewards {
  userBoost: number;
  totalBoost: number;
  pendingNpi: number;
  totalClaimed: number;
  isEligible: boolean;
  hasActiveLock: boolean;
}

// Lazy-loaded Program IDs to avoid SSR issues
let _cnftProgramId: PublicKey | null = null;
function getCnftProgramId(): PublicKey {
  if (!_cnftProgramId) {
    _cnftProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
    );
  }
  return _cnftProgramId;
}

// Lazy-loaded NPI token mint
let _npiMint: PublicKey | null = null;
function getNpiMint(): PublicKey {
  if (!_npiMint) {
    _npiMint = new PublicKey(
      process.env.NEXT_PUBLIC_NPI_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    );
  }
  return _npiMint;
}

// Seeds pour les PDAs
const GLOBAL_STATE_SEED = "global_state";
const USER_LOCK_SEED = "user_lock";
const USER_NPI_BALANCE_SEED = "user_npi_balance";
const NPI_VAULT_AUTHORITY_SEED = "npi_vault_authority";

// Discriminateur pour claim_npi instruction (premiers 8 bytes du hash SHA256 de "global:claim_npi")
const CLAIM_NPI_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);

export default function ClaimBuyback() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [rewards, setRewards] = useState<ClaimableRewards | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Dérive les PDAs nécessaires
   */
  const derivePDAs = useCallback((userPubkey: PublicKey) => {
    const programId = getCnftProgramId();
    
    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      programId
    );

    const [userLock] = PublicKey.findProgramAddressSync(
      [Buffer.from(USER_LOCK_SEED), userPubkey.toBuffer()],
      programId
    );

    const [userNpiBalance] = PublicKey.findProgramAddressSync(
      [Buffer.from(USER_NPI_BALANCE_SEED), userPubkey.toBuffer()],
      programId
    );

    const [npiVaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from(NPI_VAULT_AUTHORITY_SEED)],
      programId
    );

    return { globalState, userLock, userNpiBalance, npiVaultAuthority };
  }, []);

  /**
   * Parse la structure UserLock depuis les données on-chain
   * Structure (from Rust):
   * - discriminator: 8 bytes
   * - user: 32 bytes (Pubkey)
   * - level: 1 byte (enum: Rookie=0, Holder=1, Believer=2, Diamond=3)
   * - amount_locked: 8 bytes (u64)
   * - lock_duration: 8 bytes (i64)
   * - boost: 2 bytes (u16)
   * - lock_time: 8 bytes (i64)
   * - is_active: 1 byte (bool)
   * - bump: 1 byte (u8)
   */
  const parseUserLock = (data: Buffer) => {
    const DISCRIMINATOR_SIZE = 8;
    let offset = DISCRIMINATOR_SIZE;

    const user = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const level = data.readUInt8(offset);
    offset += 1;

    const amountLocked = data.readBigUInt64LE(offset);
    offset += 8;

    const lockDuration = data.readBigInt64LE(offset);
    offset += 8;

    const boost = data.readUInt16LE(offset);
    offset += 2;

    const lockTime = data.readBigInt64LE(offset);
    offset += 8;

    const isActive = data.readUInt8(offset) === 1;
    offset += 1;

    const bump = data.readUInt8(offset);

    return {
      user,
      level,
      amountLocked: Number(amountLocked),
      lockDuration: Number(lockDuration),
      boost,
      lockTime: Number(lockTime),
      isActive,
      bump
    };
  };

  /**
   * Parse la structure UserNpiBalance depuis les données on-chain
   * Structure:
   * - discriminator: 8 bytes
   * - user: 32 bytes (Pubkey)
   * - pending_amount: 8 bytes (u64)
   * - total_claimed: 8 bytes (u64)
   * - last_claim_time: 8 bytes (i64)
   * - bump: 1 byte (u8)
   */
  const parseUserNpiBalance = (data: Buffer) => {
    const DISCRIMINATOR_SIZE = 8;
    let offset = DISCRIMINATOR_SIZE;

    const user = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const pendingAmount = data.readBigUInt64LE(offset);
    offset += 8;

    const totalClaimed = data.readBigUInt64LE(offset);
    offset += 8;

    const lastClaimTime = data.readBigInt64LE(offset);
    offset += 8;

    const bump = data.readUInt8(offset);

    return {
      user,
      pendingAmount: Number(pendingAmount),
      totalClaimed: Number(totalClaimed),
      lastClaimTime: Number(lastClaimTime),
      bump
    };
  };

  /**
   * Parse la structure GlobalState depuis les données on-chain
   * Structure:
   * - discriminator: 8 bytes
   * - authority: 32 bytes
   * - total_community_boost: 8 bytes (u64)
   * - ...autres champs
   */
  const parseGlobalState = (data: Buffer) => {
    const DISCRIMINATOR_SIZE = 8;
    let offset = DISCRIMINATOR_SIZE;

    const authority = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    // Skip wallet pubkeys (5 x 32 = 160 bytes)
    offset += 160;

    const totalCommunityBoost = data.readBigUInt64LE(offset);
    offset += 8;

    return {
      authority,
      totalCommunityBoost: Number(totalCommunityBoost)
    };
  };

  /**
   * Récupère les récompenses claimable depuis la blockchain
   */
  const fetchClaimableRewards = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const { globalState, userLock, userNpiBalance } = derivePDAs(publicKey);

      // Fetch tous les comptes en parallèle
      const [globalStateInfo, userLockInfo, userNpiBalanceInfo] = await Promise.all([
        connection.getAccountInfo(globalState),
        connection.getAccountInfo(userLock),
        connection.getAccountInfo(userNpiBalance)
      ]);

      // Vérifier si l'utilisateur a un lock actif
      if (!userLockInfo) {
        logger.info("ClaimBuyback", "No user lock found");
        setRewards({
          userBoost: 0,
          totalBoost: 0,
          pendingNpi: 0,
          totalClaimed: 0,
          isEligible: false,
          hasActiveLock: false
        });
        return;
      }

      // Parser les données
      const userLockData = parseUserLock(userLockInfo.data);
      logger.info("ClaimBuyback", "User lock data", { 
        boost: userLockData.boost, 
        isActive: userLockData.isActive 
      });

      if (!userLockData.isActive || userLockData.boost === 0) {
        setRewards({
          userBoost: 0,
          totalBoost: 0,
          pendingNpi: 0,
          totalClaimed: 0,
          isEligible: false,
          hasActiveLock: false
        });
        return;
      }

      // Parser global state
      let totalBoost = 0;
      if (globalStateInfo) {
        const globalData = parseGlobalState(globalStateInfo.data);
        totalBoost = globalData.totalCommunityBoost;
      }

      // Parser NPI balance si existant
      let pendingNpi = 0;
      let totalClaimed = 0;
      if (userNpiBalanceInfo) {
        const npiData = parseUserNpiBalance(userNpiBalanceInfo.data);
        pendingNpi = npiData.pendingAmount / 1e6; // USDC has 6 decimals
        totalClaimed = npiData.totalClaimed / 1e6;
      }

      setRewards({
        userBoost: userLockData.boost,
        totalBoost,
        pendingNpi,
        totalClaimed,
        isEligible: pendingNpi > 0,
        hasActiveLock: userLockData.isActive
      });

    } catch (err: unknown) {
      logger.error("ClaimBuyback", "Error fetching rewards", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch rewards";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, derivePDAs]);

  // Fetch rewards on mount and when wallet changes
  useEffect(() => {
    if (!connected || !publicKey) {
      setRewards(null);
      return;
    }

    fetchClaimableRewards();
  }, [connected, publicKey, fetchClaimableRewards]);

  /**
   * Exécute la transaction claim_npi on-chain
   */
  const handleClaim = async () => {
    if (!connected || !publicKey || !signTransaction || !rewards || !rewards.isEligible) {
      return;
    }

    setClaiming(true);
    setError(null);
    setSuccess(null);

    try {
      const { globalState, userLock, userNpiBalance, npiVaultAuthority } = derivePDAs(publicKey);
      const npiMint = getNpiMint();

      // Derive vault ATA (owned by npiVaultAuthority)
      const npiVault = await getAssociatedTokenAddress(
        npiMint,
        npiVaultAuthority,
        true // allowOwnerOffCurve for PDA
      );

      // Get or create user's NPI token account
      const userNpiTokenAccount = await getAssociatedTokenAddress(
        npiMint,
        publicKey
      );

      // Check if user NPI token account exists
      const userNpiTokenAccountInfo = await connection.getAccountInfo(userNpiTokenAccount);

      const transaction = new Transaction();

      // Create ATA if doesn't exist
      if (!userNpiTokenAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey, // payer
            userNpiTokenAccount, // ata
            publicKey, // owner
            npiMint // mint
          )
        );
      }

      // Build claim_npi instruction
      // Accounts order from Rust:
      // 1. global_state
      // 2. user_lock
      // 3. user_npi_balance
      // 4. npi_vault
      // 5. npi_vault_authority
      // 6. user_npi_token_account
      // 7. user (signer)
      // 8. token_program
      // 9. system_program
      const claimInstruction = new TransactionInstruction({
        programId: getCnftProgramId(),
        keys: [
          { pubkey: globalState, isSigner: false, isWritable: true },
          { pubkey: userLock, isSigner: false, isWritable: false },
          { pubkey: userNpiBalance, isSigner: false, isWritable: true },
          { pubkey: npiVault, isSigner: false, isWritable: true },
          { pubkey: npiVaultAuthority, isSigner: false, isWritable: false },
          { pubkey: userNpiTokenAccount, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: CLAIM_NPI_DISCRIMINATOR // No additional data needed
      });

      transaction.add(claimInstruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign transaction
      const signedTx = await signTransaction(transaction);

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      logger.info("ClaimBuyback", "Claim successful", { signature });
      setSuccess(`Successfully claimed ${rewards.pendingNpi.toFixed(4)} USDC! Tx: ${signature.slice(0, 8)}...`);

      // Refresh rewards after claim
      setTimeout(() => {
        fetchClaimableRewards();
      }, 2000);

    } catch (err: unknown) {
      logger.error("ClaimBuyback", "Error claiming rewards", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to claim rewards";
      setError(errorMessage);
    } finally {
      setClaiming(false);
    }
  };

  // UI: Non connecté
  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-4 terminal-text terminal-glow uppercase tracking-wider">
              [CLAIM NPI REWARDS]
            </h2>
            <div className="text-6xl mb-4">🔗</div>
            <p className="text-gray-400 mb-4">Connectez votre wallet pour voir vos récompenses NPI</p>
          </div>
        </div>
      </div>
    );
  }

  // UI: Chargement
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-4 terminal-text terminal-glow uppercase tracking-wider">
              [CLAIM NPI REWARDS]
            </h2>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-gray-400">Chargement de vos récompenses...</p>
          </div>
        </div>
      </div>
    );
  }

  // UI: Non éligible
  if (!rewards || !rewards.hasActiveLock) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-4 terminal-text terminal-glow uppercase tracking-wider">
              [CLAIM NPI REWARDS]
            </h2>
            <div className="text-6xl mb-4">🚫</div>
            <p className="text-yellow-400 mb-2 font-bold">Non Éligible</p>
            <p className="text-gray-400 mb-4">
              Vous devez avoir une position de lock active avec boost &gt; 0 pour recevoir les NPI
            </p>
            <a
              href="/lock"
              className="inline-block px-6 py-3 border-2 border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors uppercase tracking-wider font-bold"
            >
              Locker des Tokens
            </a>
          </div>
        </div>
      </div>
    );
  }

  // UI: Interface principale
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-[var(--primary)] mb-2 terminal-text terminal-glow uppercase tracking-wider">
            [CLAIM NPI REWARDS]
          </h2>
          <p className="text-gray-400 text-sm uppercase tracking-wider">
            NPI (Negative Price Impact) distribués aux holders avec boost actif
          </p>
        </div>

        {/* Info Buyback 100% Burn */}
        <div className="mb-6 p-4 border border-blue-500/50 bg-blue-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔥</span>
            <span className="text-blue-400 font-bold uppercase">Buyback 100% Burn</span>
          </div>
          <p className="text-gray-400 text-sm">
            Le système buyback brûle 100% des tokens rachetés. Les récompenses NPI sont 
            collectées séparément et distribuées aux utilisateurs avec un lock actif.
          </p>
        </div>

        {/* Main Claim Card */}
        <div className="bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent)]/10 border-2 border-[var(--primary)] rounded-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-400 mb-2 uppercase tracking-wider">
              Vos Récompenses NPI Disponibles
            </div>
            <div className="text-5xl font-bold text-[var(--primary)] terminal-glow mb-2">
              {rewards.pendingNpi.toFixed(4)}
            </div>
            <div className="text-xl text-gray-300">USDC</div>
          </div>

          <button
            onClick={handleClaim}
            disabled={claiming || rewards.pendingNpi === 0}
            className="w-full py-4 border-2 border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider font-bold text-lg"
          >
            {claiming ? "CLAIMING..." : rewards.pendingNpi === 0 ? "PAS DE RÉCOMPENSES DISPONIBLES" : "CLAIM NPI"}
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 border-2 border-green-500 bg-green-500/10 rounded">
            <p className="text-green-400 font-bold">✅ {success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 border-2 border-red-500 bg-red-500/10 rounded">
            <p className="text-red-400 font-bold">❌ {error}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-black/30 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-400 mb-2 uppercase">Votre Boost</div>
            <div className="text-2xl font-bold text-[var(--primary)]">
              {rewards.userBoost.toLocaleString()}
            </div>
          </div>

          <div className="bg-black/30 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-400 mb-2 uppercase">Boost Total</div>
            <div className="text-2xl font-bold text-gray-300">
              {rewards.totalBoost.toLocaleString()}
            </div>
          </div>

          <div className="bg-black/30 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-400 mb-2 uppercase">Total Claimé</div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {rewards.totalClaimed.toFixed(2)} USDC
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>💡 Augmentez votre boost en lockant plus de tokens pour des périodes plus longues</p>
          <p className="mt-1">Les NPI sont distribués proportionnellement à votre boost</p>
        </div>
      </div>
    </div>
  );
}
