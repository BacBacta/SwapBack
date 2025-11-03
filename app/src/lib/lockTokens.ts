/**
 * Utilitaires pour verrouiller des tokens BACK avec transfert on-chain
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import cnftIdl from "@/idl/swapback_cnft.json";
import type { Idl } from "@coral-xyz/anchor";

// Program ID du programme swapback_cnft
export const CNFT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID ||
    "2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G"
);

// Mint du token BACK (Token-2022)
export const BACK_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_BACK_MINT ||
    "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
);

/**
 * Crée une transaction pour verrouiller des tokens BACK avec transfert on-chain
 */
export async function createLockTokensTransaction(
  connection: Connection,
  wallet: WalletContextState,
  params: {
    amount: number; // Montant en tokens (pas en lamports)
    duration: number; // Durée en secondes
  }
): Promise<Transaction> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  // Créer le provider Anchor
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    { commitment: "confirmed" }
  );

  // Charger le programme
  const program = new Program(cnftIdl as Idl, provider);

  // Convertir le montant en lamports (9 decimals pour BACK)
  const amountLamports = new BN(Math.floor(params.amount * 1_000_000_000));
  const lockDuration = new BN(Math.floor(params.duration));

  // Dériver les PDAs
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );

  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    CNFT_PROGRAM_ID
  );

  // Obtenir les token accounts
  const userTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // Le vault token account doit être créé manuellement ou via init_if_needed
  // Pour simplifier, on suppose qu'il sera créé par l'instruction
  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true, // allowOwnerOffCurve = true pour PDA
    TOKEN_2022_PROGRAM_ID
  );

  // Construire l'instruction via Anchor
  const instruction = await program.methods
    .lockTokens(amountLamports, lockDuration)
    .accounts({
      collectionConfig,
      globalState,
      userNft,
      userTokenAccount,
      vaultTokenAccount,
      vaultAuthority,
      backMint: BACK_MINT,
      user: wallet.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const transaction = new Transaction().add(instruction);

  return transaction;
}

/**
 * Crée une transaction pour déverrouiller des tokens BACK
 */
export async function createUnlockTokensTransaction(
  connection: Connection,
  wallet: WalletContextState
): Promise<Transaction> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  // Créer le provider Anchor
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    { commitment: "confirmed" }
  );

  // Charger le programme
  const program = new Program(cnftIdl as Idl, provider);

  // Dériver les PDAs
  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    CNFT_PROGRAM_ID
  );

  // Obtenir les token accounts
  const userTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true, // allowOwnerOffCurve = true pour PDA
    TOKEN_2022_PROGRAM_ID
  );

  // Construire l'instruction
  const instruction = await program.methods
    .unlockTokens()
    .accounts({
      userNft,
      globalState,
      userTokenAccount,
      vaultTokenAccount,
      vaultAuthority,
      backMint: BACK_MINT,
      user: wallet.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();

  const transaction = new Transaction().add(instruction);

  return transaction;
}
