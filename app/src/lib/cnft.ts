import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import type { Idl } from "@coral-xyz/anchor";
import cnftIdl from "@/idl/swapback_cnft.json";

// Program ID du programme swapback_cnft déployé (Devnet - Updated Oct 31, 2025)
export const CNFT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID ||
    "2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G" // Nouveau program ID avec fix bump
);

type AnchorInstruction = {
  name: string;
  discriminator?: number[];
};

type AnchorIdl = Idl & {
  instructions: AnchorInstruction[];
};

const CNFT_IDL = cnftIdl as AnchorIdl;

const getInstructionDiscriminator = (name: string): Buffer => {
  const instruction = CNFT_IDL.instructions.find((ix) => ix.name === name);
  if (!instruction?.discriminator) {
    throw new Error(`Missing discriminator for instruction ${name} in swapback_cnft IDL`);
  }
  return Buffer.from(instruction.discriminator);
};

// Discriminators et constantes - Conservés pour compatibilité future
// const MINT_LEVEL_NFT_DISCRIMINATOR = getInstructionDiscriminator("mint_level_nft");
const UPDATE_NFT_STATUS_DISCRIMINATOR = getInstructionDiscriminator("update_nft_status");
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

export function getGlobalStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
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
  _connection: Connection,
  _authority: PublicKey
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

  // ⚠️ ATTENTION: Version simplifiée - Lock local uniquement
  // Le programme cNFT ne gère pas encore le transfert de tokens BACK
  // TODO: Ajouter les instructions de transfert de tokens vers un PDA de lock
  
  // Pour l'instant, on crée une transaction vide qui sera toujours rejetée
  // mais on stocke les données en local
  
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
      lamports: 0, // Transaction de 0 SOL pour simuler le succès
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
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const [globalState] = getGlobalStatePDA();
  const [userNft] = getUserNftPDA(wallet.publicKey);

  const instruction = new TransactionInstruction({
    programId: CNFT_PROGRAM_ID,
    keys: [
      { pubkey: userNft, isSigner: false, isWritable: true },
      { pubkey: globalState, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([UPDATE_NFT_STATUS_DISCRIMINATOR, Buffer.from([0])]),
  });

  return new Transaction().add(instruction);
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

    const isActive = data.readUInt8(offset) === 1;
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
