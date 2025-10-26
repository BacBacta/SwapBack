import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";

// Program ID du programme swapback_cnft déployé
export const CNFT_PROGRAM_ID = new PublicKey(
  "CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH"
);

export enum LockLevel {
  Bronze = "Bronze",
  Silver = "Silver",
  Gold = "Gold",
  Platinum = "Platinum",
  Diamond = "Diamond",
}

export interface CNFTData {
  user: PublicKey;
  level: LockLevel;
  amountLocked: number;
  lockDuration: number;
  mintTime: number;
  isActive: boolean;
  bump: number;
}

export interface CNFTLockParams {
  amount: number;
  duration: number; // en secondes
}

/**
 * Calcule le niveau de cNFT basé sur le montant et la durée
 * Nouveau système: 5 tiers (Bronze, Silver, Gold, Platinum, Diamond)
 */
export function calculateLevel(
  amount: number,
  durationDays: number
): LockLevel {
  const amountLamports = amount * 1e9; // Convertir en lamports

  // Diamond: 100,000+ $BACK AND 365+ days
  if (amountLamports >= 100_000_000_000_000 && durationDays >= 365) {
    return LockLevel.Diamond;
  }
  // Platinum: 50,000+ $BACK AND 180+ days
  else if (amountLamports >= 50_000_000_000_000 && durationDays >= 180) {
    return LockLevel.Platinum;
  }
  // Gold: 10,000+ $BACK AND 90+ days
  else if (amountLamports >= 10_000_000_000_000 && durationDays >= 90) {
    return LockLevel.Gold;
  }
  // Silver: 1,000+ $BACK AND 30+ days
  else if (amountLamports >= 1_000_000_000_000 && durationDays >= 30) {
    return LockLevel.Silver;
  }
  // Bronze: 100+ $BACK AND 7+ days
  else if (amountLamports >= 100_000_000_000 && durationDays >= 7) {
    return LockLevel.Bronze;
  }

  return LockLevel.Bronze; // Par défaut
}

/**
 * Calcule le boost basé sur le montant et la durée
 * Nouveau système dynamique: amount_score (max 50%) + duration_score (max 50%)
 */
export function calculateBoost(amount: number, durationDays: number): number {
  // Amount score: (amount / 1,000) * 0.5, max 50%
  const amountScore = Math.min((amount / 1000) * 0.5, 50);
  
  // Duration score: (days / 10) * 1, max 50%
  const durationScore = Math.min((durationDays / 10) * 1, 50);
  
  // Total boost: max 100%
  return Math.min(amountScore + durationScore, 100);
}

/**
 * Dérive l'adresse PDA pour la config de collection
 */
export function getCollectionConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );
}

/**
 * Dérive l'adresse PDA pour le cNFT d'un utilisateur
 */
export function getUserNftPDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), userPubkey.toBuffer()],
    CNFT_PROGRAM_ID
  );
}

/**
 * Crée une transaction pour initialiser la collection
 * (Seulement pour l'authority du programme)
 */
export async function createInitializeCollectionTransaction(
  connection: Connection,
  authority: PublicKey
): Promise<Transaction> {
  const [collectionConfig] = getCollectionConfigPDA();

  // Pour l'instant, transaction simulée
  // TODO: Intégrer avec le vrai programme Anchor
  const transaction = new Transaction();

  console.log("Initialize collection PDA:", collectionConfig.toString());

  return transaction;
}

/**
 * Crée une transaction pour lock des tokens et mint un cNFT
 */
export async function createLockTransaction(
  connection: Connection,
  wallet: WalletContextState,
  params: CNFTLockParams
): Promise<{ transaction: Transaction; level: LockLevel; boost: number }> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const durationDays = params.duration / 86400;
  const level = calculateLevel(params.amount, durationDays);
  const boost = calculateBoost(params.amount, durationDays);

  const [collectionConfig] = getCollectionConfigPDA();
  const [userNft] = getUserNftPDA(wallet.publicKey);

  // Pour l'instant, transaction simulée
  // TODO: Intégrer avec le vrai programme Anchor
  const transaction = new Transaction();

  console.log("Lock transaction details:", {
    user: wallet.publicKey.toString(),
    userNftPDA: userNft.toString(),
    level,
    boost,
    amount: params.amount,
    duration: params.duration,
  });

  // Simulation: ajout d'une instruction vide pour tester
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: wallet.publicKey,
      lamports: 0,
    })
  );

  return { transaction, level, boost };
}

/**
 * Crée une transaction pour unlock des tokens
 */
export async function createUnlockTransaction(
  connection: Connection,
  wallet: WalletContextState
): Promise<Transaction> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const [userNft] = getUserNftPDA(wallet.publicKey);

  // Pour l'instant, transaction simulée
  // TODO: Intégrer avec le vrai programme Anchor
  const transaction = new Transaction();

  console.log("Unlock transaction details:", {
    user: wallet.publicKey.toString(),
    userNftPDA: userNft.toString(),
  });

  // Simulation: ajout d'une instruction vide pour tester
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: wallet.publicKey,
      lamports: 0,
    })
  );

  return transaction;
}

/**
 * Récupère les données du cNFT d'un utilisateur
 */
export async function fetchUserCNFT(
  connection: Connection,
  userPubkey: PublicKey
): Promise<CNFTData | null> {
  const [userNftPDA] = getUserNftPDA(userPubkey);

  try {
    const accountInfo = await connection.getAccountInfo(userNftPDA);

    if (!accountInfo) {
      console.log("No cNFT found for user:", userPubkey.toString());
      return null;
    }

    // TODO: Parser les données du compte avec Borsh
    // Pour l'instant, retourner null
    console.log("cNFT account found:", userNftPDA.toString());
    return null;
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
