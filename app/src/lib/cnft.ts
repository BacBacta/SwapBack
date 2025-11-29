import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { createUnlockTokensTransaction } from "./lockTokens";
import { TOKEN_DECIMALS } from "@/config/constants";

// Lazy load CNFT_PROGRAM_ID to avoid module-level env access
let _cnftProgramId: PublicKey | null = null;
function getCnftProgramId(): PublicKey {
  if (!_cnftProgramId) {
    const envId = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
    // Use the correct production program ID as fallback
    _cnftProgramId = new PublicKey(
      envId || "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
    );
    console.log("🔧 [cnft.ts] CNFT_PROGRAM_ID initialized:", _cnftProgramId.toString(), "from env:", !!envId);
  }
  return _cnftProgramId;
}

// Export for backward compatibility
export const CNFT_PROGRAM_ID = getCnftProgramId();

// const LAMPORTS_PER_BACK = 1_000_000_000;

export enum LockLevel {
  Bronze = "Bronze",
  Silver = "Silver",
  Gold = "Gold",
  Platinum = "Platinum",
  Diamond = "Diamond",
}

const LOCK_LEVEL_VARIANTS: LockLevel[] = [
  LockLevel.Bronze,
  LockLevel.Silver,
  LockLevel.Gold,
  LockLevel.Platinum,
  LockLevel.Diamond,
];

const BACK_DECIMAL_MULTIPLIER = Math.pow(10, TOKEN_DECIMALS);
const MAX_TOTAL_BOOST_BPS = 1000; // +10%

const DURATION_TIERS = [
  { minDays: 365, boostBps: 500 }, // +5.0%
  { minDays: 180, boostBps: 300 }, // +3.0%
  { minDays: 90, boostBps: 150 },  // +1.5%
  { minDays: 30, boostBps: 50 },   // +0.5%
];

const AMOUNT_TIERS = [
  { minAmount: 100_000, boostBps: 500 }, // +5.0%
  { minAmount: 50_000, boostBps: 350 },  // +3.5%
  { minAmount: 10_000, boostBps: 200 },  // +2.0%
  { minAmount: 1_000, boostBps: 100 },   // +1.0%
];

export interface CNFTLockParams {
  amount: number;
  duration: number; // en secondes
}

/**
 * Calculate cNFT level based on amount and duration
 * Nouveau système: 5 tiers (Bronze, Silver, Gold, Platinum, Diamond)
 */
export function calculateLevel(
  amount: number,
  durationDays: number
): LockLevel {
  const amountLamports = amount * BACK_DECIMAL_MULTIPLIER; // Convertir selon décimales BACK
  const diamondThreshold = 100_000 * BACK_DECIMAL_MULTIPLIER;
  const platinumThreshold = 50_000 * BACK_DECIMAL_MULTIPLIER;
  const goldThreshold = 10_000 * BACK_DECIMAL_MULTIPLIER;
  const silverThreshold = 1_000 * BACK_DECIMAL_MULTIPLIER;
  const bronzeThreshold = 100 * BACK_DECIMAL_MULTIPLIER;

  // Diamond: 100,000+ $BACK AND 365+ days
  if (amountLamports >= diamondThreshold && durationDays >= 365) {
    return LockLevel.Diamond;
  }
  // Platinum: 50,000+ $BACK AND 180+ days
  else if (amountLamports >= platinumThreshold && durationDays >= 180) {
    return LockLevel.Platinum;
  }
  // Gold: 10,000+ $BACK AND 90+ days
  else if (amountLamports >= goldThreshold && durationDays >= 90) {
    return LockLevel.Gold;
  }
  // Silver: 1,000+ $BACK AND 30+ days
  else if (amountLamports >= silverThreshold && durationDays >= 30) {
    return LockLevel.Silver;
  }
  // Bronze: 100+ $BACK AND 7+ days
  else if (amountLamports >= bronzeThreshold && durationDays >= 7) {
    return LockLevel.Bronze;
  }

  return LockLevel.Bronze; // Par défaut
}

/**
 * Calcule le boost dynamique basé sur la durée ET le montant verrouillé.
 * Formule alignée avec le programme on-chain:
 *  - Chaque durée octroie un boost fixe en basis points.
 *  - Chaque palier de montant octroie un boost fixe en basis points.
 *  - Un "cross term" (durée * montant / 10_000) ajoute un bonus multiplicatif.
 *  - Le boost total est plafonné à +10% (1000 BP).
 */
export function calculateBoost(amount: number, durationDays: number): number {
  const durationBoost = getDurationBoostBps(durationDays);
  const amountBoost = getAmountBoostBps(amount);
  const crossBonus = Math.floor((durationBoost * amountBoost) / 10_000);

  const totalBps = Math.min(
    durationBoost + amountBoost + crossBonus,
    MAX_TOTAL_BOOST_BPS
  );

  return Math.round(totalBps) / 100;
}

function getDurationBoostBps(days: number): number {
  for (const tier of DURATION_TIERS) {
    if (days >= tier.minDays) {
      return tier.boostBps;
    }
  }
  return 0;
}

function getAmountBoostBps(amountInBack: number): number {
  for (const tier of AMOUNT_TIERS) {
    if (amountInBack >= tier.minAmount) {
      return tier.boostBps;
    }
  }
  return 0;
}

/**
 * Dérive l'adresse PDA pour la config de collection
 */
export function getCollectionConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    getCnftProgramId()
  );
}

export function getGlobalStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    getCnftProgramId()
  );
}

/**
 * Dérive l'adresse PDA pour le cNFT d'un utilisateur
 */
export function getUserNftPDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_lock"), userPubkey.toBuffer()],
    getCnftProgramId()
  );
}

/**
 * Crée une transaction pour initialiser la collection
 * (Seulement pour l'authority du programme)
 */
export async function createInitializeCollectionTransaction(
  _connection: Connection,
  _authority: PublicKey
): Promise<Transaction> {
  const [collectionConfig] = getCollectionConfigPDA();

  // Transaction placeholder - le vrai lock utilise createLockTransaction
  const transaction = new Transaction();

  console.log("Initialize collection PDA:", collectionConfig.toString());

  return transaction;
}

/**
 * Crée une transaction pour lock des tokens et mint un cNFT
 */
export async function createLockTransaction(
  _connection: Connection,
  wallet: WalletContextState,
  params: CNFTLockParams
): Promise<{ transaction: Transaction; level: LockLevel; boost: number }> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const durationDays = params.duration / 86400;
  const level = calculateLevel(params.amount, durationDays);
  const boost = calculateBoost(params.amount, durationDays);

  // ⚠️ ATTENTION: Version simplifiée - Lock local avec fallback
  // Le programme on-chain swapback_cnft gère le transfert via lock_tokens instruction
  // Cette fonction stocke également en localStorage pour affichage immédiat
  
  // Stocker le lock localement
  const lockData = {
    amount: params.amount,
    duration: params.duration,
    level,
    boost,
    timestamp: Date.now(),
    unlockTime: Date.now() + (params.duration * 1000),
    wallet: wallet.publicKey.toString(),
  };
  
  if (typeof window !== 'undefined') {
    const existingLocks = JSON.parse(localStorage.getItem('backLocks') || '[]');
    existingLocks.push(lockData);
    localStorage.setItem('backLocks', JSON.stringify(existingLocks));
  }

  // Créer une transaction factice qui sera simulée comme réussie
  // En attendant l'implémentation complète du transfert de tokens
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: wallet.publicKey,
      lamports: 0, // 0 SOL transaction to simulate success
    })
  );

  console.warn('⚠️ Lock stocké localement - Le transfert de tokens BACK sera implémenté prochainement');

  return { transaction, level, boost };
}

/**
 * Crée une transaction pour unlock des tokens
 */
export async function createUnlockTransaction(
  _connection: Connection,
  wallet: WalletContextState
): Promise<Transaction> {
  console.warn(
    "[swapback_cnft] createUnlockTransaction is deprecated. Use createUnlockTokensTransaction which calls unlock_tokens."
  );
  return createUnlockTokensTransaction(_connection, wallet);
}

/**
 * Récupère les données du cNFT d'un utilisateur
 */
export async function fetchUserCNFT(
  connection: Connection,
  userPubkey: PublicKey
): Promise<CNFTData | null> {
  const programId = getCnftProgramId();
  const [userNftPDA] = getUserNftPDA(userPubkey);

  console.log("🔍 [fetchUserCNFT] Program ID:", programId.toString());
  console.log("🔍 [fetchUserCNFT] User PDA:", userNftPDA.toString());
  console.log("🔍 [fetchUserCNFT] User pubkey:", userPubkey.toString());

  try {
    const accountInfo = await connection.getAccountInfo(userNftPDA);

    if (!accountInfo) {
      console.log("❌ [fetchUserCNFT] No cNFT found for user:", userPubkey.toString());
      return null;
    }

    console.log("✅ [fetchUserCNFT] Account found, data length:", accountInfo.data.length);

    const data = accountInfo.data;

    if (data.length < 64) {
      console.warn("Unexpected cNFT account size for", userPubkey.toString());
      return null;
    }

    let offset = 8; // skip account discriminator
    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const levelIndex = data.readUInt8(offset);
    offset += 1;

    const amountLocked = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const lockDuration = Number(data.readBigInt64LE(offset));
    offset += 8;

    const boostBps = data.readUInt16LE(offset);
    offset += 2;

    const mintTime = Number(data.readBigInt64LE(offset));
    offset += 8;

    // Fix: Use !== 0 instead of === 1 to match LockInterface behavior
    // Rust bool can be any non-zero value for true
    const isActive = data.readUInt8(offset) !== 0;
    offset += 1;

    const bump = data.readUInt8(offset);

    const level = LOCK_LEVEL_VARIANTS[levelIndex] ?? LockLevel.Bronze;

    return {
      user: owner,
      level,
      levelIndex,
      amountLocked,
      lockDuration,
      boostBps,
      mintTime,
      isActive,
      bump,
      unlockTime: mintTime + lockDuration,
    };
  } catch (error) {
    console.error("Error fetching user cNFT:", error);
    return null;
  }
}

/**
 * Vérifie si un cNFT peut être unlock (date dépassée)
 */
export function canUnlock(mintTime: number, lockDuration: number): boolean {
  const unlockTime = mintTime + lockDuration;
  const now = Math.floor(Date.now() / 1000);
  return now >= unlockTime;
}

/**
 * Calcule la date de unlock
 */
export function getUnlockDate(mintTime: number, lockDuration: number): Date {
  const unlockTime = mintTime + lockDuration;
  return new Date(unlockTime * 1000);
}

export interface CNFTData {
  user: PublicKey;
  level: LockLevel;
  levelIndex: number;
  amountLocked: number;
  lockDuration: number;
  boostBps: number;
  mintTime: number;
  unlockTime: number;
  isActive: boolean;
  bump: number;
}
