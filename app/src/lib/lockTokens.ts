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
import { 
  TOKEN_2022_PROGRAM_ID, 
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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
  console.log('🔍 [LOCK TX] Creating lock transaction...');
  console.log('🔍 [LOCK TX] Params:', params);
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }
  console.log('🔍 [LOCK TX] Wallet:', wallet.publicKey.toString());

  // Créer le provider Anchor
  const provider = new AnchorProvider(
    connection,
    wallet as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    { commitment: "confirmed" }
  );

  // Charger le programme
  console.log('🔍 [LOCK TX] Loading program...');
  const program = new Program(cnftIdl as Idl, provider);
  console.log('✅ [LOCK TX] Program loaded:', CNFT_PROGRAM_ID.toString());

  // Convertir le montant en lamports (9 decimals pour BACK)
  const amountLamports = new BN(Math.floor(params.amount * 1_000_000_000));
  const lockDuration = new BN(Math.floor(params.duration));
  console.log('🔍 [LOCK TX] Amount (lamports):', amountLamports.toString());
  console.log('🔍 [LOCK TX] Duration (seconds):', lockDuration.toString());

  console.log('🔍 [LOCK TX] Amount (lamports):', amountLamports.toString());
  console.log('🔍 [LOCK TX] Duration (seconds):', lockDuration.toString());

  // Dériver les PDAs
  console.log('🔍 [LOCK TX] Deriving PDAs...');
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Collection Config:', collectionConfig.toString());

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Global State:', globalState.toString());

  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] User NFT:', userNft.toString());

  // Vérifier si le user_nft existe déjà (lock_tokens utilise 'init' donc échouera si existant)
  console.log('🔍 [LOCK TX] Checking if user NFT already exists...');
  const userNftAccount = await connection.getAccountInfo(userNft);
  if (userNftAccount) {
    console.error('❌ [LOCK TX] User NFT already exists!');
    throw new Error(
      "❌ Vous avez déjà un NFT de lock actif. " +
      "Pour ajouter plus de tokens, vous devez d'abord déverrouiller (unlock) vos tokens actuels."
    );
  }
  console.log('✅ [LOCK TX] No existing user NFT found, can proceed');

  const vaultAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    CNFT_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Vault Authority:', vaultAuthority[0].toString());

  // Obtenir les token accounts
  console.log('🔍 [LOCK TX] Getting token accounts...');
  const userTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] User Token Account:', userTokenAccount.toString());

  // Le vault token account est dérivé automatiquement par Anchor via l'IDL
  // On peut le calculer pour info mais Anchor le fera aussi
  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority[0],
    true, // allowOwnerOffCurve = true pour PDA
    TOKEN_2022_PROGRAM_ID
  );
  console.log('✅ [LOCK TX] Vault Token Account (calculated):', vaultTokenAccount.toString());
  console.log('✅ [LOCK TX] Vault Token Account (calculated):', vaultTokenAccount.toString());

  // Construire l'instruction via Anchor
  console.log('🔍 [LOCK TX] Building instruction...');
  try {
    // Anchor convertit automatiquement lock_tokens en lockTokens
    const instruction = await program.methods
      .lockTokens(amountLamports, lockDuration)
      .accounts({
        collectionConfig,
        globalState,
        userNft,
        userTokenAccount,
        vaultTokenAccount, // On le passe quand même au cas où
        vaultAuthority: vaultAuthority[0],
        backMint: BACK_MINT,
        user: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    console.log('✅ [LOCK TX] Instruction created successfully');

    const transaction = new Transaction().add(instruction);
    console.log('✅ [LOCK TX] Transaction built successfully');

    return transaction;
  } catch (error) {
    console.error('❌ [LOCK TX] Error building instruction:', error);
    if (error instanceof Error) {
      console.error('❌ [LOCK TX] Error message:', error.message);
      console.error('❌ [LOCK TX] Error stack:', error.stack);
    }
    throw error;
  }
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
    wallet as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
